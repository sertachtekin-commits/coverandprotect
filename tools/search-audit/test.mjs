// Offline tests: run `npm install && npm test` here. TypeSafe is replaced by a fake
// server behind the real SDK, so no API key or network is needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { answerRequest, auditSearch, buildIndex, matchRequest, readPage, report } from './lib.mjs';

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('ok -', name); };
const site = (f) => readPage(f, readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));

// Real SDK, fake server: records each request body and answers from `reply(body)`.
const fakeClient = (reply) => {
  const bodies = [];
  const client = new TypeSafeClient({
    apiKey: 'test',
    retry: { maxRetries: 0 },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      const answers = reply(body);
      return new Response(JSON.stringify({ model: 'jev', answers, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });
    },
  });
  return { ask: (req) => client.systemOne(req), bodies };
};
const choiceOf = (probabilities) => {
  const [choice, p] = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0];
  return { type: 'choice', choice, confidence: p, probabilities };
};

await test('reads title, description, headings and text, skipping scripts, nav and footer', () => {
  const p = readPage('x.html', `---\n---\n<html><head><title>Super Visa &amp; You</title>
    <meta name="description" content="Cost &amp; rules"></head><body><nav>Menu Home</nav>
    <h1>Super <em>Visa</em></h1><script>var secret=1</script><p>Costs &#36;1,200&nbsp;a year.</p>
    {% include buy-bar.html %}<footer>FSRA footer</footer></body></html>`);
  assert.equal(p.title, 'Super Visa & You');
  assert.equal(p.description, 'Cost & rules');
  assert.deepEqual(p.headings, ['Super Visa']);
  assert.equal(p.text, 'Super Visa Costs $1,200 a year.');
  assert.equal(p.url, 'https://coverandprotect.ca/x.html');
});

await test('shortlist puts the obvious real page first', () => {
  const files = ['blog-supervisa-refund.html', 'blog-rrsp-vs-tfsa.html', 'critical-illness.html', 'blog-will-ontario.html', 'visitor-insurance-canada.html'];
  const shortlist = buildIndex(files.map(site));
  assert.equal(shortlist('can I get a refund on super visa insurance')[0].file, 'blog-supervisa-refund.html');
  assert.equal(shortlist('rrsp vs tfsa')[0].file, 'blog-rrsp-vs-tfsa.html');
  assert.equal(shortlist('do I need a will')[0].file, 'blog-will-ontario.html');
  assert.deepEqual(shortlist('zzzz qqqq'), []);
});

await test('request 1 offers each shortlisted page plus "none", and asks buyer intent', async () => {
  const pages = [site('blog-supervisa-cost.html'), site('super-visa-insurance-ontario.html')];
  const { ask, bodies } = fakeClient(() => ({ page: choiceOf({ page_1: 0.8, page_2: 0.15, none: 0.05 }), buyer: { type: 'noul', noul: 0.3 } }));
  await ask(matchRequest('super visa insurance cost', pages));
  const b = bodies[0];
  assert.equal(b.model, 'jev-latest');
  assert.deepEqual(Object.keys(b.questions.page.criteria), ['page_1', 'page_2', 'none']);
  assert.equal(b.questions.page.type, 'choice');
  assert.equal(b.questions.buyer.type, 'noul');
  assert.equal(b.state.pages.page_1.url, 'https://coverandprotect.ca/blog-supervisa-cost.html');
  assert.ok(!('text' in b.state.pages.page_1), 'request 1 sends summaries, not full page text');
  assert.match(b.questions.page.criteria.page_2, /`pages\.page_2`/);
});

await test('request 2 scores the chosen page on a 5-level rubric with its text', () => {
  const r = answerRequest('rrsp vs tfsa', site('blog-rrsp-vs-tfsa.html'));
  assert.equal(r.questions.answer.type, 'score');
  assert.equal(r.questions.answer.criteria.length, 5);
  assert.ok(r.state.page.text.length > 500 && r.state.page.text.length <= 6000);
});

await test('audit: page found → second request scores it; competing pages detected', async () => {
  const pages = ['blog-supervisa-cost.html', 'cheapest-super-visa-insurance.html', 'blog-rrsp-vs-tfsa.html'].map(site);
  const { ask, bodies } = fakeClient((b) => b.questions.page
    ? { page: choiceOf({ page_1: 0.5, page_2: 0.4, none: 0.1 }), buyer: { type: 'noul', noul: 0.9 } }
    : { answer: { type: 'score', score: 2.2, confidence: 0.7, legend: {}, probabilities: {} } });
  const r = await auditSearch('cheapest super visa insurance', buildIndex(pages), ask);
  assert.equal(bodies.length, 2);
  assert.equal(r.answer, 2.2);
  assert.equal(r.buyer, 0.9);
  assert.equal(r.competing.length, 2);
  assert.ok(r.competing.every((p) => p.file.includes('super')));
});

await test('audit: "none" → gap with closest page, no second request', async () => {
  const pages = ['health-insurance.html', 'blog-health-dental-self-employed.html'].map(site);
  const { ask, bodies } = fakeClient(() => ({ page: choiceOf({ page_1: 0.2, page_2: 0.1, none: 0.7 }), buyer: { type: 'noul', noul: 0.6 } }));
  const r = await auditSearch('disability insurance for self-employed', buildIndex(pages), ask);
  assert.equal(bodies.length, 1);
  assert.equal(r.page, null);
  assert.ok(r.closest);
});

await test('audit: no page shares a word with the search → gap without any API call', async () => {
  const r = await auditSearch('zzzz qqqq', buildIndex([site('terms.html')]), () => { throw new Error('should not call'); });
  assert.equal(r.page, null);
  assert.match(r.note, /no page/);
});

await test('report sorts each section by readiness to buy and lists failures', () => {
  const p = (file) => ({ file, url: 'https://coverandprotect.ca/' + file });
  const md = report([
    { search: 'low buyer gap', page: null, buyer: 0.1, closest: p('a.html'), competing: [] },
    { search: 'high buyer gap', page: null, buyer: 0.9, closest: p('b.html'), competing: [] },
    { search: 'weak one', page: p('c.html'), buyer: 0.5, answer: 1.4, confidence: 0.9, competing: [p('c.html')] },
    { search: 'strong one', page: p('d.html'), buyer: 0.2, answer: 3.6, confidence: 0.4, competing: [p('d.html'), p('e.html')] },
    { search: 'broke', error: 'HTTP 500' },
  ], { date: '2026-01-01' });
  assert.ok(md.indexOf('high buyer gap') < md.indexOf('low buyer gap'));
  assert.match(md, /\*\*2\*\* searches with no page/);
  assert.match(md, /\| weak one \| \*\*50%\*\* \| \[c\.html\]\(https:\/\/coverandprotect\.ca\/c\.html\) \| 1\.4 \/ 4 \|/);
  assert.match(md, /## 3\.[\s\S]*strong one[\s\S]*## 4\./);
  assert.match(md, /## Failed[\s\S]*broke \| HTTP 500/);
  assert.match(md, /low certainty: strong one/);
});

console.log(`\n${passed} tests passed`);
