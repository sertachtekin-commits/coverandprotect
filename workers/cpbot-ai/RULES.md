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
