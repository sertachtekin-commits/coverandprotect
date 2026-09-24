/**
 * Cover & Protect — lead sorter (Google Apps Script).
 *
 * Runs inside the Gmail inbox that receives the Formspree lead emails. Every
 * few minutes it finds unsorted lead emails, works out which product each lead
 * is about, and applies a Gmail label such as "Leads/Super Visa".
 *
 * Known rules stay in code: the page the form was on (the email subject) and
 * the buy-online "coverage" dropdown already name the product. TypeSafe is
 * only asked when the lead typed a message, because that is where people say
 * things the page can't know ("my parents' Super Visa" on the travel page,
 * "also need life insurance", "not sure what I need").
 *
 * Nothing on the website changes: forms still post to Formspree and the lead
 * email still arrives as before. If this script fails, the email just stays
 * unlabelled and is retried on the next run.
 *
 * Setup: see README.md in this folder.
 */

// ---- Settings ---------------------------------------------------------------

/** Gmail search for lead emails not yet sorted. Subjects come from each form's _subject field. */
const LEAD_QUERY =
  'subject:("New Lead" OR "landing page lead") newer_than:14d -label:leads-sorted';

/** Most emails handled per run, so a backlog can't run up a large API bill. */
const MAX_PER_RUN = 20;

/**
 * Minimum TypeSafe confidence to trust the message over the page it came
 * from. A starting point: raise it if you see wrong labels, lower it if too
 * many leads land in "Needs review".
 */
const MIN_CONFIDENCE = 0.7;

/** Messages shorter than this (e.g. "thanks", "call me") carry no product signal. */
const MIN_MESSAGE_CHARS = 15;

const TYPESAFE_URL = 'https://api.typesafe.ai/v1/systemone';
const TYPESAFE_MODEL = 'jev-latest';

const SORTED_LABEL = 'Leads/Sorted';
const REVIEW_LABEL = 'Leads/Needs review';

/** Product key → Gmail label. */
const PRODUCT_LABELS = {
  super_visa: 'Leads/Super Visa',
  visitor: 'Leads/Visitor to Canada',
  travel: 'Leads/Travel (outbound)',
  health_dental: 'Leads/Health & Dental',
  group_benefits: 'Leads/Group Benefits',
  critical_illness: 'Leads/Critical Illness',
  life_estate: 'Leads/Life & Estate',
  long_term_care: 'Leads/Long-Term Care',
  savings: 'Leads/Savings & Investments',
};

/**
 * Email subject → product, checked in order (first match wins). The
 * calculator and buy-online forms cover several products, so they map to
 * null and are decided by the dropdown or the message instead.
 */
const SUBJECT_RULES = [
  [/calculator/i, null],
  [/buy online/i, null],
  [/super visa/i, 'super_visa'],
  [/visitor/i, 'visitor'],
  [/travel|snowbird|multi-trip/i, 'travel'],
  [/health insurance/i, 'health_dental'],
  [/group benefits/i, 'group_benefits'],
  [/critical illness/i, 'critical_illness'],
  [/estate planning/i, 'life_estate'],
  [/long-term care/i, 'long_term_care'],
  [/savings/i, 'savings'],
];

/** buy-online.html "coverage" dropdown → product ("Not sure" is left to the message). */
const COVERAGE_RULES = {
  'super visa insurance': 'super_visa',
  'visitor to canada insurance': 'visitor',
  'travel insurance for a trip outside canada': 'travel',
  'snowbird / long-stay coverage': 'travel',
  'annual multi-trip plan': 'travel',
};

/**
 * Form fields never sent to TypeSafe: contact details and ad-click
 * attribution. Only what describes the coverage need leaves the inbox.
 */
const PRIVATE_FIELDS =
  /^(name|fname|lname|first_?name|last_?name|email|_?replyto|phone|tel|_next|_subject|utm_\w+|gclid|gbraid|wbraid|fbclid|landing_page|referrer)$/i;

/** Free-text fields a lead types into. */
const MESSAGE_FIELDS = ['notes', 'message'];

// ---- The TypeSafe question ---------------------------------------------------

const PRODUCT_QUESTION = {
  type: 'choice',
  instructions:
    'An insurance lead submitted a web form to an Ontario insurance advisor. ' +
    '`form` is the page the form was on; `fields` are what the person entered, ' +
    'including any message they typed. Which product is this person actually ' +
    'asking about? When the message names a need, it outweighs the page the ' +
    'form happened to be on. If several products are mentioned, pick the one ' +
    'they most want now.',
  criteria: {
    super_visa:
      'Super Visa medical insurance: parents or grandparents applying for or ' +
      'holding a Canadian Super Visa, needing the 1-year, $100,000+ policy ' +
      'the visa requires.',
    visitor:
      'Visitor to Canada insurance that is not for a Super Visa: visiting ' +
      'relatives or tourists, international students, workers, or new ' +
      'immigrants waiting for OHIP to start.',
    travel:
      'Travel insurance for Canadian residents leaving Canada: a trip abroad, ' +
      'snowbird or long stay in the US, or an annual multi-trip plan.',
    health_dental:
      'Individual or family health and dental insurance, including for the ' +
      'self-employed or people who lost workplace benefits.',
    group_benefits:
      'Group health and dental benefits that a business provides to its employees.',
    critical_illness:
      'Critical illness insurance: a lump sum paid on diagnosis of cancer, ' +
      'heart attack, stroke, or a similar illness.',
    life_estate:
      'Life insurance (term or whole life) or estate planning: wills, ' +
      'powers of attorney, protecting a family or mortgage after death.',
    long_term_care:
      'Long-term care insurance or planning: paying for care at home or in a ' +
      'care facility later in life.',
    savings:
      'Savings and investment plans: RRSP, TFSA, RESP, annuities, segregated ' +
      'funds, retirement income.',
    unclear:
      'None of the above can be told from what they wrote: no product is ' +
      'named or implied, they only ask for a call back, it is spam, or it is ' +
      'not about insurance.',
  },
};

// ---- Entry points --------------------------------------------------------------

/** Run by the time trigger. Also safe to run by hand from the editor. */
function sortLeads() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('TYPESAFE_API_KEY');
  const threads = GmailApp.search(LEAD_QUERY, 0, MAX_PER_RUN);
  const sortedLabel = getOrCreateLabel_(SORTED_LABEL);

  threads.forEach(function (thread) {
    const message = thread.getMessages()[0];
    let labels;
    try {
      labels = decideLabels(message.getSubject(), message.getPlainBody(), apiKey, callTypeSafe_);
    } catch (err) {
      // Leave the thread unsorted so the next run retries it.
      console.error('Lead not sorted, will retry: ' + thread.getId() + ' — ' + err);
      return;
    }
    labels.forEach(function (name) {
      thread.addLabel(getOrCreateLabel_(name));
    });
    thread.addLabel(sortedLabel);
  });
}

/** Run once by hand to start sorting every 10 minutes. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sortLeads') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sortLeads').timeBased().everyMinutes(10).create();
}

// ---- Decision logic (no Gmail calls, so it can be tested outside Apps Script) ---

/**
 * Returns the Gmail label names for one lead email.
 * `ask(state, apiKey)` returns a TypeSafe Choice answer: { choice, confidence }.
 */
function decideLabels(subject, body, apiKey, ask) {
  const fields = parseFields(body);
  const formProduct = productFromForm(subject, fields);
  const typed = MESSAGE_FIELDS.map(function (k) { return fields[k] || ''; }).join(' ').trim();

  // No real message: the form already says what they want.
  if (typed.length < MIN_MESSAGE_CHARS) {
    return [formProduct ? PRODUCT_LABELS[formProduct] : REVIEW_LABEL];
  }
  if (!apiKey) throw new Error('TYPESAFE_API_KEY script property is not set');

  const answer = ask({ form: subject, fields: publicFields(fields) }, apiKey);
  const confident = answer.choice !== 'unclear' && answer.confidence >= MIN_CONFIDENCE;

  if (confident) {
    const labels = [PRODUCT_LABELS[answer.choice]];
    // Page says one product, message another: show both so the advisor sees it.
    if (formProduct && formProduct !== answer.choice) labels.push(PRODUCT_LABELS[formProduct]);
    return labels;
  }
  return [formProduct ? PRODUCT_LABELS[formProduct] : REVIEW_LABEL];
}

/** Product named by the dropdown, else by the page (subject); null if neither says. */
function productFromForm(subject, fields) {
  const coverage = (fields.coverage || '').trim().toLowerCase();
  if (COVERAGE_RULES[coverage]) return COVERAGE_RULES[coverage];
  for (let i = 0; i < SUBJECT_RULES.length; i++) {
    if (SUBJECT_RULES[i][0].test(subject)) return SUBJECT_RULES[i][1];
  }
  return null;
}

/**
 * Parses a Formspree notification body into { field: value }. Formspree lists
 * each field as "name: value" or as the name on one line and the value on the
 * following line(s); both are handled. Unrecognised text is kept under
 * "email_text" so a format change degrades to less structure, not lost input.
 */
function parseFields(body) {
  const known = /^(_?[a-z][a-z0-9_]*)\s*:\s*(.*)$/i;
  const fields = {};
  const loose = [];
  let current = null;

  String(body || '').split(/\r?\n/).forEach(function (raw) {
    const line = raw.trim();
    if (!line) { current = null; return; }
    const m = line.match(known);
    if (m && !/^https?$/i.test(m[1])) {
      current = m[1].toLowerCase();
      fields[current] = m[2].trim();
    } else if (current) {
      fields[current] = (fields[current] ? fields[current] + ' ' : '') + line;
    } else {
      loose.push(line);
    }
  });
  if (loose.length && Object.keys(fields).length === 0) fields.email_text = loose.join(' ');
  return fields;
}

/** Copy of the fields with contact details dropped and stray emails/phone numbers masked. */
function publicFields(fields) {
  const out = {};
  Object.keys(fields).forEach(function (k) {
    if (PRIVATE_FIELDS.test(k) || !fields[k]) return;
    out[k] = redact(fields[k]).slice(0, 2000);
  });
  return out;
}

function redact(text) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[phone]');
}

// ---- Apps Script plumbing --------------------------------------------------------

function callTypeSafe_(state, apiKey) {
  const response = UrlFetchApp.fetch(TYPESAFE_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(buildRequest(state)),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('TypeSafe HTTP ' + status + ': ' + response.getContentText().slice(0, 300));
  }
  return JSON.parse(response.getContentText()).answers.product;
}

function buildRequest(state) {
  return { model: TYPESAFE_MODEL, state: state, questions: { product: PRODUCT_QUESTION } };
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// Lets test.mjs load this file in Node; Apps Script has no `module`.
if (typeof module !== 'undefined') {
  module.exports = {
    decideLabels, productFromForm, parseFields, publicFields, redact, buildRequest,
    PRODUCT_LABELS, PRODUCT_QUESTION, REVIEW_LABEL, LEAD_QUERY,
  };
}
