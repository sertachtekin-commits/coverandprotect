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

/* Every page, plus the homepage body (index.html is a thin wrapper around it),
   plus the machine-readable files AI assistants read as a statement of fact
   about the business. llms.txt went stale within a day of the panel being
   confirmed — it was still naming Empire Life and listing the insurers flat,
   with no travel/life split, while every page had been corrected. A file
   nothing checks is a file that drifts, and this is the one an assistant
   quotes. */
const files = [
  ...fs.readdirSync(root).filter(f => f.endsWith('.html')),
  '_includes/homepage-original.html',
  'llms.txt',
  'entity.json',
];
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/* ---------------------------------------------------------------------------
 * Where an insurer Sertac is NOT appointed with may still be named, and why.
 *
 * Sertac confirmed the life & health carriers on 2026-11-01 — Canada Life,
 * Desjardins, iA Financial, RBC Life and BMO Life, alongside Manulife — so
 * those are `confirmed` in INSURERS and this table no longer covers them.
 *
 * What is left is genuine EDITORIAL: a factual statement about an insurer the
 * practice does not place with. Comparing published market rates, or citing an
 * insurer's own appeal deadline, is useful content and claims no appointment.
 *
 * Empire Life has an empty list on purpose. It was named on four service pages
 * and the homepage, and Sertac did not include it when he confirmed the life &
 * health carriers. Read as deliberate and removed; the empty list is what
 * fails if it comes back without the boolean changing with it.
 * ------------------------------------------------------------------------ */
const ALLOWED = {
  /* editorial: PolicyAdvisor's published 180-day snowbird premium comparison,
     cited to them on the page. Market data, not a panel. */
  "GMS":         ['snowbird-travel-insurance-cost-by-age.html'],

  /* editorial: Allianz's own 180-day written-appeal deadline, given as an
     example of why a denial letter must be read immediately, plus a link to
     their claim page. Useful to a claimant whoever sold the policy. */
  "Allianz":     ['blog-how-to-make-travel-insurance-claim.html'],

  /* removed, and expected to stay removed */
  "Empire Life": [],
  "Travelance":  [],
};

console.log("--- the four confirmed insurers, and nobody else claimed ---");
{
  const p = panel();
  ok(p.confirmed.join(", ") === "Manulife, TuGo, 21st Century, TruStone Health, RIMI",
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

console.log("\n--- no page claims a number of insurers ---");
{
  /* "10+ Canadian insurers" was the headline claim, on twenty-odd lines
     including meta descriptions and JSON-LD. On travel pages it was simply
     wrong — the travel panel is four. On the homepage and about page it spanned
     the whole practice, where nine are confirmed "among others", so the number
     was arguably defensible and still not verifiable: he has not said how many
     the others are.
     Every count is now gone, replaced by wording that stays true whoever joins
     or leaves the panel. No page may quote one again. */
  const COUNT = /\b(\d+\+|more than ten|ten|eleven|twelve|thirteen|[1-9]\d)\s+(major\s+)?(top\s+)?(Canadian\s+)?insurers\b/i;
  const offenders = files.filter(f => COUNT.test(read(f)));
  ok(offenders.length === 0,
     `${files.length} pages checked, none quoting an insurer count` +
     (offenders.length ? ` — still claiming one: ${offenders.join(', ')}` : ''));
}

console.log("\n--- the assistant's panel is travel only, not every appointment ---");
{
  /* Three of the four travel insurers do not write life or group business, and
     the life carriers do not write travel. panel() filters on `books`, so a
     confirmed Canada Life appointment can never be offered to a snowbird. */
  const p = panel();
  const lifeOnly = INSURERS.filter(x => x.confirmed && !x.books.includes("travel"));
  ok(lifeOnly.length > 0, `${lifeOnly.length} confirmed insurers write life & health but not travel`);
  ok(lifeOnly.every(x => !p.confirmed.includes(x.name)),
     `none of them reaches the assistant (${lifeOnly.map(x => x.name).join(', ')})`);
  ok(INSURERS.every(x => Array.isArray(x.books) && x.books.length),
     "every insurer records which book of business it is for");
  ok(/must not name them here/.test(p.must_say),
     "and the model is told the other carriers exist but are not its to sell");
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
