# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Cover & Protect** (`coverandprotect.ca`) is the marketing website for an
Ontario-licensed independent insurance advisor based in Toronto (Sertac Tekin,
FSRA Licence #10112782). It is a **hand-authored, mostly-static HTML site** — no
framework, no JS bundler, no server-side code. Pages are plain `.html` files with
their own inline styles and markup.

The site is **deployed via GitHub Pages with Jekyll**:

- `CNAME` pins the custom domain `coverandprotect.ca`.
- Pushing to the default branch (`main`) triggers GitHub Pages' built-in **Jekyll
  build**, which resolves `{% include %}` tags and publishes the result. There is
  no separate CI or bundler step.
- Jekyll is used only as a lightweight include mechanism (shared `<head>`
  analytics + footer facts). **No theme or layout is applied** — each page renders
  exactly as authored. See "Jekyll includes" below.

## Repository layout

Everything lives at the repository root (flat structure):

| File | Purpose |
|------|---------|
| `index.html` | Homepage — a thin wrapper that renders `_includes/homepage-original.html` and rewrites a few exact strings in it for search. A `replace_first` whose needle stops matching fails **silently**, so `workers/cpbot-ai/test/homepage.test.mjs` checks every needle still appears exactly once. Run it after editing either file. |
| `super-visa-insurance-ontario.html` | Super Visa insurance campaign landing page |
| `visitor-insurance-canada.html` | Visitor insurance campaign landing page |
| `travel-insurance.html` | Travel insurance service page |
| `health-insurance.html` | Individual health insurance service page |
| `group-benefits.html` | Group / business benefits service page |
| `critical-illness.html` | Critical illness service page |
| `estate-planning.html` | Life & estate planning service page |
| `long-term-care.html` | Long-term care service page |
| `savings-plans.html` | Savings / investment plans service page |
| `blog-supervisa-cost.html` | Blog article (Super Visa cost) |
| `blog-travel-insurance-canadians.html` | Blog article (travel insurance for Canadians abroad) |
| `blog-how-to-make-travel-insurance-claim.html` | Blog article (Canadian travel insurance claim guide) |
| `blog-supervisa-refund.html` | Blog article (Super Visa premium refunds) |
| `blog-ohip-visitors.html` | Blog article (OHIP coverage gaps for visitors) |
| `blog-critical-illness-worth-it.html` | Blog article (is critical illness insurance worth it) |
| `blog-health-dental-self-employed.html` | Blog article (health & dental for the self-employed) |
| `blog-resp-cesg-explained.html` | Blog article (RESP & CESG education savings grant) |
| `blog-rrsp-vs-tfsa.html` | Blog article (RRSP vs TFSA retirement savings) |
| `blog-group-benefits-small-business.html` | Blog article (group benefits for small business) |
| `blog-will-ontario.html` | Blog article (why Ontario families need a will) |
| `blog-power-of-attorney-ontario.html` | Blog article (powers of attorney in Ontario) |
| `blog-term-vs-whole-life.html` | Blog article (term vs whole life insurance) |
| `blog-how-much-life-insurance.html` | Blog article (life insurance needs / coverage amount) |
| `blog.html` | Blog index / hub page listing all `blog-*.html` articles |
| `buy-online.html` | Buy-online hub — every self-serve purchase path in one place |
| `app.html` | Installable buy-online app (the PWA start page) |
| `thankyou.html` | Post-form-submission confirmation page |
| `tracking.js` | Shared analytics/lead-tracking script (see below) |
| `cpbot.js` | The chat assistant's code — UI, estimate engine, AI tool implementations. Loaded by `_includes/cpbot.html` as `cpbot.js?v=N`; **bump that version there and in `sw.js` PRECACHE when you change it.** No front matter, so Jekyll copies it verbatim and no Liquid runs in it. |
| `manifest.json` | PWA web app manifest (the buy-online app; start URL is `app.html`) |
| `sw.js` | PWA service worker — offline caching; bump `CACHE_VERSION` when precached assets change |
| `blog.css` | Shared stylesheet for all `blog-*.html` articles |
| `sitemap.xml` | XML sitemap (must be kept in sync with pages) |
| `robots.txt` | Crawler directives; points to the sitemap |
| `CNAME` | GitHub Pages custom domain |
| `_config.yml` | Jekyll config (no theme/layout; just includes) |
| `googledb2fcfa7efcf42c9.html` | Google Search Console HTML-file verification token (leave as-is) |
| `_includes/analytics.html` | Shared GA4 snippet (included in every page's `<head>`) |
| `_includes/contact-line.html` | Shared footer licence + contact line (blog articles) |
| `_includes/buy-bar.html` | Shared mobile buy bar (call · buy online · quote) |
| `_includes/cpbot.html` | Shared Cover & Protect assistant chatbot — markup + styles, loading `cpbot.js`. Include with `{% include cpbot.html %}` just before `</body>` — **on every page except the legal pages and `thankyou.html`**, since the pages that catch organic search are where a stranger first meets it. Page-aware greeting: buy-online.html gets copilot mode (guided path finder), instant-quote.html gets quote-tool help, travel-insurance-calculator.html gets estimate help. Knowledge base (KB), quote flows (FLOWS) and the illustrative estimate engine live in `cpbot.js` — keep the estimate bands in sync with `travel-insurance-calculator.html` (rate assumptions v2026.07). Outbound portal links carry `data-buy-step`/`data-trustone-plan` so `tracking.js` fires the funnel events. State: one `PROFILE` object, written only through `setFact()`; each step names its field as `f:`. Phase 2 (2026-10-06): guided quote flows now end in a `{t:"recommend"}` step that saves quote context to localStorage (`cpq_v1`, 24h) and shows a "best path" handoff card (Continue to buy / walkthrough / talk to Sertac). `buy-online.html` reads that context and shows a pickup banner highlighting the recommended provider card. New flows: `topup`, `annual`. Per-provider buying walkthroughs in `WALK`. LESSON (2026-10-05): when extracting a `<style>` block, remove from the opening tag — a regex starting at an inner comment left an orphaned `<style>` that swallowed page content as CSS. |
| `images/` | All image assets (hero images, illustrations) |
| `tools/lead-sorter/` | Gmail Apps Script that labels Formspree lead emails by product using TypeSafe (not published; see its README) |
| `tools/layout-check/` | Headless-browser check that the chat launcher does not cover the buy bar's quote button on a phone (not published; see its README) |
| `tools/search-audit/` | TypeSafe search & AI-visibility audit of the sitemap pages, run from GitHub Actions (not published; see its README) |
| `workers/cpbot-ai/` | Cloudflare Worker behind the chat assistant — holds the OpenAI key and runs the tool-calling loop (not published; see its README) |

`_site/` (the Jekyll build output) is git-ignored — never commit it; GitHub Pages
builds it server-side.

The service/landing pages are **self-contained**: each carries its own inline
`<style>` block and its own copy of the nav, footer, and meta tags (these were
authored at different times and their CSS is not byte-identical, so don't assume
a change to one applies to others). The shared assets are `tracking.js` (all
pages) and `blog.css` (the four `blog-*.html` articles, which link it instead of
inlining styles).

## Conventions

### Design tokens (CSS custom properties)
Every page defines the same palette in a `:root` block. Reuse these exact values
when adding or editing styles — do not introduce new ad-hoc colors:

```css
--navy: #0a1628;   --deep: #0d1f3c;
--teal: #0e7c7b;   --teal-light: #14a8a7;
--gold: #c9973a;   --gold-light: #e5b657;
--cream: #f5f0e8;  --white: #ffffff;
--text-muted: #8a9ab5;
--border: rgba(255,255,255,0.08);
```

Fonts: **Playfair Display** (headings/logo) and **DM Sans** (body), loaded from
Google Fonts. The logo is the word "Cover & Protect" with the ampersand/accent
in `--gold`.

### Jekyll includes
Every page begins with an (empty) YAML front-matter block so Jekyll processes it:

```
---
---
<!DOCTYPE html>
```

Shared, byte-identical fragments are pulled in with Liquid includes instead of
being duplicated:

- `{% include analytics.html %}` — the GA4 gtag snippet, in every page's `<head>`.
- `{% include contact-line.html %}` — the footer licence + contact line, used by
  the blog articles.

When you add a page, **start it with the `---\n---` front matter** and use
`{% include analytics.html %}` for the GA4 snippet rather than pasting it. To
change the GA4 ID or the contact facts, edit the include once. The nav and
per-page footers are intentionally different across pages and are **not**
templated — don't try to unify them. Avoid literal `{{` or `{%` in page content
(Liquid would try to interpret it). Verify a change builds with `jekyll build`
and that `_site/<page>.html` looks right.

### Page structure
Each page generally follows: `---\n---` front matter →
`{% include analytics.html %}` in `<head>` → SEO meta tags (title, description,
keywords, geo, Open Graph, Twitter Card, canonical) → JSON-LD structured data →
inline `<style>` (or `blog.css` link) → fixed `<nav>` → page sections →
`<footer>` → `<script src="tracking.js?v=6" defer></script>` before `</body>`.

When creating a new page, **copy an existing page** (e.g. a service page) as the
template rather than starting from scratch, so the nav, footer, palette, and
tracking are consistent. For blog articles, copy one of the `blog-*.html` files —
they share the light-theme layout (cream background, `.wrap`, `.cta-box`, Article
JSON-LD) and link the shared **`blog.css`** rather than inlining styles. New blog
posts should link `blog.css` too; only add inline `<style>` for genuinely
post-specific tweaks. Also add the new post as a card in the **`blog.html`** hub
grid and to `sitemap.xml` — `blog.html` is the central blog index, linked from the
homepage footer and each article's nav ("All Guides").

### Images & performance
- Source images live in `images/` and are served directly. **Keep them
  web-optimized**: long edge ≤ 1920px, JPEG quality ~80, progressive. The whole
  `images/` folder should stay around a few MB, not tens of MB. If you add a
  large photo, compress/resize it before committing (e.g. with Pillow).
- **WebP:** every image ships as both `.jpg` and `.webp`. Images are served via
  `<picture><source srcset="images/NAME.webp" type="image/webp"><img
  src="images/NAME.jpg" …></picture>` so WebP-capable browsers get the smaller
  file and others fall back to JPEG. When adding an image, generate both formats
  and use the `<picture>` wrapper. A global `picture{display:contents}` rule keeps
  the wrapper from affecting layout — keep that rule on any page using `<picture>`.
- **Loading discipline:** above-the-fold hero images use `fetchpriority="high"`
  (eager, the default) so they don't delay LCP; below-the-fold content images use
  `loading="lazy"`. Don't put `loading="lazy"` on a hero.

### Accessibility
- Every form `<label>` must be associated with its control via `for="id"` ↔
  `id="…"`. When adding form fields, give the control an `id` and point the label
  at it. The email field is marked `required`; other fields are intentionally
  optional to minimize submission friction.

### Internal linking
- When adding a page, link it from relevant existing pages (nav, footer, or
  related-article links) in addition to `sitemap.xml` — the site relies on
  internal links for discovery and SEO. Blog posts cross-link each other and link
  to the matching service page's quote form.

### The buy-online path (mobile buy bar)
Every content page carries a fixed bottom action bar on phones, so the purchase
path is always one tap away. There are **two implementations, and a page must
never have both**:

- **`.sticky-call`** — hand-written into `super-visa-insurance-ontario.html`,
  `visitor-insurance-canada.html`, `travel-insurance.html` and
  `travel-insurance-calculator.html`, using each page's own CSS variables.
- **`{% include buy-bar.html %}`** — the shared, self-styled bar (prefixed
  `cp-buybar-*`) for every other page, dropped in just before `</body>`. It
  carries its own `<style>` so it works on pages with unrelated CSS, reserves
  `padding-bottom` on `<body>` so it never covers the footer links, and hides
  itself on desktop and inside the installed app.

Both bars sit at `bottom:12px` and the chat launcher at `bottom:20px`, so the
launcher is lifted clear of them on phones (see the end of `_includes/cpbot.html`);
if you change either bar's height or the launcher's position, run
`tools/layout-check`. When adding a page, include `buy-bar.html` unless you are
hand-writing a `.sticky-call` bar, and include `cpbot.html` as well (see "The chat sales
assistant"). The assistant spent its first three weeks on only the eight buy
pages, which meant none of the blog or landing pages that actually catch search
traffic could use it. Legal pages (`privacy-policy.html`, `terms.html`),
`thankyou.html` and `app.html` deliberately have neither.

Every page should also reach `buy-online.html` through its nav or footer — that
hub is what routes organic blog traffic to a purchase.

### Brand / business facts (keep consistent everywhere)
- Business: **Cover & Protect**, advisor **Sertac Tekin**, Toronto, Ontario.
- Regulator: **FSRA Licence #10112782** (shown in disclaimers/forms).
- Phone: `tel:4373856173` · WhatsApp: `wa.me/14373856173`
- Email: `contact@coverandprotect.ca` (canonical — use everywhere; do not use `info@coverandprotect.ca`)
- Social: Facebook `https://www.facebook.com/share/1HAGzGYSun/` · Instagram
  `https://www.instagram.com/coverandprotect.ca`. These appear both as visible
  icon links in the page footers (inline SVG, gold `--gold-light`, opening in a
  new tab) and in each page's JSON-LD `sameAs` array — keep the two in sync. The
  footer icon row lives in each page's footer; for the blog articles it's in the
  shared `_includes/contact-line.html`, so update that once for all four.
- Tone: professional, trust-focused, compliance-aware (FSRA Licensed · PIPEDA
  Compliant).

## PWA (the installable buy-online app)

`app.html` is the installable Progressive Web App, and its only job is getting
someone from "I need coverage" to a paid policy. It asks two questions — who the
coverage is for, and whether there are pre-existing conditions — and returns the
single matching insurer plan with an apply-and-pay button, instead of making the
visitor choose from the eight options listed on `buy-online.html`.

The "not sure" answer deliberately leads to a phone call rather than a checkout:
guessing on the medical questions is the most common reason a large claim is
denied, so that path must never be turned into a direct purchase link.

## The chat sales assistant (`_includes/cpbot.html` + `workers/cpbot-ai/`)

The assistant is a **sales agent, not an FAQ**. The model has four tools and uses
them to qualify, price and hand off:

| Tool | Purpose |
|------|---------|
| `assess_preexisting` | **Runs in the Worker, never the browser.** Sorts a pre-existing case against the insurer underwriting rules in `workers/cpbot-ai/underwriting.js` and returns a tier plus `must_say` wording instructions. See "The underwriting layer" below. |
| `lookup_kb` | Searches the site's own 36 written answers and returns the wording plus the page to cite. **Called first for any factual question.** Without it the model answered from general knowledge while the curated, advisor-checked wording sat unused — and on the stability period, being vaguely right is how a client loses a claim. |
| `save_profile` | Remembers product, age, days, destination, dates, travellers, pre-existing status, monthly preference; returns what is still missing. This is why it stops re-asking. |
| `estimate_premium` | Returns an illustrative band from the page's estimate engine — **the only number the model may state.** |
| `recommend_path` | Returns insurer/tool, reason and URL from the same `recommendFor()` the guided flows use. |
| `create_lead` | Posts the profile to Formspree; refuses without a name and a phone or email. |

**The conversation's facts live in one object.** `PROFILE` in
`_includes/cpbot.html`, written only through `setFact()`. There used to be three
stores — `AIP`, `cpKnownTravel` and `session.data` — holding the same fact under
different names with bridges copying between them, and every "it asked me
something I already said" bug traced back to one store knowing the answer and
the store being read not knowing it. Each guided-flow step names the field it
answers (`f:`) and is skipped when that field is known, from any source;
`setFact` derives what an answer implies (dates → trip length, ages → age,
a US destination → the USA loading); the AI tools write through the same
`setFact` via the `AI_FIELD` mapping; and `pricingNode()` is the single reader
that shapes the facts for `estimateFor()`/`recommendFor()`. Do not add a second
store or a bridge — add a field and, if an answer implies another, a `DERIVE`
rule. `cancel` keeps the answers; `#restart` ("start over") is the only thing
that clears them.

**The tools execute in the browser, not in the Worker.** The rate bands live in
`_includes/cpbot.html` and must match `travel-insurance-calculator.html`; running
them in the Worker as well would be a third copy to keep in sync, and drifting
rate tables are how a customer is quoted one number and shown another. The Worker
is the conversation brain, the page is the calculator. The two-round protocol and
the tool contracts are documented in `workers/cpbot-ai/README.md`.

## The underwriting layer (`workers/cpbot-ai/underwriting.js`)

Travelling Canadians, snowbirds and seniors with serious health histories are
Sertac's specialism, and this is where that shows. The file holds insurer
stability rules per condition and age band, and `assess()` sorts a case into
`advisor_only` / `needs_review` / `likely_eligible`.

**It runs in the Worker and never reaches the browser.** `cpbot.js` is public;
underwriting guides are usually confidential under the broker agreement, and
this is eighteen years of work besides. The page sends the intake and gets back
a tier — never the rules that produced it. `worker.test.mjs` asserts that
neither the tool name nor any rule detail appears in a browser-bound response.
Note this is the **opposite** of the rate bands, which must stay in the page so
they cannot drift from the calculator. Different data, different rule.

**`likely_eligible` is reachable only from a rule Sertac verified against a
named document, within the last year, and not past its `reviewBy`.** Unverified
or stale rules cap at `needs_review`. This is enforced in code, not in wording,
and `underwriting.test.mjs` fails if it stops being true. **Never add a rule you
cannot source** — `RULES` ships empty for exactly that reason, and an empty file
behaves precisely as the site did before, so it is safe to fill in one rule at
a time. The procedure is in `workers/cpbot-ai/RULES.md`.

The `BLOCKERS` list is separate and needs no rule: a test result outstanding, a
symptom under investigation, an admission inside 90 days, a terminal prognosis,
or a trip taken for treatment. These stop a sale rather than enable one, so the
failure mode is routing someone to a licensed advisor.

The assistant may never say anyone is insurable, approved, covered or
uninsurable — only what insurers normally consider and what decides a case.
That is the FSRA fair-treatment position and the reason the handoff to Sertac is
the process rather than a disclaimer.

**Server-side tools change the protocol.** When the model asks for
`assess_preexisting`, the Worker answers it and asks the model again without
involving the page. Those exchanges come back as `server_chain` (and
`server_results` when one assistant turn mixes server and browser tools) so
`aiTurn` can replay them — every `tool_call_id` must be answered or the provider
rejects the round.

**The pre-existing-condition gate is a safety rule, not a nicety.** A visitor who
reports a recent medication, dosage or treatment change — or says they are not
sure — must never be shown a price or a buy link, because a change inside the
insurer's stability period is the most common reason a large claim is refused.
`aiAdvisorRequired()` gates the AI path and `needsAdvisor()` gates `showRecommend()`
in the guided flows. This matches the rule `app.html` already follows for its
"not sure" answer. Note `normCond()` still maps `recent` → `stable` for the
*pricing* factor; the advisor gate runs first and is what keeps that off a
customer's screen. Do not remove it.

**The knowledge base answers typed questions, not just chips.** `KB`'s 36 topics
used to be wired only to the chip buttons; everything typed went to the model.
Now `kbSearch()` serves both the `lookup_kb` tool and `aiFallback`'s
`unavailable()` branch, so a question still gets the written answer, with its
source link, when the Worker is unreachable — out of credit, bad key, or down.
`KB_MIN_SCORE` is the confidence floor, tuned in `kb.test.mjs` against twenty
real questions and ten off-topic ones; raising it silences a stray match but
starts dropping real questions, which is the worse trade.

**`rank()` sums matched keyword lengths**, so a topic with long generic keywords
outranks one with short specific keywords. That is why "how much does super visa
insurance cost" returned the overview rather than the prices until the `cost`
topic got the longer phrasings. If a question reaches the wrong topic, add the
phrasing people actually type to that topic's `k` list rather than changing the
scoring — and keep it specific, since a bare "insurance cost" would hijack
travel and visitor pricing questions.

**What the chat reports to GA4.** Four events, sent by `track()` in `cpbot.js`:
`chat_open`, `chat_estimate`, `chat_recommend` (the advisor gate counts, as
`provider:"advisor"`) and `chat_lead`. Together they answer how many people open
it, how many get a price, and where they stop — none of which was visible
before. `generate_lead` still fires separately through `tracking.js`'s fetch
wrapper, so the conversion is unchanged. **Engagement metadata only**: product,
provider, path, USA flag and condition class. Never an age, destination, date,
name or contact detail — those belong in the lead email and nowhere else. A test
in `tools.test.mjs` reads the shipped payloads and fails if one grows a PII
field.

**Tests** (plain Node, no dependencies) live in `workers/cpbot-ai/test/`. Run
them after changing the Worker, the tools, the rate bands, or the
pre-existing wording:

```sh
cd workers/cpbot-ai && npm test
```

That runs eight suites: `worker.test.mjs` (protocol and guards),
`tools.test.mjs` (tool behaviour, the advisor gate, routing, and the GA4
payloads), `flow.test.mjs` (the guided flow's step sequence),
`characterize.test.mjs` (every flow's question order — it fails if a change
alters what a visitor is asked), `coverage.test.mjs` (every page carries the
assistant; the `cpbot.js` version matches `sw.js`), `homepage.test.mjs` (the
homepage wrapper's rewrites still match) `kb.test.mjs` (every real question finds a
written answer; chitchat does not) and `underwriting.test.mjs` (an unverified
or stale rule can never produce a green light; the hard stops stop everything).

They evaluate `cpbot.js` itself, so they test the shipped file rather than a
copy. `tools/layout-check` needs a browser and is run by hand.

A `GET` on the Worker URL returning `Method not allowed` is correct — it accepts
`POST` only.

**Keep the plan matrix in sync.** The `MATCH` table in `app.html` mirrors the
provider list on `buy-online.html`. If a TruStone plan code changes in one place,
change it in the other.

The visitor branch also offers **21st Century** (`instant-quote.html`), for
monthly payments, up to six travellers on one quote, and Pending-status policies
that can be filed with a Super Visa application. It is styled as a plain
secondary link, never as an apply-and-pay button, because that flow ends in an
emailed payment link rather than a completed purchase — two buttons that look
alike but behave differently is how someone ends up believing they are covered
before the premium is paid. It is absent from the outbound branch on purpose:
the insurer covers visitors to Canada only, with outbound due in 2026.

`manifest.json` sets the app name, `start_url` (`/app.html?source=pwa`), scope
(the whole site) and three launcher shortcuts (buy online, calculator, instant
quote). Its `id` is deliberately still `/travel-insurance-calculator.html`: that
was the app's identity when the PWA was the calculator, and changing `id` would
orphan every existing install as a separate app rather than upgrading it. Leave
it alone. App icons live in `images/` (`icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`, `apple-touch-icon.png`), generated in the brand style.

`sw.js` is registered from `app.html`, `buy-online.html` and
`travel-insurance-calculator.html`. It is network-first for page navigations
(deploys show immediately) and cache-first for static assets, same-origin GET
only — it never touches Formspree posts, insurer checkout portals or analytics.
Precache entries are added one at a time, so a single bad URL cannot abort the
install and leave the app with no offline support. If you change what the app
loads, update `PRECACHE` in `sw.js` and bump its `CACHE_VERSION` so installed
clients refresh.

Because the installed app now opens `app.html`, the install copy on the
calculator page promotes the app rather than the calculator. Keep it that way.

## Forms and lead capture

Lead forms post to **Formspree** endpoint `https://formspree.io/f/mdajwykn`
(same endpoint across all pages). Each form includes hidden fields:

- `_subject` — describes the lead type (e.g. "New Lead - Quote Request").
- `_next` — redirect target `https://coverandprotect.ca/thankyou.html?lead=1`.

`tracking.js` additionally injects hidden `utm_*`/`gclid`/etc. attribution fields
into each Formspree form at runtime (see "Analytics & tracking"), so the owner's
lead email carries the campaign that produced it — you don't hand-author those.

**Lead sorting.** `tools/lead-sorter/Code.gs` runs in the inbox that receives
these emails and labels each lead by product. It maps each form's `_subject` to a
product in `SUBJECT_RULES`, so when you add a form or change a `_subject`, update
that table and run `node test.mjs` there. **This includes the chat**: its guided
flows send `New quote request - <flow title>` and the AI agent sends
`New quote request - <product> - Chat sales agent`, where the product word comes
from `leadSubjectProduct()` in `_includes/cpbot.html`. Those two must agree —
a subject no rule matches lands the lead in "Needs review" rather than its
product folder. The sorter's free-text fields are `notes` and `message`; a lead
posting any other field name is silently invisible to it. `tools/` is excluded from the Jekyll
build. The script never sends contact details, ad-click IDs or the chat
transcript to TypeSafe; keep it that way. `redact()` masks emails and phone
numbers but cannot mask a name typed mid-sentence, which is why `conversation`
is in `PRIVATE_FIELDS` — the structured `details` field already carries the
product signal.

`thankyou.html` reads `?lead=1` and fires the conversion event, then
auto-redirects home after a few seconds. When adding a form, mirror this exact
pattern (same endpoint, same `_next`, descriptive `_subject`).

## Analytics & tracking (`tracking.js`)

A single vanilla-JS, no-dependency script included on every page. Key behavior:

- **GA4** property `G-J7F01SWCLW` (the gtag snippet lives in
  `_includes/analytics.html`, included in each page's `<head>`; `tracking.js`
  sends events via `gtag`/`dataLayer`). `analytics.html` also holds two commented
  placeholders: one for the **Google Search Console** `google-site-verification`
  meta, and one for a direct **Google Ads** conversion tag (`gtag('config',
  'AW-…')` plus a `window.CP_ADS_CONVERSION` id/label). Filling either in once
  applies it to every page.
- **Google Search Console verification** is currently done via the HTML-file
  method: `googledb2fcfa7efcf42c9.html` at the repo root is the token GSC checks
  for. Leave it in place. (The meta-tag placeholder in `analytics.html` is an
  alternative that isn't in use.)
- Persists UTM/click attribution (`utm_*`, `gclid`, `gbraid`, `wbraid`,
  `fbclid`) in `localStorage` (90-day window, matching Google Ads' click-through
  conversion window) with a `sessionStorage` fallback, and attaches it to every
  event. It also **stamps hidden attribution fields onto Formspree forms** so the
  owner's lead email shows which campaign/click produced the lead — this ad-click
  metadata goes only into that lead email, never to analytics.
- Auto-fires events: `phone_click`, `email_click`, `whatsapp_click`,
  `booking_click`, `truestone_click` (TruStone Health application links),
  `tugo_click` (TuGo online store / B2C links), `form_start`, `campaign_landing`,
  and `generate_lead`.
- **Online-purchase funnel**, three tiers, all deduplicated per link per page
  view:
  - `select_item` — moving toward a buy path elsewhere on our own site (the
    hub, the app, the instant quote, the calculator). The target is compared
    against the *current* path, so a real step between two buy pages still
    counts.
  - `quote_start` — opening the 21st Century quote tool. That flow prices the
    coverage and submits a request; the advisor reviews it and the insurer
    emails a secure payment link, so **no purchase happens in the session**.
    Opt in with `data-buy-step="quote"`.
  - `begin_checkout` — opening an insurer's own application *and payment*
    portal (TruStone, the TuGo store), where the visitor actually pays. Opt in
    with `data-buy-step="checkout"` and `data-provider="…"`.

  Keep 21st Century out of `begin_checkout`. Counting a quote request as a
  checkout trains Google Ads bidding on a softer signal than the portals where
  money changes hands. **Mark `begin_checkout` as a conversion in GA4 alongside
  `generate_lead`** so Ads bids toward people who buy, not only people who fill
  in a form.
- `app.html` additionally sends `app_step`, `app_plan_matched`,
  `app_install_prompt`, `app_install_choice` and `app_installed`.
- `generate_lead` is the conversion — fired on a successful Formspree `fetch`
  response and on the `thankyou.html?lead=1` page (guarded against
  refresh/back-navigation double-counting via a `sessionStorage` flag). **Mark
  `generate_lead` as a conversion in GA4** for Google Ads import. If
  `window.CP_ADS_CONVERSION` is set (see `analytics.html`), the same lead also
  fires a direct Google Ads `conversion` event.
- **Privacy:** only engagement metadata is sent to GA4 — never form field values
  or contact details. Preserve this; do not add code that sends PII to analytics.

The script is included with a cache-busting query (`tracking.js?v=10`). **If you
change `tracking.js`, bump the `?v=` version on every page** that includes it so
clients fetch the new file. The same rule applies to `cpbot.js`, but its version
lives in one place — `_includes/cpbot.html` — plus `sw.js`'s `PRECACHE` entry.

## Common tasks

- **Add a page:** copy an existing page (keep the `---\n---` front matter and the
  `{% include analytics.html %}`), update content/meta/JSON-LD, add it to
  `sitemap.xml`, and link it from the nav/footer where appropriate.
- **Edit styling:** edit the inline `<style>` block in the specific page (or
  `blog.css` for articles); use the existing CSS variables. Page styles are not
  shared across the service/landing pages.
- **Update analytics:** edit `_includes/analytics.html` (one place). For
  `tracking.js` behavior changes, edit the script and bump `?v=` on all pages.
- **Always update `sitemap.xml`** (add/remove `<url>` entries, refresh
  `<lastmod>`) when pages are added, removed, or substantially changed. A
  `<lastmod>` is the date the page's *copy* last changed — adding a shared
  include to every page is not a reason to restamp all of them, and a sitemap
  that says everything changed today tells a crawler nothing. Note the file
  uses two layouts (one `<url>` per line, and one element per line); a script
  that edits it must handle both.

## Search & AI visibility audit

`tools/search-audit/` checks the searches in its `queries.txt` against every
page in `sitemap.xml`. For each search it reports whether one page answers it,
and how directly. Run it from **Actions → Search & AI visibility audit**; it
needs the `TYPESAFE_API_KEY` repository secret. When you fix a page the report
flags, put a direct, specific answer to the search in the page's first
paragraph, one that could be quoted on its own. Keep the page's FAQ JSON-LD in
sync with its visible FAQ. New pages are picked up from `sitemap.xml`
automatically.

## Workflow notes

- **Build/verify locally with Jekyll:** `jekyll build` produces `_site/`. Diff a
  built page against the previous version (or just open it) to confirm includes
  resolved and nothing else changed. There are no unit tests or linters.
- Keep SEO tags, JSON-LD, canonical URLs, and `sitemap.xml` consistent with the
  page's actual content and URL.
- Commit with clear messages; pushing to the published branch triggers the
  GitHub Pages Jekyll build, so review content (especially licence numbers,
  contact info, and legal disclaimers) before pushing. If the Jekyll build fails,
  the live site keeps the last good build — so verify the build locally first.
