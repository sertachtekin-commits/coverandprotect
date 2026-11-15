# Blog topic queue

This file drives the biweekly blog Routine. Each run picks the **first
unchecked** topic below whose target file does not already exist, writes the
article following the conventions in `CLAUDE.md`, wires it into `blog.html`,
`sitemap.xml`, `feed.xml` and `llms.txt`, checks the box here, and opens a
**pull request for review**. It never publishes to `main` on its own.

**You control this file.** Add, remove or reorder topics freely. To pause the
automation, disable the Routine or delete this file. To prioritise a topic,
move it to the top.

## How to write a line

`- [ ] <exact-filename-without-.html> — Title → funnel-page.html`

The first field must be the **exact filename the article will be saved as**,
minus `.html`. The Routine checks whether that file already exists before
writing, and a slug that does not match the real naming convention defeats that
check — which is how near-duplicates of published articles get written. Confirm
against `ls *.html` before adding a line.

## Pending

- [ ] blog-long-term-care-cost — How Much Does Long-Term Care Cost in Ontario? (2026) → long-term-care.html
- [ ] blog-estate-planning-basics — Estate Planning in Ontario: A Starter Guide for Families → estate-planning.html
- [ ] travel-insurance-cancer-remission — Travel Insurance After Cancer: What "In Remission" Means to an Insurer → travel-insurance.html
- [ ] travel-insurance-copd-lung — Travel Insurance With COPD or a Lung Condition → travel-insurance.html

## Published

These exist on `main`. They are listed so the Routine does not rewrite them
under a slightly different slug, which is the failure this file exists to stop.

- [x] blog-supervisa-requirements — Super Visa Insurance Requirements in 2026: The Complete Checklist
- [x] blog-super-visa-vs-visitor-insurance — Super Visa vs Visitor Insurance
- [x] blog-supervisa-cost — How Much Does Super Visa Insurance Cost in Canada?
- [x] blog-supervisa-refund — Is Super Visa Insurance Refundable?
- [x] blog-super-visa-foreign-insurer-rules — Super Visa Insurance From a Foreign Insurer
- [x] blog-resp-cesg-explained — RESP & CESG Explained
- [x] blog-rrsp-vs-tfsa — RRSP vs TFSA
- [x] blog-critical-illness-worth-it — Is Critical Illness Insurance Worth It?
- [x] blog-health-dental-self-employed — Health & Dental for the Self-Employed
- [x] blog-group-benefits-small-business — Group Benefits for Small Business
- [x] blog-will-ontario — Why Every Ontario Family Needs a Will
- [x] blog-power-of-attorney-ontario — Powers of Attorney in Ontario
- [x] blog-term-vs-whole-life — Term vs Whole Life
- [x] blog-how-much-life-insurance — How Much Life Insurance Do You Need?
- [x] blog-ohip-visitors — Does OHIP Cover Visitors to Canada?
- [x] blog-travel-insurance-canadians — Travel Insurance for Canadians Going Abroad
- [x] blog-travel-insurance-pre-existing-conditions — Travel Insurance and Pre-Existing Conditions
- [x] blog-usa-vs-worldwide-travel-insurance — USA vs Worldwide Travel Insurance
- [x] blog-how-to-make-travel-insurance-claim — How to Make a Travel Insurance Claim
- [x] blog-snowbird-travel-insurance — Snowbird Travel Insurance for Florida & Arizona
- [x] mortgage-life-insurance-vs-term-life — Mortgage Life Insurance vs Term Life
- [x] ohip-waiting-period-newcomers — Is There Still a Three-Month OHIP Wait?
- [x] travel-insurance-seniors-canada — Travel Insurance for Seniors
- [x] travel-insurance-diabetes-canada — Travel Insurance With Diabetes
- [x] travel-insurance-heart-conditions-canada — Travel Insurance With a Heart Condition
- [x] travel-insurance-stability-period — Stability Periods Compared
- [x] snowbird-travel-insurance-cost-by-age — What Snowbird Travel Insurance Costs by Age
- [x] dental-insurance-self-employed-ontario — Dental Insurance for the Self-Employed
- [x] international-student-health-insurance-ontario — International Student Health Insurance

## Facts the Routine must get right

These are the ones that have been wrong before. They are in `CLAUDE.md` too,
and this file repeats them because the Routine reads this file first.

- Phone: **437-385-6173** (`tel:4373856173`). An older number appears in
  historical commits — it is not current and must never be published.
- Email: **contact@coverandprotect.ca**. Never `info@`.
- Advisor: **Sertac Tekin**, FSRA Licence **#10112782**, Toronto, Ontario.
- Insurers may only be named if they are `confirmed: true` in
  `workers/cpbot-ai/underwriting.js`. **Never state a count of insurers.**
  `workers/cpbot-ai/test/panel.test.mjs` fails the build if either rule breaks.
- Prices and program rules are illustrative and need the standard disclaimer.
  Do not invent figures, statistics, or IRCC/CRA rules.
