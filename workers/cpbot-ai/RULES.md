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

## TuGo's table is in, and waiting for your signature

Transcribed from the Traveller policy wording you supplied (page 13 of the
document, PDF page 18), verbatim, with the quote on each rule:

| Age on application date | Trip length | Stability period |
|---|---|---|
| 59 and under | 35 days or less | **7 days** before departure |
| 59 and under | over 35 days | **90 days** |
| 60 to 74 | all | **180 days** |
| 75 and over | all | **365 days** |
| any | Travel Within Canada | **no stability requirement at all** |

**They are inactive.** Every one carries `verifiedBy: null`. I transcribed them;
I did not sign them. Reading a table out of an insurance contract still takes
judgement — that one is headed *"Worldwide and Worldwide Excluding USA Plans"*,
and whether it also covers the Multi Trip Annual emergency medical is an
inference, not a quote — and it is your licence on the policy.

**To activate:** check the quotes against the PDF, then in each rule set

```js
  source: { ...TUGO_TRAVELLER, verifiedBy: "Sertac", verifiedOn: "2026-10-25" },
```

or just set those two fields on `TUGO_TRAVELLER` once. Until then they produce
`needs_review` and everything routes to you, exactly as an empty file did.

### Three things from the wording that are not rules but change the answer

- The age band is read on the **application date** — which the policy defines as
  the date the premium is paid — while stability is measured to the **date of
  departure**. Someone who turns 60 between those two dates is in the younger band.
- A **top-up** is measured on the **total** trip length, not the top-up days. A
  30-day top-up on a 90-day trip is a 90-day trip.
- **Trip Cancellation and Trip Interruption have their own, separate 60-day
  stability wording**, including for a travelling companion's conditions. Do not
  mix it with the emergency medical table.

### Snowbirds: what the wording says about a long winter away

These came out of the same PDF and are in the engine now. The first three stop
a sale; the rest are raised as questions.

**Provincial health coverage is an eligibility condition, not a benefit.** TuGo
defines a Canadian resident as someone *"eligible for or has a provincial or
territorial government health care plan in place"*. Lose OHIP by staying away
too long and the travel policy goes with it — the opposite of what most people
assume, since they expect the travel insurance to cover the gap. It cannot: the
deductible applies only after the provincial plan has paid.

**Also eligibility, from page 3 of the document:** not travelling against a
physician's or other registered medical practitioner's advice, no terminal
diagnosis, not receiving or recommended palliative care. Plus exclusion 14 —
registered on a waiting list in Canada for treatment or diagnosis — and
coverage is **void if bought after you leave your province**, or for a trip that
did not start in Canada.

**The annual multi-trip trap.** An annual plan covers unlimited trips but no
single trip beyond the cap contracted at application, and outside Canada that
clock runs *from leaving Canada to returning to Canada*. A 150-day winter on a
35-day cap is covered for 35 days. Travel within Canada but outside your own
province is automatically covered beyond the cap.

**Coming home mid-winter.** Coverage terminates when you return to your
province. One temporary visit is allowed without ending the policy — but only
if it was *unexpected or beyond your control*, and you are not covered while
home, with no refund for those days. A planned Christmas trip back is not that
exception. Worth re-reading alongside `snowbird-60-day-split-calculator.html`.

**Worldwide excluding USA, for someone driving south.** Stopovers or layovers up
to 48 hours, or transit by road or rail up to 5 days each way. A cruise that
departs from or calls at any US port needs the full Worldwide plan for the whole
trip.

**The $15,000 figure worth quoting to every client over 60.** For insureds 60
and over at the time of application, an answer on the Medical Questionnaire that
is not truthful and accurate carries an **extra $15,000 USD deductible** on any
claim, and no further coverage under the policy until the corrected premium is
paid. That is the best argument there is for going through those questions with
an advisor instead of guessing at a checkout.

### A correction

I told you earlier that TuGo has an optional *Unstable Pre-existing Medical
Condition* rider reducing the requirement to as little as 7 days under 80. That
came from a third-party website. **The words "unstable" and "rider" do not appear
anywhere in the 75 pages of this policy wording.** The 7-day figure in the real
table is the stability period for under-60s on trips of 35 days or less, which
is most likely what that site garbled.

The `riders` mechanism stays — it is built and tested, and riders do exist in
this market — but no TuGo rider is recorded, and none will be until you name one
from a document. This is exactly why the primary source matters.

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
