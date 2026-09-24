// Search & AI-visibility audit: the logic, kept free of I/O so it can be tested offline.
//
// For each search someone might type into Google or ask an AI assistant:
//   1. Code shortlists the site's pages most likely to be about it (keyword overlap).
//   2. TypeSafe picks which shortlisted page is really about that search, or "none",
//      and judges whether the searcher is ready to buy (one request, parallel questions).
//   3. If a page was picked, TypeSafe scores how directly that page answers the search
//      (second request: it needs the chosen page's full text).
//   4. Code turns the answers into a prioritised to-do report.
import { choice, noul, score } from '@typesafe-ai/sdk';

/** Pages that should never be recommended as the answer to a search. */
export const EXCLUDED_PAGES = new Set(['privacy-policy.html', 'terms.html', 'app.html', 'thankyou.html']);
export const SHORTLIST_SIZE = 6;
/** Two pages each above this share of the choice are competing for the same search. */
export const COMPETING_SHARE = 0.3;
/** Answer score below this (0–4 scale) means the page should answer the search more directly. */
export const WEAK_ANSWER = 3;
export const BUYER = 0.5;
const PAGE_TEXT_CHARS = 6000;

// ---- Reading pages -------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const textOf = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Title, description, headings and readable body text of one page. */
export function readPage(file, html) {
  const title = textOf(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const description = decode(html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '');
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html)
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|form|template)\b[\s\S]*?<\/\1>/gi, ' ');
  const headings = [...body.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => textOf(m[2])).filter(Boolean);
  return { file, url: 'https://coverandprotect.ca/' + (file === 'index.html' ? '' : file), title, description, headings, text: textOf(body) };
}

// ---- Shortlisting (code) -----------------------------------------------------------

const STOP = new Set('a an and are as at be by can do does for from get how i in is it my of on or the to what when where which who why with you your vs near me'.split(' '));
const tokens = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
  .filter((t) => t && !STOP.has(t)).map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));

/** Builds a scorer over all pages; URL, title, description and headings count more than body text. */
export function buildIndex(pages) {
  const docs = pages.map((p) => {
    const tf = new Map();
    const add = (s, w) => tokens(s).forEach((t) => tf.set(t, (tf.get(t) ?? 0) + w));
    add(p.file.replace(/\.html$/, '').replace(/-/g, ' '), 3);
    add(p.title, 3); add(p.description, 2); add(p.headings.join(' '), 2); add(p.text, 1);
    return { page: p, tf };
  });
  const df = new Map();
  docs.forEach((d) => d.tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const idf = (t) => Math.log(1 + docs.length / (df.get(t) ?? docs.length));
  return (search, n = SHORTLIST_SIZE) => {
    const q = [...new Set(tokens(search))];
    return docs
      .map((d) => ({ page: d.page, s: q.reduce((sum, t) => sum + Math.log(1 + (d.tf.get(t) ?? 0)) * idf(t), 0) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map((r) => r.page);
  };
}

// ---- TypeSafe questions -------------------------------------------------------------

/** Request 1: which shortlisted page is about this search, and is the searcher ready to buy. */
export function matchRequest(search, shortlist) {
  const pages = {};
  const criteria = {};
  shortlist.forEach((p, i) => {
    const key = `page_${i + 1}`;
    pages[key] = { url: p.url, title: p.title, description: p.description, headings: p.headings.slice(0, 12) };
    criteria[key] = `The page at \`pages.${key}\` is mainly about what this searcher wants, so it is the page that should come up for this search.`;
  });
  criteria.none =
    'None of the pages is mainly about what this searcher wants. Pages that only mention the topic ' +
    'in passing do not count; the site would need a new page or a new section to answer it.';
  return {
    state: { search, pages },
    questions: {
      page: choice(
        'Someone typed `search` into Google or asked an AI assistant. `pages` are candidate pages from ' +
        'the website of a licensed insurance advisor in Toronto, Ontario. Which page is mainly about ' +
        'what this person wants to know or buy?',
        criteria,
      ),
      buyer: noul(
        'Is the person who searched `search` likely ready to get a quote or buy insurance soon, ' +
        'rather than researching or looking for general information?',
      ),
    },
  };
}

export const ANSWER_LEVELS = [
  'The page does not answer the search at all.',
  'The page touches on the topic, but someone who searched this would not find their answer.',
  'The answer is on the page but vague, generic, or buried far down.',
  'The page answers it clearly with specifics, but not near the top or not in one passage that could be quoted on its own.',
  'Near the top, the page gives a direct, specific answer in a sentence or short paragraph that a search snippet or AI assistant could quote as-is.',
];

/** Request 2: how directly the chosen page answers the search. */
export function answerRequest(search, page) {
  return {
    state: { search, page: { url: page.url, title: page.title, text: page.text.slice(0, PAGE_TEXT_CHARS) } },
    questions: {
      answer: score(
        'Someone typed `search` into Google or asked an AI assistant. How directly and completely does ' +
        '`page.text` answer it?',
        ANSWER_LEVELS,
      ),
    },
  };
}

// ---- Running --------------------------------------------------------------------------

/** Audits one search. `ask(request)` is client.systemOne. */
export async function auditSearch(search, shortlistFor, ask) {
  const shortlist = shortlistFor(search);
  if (!shortlist.length) return { search, page: null, buyer: null, note: 'no page mentions these words' };

  const { answers: m } = await ask(matchRequest(search, shortlist));
  const byKey = Object.fromEntries(shortlist.map((p, i) => [`page_${i + 1}`, p]));
  const shares = Object.entries(m.page.probabilities)
    .filter(([k]) => k !== 'none')
    .map(([k, share]) => ({ page: byKey[k], share }))
    .sort((a, b) => b.share - a.share);
  const result = {
    search,
    buyer: m.buyer.noul,
    page: m.page.choice === 'none' ? null : byKey[m.page.choice],
    confidence: m.page.confidence,
    closest: shares[0]?.page ?? null,
    competing: shares.filter((s) => s.share >= COMPETING_SHARE).map((s) => s.page),
  };
  if (result.page) {
    const { answers: a } = await ask(answerRequest(search, result.page));
    result.answer = a.answer.score;
  }
  return result;
}

// ---- Report -----------------------------------------------------------------------------

const pct = (x) => (x == null ? '–' : Math.round(x * 100) + '%');
const link = (p) => (p ? `[${p.file}](${p.url})` : '–');
const esc = (s) => String(s).replace(/\|/g, '\\|');
const byBuyer = (a, b) => (b.buyer ?? 0) - (a.buyer ?? 0);
const table = (head, rows) => rows.length
  ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n')
  : '_None._';

export function report(results, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const ok = results.filter((r) => !r.error);
  const gaps = ok.filter((r) => !r.page).sort(byBuyer);
  const weak = ok.filter((r) => r.page && r.answer < WEAK_ANSWER).sort(byBuyer);
  const competing = ok.filter((r) => r.competing?.length > 1).sort(byBuyer);
  const strong = ok.filter((r) => r.page && r.answer >= WEAK_ANSWER).sort(byBuyer);
  const failed = results.filter((r) => r.error);
  const buyerTag = (r) => (r.buyer >= BUYER ? `**${pct(r.buyer)}**` : pct(r.buyer));

  return `# Search & AI visibility audit — ${date}

${results.length} searches checked against the site's pages with TypeSafe.
"Ready to buy" is TypeSafe's probability that the searcher wants a quote or policy soon; work top-down.
"Answer" is how directly the page answers the search, 0 (not at all) to 4 (a quotable answer near the top).

- **${gaps.length}** searches with no page about them — write a page or section
- **${weak.length}** searches whose page answers weakly — put a direct answer near the top
- **${competing.length}** searches where two or more pages compete — make one page the clear answer and link the others to it
- **${strong.length}** searches answered well${failed.length ? `\n- **${failed.length}** searches failed to check (see the end)` : ''}

## 1. No page is about these searches

${table(['Search', 'Ready to buy', 'Closest page', 'Note'], gaps.map((r) => [r.search, buyerTag(r), link(r.closest), r.note ?? '']))}

## 2. The right page exists but answers weakly

${table(['Search', 'Ready to buy', 'Page', 'Answer'], weak.map((r) => [r.search, buyerTag(r), link(r.page), r.answer.toFixed(1) + ' / 4']))}

## 3. Pages competing for the same search

${table(['Search', 'Ready to buy', 'Competing pages'], competing.map((r) => [r.search, buyerTag(r), r.competing.map(link).join(', ')]))}

## 4. Answered well

${table(['Search', 'Ready to buy', 'Page', 'Answer'], strong.map((r) => [r.search, buyerTag(r), link(r.page), r.answer.toFixed(1) + ' / 4']))}
${failed.length ? `\n## Failed\n\n${table(['Search', 'Error'], failed.map((r) => [r.search, r.error]))}\n` : ''}
_Page matches with low certainty: ${ok.filter((r) => r.confidence != null && r.confidence < 0.5).map((r) => r.search).join('; ') || 'none'}._
`;
}
