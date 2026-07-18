# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

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
  no separate build/bundler step.
- Jekyll is used only as a lightweight include/Liquid mechanism (shared `<head>`
  analytics, footer facts, and the homepage wrapper). **No theme or layout is
  applied** — each page renders exactly as authored. See "Jekyll includes" below.
- The only CI is `.github/workflows/indexnow.yml`, which pings the IndexNow API
  (Bing/Yandex) after content pushes to `main` — see "Search & AI discoverability".

## Repository layout

Everything lives at the repository root (flat structure):

| File | Purpose |
|------|---------|
| `index.html` | Homepage — a thin Liquid wrapper; real markup lives in `_includes/homepage-original.html` (see below) |
| `insurance-services-toronto-gta.html` | Toronto/GTA service-area hub page |
| `about-sertac-tekin.html` | About-the-advisor / trust page |
| `super-visa-insurance-ontario.html` | Super Visa insurance campaign landing page |
| `visitor-insurance-canada.html` | Visitor insurance campaign landing page |
| `best-visitor-insurance-toronto.html` | Visitor-insurance comparison guide (local SEO landing page) |
| `travel-insurance.html` | Travel insurance service page |
| `health-insurance.html` | Individual health insurance service page |
| `group-benefits.html` | Group / business benefits service page |
| `critical-illness.html` | Critical illness service page |
| `estate-planning.html` | Life & estate planning service page |
| `long-term-care.html` | Long-term care service page |
| `savings-plans.html` | Savings / investment plans service page |
| `blog-*.html` (14 files) | Blog articles: Super Visa cost & refunds, OHIP for visitors, travel insurance for Canadians abroad, making a travel insurance claim, critical illness, health & dental for self-employed, RESP/CESG, RRSP vs TFSA, group benefits for small business, wills, powers of attorney, term vs whole life, how much life insurance |
| `blog.html` | Blog index / hub page listing all `blog-*.html` articles |
| `thankyou.html` | Post-form-submission confirmation page |
| `tracking.js` | Shared analytics/lead-tracking script (see below) |
| `blog.css` | Shared stylesheet for `blog.html` and all `blog-*.html` articles |
| `sitemap.xml` | XML sitemap (must be kept in sync with pages) |
| `robots.txt` | Crawler directives; explicitly allows AI crawlers; points to the sitemap and machine-readable files |
| `llms.txt` | Machine-readable business/site summary for AI assistants (canonical facts + annotated page list) |
| `entity.json` | Standalone JSON-LD entity record (WebSite + InsuranceAgency/LocalBusiness + Person) |
| `feed.xml` | RSS feed of blog articles |
| `CNAME` | GitHub Pages custom domain |
| `_config.yml` | Jekyll config (no theme/layout; just includes + excludes) |
| `googledb2fcfa7efcf42c9.html` | Google Search Console HTML-file verification token (leave as-is) |
| `168b5dc…​.txt`, `7f3a9c…​.txt` | IndexNow key files (leave as-is; the workflow references the first) |
| `.github/workflows/indexnow.yml` | GitHub Action: submits sitemap URLs to IndexNow on push to `main` |
| `_includes/analytics.html` | Shared GA4 snippet (included in every page's `<head>`) |
| `_includes/contact-line.html` | Shared footer licence + contact line + social icons (blog pages) |
| `_includes/homepage-original.html` | The full homepage markup, rendered by `index.html` |
| `images/` | All image assets (hero images, illustrations), each as `.jpg` + `.webp` |

`_site/` (the Jekyll build output) is git-ignored — never commit it; GitHub Pages
builds it server-side.

The service/landing pages are **self-contained**: each carries its own inline
`<style>` block and its own copy of the nav, footer, and meta tags (these were
authored at different times and their CSS is not byte-identical, so don't assume
a change to one applies to others). The shared assets are `tracking.js` (all
pages) and `blog.css` (`blog.html` plus all `blog-*.html` articles, which link it
instead of inlining styles).

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
- `{% include contact-line.html %}` — the footer licence + contact line + social
  icons, used by `blog.html` and all blog articles.

When you add a page, **start it with the `---\n---` front matter** and use
`{% include analytics.html %}` for the GA4 snippet rather than pasting it. To
change the GA4 ID or the contact facts, edit the include once. The nav and
per-page footers are intentionally different across pages and are **not**
templated — don't try to unify them. Avoid literal `{{` or `{%` in page content
(Liquid would try to interpret it). Verify a change builds with `jekyll build`
and that `_site/<page>.html` looks right.

### The homepage is a Liquid wrapper
`index.html` does **not** contain the homepage markup. It `{% capture %}`s
`_includes/homepage-original.html` and applies a few `replace_first` string
substitutions (H1 and hero copy) before emitting the result — an SEO copy
update layered over the legacy page without editing it. Consequences:

- **To change homepage content**, edit `_includes/homepage-original.html`.
- **To change the swapped H1/hero copy**, edit the `replace_first` calls in
  `index.html` — and note each call's search string must still match the
  include byte-for-byte, or the substitution silently does nothing. If you edit
  the hero copy in the include, update the matching search strings too.
- Always `jekyll build` and inspect `_site/index.html` after touching either
  file to confirm the substitutions still land.

### Page structure
Each page generally follows: `---\n---` front matter →
`{% include analytics.html %}` in `<head>` → SEO meta tags (title, description,
keywords, geo, Open Graph, Twitter Card, canonical) → JSON-LD structured data →
inline `<style>` (or `blog.css` link) → fixed `<nav>` → page sections →
`<footer>` → `<script src="tracking.js?v=5" defer></script>` before `</body>`.

When creating a new page, **copy an existing page** (e.g. a service page) as the
template rather than starting from scratch, so the nav, footer, palette, and
tracking are consistent. For blog articles, copy one of the `blog-*.html` files —
they share the light-theme layout (cream background, `.wrap`, `.cta-box`, Article
JSON-LD) and link the shared **`blog.css`** rather than inlining styles. New blog
posts should link `blog.css` too; only add inline `<style>` for genuinely
post-specific tweaks. Also add the new post as a card in the **`blog.html`** hub
grid, to `sitemap.xml`, to `feed.xml`, and to the guides list in `llms.txt` —
`blog.html` is the central blog index, linked from the homepage footer and each
article's nav ("All Guides").

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
- Email: **`contact@coverandprotect.ca` is the canonical address** (used in
  `llms.txt`, `entity.json`, and `contact-line.html`). A few older pages
  (`super-visa-insurance-ontario.html`, `visitor-insurance-canada.html`,
  `about-sertac-tekin.html`) still carry `info@coverandprotect.ca`; use
  `contact@` for anything new.
- Social: Facebook `https://www.facebook.com/share/1HAGzGYSun/` · Instagram
  `https://www.instagram.com/coverandprotect.ca`. These appear both as visible
  icon links in the page footers (inline SVG, gold `--gold-light`, opening in a
  new tab) and in each page's JSON-LD `sameAs` array — keep the two in sync. The
  footer icon row lives in each page's footer; for the blog pages it's in the
  shared `_includes/contact-line.html`, so update that once for all of them.
- Tone: professional, trust-focused, compliance-aware (FSRA Licensed · PIPEDA
  Compliant).

## Forms and lead capture

Lead forms post to **Formspree** endpoint `https://formspree.io/f/mdajwykn`
(same endpoint across all pages). Each form includes hidden fields:

- `_subject` — describes the lead type (e.g. "New Lead - Quote Request").
- `_next` — redirect target `https://coverandprotect.ca/thankyou.html?lead=1`.

`tracking.js` additionally injects hidden `utm_*`/`gclid`/etc. attribution fields
into each Formspree form at runtime (see "Analytics & tracking"), so the owner's
lead email carries the campaign that produced it — you don't hand-author those.

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
  `truestone_click` (TruStone Health application links), `tugo_click` (TuGo online
  store / B2C links), `form_start`, `campaign_landing`, and `generate_lead`.
- `generate_lead` is the conversion — fired on a successful Formspree `fetch`
  response and on the `thankyou.html?lead=1` page (guarded against
  refresh/back-navigation double-counting via a `sessionStorage` flag). **Mark
  `generate_lead` as a conversion in GA4** for Google Ads import. If
  `window.CP_ADS_CONVERSION` is set (see `analytics.html`), the same lead also
  fires a direct Google Ads `conversion` event.
- **Privacy:** only engagement metadata is sent to GA4 — never form field values
  or contact details. Preserve this; do not add code that sends PII to analytics.

The script is included with a cache-busting query (`tracking.js?v=5`). **If you
change `tracking.js`, bump the `?v=` version on every page** that includes it so
clients fetch the new file.

## Search & AI discoverability

Beyond `sitemap.xml`, the site maintains machine-readable records that **must be
kept in sync with page content**:

- **`llms.txt`** — plain-text canonical business facts plus an annotated list of
  every page, aimed at AI assistants/crawlers. Update it (and its "Last
  reviewed" date) when pages are added or business facts change.
- **`entity.json`** — a standalone JSON-LD `@graph` (WebSite,
  InsuranceAgency/LocalBusiness, Person) that consolidates the entity facts also
  embedded in per-page JSON-LD. Keep it consistent with the on-page schema and
  `llms.txt`.
- **`feed.xml`** — hand-maintained RSS feed of the blog articles. Add an `<item>`
  (and bump `<lastBuildDate>`) when publishing a post.
- **`robots.txt`** — explicitly allows Google/Bing plus OpenAI, Anthropic,
  Perplexity, and Apple AI crawlers, and references `llms.txt`, `entity.json`,
  `feed.xml`, and the sitemap.
- **IndexNow:** `.github/workflows/indexnow.yml` runs on pushes to `main` that
  touch HTML/XML/`robots.txt`/`llms.txt`/`entity.json`. It reads `sitemap.xml`,
  appends the machine-readable URLs, and submits the list to
  `api.indexnow.org` (Bing/Yandex only; best-effort — non-2xx is a warning, not
  a failure). The two random-hex `.txt` files at the repo root are the IndexNow
  key files it verifies against — leave them alone.

## Common tasks

- **Add a page:** copy an existing page (keep the `---\n---` front matter and the
  `{% include analytics.html %}`), update content/meta/JSON-LD, add it to
  `sitemap.xml` and `llms.txt`, and link it from the nav/footer where appropriate.
- **Add a blog post:** copy a `blog-*.html` article, then update `blog.html`
  (hub card), `sitemap.xml`, `feed.xml`, and `llms.txt`.
- **Edit the homepage:** edit `_includes/homepage-original.html` (content) or the
  `replace_first` substitutions in `index.html` (H1/hero copy) — see "The
  homepage is a Liquid wrapper".
- **Edit styling:** edit the inline `<style>` block in the specific page (or
  `blog.css` for articles); use the existing CSS variables. Page styles are not
  shared across the service/landing pages.
- **Update analytics:** edit `_includes/analytics.html` (one place). For
  `tracking.js` behavior changes, edit the script and bump `?v=` on all pages.
- **Always update `sitemap.xml`** (add/remove `<url>` entries, refresh
  `<lastmod>`) when pages are added, removed, or substantially changed.

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
