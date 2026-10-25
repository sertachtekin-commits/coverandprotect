/* The invariants that make this layer safe to ship.
   A wrong green light here means someone with a stent buys the wrong plan and
   has a six-figure claim refused. Everything below exists to make that
   impossible by construction rather than by careful wording. */
import { assess, BLOCKERS, CONDITIONS, RULES, ruleIsTrusted } from '../underwriting.js';
import fs from 'node:fs';

let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };

const TODAY = Date.parse('2026-10-25');
const verified = (over) => Object.assign({
  insurer: "ExampleCo", plan: "Single Trip", condition: "cardiac", ageBand: [60, 79],
  stabilityDays: 180, knockouts: [],
  source: { doc: "Example wording 2026-01", verifiedBy: "Sertac", verifiedOn: "2026-09-01" },
  reviewBy: "2027-06-30",
}, over || {});

const stentCase = (over) => Object.assign({
  age: 72, medicationCount: 6, tripDays: 120,
  conditions: [{ category: "cardiac", detail: "stent", lastEventMonthsAgo: 14, changeMonthsAgo: 9 }],
}, over || {});

console.log("--- an unverified rule can never produce a green light ---");
{
  const unverified = verified({ source: { doc: "Someone's notes" } });
  const r = assess(stentCase(), { rules: [unverified], today: TODAY });
  ok(r.tier !== "likely_eligible", `tier is ${r.tier}, not likely_eligible`);
  ok(r.verified_rules_used === 0, "no verified rule was counted");
  ok(r.insurers[0].status === "unverified", "and the insurer is marked unverified");
  ok(r.insurers[0].source === undefined, "an unverified rule cites no source");
}

console.log("\n--- nor can a stale one ---");
{
  const stale = verified({ source: { doc: "Old wording 2024", verifiedBy: "Sertac", verifiedOn: "2024-01-05" } });
  ok(ruleIsTrusted(stale, TODAY) === false, "a verification over a year old is not trusted");
  ok(assess(stentCase(), { rules: [stale], today: TODAY }).tier !== "likely_eligible", "so the case cannot go green");
  const expired = verified({ reviewBy: "2026-01-01" });
  ok(ruleIsTrusted(expired, TODAY) === false, "nor is one past its review date");
}

console.log("\n--- with no rules at all it behaves exactly as the site does today ---");
{
  const r = assess(stentCase(), { rules: [], today: TODAY });
  ok(r.tier === "needs_review", "every case routes to the advisor");
  ok(r.insurers.length === 0, "and no insurer is named");
  ok(RULES.length === 0, "the shipped rule set is empty until Sertac fills it");
}

console.log("\n--- the hard stops stop everything, rules or no rules ---");
for (const [label, extra] of [
  ["a scan result still outstanding", { awaitingResults: true }],
  ["a symptom under investigation",   { underInvestigation: true }],
  ["a hospital stay six weeks ago",   { hospitalisedMonthsAgo: 1.5 }],
  ["a terminal prognosis",            { terminalPrognosis: true }],
  ["travelling for treatment",        { travellingForTreatment: true }],
]) {
  const r = assess(stentCase(extra), { rules: [verified()], today: TODAY });
  ok(r.tier === "advisor_only" && r.insurers.length === 0,
     `${label} -> ${r.tier}, no insurer named`);
  ok(r.blockers[0] && r.blockers[0].why.length > 40, `   …and says why: "${r.blockers[0].say}"`);
}

console.log("\n--- a verified rule, clear of the window, is the only way to green ---");
{
  const r = assess(stentCase(), { rules: [verified()], today: TODAY });
  ok(r.tier === "likely_eligible", `9 months stable against a 180-day rule -> ${r.tier}`);
  ok(r.insurers[0].status === "normally_considered" && r.insurers[0].source === "Example wording 2026-01",
     "the insurer is named with the document it came from");
  ok(/never say they are covered/i.test(r.must_say), "and the model is told not to claim they are covered");
}

console.log("\n--- inside the stability window is never green ---");
{
  const recent = stentCase({ conditions: [{ category: "cardiac", detail: "stent", lastEventMonthsAgo: 14, changeMonthsAgo: 2 }] });
  const r = assess(recent, { rules: [verified()], today: TODAY });
  ok(r.tier === "needs_review", `a dose change 2 months ago against a 180-day rule -> ${r.tier}`);
  ok(r.insurers[0].clear_of_window === false, "and the insurer is flagged as inside its window");
}

console.log("\n--- 'I don't know when it changed' is not treated as stable ---");
{
  const vague = stentCase({ conditions: [{ category: "cardiac", detail: "stent" }] });
  const r = assess(vague, { rules: [verified()], today: TODAY });
  ok(r.tier === "needs_review", `no dates -> ${r.tier}`);
  ok(r.deciding_factors.some(f => /last changed/i.test(f)), "and it asks for the one date that decides it");
}

console.log("\n--- the things a specialist would raise unprompted ---");
{
  const r = assess(stentCase(), { rules: [verified()], today: TODAY });
  ok(r.deciding_factors.some(f => /five or more medications/i.test(f)), "six medications is raised");
  ok(r.deciding_factors.some(f => /120-day trip/.test(f)), "and a 120-day trip against the departure date");
}

console.log("\n--- nothing in here was invented by an AI ---");
{
  const src = fs.readFileSync(new URL('../underwriting.js', import.meta.url), 'utf8');
  ok(RULES.length === 0 || RULES.every(r => r.source && r.source.verifiedBy),
     "every shipped rule carries a human verifier");
  ok(/Nothing in RULES was written by an AI/.test(src), "and the file says so where the next person will read it");
}

console.log(fail ? `\n${fail} FAILED` : "\nall underwriting tests passed");
process.exit(fail ? 1 : 0);
