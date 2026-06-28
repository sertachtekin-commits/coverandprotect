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
| `blog-travel-insurance-canadians.html` | Blog article (travel insurance for Canadians abroad) |
| `thankyou.html` | Post-form-submission confirmation page |
| `tracking.js` | Shared analytics/lead-tracking script (see below) |
| `blog.css` | Shared stylesheet for all `blog-*.html` articles |
| `sitemap.xml` | XML sitemap (must be kept in sync with pages) |
| `robots.txt` | Crawler directives; points to the sitemap |
| `CNAME` | GitHub Pages custom domain |
| `images/` | All image assets (hero images, illustrations) |

The service/landing pages are **self-contained**: each carries its own inline
`<style>` block and its own copy of the nav, footer, and meta tags (these were
authored at different times and their CSS is not byte-identical, so don't assume
a change to one applies to others). The shared assets are `tracking.js` (all
pages) and `blog.css` (the `blog-*.html` articles, which link it instead of
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

### Page structure
Each page generally follows: GA4 snippet in `<head>` → SEO meta tags (title,
description, keywords, geo, Open Graph, Twitter Card, canonical) → JSON-LD
structured data → inline `<style>` → fixed `<nav>` → page sections → `<footer>`
→ `<script src="tracking.js?v=2" defer></script>` before `</body>`.

When creating a new page, **copy an existing page** (e.g. a service page) as the
template rather than starting from scratch, so the nav, footer, palette, and
tracking are consistent. For blog articles, copy one of the `blog-*.html` files —
they share the light-theme layout (cream background, `.wrap`, `.cta-box`, Article
JSON-LD) and link the shared **`blog.css`** rather than inlining styles. New blog
posts should link `blog.css` too; only add inline `<style>` for genuinely
post-specific tweaks.

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
