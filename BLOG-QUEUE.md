# Blog topic queue

This file drives the automated biweekly blog Routine. Each run picks the
**first unchecked** topic below, writes the article (following the
conventions in `CLAUDE.md`), wires it into `blog.html` + `sitemap.xml`,
checks the box here, and opens a **Pull Request for review** — it never
publishes to `main` on its own.

**You control this file.** Add, remove, or reorder topics freely. To pause
the automation entirely, disable the Routine (or delete this file). To
prioritise a topic, move it to the top.

Format: `- [ ] slug — Title → funnel-page`

## Pending

- [ ] blog-super-visa-vs-visitor — Super Visa vs Visitor Insurance: Which Do Your Parents Need? (2026) → super-visa-insurance-ontario.html
- [ ] blog-resp-grants — RESP Explained: Government Grants & How Much to Save (Ontario 2026) → savings-plans.html
- [ ] blog-long-term-care-cost — How Much Does Long-Term Care Cost in Ontario? (2026) → long-term-care.html
- [ ] blog-rrsp-tfsa — RRSP vs TFSA: Which Should Ontario Families Use First? (2026) → savings-plans.html
- [ ] blog-travel-insurance-seniors — Travel Insurance for Canadian Snowbirds & Seniors (2026) → travel-insurance.html
- [ ] blog-critical-illness-cost — How Much Does Critical Illness Insurance Cost in Ontario? (2026) → critical-illness.html
- [ ] blog-health-insurance-self-employed — Health & Dental Insurance for the Self-Employed in Ontario (2026) → health-insurance.html
- [ ] blog-estate-planning-basics — Estate Planning in Ontario: A Simple Starter Guide (2026) → estate-planning.html
- [ ] blog-mortgage-insurance-vs-life — Bank Mortgage Insurance vs. Term Life: Which Protects Your Family Better? → estate-planning.html
- [ ] blog-newcomer-health-ohip-wait — Health Insurance for Newcomers to Canada: Covering the OHIP Waiting Period → visitor-insurance-canada.html

## Published (auto-checked by the Routine)

_None yet — the Routine moves items here as it completes them._
