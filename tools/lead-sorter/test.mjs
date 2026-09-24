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
  const body = 'fname: Ana\nemail: ana@example.com\nphone: 416-555-0100\nnotes: \n';
  same(cs.decideLabels('New Lead - Critical Illness Quote - Cover&Protect', body, 'k', neverAsk), [L.critical_illness]);
});

await test('buy-online dropdown decides when there is no message', () => {
  const body = 'coverage: Snowbird / long-stay coverage\nnotes: ok\n';
  same(cs.decideLabels('New Lead - Buy Online Page - Cover&amp;Protect', body, 'k', neverAsk), [L.travel]);
});

await test('generic form with no message goes to review', () => {
  const body = 'coverage: Not sure — need advice\n';
  same(cs.decideLabels('New Lead - Buy Online Page - Cover&amp;Protect', body, 'k', neverAsk), [cs.REVIEW_LABEL]);
});

await test('message overrides the page, and both labels show', () => {
  const { ask } = stub('super_visa');
  const body = 'notes: My parents are applying for the Super Visa next month\n';
  same(cs.decideLabels('New Lead - Travel Insurance - Cover&amp;Protect', body, 'k', ask), [L.super_visa, L.travel]);
});

await test('message agrees with the page: one label', () => {
  const { ask } = stub('visitor');
  const body = 'message: My sister is visiting from Turkey for 3 months\n';
  same(cs.decideLabels('New Visitor Insurance landing page lead - Cover & Protect', body, 'k', ask), [L.visitor]);
});

await test('low confidence falls back to the page', () => {
  const { ask } = stub('life_estate', 0.4);
  same(cs.decideLabels('New Lead - Health Insurance - Cover&amp;Protect', 'notes: what options do I have for my family?', 'k', ask), [L.health_dental]);
});

await test('unclear on a generic form goes to review', () => {
  const { ask } = stub('unclear', 0.99);
  same(cs.decideLabels('New Lead - Travel Insurance Calculator Quote Request', 'message: please call me back tomorrow', 'k', ask), [cs.REVIEW_LABEL]);
});

await test('contact details and attribution never reach TypeSafe', () => {
  const { ask, calls } = stub('savings');
  const body = [
    'fname: Ana', 'lname: Silva', 'email: ana@example.com', 'phone: (416) 555-0100',
    'utm_source: google', 'gclid: abc123', '_next: https://coverandprotect.ca/thankyou.html?lead=1',
    'notes: Want to open an RESP. Reach me at ana.s@example.org or 647 555 0199.',
  ].join('\n');
  cs.decideLabels('New Lead - Savings Plans - Cover&amp;Protect', body, 'k', ask);
  const sent = JSON.stringify(calls[0]);
  for (const secret of ['Ana', 'Silva', 'example', '555', 'google', 'abc123', 'thankyou']) {
    assert.ok(!sent.includes(secret), `leaked ${secret}: ${sent}`);
  }
  assert.match(calls[0].fields.notes, /RESP.*\[email\].*\[phone\]/);
});

await test('value on the line after its field name is parsed', () => {
  same(cs.parseFields('notes:\nNeed coverage for\nmy two kids\n\nages: 34'), { notes: 'Need coverage for my two kids', ages: '34' });
});

await test('missing API key throws so the lead is retried later', () => {
  assert.throws(() => cs.decideLabels('New Lead - Health Insurance - Cover&amp;Protect', 'notes: need dental for my whole family', '', neverAsk), /TYPESAFE_API_KEY/);
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
