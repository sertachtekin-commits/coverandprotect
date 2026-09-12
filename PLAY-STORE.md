# Publishing the buy-online app to Google Play

The app at `app.html` can be listed on Google Play as a **Trusted Web Activity**
(TWA) — an Android wrapper that runs the live site fullscreen, with no browser
chrome. There is no separate Android codebase: the site *is* the app, so
anything pushed to `main` reaches Play users on their next launch.

Apple's App Store is **not** covered here. It rejects website wrappers under
review guideline 4.2.2, so an App Store listing would need genuinely native
features built first.

## What is already done in this repo

- `.well-known/assetlinks.json` — the Digital Asset Links file Android checks to
  confirm this domain and the Play app belong to the same owner. **The
  fingerprint in it is a placeholder** (see step 3).
- `_config.yml` has `include: [.well-known]`. Jekyll skips dot-directories by
  default, so without this the file silently never reaches the live site and the
  app shows a browser address bar. Don't remove it.
- `manifest.json` carries `related_applications` (declaring the intended package
  name) and `prefer_related_applications: false`.

## Steps

**1. Register a Play Developer account** — $25 once, at
<https://play.google.com/console>.

Register as an **organization**, not a personal account. Personal accounts must
run a closed test with 12 testers for 14 days before they may publish publicly;
organization accounts are exempt. An organization account needs a free D-U-N-S
number for the business, which takes about a week to issue.

**2. Generate the Android package** at <https://www.pwabuilder.com>. Enter
`https://coverandprotect.ca/app.html`, choose the Android / Play package, and set
the package ID to **`ca.coverandprotect.app`** — it must match `assetlinks.json`
and `manifest.json` exactly, and it can never be changed after first publish.
Download the zip; it contains the `.aab` to upload and a signing key.

**3. Put the real fingerprint into `assetlinks.json`.** This is the step that
makes the address bar disappear, and the one most often skipped.

Take the SHA-256 certificate fingerprint of the **app signing key**, from Play
Console under *Setup → App integrity → App signing*. (The fingerprint in
PWABuilder's zip is the *upload* key. If Play re-signs the app — the default —
these differ, and using the wrong one leaves the address bar visible.)

Replace `REPLACE_WITH_SHA256_FINGERPRINT_FROM_PLAY_CONSOLE` in
`.well-known/assetlinks.json` with it, keeping the `AB:CD:EF:...` colon format,
then commit and push. Verify it is live at
<https://coverandprotect.ca/.well-known/assetlinks.json> before releasing.

**4. Complete the Play listing.** You will need:

- 2–8 phone screenshots. **Take these on a real phone** from
  `coverandprotect.ca/app.html` — the app's start screen and a matched plan are
  the two that sell it. They are not generated from this repo.
- A 512×512 app icon and a 1024×500 feature graphic.
- Privacy policy URL: `https://coverandprotect.ca/privacy-policy.html`.
- The Data safety form. The app collects the lead-form fields and sends
  analytics; it does not collect payment details, since payment happens on the
  insurer's own portal.
- A content rating questionnaire, and the Financial features declaration —
  declare insurance and be ready to cite **FSRA Licence #10112782**.

**5. After the listing is live**, decide whether to set
`prefer_related_applications` to `true` in `manifest.json`. Doing so makes Chrome
on Android promote the Play app instead of offering the web install. Leave it
`false` until then — otherwise Chrome suppresses the working web install and
points people at a listing that does not exist yet.

## Keeping it working

The TWA loads the live site, so ordinary deploys reach app users with no Play
release needed. A new Play release is only required to change the package
itself — icon, name, target SDK, or the launch URL.

Two things must stay in sync, or the app breaks in ways that are easy to miss:

- The package name in `assetlinks.json`, `manifest.json`, and Play Console.
- The signing fingerprint in `assetlinks.json`. If Play's signing key is ever
  reset, update the file or every install falls back to showing the address bar.
