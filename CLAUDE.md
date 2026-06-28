# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Cover & Protect** (`coverandprotect.ca`) is the marketing website for an
Ontario-licensed independent insurance advisor based in Toronto (Sertac Tekin,
FSRA Licence #10112782). It is a **static, hand-authored HTML site** — there is
no build step, no framework, no package manager, and no server-side code. Pages
are plain `.html` files served directly.

The site is **deployed via GitHub Pages**:

- `CNAME` pins the custom domain `coverandprotect.ca`.
- Pushing to the default branch (`main`) publishes the live site. There is no CI
  build — what is committed is what is served.

## Repository layout

Everything lives at the repository root (flat structure):

| File | Purpose |
|------|---------|
| `index.html` | Homepage / main landing page |
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
| `thankyou.html` | Post-form-submission confirmation page |
| `tracking.js` | Shared analytics/lead-tracking script (see below) |
| `sitemap.xml` | XML sitemap (must be kept in sync with pages) |
| `robots.txt` | Crawler directives; points to the sitemap |
| `CNAME` | GitHub Pages custom domain |
| `images/` | All image assets (hero images, illustrations) |

There is no shared CSS or HTML include mechanism. **Each HTML page is
self-contained**: it carries its own inline `<style>` block and its own copy of
the nav, footer, and meta tags. The only genuinely shared asset is `tracking.js`.

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

### Page structure
Each page generally follows: GA4 snippet in `<head>` → SEO meta tags (title,
description, keywords, geo, Open Graph, Twitter Card, canonical) → JSON-LD
structured data → inline `<style>` → fixed `<nav>` → page sections → `<footer>`
→ `<script src="tracking.js?v=2" defer></script>` before `</body>`.

When creating a new page, **copy an existing page** (e.g. a service page) as the
template rather than starting from scratch, so the nav, footer, palette, and
tracking are consistent.

### Brand / business facts (keep consistent everywhere)
- Business: **Cover & Protect**, advisor **Sertac Tekin**, Toronto, Ontario.
- Regulator: **FSRA Licence #10112782** (shown in disclaimers/forms).
- Phone: `tel:6473669495` · WhatsApp: `wa.me/16473669495`
- Email: `contact@coverandprotect.ca` / `info@coverandprotect.ca`
- Tone: professional, trust-focused, compliance-aware (FSRA Licensed · PIPEDA
  Compliant).

## Forms and lead capture

Lead forms post to **Formspree** endpoint `https://formspree.io/f/mdajwykn`
(same endpoint across all pages). Each form includes hidden fields:

- `_subject` — describes the lead type (e.g. "New Lead - Quote Request").
- `_next` — redirect target `https://www.coverandprotect.ca/thankyou.html?lead=1`.

`thankyou.html` reads `?lead=1` and fires the conversion event, then
auto-redirects home after a few seconds. When adding a form, mirror this exact
pattern (same endpoint, same `_next`, descriptive `_subject`).

## Analytics & tracking (`tracking.js`)

A single vanilla-JS, no-dependency script included on every page. Key behavior:

- **GA4** property `G-J7F01SWCLW` (the gtag snippet is inlined in each page's
  `<head>`; `tracking.js` sends events via `gtag`/`dataLayer`).
- Persists UTM/click attribution (`utm_*`, `gclid`, `gbraid`, `wbraid`,
  `fbclid`) in `sessionStorage` and attaches it to every event.
- Auto-fires events: `phone_click`, `email_click`, `whatsapp_click`,
  `truestone_click` (TruStone Health application links), `form_start`,
  `campaign_landing`, and `generate_lead`.
- `generate_lead` is the conversion — fired on a successful Formspree `fetch`
  response and on the `thankyou.html?lead=1` page. **Mark `generate_lead` as a
  conversion in GA4** for Google Ads import.
- **Privacy:** only engagement metadata is sent to GA4 — never form field values
  or contact details. Preserve this; do not add code that sends PII to analytics.

The script is included with a cache-busting query (`tracking.js?v=2`). **If you
change `tracking.js`, bump the `?v=` version on every page** that includes it so
clients fetch the new file.

## Common tasks

- **Add a page:** copy an existing page, update content/meta/JSON-LD, add it to
  `sitemap.xml`, and link it from the nav/footer where appropriate.
- **Edit styling:** edit the inline `<style>` block in the specific page; use the
  existing CSS variables. Remember changes are not shared across pages.
- **Update analytics:** edit `tracking.js` and bump `?v=` on all pages.
- **Always update `sitemap.xml`** (add/remove `<url>` entries, refresh
  `<lastmod>`) when pages are added, removed, or substantially changed.

## Workflow notes

- No build, test, lint, or install commands exist. Validate changes by opening
  the HTML in a browser (or a static server) and checking layout, links, and
  console for errors.
- Keep SEO tags, JSON-LD, canonical URLs, and `sitemap.xml` consistent with the
  page's actual content and URL.
- Commit with clear messages; pushing to the published branch updates the live
  site, so review content (especially licence numbers, contact info, and legal
  disclaimers) before pushing.
