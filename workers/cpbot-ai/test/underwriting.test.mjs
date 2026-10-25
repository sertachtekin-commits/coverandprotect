/* The invariants that make this layer safe to ship.
   A wrong green light here means someone with a stent buys the wrong plan and
   has a six-figure claim refused. Everything below exists to make that
   impossible by construction rather than by careful wording. */
import { assess, BLOCKERS, CONDITIONS, RULES, ruleIsTrusted,
         QUESTIONNAIRES, questionnaireFor, ALTERATION_EXCEPTIONS,
         SNOWBIRD_CHECKS } from '../underwriting.js';
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
  ok(RULES.every((r) => !ruleIsTrusted(r, TODAY)),
     `no shipped rule is trusted until it is signed off (${RULES.length} transcribed, 0 trusted)`);
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

console.log("\n--- a rider turns a dead end into a conversation, not into a yes ---");
{
  const withRider = verified({
    riders: [{
      name: "Unstable Pre-existing Medical Condition rider", stabilityDays: 7, maxAge: 79,
      note: "added premium",
      source: { doc: "Example wording 2026-01", verifiedBy: "Sertac", verifiedOn: "2026-09-01" },
    }],
  });
  /* Dose changed 4 months ago: misses the 180-day rule, clears a 7-day rider. */
  const recent = stentCase({ conditions: [{ category: "cardiac", detail: "stent", changeMonthsAgo: 4 }] });
  const r = assess(recent, { rules: [withRider], today: TODAY });

  ok(r.tier === "needs_review", `a rider never makes it green (tier ${r.tier})`);
  ok(r.insurers[0].status === "inside_window_rider_may_apply", "but the insurer is flagged as having a route");
  ok(r.insurers[0].rider_may_apply.stability_days === 7, "with the shorter window it buys");
  ok(r.riders_to_raise.length === 1, `and it is raised: ${r.riders_to_raise[0]}`);
  ok(/worth the premium/i.test(r.must_say) && /Do not promise it/i.test(r.must_say),
     "the model is told to offer it as a route, not a promise");
  ok(/stops looking/.test(r.must_say), "…and why that distinction earns the phone call");
}

console.log("\n--- an unverified rider is not named either ---");
{
  const unverifiedRider = verified({
    riders: [{ name: "Some rider", stabilityDays: 7, source: { doc: "hearsay" } }],
  });
  const recent = stentCase({ conditions: [{ category: "cardiac", changeMonthsAgo: 4 }] });
  const r = assess(recent, { rules: [unverifiedRider], today: TODAY });
  ok(r.riders_to_raise.length === 0, "an unsourced rider is never mentioned");
  ok(r.insurers[0].rider_may_apply === undefined, "and no route is implied from it");
}

console.log("\n--- a rider past its own age limit does not apply ---");
{
  const rule = verified({
    ageBand: [60, 95],
    riders: [{ name: "Rider", stabilityDays: 7, maxAge: 79, note: "",
      source: { doc: "Example wording 2026-01", verifiedBy: "Sertac", verifiedOn: "2026-09-01" } }],
  });
  const old84 = stentCase({ age: 84, conditions: [{ category: "cardiac", changeMonthsAgo: 4 }] });
  const r = assess(old84, { rules: [rule], today: TODAY });
  ok(r.riders_to_raise.length === 0, "an 84-year-old is not offered a rider capped at 79");
}

console.log("\n--- and a rider whose own window is still missed does not apply ---");
{
  const rule = verified({
    riders: [{ name: "Rider", stabilityDays: 90, note: "",
      source: { doc: "Example wording 2026-01", verifiedBy: "Sertac", verifiedOn: "2026-09-01" } }],
  });
  const lastWeek = stentCase({ conditions: [{ category: "cardiac", changeMonthsAgo: 0.25 }] });
  ok(assess(lastWeek, { rules: [rule], today: TODAY }).riders_to_raise.length === 0,
     "a change last week does not clear a 90-day rider either");
}

console.log("\n--- the generic-switch point people stop looking over ---");
{
  const r = assess(stentCase(), { rules: [verified()], today: TODAY });
  ok(r.deciding_factors.some(f => /equivalent generic/i.test(f)),
     "a reported change prompts the question of whether it was only a brand switch");
  ok(r.deciding_factors.some(f => /counts as an alteration at all/i.test(f)),
     "…against all five carve-outs, not just that one");
}

console.log("\n--- the things a specialist would raise unprompted ---");
{
  const r = assess(stentCase(), { rules: [verified()], today: TODAY });
  ok(r.deciding_factors.some(f => /five or more medications/i.test(f)), "six medications is raised");
  ok(r.deciding_factors.some(f => /120-day trip/.test(f)), "and a 120-day trip against the departure date");
}

console.log("\n--- SNOWBIRDS: losing provincial cover ends the eligibility, not just a benefit ---");
{
  const winter = (o) => ({ age: 72, tripDays: 150,
    conditions: [{ category: "cardiac", changeMonthsAgo: 9 }], ...o });
  const r = assess(winter({ provincialHealthCover: false }), { rules: [verified()], today: TODAY });
  ok(r.tier === "advisor_only" && r.insurers.length === 0,
     `OHIP lapsed or at risk -> ${r.tier}, no insurer named`);
  ok(/eligible for, or holding, a provincial/.test(r.blockers[0].why),
     "and it cites the residency definition that makes it an eligibility condition");
  ok(/opposite of what people assume/.test(r.blockers[0].why),
     "…and says why people get it wrong");

  /* Only fires when they actually say so — never guessed from a long trip. */
  ok(assess(winter({}), { rules: [verified()], today: TODAY }).tier !== "advisor_only",
     "a long trip on its own does not trigger it");
}

console.log("\n--- the other two eligibility stops in the wording ---");
for (const [label, extra] of [
  ["on a waiting list in Canada", { onWaitingListInCanada: true }],
  ["already left the province",   { alreadyDeparted: true }],
]) {
  const r = assess({ age: 72, tripDays: 150, conditions: [{ category: "cardiac", changeMonthsAgo: 9 }], ...extra },
                   { rules: [verified()], today: TODAY });
  ok(r.tier === "advisor_only", `${label} -> ${r.tier}`);
}

console.log("\n--- the long-winter questions a two-week traveller never faces ---");
{
  const r = assess({ age: 72, tripDays: 150, plan: "worldwide_excluding_usa",
                     conditions: [{ category: "cardiac", changeMonthsAgo: 9 }] },
                   { rules: [verified()], today: TODAY });
  const f = r.deciding_factors.join(" | ");
  ok(/per-trip day cap/.test(f), "an annual plan's per-trip cap, and that the clock runs Canada-to-Canada");
  ok(/terminates when you return to your province/.test(f), "what coming home mid-winter does to the policy");
  ok(/48 hours/.test(f) && /5 days each way/.test(f), "the USA transit limits on a worldwide-excluding-USA plan");
  ok(/\$15,000 USD/.test(f), "the extra deductible at 60+ for an inaccurate questionnaire answer");

  /* They are questions, not rulings — none of them blocks. */
  ok(r.tier !== "advisor_only", `none of them stops the conversation (${r.tier})`);
}

console.log("\n--- and they stay quiet for a traveller they do not apply to ---");
{
  const fortnight = assess({ age: 40, tripDays: 14, plan: "worldwide",
    conditions: [{ category: "cardiac", changeMonthsAgo: 9 }] }, { rules: [verified()], today: TODAY });
  const f = fortnight.deciding_factors.join(" | ");
  ok(!/per-trip day cap/.test(f), "a 14-day trip is not lectured about annual caps");
  ok(!/\$15,000 USD/.test(f), "and a 40-year-old is not told about the over-60 deductible");
  ok(SNOWBIRD_CHECKS.length === 4, `${SNOWBIRD_CHECKS.length} checks, each gated on the traveller it applies to`);
}

console.log("\n--- TuGo's stability table, transcribed from the policy wording ---");
{
  /* Signed-off copies, so we can test what the table does once Sertac activates
     it. The shipped rules stay unverified until he says otherwise. */
  const signed = RULES.map((r) => ({ ...r, source: { ...r.source, verifiedBy: "Sertac", verifiedOn: "2026-10-25" } }));
  const cse = (o) => ({ conditions: [{ category: "cardiac", changeMonthsAgo: 9 }], ...o });
  const band = (i) => {
    const r = assess(cse(i), { rules: signed, today: TODAY });
    return r.insurers.map((x) => x.stability_days);
  };
  ok(band({ age: 55, tripDays: 20 }).join() === "7",   "under 60, 35 days or less -> 7 days");
  ok(band({ age: 55, tripDays: 120 }).join() === "90", "under 60, over 35 days -> 90 days");
  ok(band({ age: 72, tripDays: 120 }).join() === "180","60 to 74 -> 180 days");
  ok(band({ age: 80, tripDays: 120 }).join() === "365","75 and over -> 365 days");
  ok(band({ age: 72, tripDays: 120, withinCanada: true }).join() === "0",
     "Travel Within Canada -> no stability requirement");
  ok(band({ age: 72, tripDays: 120 }).join() !== "180,0",
     "…and that domestic plan is not offered for a trip abroad");

  ok(RULES.every((r) => typeof r.quote === "string" && r.quote.length > 40),
     "every rule carries the verbatim line it came from");
  ok(/page 13 of the document/.test(RULES[0].source.doc), `and the page (${RULES[0].source.doc.slice(-30)})`);

  /* 9 months stable clears 180 but not 365. */
  const r72 = assess(cse({ age: 72, tripDays: 120 }), { rules: signed, today: TODAY });
  ok(r72.tier === "likely_eligible", `once signed off, a 72-year-old 9 months stable -> ${r72.tier}`);
  const r80 = assess(cse({ age: 80, tripDays: 120 }), { rules: signed, today: TODAY });
  ok(r80.tier === "needs_review", `but at 80, against a 365-day window -> ${r80.tier}`);
}

console.log("\n--- as shipped, none of it is active until Sertac signs it ---");
{
  ok(RULES.length === 5, `${RULES.length} rules transcribed`);
  ok(RULES.every((r) => r.source.verifiedBy === null), "every one is unverified");
  ok(RULES.every((r) => /Claude, from the PDF/.test(r.source.transcribedBy)), "…and says who transcribed it");
  ok(RULES.every((r) => !ruleIsTrusted(r, TODAY)), "so none is trusted");
  const r = assess({ age: 72, tripDays: 120, conditions: [{ category: "cardiac", changeMonthsAgo: 9 }] }, { today: TODAY });
  ok(r.tier === "needs_review", `and a clear-cut case still routes to him (${r.tier})`);
}

console.log("\n--- trip length decides the band under 60, so it is asked for ---");
{
  const r = assess({ age: 55, conditions: [{ category: "cardiac", changeMonthsAgo: 9 }] }, { today: TODAY });
  ok(r.deciding_factors.some((f) => /7 days for a trip of 35 days or less/.test(f)),
     "with no trip length, it explains why the number matters");
}

console.log("\n--- a Canadian trip is raised when an outbound window is the problem ---");
{
  const r = assess({ age: 80, tripDays: 120, conditions: [{ category: "cardiac", changeMonthsAgo: 2 }] }, { today: TODAY });
  ok(r.deciding_factors.some((f) => /no stability requirement/.test(f)),
     "someone who cannot clear a window is told a domestic trip has none");
}

console.log("\n--- the exclusions the wording actually lists ---");
for (const [label, extra] of [
  ["advised not to travel",        { advisedNotToTravel: true }],
  ["palliative care recommended",  { palliativeCare: true }],
  ["surgery or referral pending",  { procedureOrReferralPending: true }],
]) {
  const r = assess({ age: 72, tripDays: 30, conditions: [{ category: "cardiac", changeMonthsAgo: 9 }], ...extra }, { today: TODAY });
  ok(r.tier === "advisor_only" && r.insurers.length === 0, `${label} -> ${r.tier}`);
}
{
  const pending = BLOCKERS.find((b) => b.id === "awaiting_results");
  ok(/monitor an existing condition/.test(pending.nuance || ""),
     "a pending test still stops the sale, but the monitoring and screening carve-outs are explained");
}

console.log("\n--- what does NOT break a stability period ---");
{
  ok(ALTERATION_EXCEPTIONS.length === 5, `${ALTERATION_EXCEPTIONS.length} carve-outs from the definition of alteration`);
  const all = ALTERATION_EXCEPTIONS.join(" ");
  ok(/equivalent generic/.test(all), "the generic switch");
  ok(/insulin or oral diabetes/.test(all), "routine insulin and oral diabetes adjustments");
  ok(/blood thinner/.test(all) && /24 hours/.test(all), "blood thinner adjustments, and a 24-hour stop for surgery");
  ok(/combined into one/.test(all), "and medications being combined");
  const r = assess({ age: 72, tripDays: 30, conditions: [{ category: "cardiac", changeMonthsAgo: 4 }] }, { today: TODAY });
  ok(r.deciding_factors.some((f) => /counts as an alteration at all/.test(f)),
     "a reported change prompts the question of whether it counts at all");
}

console.log("\n--- the insurer's own questionnaire, in the insurer's words ---");
{
  const q = questionnaireFor("TuGo");
  ok(q.found === true && q.questions.length === 5, `TuGo: ${q.questions.length} questions`);
  ok(/shop\.tugo\.com/.test(q.source), `sourced to the tool it came from (${q.source})`);
  ok(QUESTIONNAIRES.tugo.source.verifiedBy === "Sertac", "and to the person who captured it");

  /* The details that make it worth having — each one is a fact on the form,
     and each one is something people routinely get wrong. */
  const all = JSON.stringify(q.questions);
  ok(/Less than 1 year ago/.test(all) && /More than 5 years ago/.test(all),
     "cardiac events are recency bands, not dates");
  ok(/alteration to medication in the last 6 months/.test(all),
     "the blood-pressure question turns on a six-month alteration window");
  ok(/controlled or managed by medication, a medical device, diet or exercise/.test(all),
     "a controlled condition still counts as a yes");
  ok(/Exclude basal cell and squamous cell skin cancer and\/or cancer that is in remission/.test(all),
     "cancer in remission is explicitly excluded from the catch-all");
  ok(/requiring prednisone/.test(all) && /requiring home oxygen/.test(all) && /requiring insulin/.test(all),
     "asthma, COPD and diabetes each split on severity");

  ok(/sets the (price|rate) band|rate category/i.test(q.purpose + q.must_say),
     "it is described as setting the rate, not deciding coverage");
  ok(/never tell anyone what their answers mean for eligibility/i.test(q.must_say),
     "and the model is told not to interpret it as eligibility");
}

console.log("\n--- what the screenshots cut off is marked, not guessed ---");
{
  const partial = questionnaireFor("TuGo").questions.filter((x) => x.complete === false);
  ok(partial.length === 2, `${partial.length} questions are flagged incomplete`);
  ok(partial.every((x) => /Sertac to complete/.test(x.incomplete_note || "")),
     "each says what is missing and who completes it");
}

console.log("\n--- an insurer with no questionnaire gets no invented one ---");
{
  const none = questionnaireFor("Acme Insurance");
  ok(none.found === false, "unknown insurer returns found:false");
  ok(/Do not invent one/.test(none.note), "…and tells the model not to make one up");
  ok(none.available.includes("TuGo"), `…while naming what is held: ${none.available.join(", ")}`);
}

console.log("\n--- nothing in here was invented by an AI ---");
{
  const src = fs.readFileSync(new URL('../underwriting.js', import.meta.url), 'utf8');
  /* The invariant is not "a human wrote every rule" — it is that nothing
     reaches a visitor as fact without a human signing it, and that anything
     unsigned says where it came from and carries the line it was taken from. */
  ok(RULES.every(r => r.source && (r.source.verifiedBy || (r.source.transcribedBy && r.quote))),
     "every rule is either signed off, or says who transcribed it and quotes its source");
  ok(RULES.filter(r => !r.source.verifiedBy).every(r => !ruleIsTrusted(r, TODAY)),
     "and nothing unsigned is ever trusted");
  ok(/Nothing in RULES was written by an AI/.test(src), "and the file says so where the next person will read it");
}

console.log(fail ? `\n${fail} FAILED` : "\nall underwriting tests passed");
process.exit(fail ? 1 : 0);
