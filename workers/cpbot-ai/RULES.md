# The underwriting rules — how to add them

This is the file that turns the assistant from a form into a specialist. It is
also the one file where a mistake costs someone a claim, so it is built so that
nothing goes in unless you put it there and signed your name to it.

**Nothing in `RULES` was written by an AI, and nothing should be.** I don't have
the insurer underwriting guides and I will not invent them — a plausible-looking
stability period that is wrong is worse than no rule at all. You have eighteen
years and the actual documents. This file holds your knowledge; the code around
it only applies it.

**Before you start:** check whether your broker agreements let you record these
rules at all. Some underwriting guides are explicitly confidential. That is why
this file lives in the Worker and never reaches the browser — a visitor cannot
read it and nor can a competitor — but confidentiality terms are yours to
confirm, not mine.

## What happens while the file is empty

Nothing breaks. With no rules, every pre-existing case returns `needs_review`
and goes to you, which is exactly what the site does today. The hard stops
(awaiting results, under investigation, recent admission, terminal prognosis,
travelling for treatment) already work without any rule, because they stop a
sale rather than enable one.

So you can add rules one at a time, starting with the conditions you see most,
and each one makes the assistant sharper without any risk in between.

## Two separate things

| | What it is | Who supplies it |
|---|---|---|
| `QUESTIONNAIRES` | What an insurer **asks** — their medical questionnaire, in their words | Transcribed from the insurer's own tool. A fact. |
| `RULES` | What the insurer **does with the answer** — stability windows, knockouts | Yours. Not derivable from the form. |

TuGo's is in, captured 2026-10-25 from shop.tugo.com. Two of its five questions
are flagged `complete: false` because the screenshots cut off mid-list — the
cardiovascular list after *Arteriosclerosis*, and the general list after
*Kidney disease requiring dialysis*. Finish those and clear the flag. **Do not
let anyone guess the missing items**; a questionnaire that is nearly right is
how someone answers "None" to a condition that was on the real form.

Three things that questionnaire told us, which are worth knowing whether or not
you ever write a rule:

- Cardiac events are asked as **recency bands** — under a year, one to five,
  over five — not as a date. "About a year ago" is the answer to pin down.
- Blood pressure turns on a **six-month medication-alteration window**, and only
  blood pressure.
- The condition lists use a **twelve-month lookback** and count a condition
  *"whether or not you received any medical care for it… including conditions
  controlled or managed by medication, a medical device, diet or exercise."*
  And the cancer catch-all **excludes** basal cell and squamous cell skin cancer
  and cancer in remission.

Whether any of that changes what TuGo will cover is your call, not the form's —
which is why it sits in `QUESTIONNAIRES` and not in `RULES`.

## The shape

```js
{
  insurer: "TuGo",
  plan: "Emergency Medical Single Trip",
  condition: "cardiac.stent",      // category, or category.detail
  ageBand: [60, 74],               // inclusive; omit if it does not vary
  maxAge: 89,                      // optional hard cap
  stabilityDays: 180,
  knockouts: ["angina_12m"],       // flags that rule this plan out
  source: {
    doc: "TuGo policy wording, January 2026",   // the document you read
    page: 14,                                   // optional
    verifiedBy: "Sertac",
    verifiedOn: "2026-10-25",                   // the day YOU checked it
  },
  reviewBy: "2027-01-31",          // when it must be checked again
}
```

### Riders

A rider is a paid add-on that buys a shorter stability window — TuGo's Unstable
Pre-existing Medical Condition rider is the one most people have never heard of.
Add them to the rule they belong to:

```js
  riders: [{
    name: "Unstable Pre-existing Medical Condition rider",
    stabilityDays: 7,
    maxAge: 79,
    note: "added premium; the condition still has to be stable for the shorter window",
    source: { doc: "TuGo policy wording, January 2026",
              verifiedBy: "Sertac", verifiedOn: "2026-10-25" },
  }],
```

A rider needs its own `source` and is held to the same bar as the rule: an
unverified or stale rider is never named to a visitor. **A rider never makes a
case green.** It costs more, it has its own age limit, and whether it is worth
the premium is your call — so it turns a dead end into a conversation, which is
the point. Without it, "your dose changed four months ago" ends the discussion.

Categories available: see `CONDITIONS` in `underwriting.js` — `cardiac`,
`stroke`, `cancer`, `diabetes`, `respiratory`, `bloodthin`, `kidney`, `liver`,
`bp`, `other`. Add one if you need it.

## The checklist for each rule

1. **Name the document.** Not "TuGo" — "TuGo policy wording, January 2026".
   If you cannot name where it came from, it does not go in.
2. **Put today's date in `verifiedOn`.** A verification expires after one year
   automatically, and an expired rule stops producing a green light on its own.
   Nobody has to remember.
3. **Set `reviewBy`** to whenever you next expect the wording to change — a
   renewal date, a product launch.
4. **Run the tests.** `npm test` from `workers/cpbot-ai`. They check that
   nothing you added can produce a green light it should not.

## What the tiers mean, and what the assistant may say

| Tier | When | What the visitor hears |
|---|---|---|
| `advisor_only` | a hard stop is true | the blocker, in plain words, the reason, and your number |
| `needs_review` | plausible but the wording decides it, **or any rule involved is unverified or stale** | what decides the case and why — never a conclusion |
| `likely_eligible` | a **verified, in-date** rule says insurers normally consider this, and nothing blocks it | which insurers normally consider a case like this, on what stability rule — and that you confirm it before anything is bought |

**`likely_eligible` is unreachable from an unverified rule.** That is enforced
in code, not in wording, and `underwriting.test.mjs` fails if it ever stops
being true.

The assistant is never allowed to say someone is insurable, approved, covered,
or uninsurable. It says what insurers normally do and what decides a case. You
decide. That is both the regulatory position under FSRA's fair-treatment
expectations and, frankly, the thing that makes someone phone you rather than
buy the wrong plan from a price comparison site.

## The number that actually matters

Every rule turns on `changeMonthsAgo` — months since *anything* about the
condition changed: a new medication, a dose change, a new symptom, a test, a
referral, an admission. Not the diagnosis date. Most visitors have never been
told the difference, and the assistant is instructed to explain it, because
explaining it is what makes someone trust that you know the subject.
