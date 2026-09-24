// Offline tests for Code.gs. Run: cd tools/lead-sorter && npm i --no-save @typesafe-ai/sdk && node test.mjs
// No API key or network needed: TypeSafe is replaced by a stub.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { TypeSafeClient, choice } from '@typesafe-ai/sdk';

const mod = { exports: {} };
vm.runInNewContext(readFileSync(new URL('./Code.gs', import.meta.url), 'utf8'), { module: mod, console });
const cs = mod.exports;
const L = cs.PRODUCT_LABELS;
// Code.gs runs in its own vm realm; copy results into this realm before deep comparison.
const same = (actual, expected, msg) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('ok -', name); };

// Stub TypeSafe: records what it was sent, returns a fixed answer.
const stub = (choice, confidence = 0.95) => {
  const calls = [];
  const ask = (state) => { calls.push(state); return { type: 'choice', choice, confidence }; };
  return { ask, calls };
};
// A Formspree notification body, laid out exactly as Formspree sends it
// (checked against real lead emails; the people and values here are made up).
const formspree = (pairs) => [
  "You've received a new form submission. --", '', '*New form submission on Cover & Protect Leads*', '',
  "Someone just submitted a form on coverandprotect.ca/. Here's what they had", 'to say:', '',
  pairs.map(([k, v]) => (v ? `${k}\n${v}` : k)).join('\n\n'), '',
  'Submitted 11:45 PM - 21 September 2026', 'Mark as spam', '<https://formspree.io/mark-spam?id=abc>', '',
  '[image: Formspree logo] <https://formspree.io>', '',
  'You are receiving this because you confirmed this email address on', 'Formspree.',
].join('\n');
const neverAsk = () => { throw new Error('TypeSafe should not be called'); };

await test('request body matches what the official SDK sends', async () => {
  let sent;
  const client = new TypeSafeClient({
    apiKey: 'test-key',
    fetch: async (url, init) => {
      sent = { url, init };
      const answers = { product: { type: 'choice', choice: 'visitor', confidence: 0.9, probabilities: {} } };
      return new Response(JSON.stringify({ model: 'jev', answers, usage: { input_tokens: 1, output_tokens: 1 } }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const state = { form: 'x', fields: { notes: 'hello' } };
  const q = cs.PRODUCT_QUESTION;
  await client.systemOne({ state, questions: { product: choice(q.instructions, q.criteria) } });
  assert.equal(sent.url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(new Headers(sent.init.headers).get('authorization'), 'Bearer test-key');
  assert.deepEqual(JSON.parse(JSON.stringify(cs.buildRequest(state))), JSON.parse(sent.init.body));
});

await test('every product the model can pick has a Gmail label', () => {
  for (const k of Object.keys(cs.PRODUCT_QUESTION.criteria)) {
    if (k !== 'unclear') assert.ok(L[k], k);
  }
});

await test('no message: page decides, no API call', () => {
  const body = formspree([['fname', 'Ana'], ['email', 'ana@example.com'], ['phone', '416-555-0100'], ['notes', ''], ['source_page', '/critical-illness.html']]);
  same(cs.decideLabels('New Lead - Critical Illness Quote - Cover&Protect', body, 'k', neverAsk), [L.critical_illness]);
});

await test('buy-online dropdown decides when there is no message', () => {
  const body = formspree([['coverage', 'Snowbird / long-stay coverage'], ['notes', 'ok']]);
  same(cs.decideLabels('New Lead - Buy Online Page - Cover&amp;Protect', body, 'k', neverAsk), [L.travel]);
});

await test('generic form with no message goes to review', () => {
  const body = formspree([['coverage', 'Not sure — need advice']]);
  same(cs.decideLabels('New Lead - Buy Online Page - Cover&amp;Protect', body, 'k', neverAsk), [cs.REVIEW_LABEL]);
});

await test('message overrides the page, and both labels show', () => {
  const { ask } = stub('super_visa');
  const body = formspree([['ages', '66, 68'], ['notes', 'My parents are applying for the Super Visa next month']]);
  same(cs.decideLabels('New Lead - Travel Insurance - Cover&amp;Protect', body, 'k', ask), [L.super_visa, L.travel]);
});

await test('message agrees with the page: one label', () => {
  const { ask } = stub('visitor');
  const body = formspree([['visitor_age', '61'], ['message', 'My sister is visiting from Turkey for 3 months'], ['product_interest', 'Visitor insurance']]);
  same(cs.decideLabels('New Visitor Insurance landing page lead - Cover & Protect', body, 'k', ask), [L.visitor]);
});

await test('low confidence falls back to the page', () => {
  const { ask } = stub('life_estate', 0.4);
  same(cs.decideLabels('New Lead - Health Insurance - Cover&amp;Protect', formspree([['notes', 'what options do I have for my family?']]), 'k', ask), [L.health_dental]);
});

await test('unclear on a generic form goes to review', () => {
  const { ask } = stub('unclear', 0.99);
  same(cs.decideLabels('New Lead - Travel Insurance Calculator Quote Request', formspree([['message', 'please call me back tomorrow']]), 'k', ask), [cs.REVIEW_LABEL]);
});

await test('contact details and attribution never reach TypeSafe', () => {
  const { ask, calls } = stub('savings');
  const body = formspree([
    ['fname', 'Ana'], ['lname', 'Silva'], ['email', 'ana@example.com'], ['phone', '(416) 555-0100'],
    ['utm_source', 'google'], ['gclid', 'abc123'], ['_next', 'https://coverandprotect.ca/thankyou.html?lead=1'],
    ['notes', 'Want to open an RESP. Reach me at ana.s@example.org or 6475550199.'],
    ['source_page', '/savings-plans.html'],
  ]);
  cs.decideLabels('New Lead - Savings Plans - Cover&amp;Protect', body, 'k', ask);
  const sent = JSON.stringify(calls[0]);
  for (const secret of ['Ana', 'Silva', 'example', '555', 'google', 'abc123', 'thankyou']) {
    assert.ok(!sent.includes(secret), `leaked ${secret}: ${sent}`);
  }
  assert.match(calls[0].fields.notes, /RESP.*\[email\].*\[phone\]/);
});

await test('parses the real Formspree layout, including empty fields', () => {
  same(cs.parseFields(formspree([
    ['fname', 'Ana'], ['ages', '65'], ['notes', ''], ['source_page', '/annual-multi-trip-travel-insurance.html'], ['product_interest', ''],
  ])), { fname: 'Ana', ages: '65', notes: '', source_page: '/annual-multi-trip-travel-insurance.html', product_interest: '' });
});

await test('multi-line and multi-paragraph messages stay in one field', () => {
  const f = cs.parseFields(formspree([['message', 'Hello,\nmy parents arrive in May.\n\nThey need the Super Visa policy.'], ['source_page', '/x.html']]));
  same(f.message, 'Hello, my parents arrive in May. They need the Super Visa policy.');
  same(f.source_page, '/x.html');
});

await test('Windows line endings parse the same', () => {
  same(cs.parseFields(formspree([['notes', 'need dental'], ['ages', '40']]).replace(/\n/g, '\r\n')), { notes: 'need dental', ages: '40' });
});

await test('unrecognised email layout: nothing parsed, page label, no API call', () => {
  same(cs.parseFields('notes: my parents need Super Visa cover'), {});
  same(cs.decideLabels('New Lead - Health Insurance - Cover&amp;Protect', 'Hi, my parents need Super Visa cover', 'k', neverAsk), [L.health_dental]);
});

await test('missing API key throws so the lead is retried later', () => {
  assert.throws(() => cs.decideLabels('New Lead - Health Insurance - Cover&amp;Protect', formspree([['notes', 'need dental for my whole family']]), '', neverAsk), /TYPESAFE_API_KEY/);
});

await test('every page subject on the site maps as intended', () => {
  const expected = {
    'Annual Multi-Trip Travel Insurance': 'travel', 'Best Super Visa Insurance': 'super_visa',
    'Buy Online Page': null, 'Cheapest Super Visa Insurance': 'super_visa', 'Critical Illness Quote': 'critical_illness',
    'Estate Planning': 'life_estate', 'Group Benefits': 'group_benefits', 'Health Insurance': 'health_dental',
    'Long-Term Care Planning': 'long_term_care', 'Savings Plans': 'savings', 'Snowbird Travel Insurance': 'travel',
    'Travel Insurance': 'travel', 'Travel Insurance Calculator Quote Request': null,
  };
  for (const [page, product] of Object.entries(expected)) assert.equal(cs.productFromForm('New Lead - ' + page, {}), product, page);
  assert.equal(cs.productFromForm('New Super Visa landing page lead - Cover & Protect', {}), 'super_visa');
  assert.equal(cs.productFromForm('New Visitor Insurance landing page lead - Cover & Protect', {}), 'visitor');
});

console.log(`\n${passed} tests passed`);
