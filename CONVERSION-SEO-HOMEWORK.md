# Cover & Protect Conversion SEO Homework

This checklist covers the remaining work that cannot be completed inside the website repository.

## 1. GA4 setup

- Confirm property ID `G-J7F01SWCLW` is the active Cover & Protect GA4 property.
- In Admin > Events, verify these events are arriving:
  - `generate_lead`
  - `form_start`
  - `cta_click`
  - `phone_click`
  - `email_click`
  - `whatsapp_click`
  - `booking_click`
  - `calculator_click`
  - `truestone_click`
  - `tugo_click`
  - `ai_referral_visit`
  - `lead_interest_selected`
- Mark `generate_lead` as a key event.
- Consider marking `phone_click`, `booking_click`, and `whatsapp_click` as secondary key events, not primary lead conversions.
- Create custom dimensions for:
  - `cta_section`
  - `cta_variant`
  - `ai_assistant`
  - `referrer_host`
  - `product_interest`
  - `lead_source`
- Build a funnel exploration:
  1. Landing page view
  2. CTA click
  3. Form start
  4. Generate lead
- Segment by landing page, device, source/medium, city page, and AI assistant.

## 2. Google Ads conversion setup

- Create a Website Lead conversion action in Google Ads.
- Copy the `AW-XXXXXXXXXX` ID and conversion label.
- Add both values to `_includes/analytics.html` using the existing commented template.
- Import `generate_lead` from GA4 only if direct Ads tracking is not enabled; avoid counting the same lead twice.
- Set phone-click and insurer outbound-click conversions as secondary actions until lead quality is proven.

## 3. Search Console CTR work

Every Monday, export queries and pages for the latest 28 days and compare with the previous 28 days.

Prioritize pages with:
- more than 100 impressions,
- positions 5–20,
- CTR below the site average.

For each priority page, test one title and description change at a time. Keep each test live for at least 21–28 days unless traffic is very low.

Suggested title patterns:
- `Travel Insurance for Canadians | Compare Ontario Plans`
- `Super Visa Insurance Ontario | Compare Plans & Deductibles`
- `Visitor Insurance Toronto | Licensed Ontario Advisor`
- `Travel Insurance Calculator Canada | Estimate Your Cost`

Avoid changing page titles weekly. Record the old title, new title, date, impressions, CTR and average position.

## 4. Lead quality tracking

For every inquiry, record:
- date,
- source,
- landing page,
- product requested,
- city,
- quoted/not quoted,
- sale/not sold,
- premium or commission value,
- reason lost.

Minimum monthly report:
- leads by source,
- qualified-lead rate,
- quote rate,
- close rate,
- cost per lead,
- revenue or commission per lead.

Do not optimize campaigns only for form volume. Optimize for qualified leads and bound policies.

## 5. CTA testing

Run one controlled test at a time.

Test A:
- Control: `Get a Free Quote`
- Variant: `Compare Insurance Options`

Test B:
- Control: form CTA
- Variant: `Speak With a Licensed Ontario Advisor`

Test C:
- Control: phone CTA
- Variant: `Call or Text 647-366-9495`

Measure CTA click rate, form-start rate and lead rate by `cta_variant` and `cta_section`.

## 6. Lead magnet production

Create one useful, compliance-safe lead magnet before adding more blog articles.

Recommended first asset:

`Super Visa Insurance Comparison Checklist`

Include:
- applicant age,
- arrival date,
- required coverage period,
- deductible options,
- pre-existing conditions,
- medication changes,
- refund conditions,
- monthly-payment availability,
- insurer-document requirements.

Do not promise the cheapest price or guaranteed eligibility. Gate the download with name and email only, then offer a quote consultation.

## 7. Form optimization

Keep initial forms short:
- name,
- email or phone,
- insurance type,
- short message.

Ask detailed medical and underwriting questions only after contact through an approved secure process. Never collect sensitive medical information through ordinary analytics or hidden tracking fields.

Review Formspree delivery weekly and submit a real test inquiry from mobile and desktop after every deployment.

## 8. AI referral validation

In GA4, create a comparison using event `ai_referral_visit` and dimension `ai_assistant`.

Also inspect Traffic Acquisition for referrals from:
- ChatGPT/OpenAI,
- Perplexity,
- Microsoft Copilot/Bing,
- Gemini,
- Claude,
- You.com,
- Phind.

Some AI tools suppress referrer data. Treat measured AI traffic as a minimum, not a complete count. Add a form question such as `How did you hear about us?` with an `AI assistant` option to validate attribution.

## 9. Monthly conversion targets

Initial operating targets:
- Organic CTR: improve by at least 20% on tested pages.
- Landing-page CTA click rate: 3% or higher.
- CTA click to form-start rate: 35% or higher.
- Form-start to lead rate: 45% or higher.
- Organic-session to lead rate: 2% or higher.

Adjust targets after at least 100 qualified sessions per page or 20 leads, whichever provides the more reliable sample.
