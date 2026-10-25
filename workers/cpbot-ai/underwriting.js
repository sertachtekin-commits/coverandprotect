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
  /* Added to match what TuGo's questionnaire actually asks about, so the intake
     maps onto the form rather than forcing everything into "other". */
  gastro:      "Stomach or bowel condition (ulcer, Crohn's, colitis, GERD)",
  thyroid:     "Thyroid condition",
  arthritis:   "Arthritis",
  dvt:         "Blood clot or DVT",
  aneurysm:    "Aortic aneurysm",
  other:       "Something else",
};

/* ---- what the insurer actually asks ------------------------------------- */
/* This is NOT the same thing as RULES, and keeping them apart is the point.
 *
 *   QUESTIONNAIRES = what an insurer asks.      A fact. Transcribed from the
 *                                               insurer's own tool.
 *   RULES          = what it does with the answer. Sertac's knowledge, and
 *                                               not derivable from the form.
 *
 * The questionnaire on its own is worth a lot. An assistant that can walk
 * someone through TuGo's real questions, in TuGo's words, sends them to the
 * quote tool already knowing their answers and sends Sertac a complete picture
 * instead of "my mother has a heart thing". It does that without claiming
 * anything about coverage. */
export const QUESTIONNAIRES = {
  tugo: {
    insurer: "TuGo",
    title: "Rate Qualification Questions (Medical Questionnaire)",
    /* TuGo's own material is explicit that the MQ sets the PRICE band. It is
       not the policy's pre-existing/stability wording, which is a separate
       document and is what a claim is actually assessed against. */
    purpose:
      "Determines the rate category for the quote. It is not the policy's pre-existing condition wording, and answering it does not mean a condition is covered.",
    note_on_accuracy:
      "TuGo states that if a Medical Questionnaire is required and an answer is not accurate and complete, an extra deductible may apply. Every question must be answered, including choosing None where nothing applies.",
    source: {
      doc: "TuGo online store Medical Questionnaire, shop.tugo.com, Step 2: Choose Plans",
      verifiedBy: "Sertac",
      verifiedOn: "2026-10-25",
      note: "Transcribed from screenshots of the live quote tool.",
    },
    reviewBy: "2027-04-30",
    questions: [
      {
        n: 1,
        verbatim: "Have you had any of the following? Choose the one most recent event.",
        complete: true,
        items: [
          "Myocardial infarction (heart attack), stroke or Transient Ischemic Attack (TIA, mini-stroke)",
          "Arterial by-pass, angioplasty and/or the placement of a stent for a cardiovascular condition",
        ],
        answers: ["Less than 1 year ago", "1 to 5 years ago", "More than 5 years ago", "None"],
        why:
          "Asked as recency bands, not as a date. Which band an event falls into is what moves the rate, so 'about a year ago' is the single answer worth pinning down before anyone runs a quote.",
      },
      {
        n: 2,
        verbatim: "Do you currently have hypertension also known as high blood pressure?",
        complete: true,
        answers: [
          "No",
          "Yes with no alteration to medication in the last 6 months",
          "Yes with an alteration to medication in the last 6 months",
        ],
        why:
          "The pivot is a SIX MONTH medication-alteration window, and it is asked only for blood pressure. An alteration is the dose or type going up, down, stopping, or a new medication starting — a switch to an equivalent generic is excluded. People on long-term blood pressure medication routinely answer this wrong in both directions.",
      },
      {
        n: 3,
        verbatim:
          "Have you had any of these conditions in the last 12 months? Choose a condition if, in the specified timeframe, you had the condition, whether or not you received any medical care for it. This includes conditions controlled or managed by medication, a medical device, diet or exercise.",
        complete: false,
        incomplete_note:
          "The CARDIOVASCULAR list was cut off in the source screenshots after 'Arteriosclerosis and/or atherosclerosis'. Sertac to complete.",
        groups: {
          CARDIOVASCULAR: [
            "Aortic aneurysm that is 4cm or larger",
            "Angina",
            "Congestive heart failure also known as pulmonary edema",
            "Coronary Artery Disease (CAD)",
            "Deep Vein Thrombosis (DVT)",
            "Arteriosclerosis and/or atherosclerosis",
          ],
          RESPIRATORY: [
            "Asthma requiring prednisone",
            "Asthma not requiring prednisone",
            "Two or more bronchitis episodes",
            "Pneumonia",
            "Chronic Obstructive Pulmonary Disease (COPD), including emphysema, requiring home oxygen",
            "Chronic Obstructive Pulmonary Disease (COPD), including emphysema, not requiring home oxygen",
            "None",
          ],
          GASTROINTESTINAL: [
            "Peptic ulcer either stomach or duodenal",
            "Crohn's disease, diverticulitis, inflammatory bowel disease, bowel obstruction and/or ulcerative colitis",
            "Gastroesophageal reflux disease (GERD) also known as chronic acid reflux",
            "None",
          ],
        },
        why:
          "Twelve-month lookback, and it counts a condition even with no treatment and even when it is controlled by medication, a device, diet or exercise. That catches people out: 'my asthma is fine, I just use an inhaler' is still a yes. Note the pairs that split on severity — asthma with or without prednisone, COPD with or without home oxygen — which is where the rate difference sits.",
      },
      {
        n: 4,
        verbatim:
          "Have you had any of these conditions in the last 12 months? Choose a condition if, in the specified timeframe, you had the condition, whether or not you received any medical care for it. This includes conditions controlled or managed by medication, a medical device, diet or exercise.",
        complete: false,
        incomplete_note:
          "The first list was cut off in the source screenshots after 'Kidney disease requiring dialysis'. Sertac to complete.",
        groups: {
          GENERAL: [
            "Arthritis",
            "Diabetes requiring insulin",
            "Diabetes not requiring insulin",
            "Gallbladder disease, including gallstones",
            "Hyperthyroidism",
            "Hypothyroidism",
            "Kidney stones",
            "Kidney disease requiring dialysis",
          ],
          CANCER: [
            "Pancreatic cancer",
            "Liver cancer",
            "Any type of cancer that has metastasized or that required a bone marrow transplant, excluding pancreatic or liver cancer",
            "Any other types of cancer. Exclude basal cell and squamous cell skin cancer and/or cancer that is in remission",
            "None",
          ],
        },
        why:
          "Cancer is not one question. Pancreatic and liver are each asked separately, metastasis or a bone marrow transplant is asked separately again, and the catch-all explicitly EXCLUDES basal cell and squamous cell skin cancer and cancer in remission. Someone whose cancer is in remission is often answering yes when the form does not ask them to. Diabetes splits on insulin, like asthma splits on prednisone.",
      },
      {
        n: 5,
        verbatim:
          "In the last 12 months, have you smoked any tobacco products, or vaped any nicotine products (including e-cigarettes)?",
        complete: true,
        answers: ["Yes", "No"],
        why: "Twelve-month lookback, and vaping counts.",
      },
    ],
  },
};

export function questionnaireFor(insurer) {
  const key = String(insurer || "").toLowerCase().replace(/[^a-z]/g, "");
  const q = QUESTIONNAIRES[key];
  if (!q) {
    return {
      found: false,
      available: Object.values(QUESTIONNAIRES).map((x) => x.insurer),
      note: "No questionnaire is recorded for that insurer. Do not invent one — say which you have and offer Sertac for the rest.",
    };
  }
  return {
    found: true,
    insurer: q.insurer,
    title: q.title,
    purpose: q.purpose,
    note_on_accuracy: q.note_on_accuracy,
    source: q.source.doc,
    questions: q.questions,
    must_say:
      "These are the insurer's own questions, so use their wording. Ask them a few at a time, not as a wall of text. Explain WHY a question matters — the recency band, the six-month alteration window, that a controlled condition still counts — because that is the part nobody tells people and it is what stops a questionnaire being answered wrong. This sets the price band; it does not decide whether a condition is covered. Never tell anyone what their answers mean for eligibility: summarise what they told you and hand it to Sertac.",
  };
}

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

/* A rider is a paid add-on that buys a shorter stability window — TuGo's
   Unstable Pre-existing Medical Condition rider is the one most people have
   never heard of. It matters because without it, "your dose changed four months
   ago" is a dead end, and with it there may still be a way to travel. It is
   never an automatic yes: it costs more, it has its own age limit, and whether
   it is worth the premium is a judgement call. So a rider turns a dead end into
   a conversation — it does not turn it green. */
function riderThatMayApply(rule, stableMonths, intake, today) {
  const riders = Array.isArray(rule.riders) ? rule.riders : [];
  for (const rider of riders) {
    /* Same bar as the rule itself: unverified means unnamed. */
    if (!ruleIsTrusted(rider, today)) continue;
    if (Number.isFinite(rider.maxAge) && Number.isFinite(intake.age) && intake.age > rider.maxAge) continue;
    if (!Number.isFinite(rider.stabilityDays)) continue;
    if (stableMonths * 30.4 < rider.stabilityDays) continue;
    return { name: rider.name, stability_days: rider.stabilityDays, note: rider.note };
  }
  return null;
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
  const riders = [];
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

      const rider = inside && trusted ? riderThatMayApply(r, stable, i, today) : null;
      if (rider) riders.push(`${r.insurer}: ${rider.name}`);

      insurers.push({
        insurer: r.insurer,
        plan: r.plan,
        stability_days: r.stabilityDays,
        clear_of_window: !inside,
        /* An unverified rule is information, never a green light. */
        status: trusted
          ? (inside ? (rider ? "inside_window_rider_may_apply" : "inside_window") : "normally_considered")
          : "unverified",
        rider_may_apply: rider || undefined,
        source: trusted ? r.source.doc : undefined,
      });
      if (!trusted) deciding.push(`${r.insurer} ${r.plan}: this rule has not been verified since ${(r.source && r.source.verifiedOn) || "ever"} — Sertac confirms it against the current wording`);
    }
  }

  /* A switch to an equivalent generic is excluded from the definition of an
     "alteration" in some wordings. People who changed brand often believe they
     have broken their stability period when they have not — and that belief is
     why they stop looking. Raise it; do not decide it. */
  if (conditions.some((c) => monthsStable(c) !== null) && i.changeWasGenericSwitch !== false) {
    deciding.push("whether that change was only a switch to an equivalent generic — some wordings do not count that as an alteration at all, which can leave the stability period unbroken");
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
    riders_to_raise: [...new Set(riders)],
    verified_rules_used: green.length,
    must_say: tier === "likely_eligible"
      ? "Say which insurers normally consider a case like this and on what stability rule, in general terms. Never say they are covered or approved — say Sertac confirms it against the policy wording and their exact dates before anything is bought."
      : riders.length
        ? "The standard wording would not cover this, but a rider in riders_to_raise may. Say so — that the usual stability window is not met, that there is an add-on built for exactly this, that it costs more and has its own limits, and that Sertac will say whether it is worth the premium. Do not promise it. A visitor told 'no' stops looking; a visitor told 'there is a route, and here is who decides it' picks up the phone."
        : "Do not state a conclusion. Explain what decides the case and why it needs the actual wording, then hand to Sertac. Showing that you know what the question turns on is the point; answering it is not.",
  };
}
