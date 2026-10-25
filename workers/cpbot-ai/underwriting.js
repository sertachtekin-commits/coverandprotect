/* Pre-existing condition underwriting — the specialist layer.
 * ===========================================================================
 *
 * WHY THIS IS SERVER-SIDE. Everything else the assistant uses lives in
 * cpbot.js, which any visitor can read. This file does not: it holds Sertac's
 * underwriting knowledge, built over eighteen years, and insurer underwriting
 * guides are usually confidential under the broker agreement. It is served
 * from the Worker and never sent to the browser.
 *
 * WHAT THIS IS AND IS NOT. It does not decide whether anyone is insurable.
 * It sorts a case into one of three tiers and says what decides it, so the
 * assistant can show that it understands the problem and Sertac can start the
 * call already knowing the answer. The tiers:
 *
 *   advisor_only    something here stops an online purchase outright
 *   needs_review    plausible, but the wording decides it — a real conversation
 *   likely_eligible at least one VERIFIED rule says insurers normally consider
 *                   this, and nothing blocks it
 *
 * THE RULE THAT MATTERS. likely_eligible is reachable ONLY from a rule that
 * Sertac has personally verified against a named document, and only while that
 * verification is still in date. An unverified or expired rule can never
 * produce a green light — it caps at needs_review. Which means this file is
 * safe while it is empty: with no rules at all, everything routes to Sertac,
 * exactly as it does today, and each rule he signs off makes it sharper.
 *
 * Nothing in RULES was written by an AI. See RULES.md.
 */

/* ---- the taxonomy ------------------------------------------------------- */
/* Categories the intake can produce. Kept coarse on purpose: the assistant is
   triaging, not taking a medical history, and a long list invites a visitor to
   type something identifying. */
export const CONDITIONS = {
  cardiac:     "Heart condition (stent, bypass, angina, arrhythmia, heart attack)",
  stroke:      "Stroke or TIA",
  cancer:      "Cancer — current or past",
  diabetes:    "Diabetes",
  respiratory: "Lung or breathing condition (COPD, emphysema, asthma)",
  bloodthin:   "Blood thinners / anticoagulants",
  kidney:      "Kidney disease or dialysis",
  liver:       "Liver disease",
  bp:          "High blood pressure or cholesterol",
  other:       "Something else",
};

/* ---- hard stops --------------------------------------------------------- */
/* These are not insurer-specific and not a judgement call: while any of them is
   true, the stability clock has not started, so no insurer's pre-existing
   wording can be satisfied and no honest online purchase is possible. They are
   safe to encode without a rule because they stop a sale rather than enabling
   one — the failure mode is sending someone to a licensed advisor. */
export const BLOCKERS = [
  { id: "awaiting_results",
    when: (i) => i.awaitingResults === true,
    say: "a test, scan or specialist referral is still outstanding",
    why: "Until the result is in, the condition is under investigation. Every insurer treats that as unstable, and a claim connected to it would be refused however the policy was bought." },

  { id: "under_investigation",
    when: (i) => i.underInvestigation === true,
    say: "a symptom is currently being investigated",
    why: "An undiagnosed symptom is not a pre-existing condition yet — it is an open question, and insurers exclude anything it later turns out to be." },

  { id: "recent_hospitalisation",
    when: (i) => Number.isFinite(i.hospitalisedMonthsAgo) && i.hospitalisedMonthsAgo < 3,
    say: "a hospital stay in the last three months",
    why: "A recent admission restarts the stability clock on every plan, and most insurers decline outright inside 90 days." },

  { id: "terminal",
    when: (i) => i.terminalPrognosis === true,
    say: "a terminal prognosis",
    why: "No travel medical plan covers treatment for a terminal condition. There may still be options for the unrelated risks of the trip, which is a conversation worth having." },

  { id: "travelling_for_treatment",
    when: (i) => i.travellingForTreatment === true,
    say: "the trip is for medical treatment",
    why: "Travel medical insurance covers emergencies that arise abroad, never planned treatment — and knowing the trip's purpose can void the whole policy if it is not declared." },
];

/* ---- the rules ---------------------------------------------------------- */
/* EMPTY ON PURPOSE. Each entry is Sertac's, verified against a named document
   on a named date. See RULES.md for the shape and the checklist. Until a rule
   is added for a condition, that condition returns needs_review and the case
   goes to him — which is what happens today, so nothing regresses. */
export const RULES = [];

/* A verification is good for a year. Underwriting moves; a rule nobody has
   looked at since last winter is a guess wearing a citation. */
const VERIFICATION_VALID_DAYS = 365;

export function ruleIsTrusted(rule, today) {
  if (!rule || !rule.source) return false;
  if (!rule.source.verifiedBy || !rule.source.verifiedOn) return false;
  const on = Date.parse(rule.source.verifiedOn);
  if (!Number.isFinite(on)) return false;
  const now = (today instanceof Date ? today : new Date(today || Date.now())).getTime();
  if (now - on > VERIFICATION_VALID_DAYS * 86400000) return false;
  if (rule.reviewBy && Date.parse(rule.reviewBy) < now) return false;
  return true;
}

/* ---- the assessment ----------------------------------------------------- */

function monthsOrNull(v) { return Number.isFinite(v) ? v : null; }

/* The single number everything turns on: how long since anything about the
   condition changed. Insurers count a dose change, a new symptom, a test, a
   referral or an admission — not merely how long ago it was diagnosed. */
function monthsStable(c) {
  const since = monthsOrNull(c.changeMonthsAgo);
  if (since !== null) return since;
  return monthsOrNull(c.lastEventMonthsAgo);
}

function matches(rule, cond, intake) {
  if (rule.condition !== cond.category && rule.condition !== cond.category + "." + cond.detail) return false;
  if (Array.isArray(rule.ageBand) && Number.isFinite(intake.age)) {
    if (intake.age < rule.ageBand[0] || intake.age > rule.ageBand[1]) return false;
  }
  if (Number.isFinite(rule.maxAge) && Number.isFinite(intake.age) && intake.age > rule.maxAge) return false;
  return true;
}

export function assess(intake, opts) {
  const today = (opts && opts.today) || Date.now();
  const rules = (opts && opts.rules) || RULES;
  const i = intake && typeof intake === "object" ? intake : {};
  const conditions = Array.isArray(i.conditions) ? i.conditions : [];

  const blockers = BLOCKERS.filter((b) => { try { return b.when(i); } catch (_) { return false; } })
                           .map((b) => ({ id: b.id, say: b.say, why: b.why }));

  if (blockers.length) {
    return {
      tier: "advisor_only",
      blockers,
      insurers: [],
      deciding_factors: [],
      verified_rules_used: 0,
      must_say: "Do not give a price, a buy link, or an opinion on whether they can get covered. Name the blocker in plain words, give the reason, and put them on to Sertac — this is exactly the case he specialises in.",
    };
  }

  if (!conditions.length) {
    return { tier: "needs_review", blockers: [], insurers: [], deciding_factors: [],
      verified_rules_used: 0,
      must_say: "No condition details were given. Ask what the condition is and when anything about it last changed, then call this again." };
  }

  const insurers = [];
  const deciding = [];
  let anyUnknown = false;
  let anyInsideWindow = false;

  for (const c of conditions) {
    const stable = monthsStable(c);
    if (stable === null) {
      anyUnknown = true;
      deciding.push(`when anything about the ${CONDITIONS[c.category] || c.category} last changed — a dose, a test, a referral or a symptom, not the diagnosis date`);
      continue;
    }
    const candidates = rules.filter((r) => matches(r, c, i));
    if (!candidates.length) { anyUnknown = true; continue; }

    for (const r of candidates) {
      const trusted = ruleIsTrusted(r, today);
      const stableDays = stable * 30.4;
      const inside = stableDays < r.stabilityDays;
      if (inside) anyInsideWindow = true;
      const hit = (r.knockouts || []).filter((k) => (c.flags || []).includes(k));
      if (hit.length) { anyInsideWindow = true; deciding.push(`${r.insurer}: ${hit.join(", ")}`); continue; }

      insurers.push({
        insurer: r.insurer,
        plan: r.plan,
        stability_days: r.stabilityDays,
        clear_of_window: !inside,
        /* An unverified rule is information, never a green light. */
        status: trusted ? (inside ? "inside_window" : "normally_considered") : "unverified",
        source: trusted ? r.source.doc : undefined,
      });
      if (!trusted) deciding.push(`${r.insurer} ${r.plan}: this rule has not been verified since ${(r.source && r.source.verifiedOn) || "ever"} — Sertac confirms it against the current wording`);
    }
  }

  if (Number.isFinite(i.medicationCount) && i.medicationCount >= 5) {
    deciding.push("five or more medications — several insurers ask about the number and the most recent change to any of them, not just the condition");
  }
  if (Number.isFinite(i.tripDays) && i.tripDays > 60) {
    deciding.push(`a ${i.tripDays}-day trip — the stability period is measured to the departure date, and some plans shorten cover past 60 days`);
  }

  const green = insurers.filter((x) => x.status === "normally_considered");
  const tier = green.length && !anyUnknown && !anyInsideWindow ? "likely_eligible" : "needs_review";

  return {
    tier,
    blockers: [],
    insurers,
    deciding_factors: [...new Set(deciding)],
    verified_rules_used: green.length,
    must_say: tier === "likely_eligible"
      ? "Say which insurers normally consider a case like this and on what stability rule, in general terms. Never say they are covered or approved — say Sertac confirms it against the policy wording and their exact dates before anything is bought."
      : "Do not state a conclusion. Explain what decides the case and why it needs the actual wording, then hand to Sertac. Showing that you know what the question turns on is the point; answering it is not.",
  };
}
