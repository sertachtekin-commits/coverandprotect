# Lead sorter

Labels each Formspree lead email in Gmail by product: `Leads/Super Visa`,
`Leads/Visitor to Canada`, `Leads/Travel (outbound)`, `Leads/Health & Dental`,
`Leads/Group Benefits`, `Leads/Critical Illness`, `Leads/Life & Estate`,
`Leads/Long-Term Care`, `Leads/Savings & Investments`, or `Leads/Needs review`.
Every processed email also gets `Leads/Sorted`.

It is a Google Apps Script that runs inside the inbox that receives the lead
emails (Gmail or Google Workspace). The website is not changed, and leads keep
arriving exactly as before.

## How it decides

1. **No typed message:** the label comes from the form itself. That is the
   page the form was on, or the product picked in the buy-online dropdown.
   TypeSafe is not called, so this costs nothing.
2. **Typed message:** TypeSafe reads the page name plus the answers and picks
   the product. If it is confident (`MIN_CONFIDENCE`, 0.7 to start), that
   label is applied. If it disagrees with the page, both labels are applied.
   For example, a lead on the travel page asking about "my parents' Super Visa"
   gets both labels.
3. **Otherwise:** the label comes from the page. Leads from general forms
   (buy-online, calculator) go to `Leads/Needs review`.

## What leaves the inbox

Only the page name and the coverage answers (ages, dates, dropdowns, the typed
message) are sent to TypeSafe. Name, email, phone, the thank-you redirect and
ad-click IDs (`utm_*`, `gclid`, …) are removed. Any email address or phone
number typed inside the message is masked as `[email]` / `[phone]`. The message
can still contain other personal details, such as health conditions, so add
TypeSafe to your list of service providers in the privacy policy before turning
this on.

## Setup (about 10 minutes, once)

1. Sign in to **sertach.tekin@gmail.com**, the account that receives the
   Cover & Protect lead emails. Then open <https://script.google.com> → **New project**. Name it "Lead sorter".
2. Replace the contents of `Code.gs` with this folder's `Code.gs`, then save.
3. **Project Settings** (gear icon) → **Script properties** → add
   `TYPESAFE_API_KEY` = your key from TypeSafe. The key stays in the script
   properties, never in the code or the website.
4. Back in the editor, pick `sortLeads` from the function menu and click
   **Run**. Approve the Gmail permissions it asks for. Check the new
   `Leads/…` labels in Gmail.
5. Pick `installTrigger` and click **Run** once. From then on it sorts new
   leads every 10 minutes.

To stop it: **Triggers** (clock icon) → delete the `sortLeads` trigger.

## Tuning

- **Wrong labels:** raise `MIN_CONFIDENCE`. **Too many in Needs review:**
  lower it. Check a few weeks of real leads before settling on a value.
- **Added a new page or form:** add its `_subject` to `SUBJECT_RULES`. If it
  is a new product, also add it to `PRODUCT_LABELS` and to the `criteria` in
  `PRODUCT_QUESTION`.
- **Only the last 14 days are scanned** (`LEAD_QUERY`). To sort older leads
  once, temporarily change `newer_than:14d` to, for example, `newer_than:1y`.
  Then run `sortLeads` by hand a few times; it handles 20 emails per run.

## Tests

```sh
cd tools/lead-sorter
npm i --no-save --no-package-lock @typesafe-ai/sdk
node test.mjs
```

The tests use a stand-in for TypeSafe, so they need no key or network. They
compare the request against the one the official SDK builds, and they check
that contact details are never sent.
