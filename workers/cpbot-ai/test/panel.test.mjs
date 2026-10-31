/* The site's copy, checked against the panel.
 *
 * On 2026-10-31 Sertac confirmed he places travel, visitor and Super Visa
 * business with four insurers: Manulife, TuGo, 21st Century and TruStone
 * Health. The site was claiming "10+ Canadian insurers" on twenty-odd lines
 * and naming thirteen companies across five mutually inconsistent lists — ten
 * on the about page, six on the Brampton page (three of which appeared nowhere
 * else), four on travel-insurance.html, and four more in
 * best-visitor-insurance-toronto.html's JSON-LD, which is the version search
 * engines and AI assistants read as fact.
 *
 * For a licensed advisor that is an accuracy problem in both directions, and
 * copy drifts back. This suite is what notices. It does not try to judge
 * whether a sentence is a sales claim — it asserts that the set of pages
 * naming an unconfirmed insurer is exactly the set recorded below, so adding
 * one anywhere new fails here and a human decides which kind of mention it is.
 */
import fs from 'fs';
import path from 'path';
import { INSURERS, panel } from '../underwriting.js';

const root = new URL('../../../', import.meta.url).pathname;
let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };

/* Every page, plus the homepage body (index.html is a thin wrapper around it). */
const files = [
  ...fs.readdirSync(root).filter(f => f.endsWith('.html')),
  '_includes/homepage-original.html',
];
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/* ---------------------------------------------------------------------------
 * Where an unconfirmed insurer may still be named, and why.
 *
 * Two kinds of entry, and the difference matters:
 *
 *   LIFE & HEALTH  — Canada Life, RBC Life, Desjardins, iA Financial, BMO Life
 *     and Empire Life are named on the health, group benefits, critical
 *     illness, long-term care and life pages. That is a different book of
 *     business from the one the assistant sells, and Sertac has not confirmed
 *     it either way. Unconfirmed is not the same as wrong, so the copy stands
 *     until he says. When he does, delete these entries and the pages
 *     together.
 *
 *   EDITORIAL — a factual statement about an insurer the practice does not
 *     place with. Comparing published market rates, or citing an insurer's own
 *     appeal deadline, is useful content and claims no appointment. These stay.
 * ------------------------------------------------------------------------ */
const ALLOWED = {
  /* life & health copy, pending Sertac's answer */
  "Canada Life":  ['about-sertac-tekin.html', 'health-insurance.html', 'group-benefits.html',
                   'critical-illness.html', 'long-term-care.html', '_includes/homepage-original.html'],
  "RBC Life":     ['about-sertac-tekin.html', 'critical-illness.html', 'long-term-care.html',
                   '_includes/homepage-original.html'],
  "Desjardins":   ['about-sertac-tekin.html', 'health-insurance.html', 'group-benefits.html',
                   'critical-illness.html', 'long-term-care.html', '_includes/homepage-original.html'],
  "iA Financial": ['about-sertac-tekin.html', 'health-insurance.html', 'group-benefits.html',
                   'critical-illness.html', 'long-term-care.html', '_includes/homepage-original.html'],
  "BMO Life":     ['about-sertac-tekin.html', 'critical-illness.html', 'long-term-care.html',
                   '_includes/homepage-original.html'],
  "Empire Life":  ['about-sertac-tekin.html', 'health-insurance.html', 'group-benefits.html',
                   'critical-illness.html', 'long-term-care.html', '_includes/homepage-original.html'],

  /* editorial: PolicyAdvisor's published 180-day snowbird premium comparison,
     cited to them on the page. Market data, not a panel. */
  "GMS":          ['snowbird-travel-insurance-cost-by-age.html'],

  /* editorial: Allianz's own 180-day written-appeal deadline, given as an
     example of why a denial letter must be read immediately, plus a link to
     their claim page. Useful to a claimant whoever sold the policy. */
  "Allianz":      ['blog-how-to-make-travel-insurance-claim.html'],

  /* nothing left: the Brampton and Super Visa guide claims are gone */
  "Travelance":   [],
};

console.log("--- the four confirmed insurers, and nobody else claimed ---");
{
  const p = panel();
  ok(p.confirmed.join(", ") === "Manulife, TuGo, 21st Century, TruStone Health",
     `panel(): ${p.confirmed.join(", ")}`);

  for (const ins of INSURERS.filter(x => !x.confirmed)) {
    /* Word boundaries, so "GMS" does not match inside another word and
       "RBC Life" is not found by a bare "RBC". */
    const re = new RegExp(`\\b${ins.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const found = files.filter(f => re.test(read(f))).sort();
    const allowed = (ALLOWED[ins.name] || []).slice().sort();
    const extra = found.filter(f => !allowed.includes(f));
    const gone  = allowed.filter(f => !found.includes(f));
    ok(extra.length === 0,
       `${ins.name}: named on ${found.length} page(s), all accounted for` +
       (extra.length ? ` — UNEXPECTED: ${extra.join(', ')}` : ''));
    if (gone.length) console.log(`         note: ${ins.name} no longer on ${gone.join(', ')} — tidy ALLOWED`);
  }
}

console.log("\n--- no travel or visitor page claims a panel it does not have ---");
{
  /* "10+ insurers" was the headline claim and it is four. These pages sell
     travel, visitor or Super Visa only, so the count is simply wrong on them.
     The about page and the homepage span the whole practice, including the
     unconfirmed life & health side, so they are excluded until that is settled
     — the one place the count may still appear. */
  const SPANS_WHOLE_PRACTICE = new Set([
    'about-sertac-tekin.html',
    'index.html',
    '_includes/homepage-original.html',
    'blog-super-visa-foreign-insurer-rules.html',        // advisor bio, whole practice
    'blog-travel-insurance-pre-existing-conditions.html', // advisor bio, whole practice
  ]);
  const COUNT = /\b(10\+|more than ten|ten|eleven|twelve|thirteen|[1-9]\d)\s+(major\s+)?(top\s+)?(Canadian\s+)?insurers\b/i;
  const offenders = files.filter(f => !SPANS_WHOLE_PRACTICE.has(f) && COUNT.test(read(f)));
  ok(offenders.length === 0,
     `${files.length - SPANS_WHOLE_PRACTICE.size} pages checked for an inflated insurer count` +
     (offenders.length ? ` — still claiming one: ${offenders.join(', ')}` : ''));
}

console.log("\n--- the removed travel claims stay removed ---");
{
  /* These three were named as travel insurers the practice compares. They are
     not on the panel, and the sentences that claimed them are gone. */
  for (const [name, page] of [
    ["GMS",        'super-visa-insurance-brampton.html'],
    ["Allianz",    'super-visa-insurance-brampton.html'],
    ["Travelance", 'super-visa-insurance-brampton.html'],
    ["GMS",        'super-visa-guide.html'],
    ["Travelance", 'super-visa-guide.html'],
    ["MSH International", 'super-visa-guide.html'],
  ]) {
    ok(!read(page).includes(name), `${name} is gone from ${page}`);
  }
}

console.log(fail ? `\n${fail} FAILED` : "\nall panel tests passed");
process.exit(fail ? 1 : 0);
