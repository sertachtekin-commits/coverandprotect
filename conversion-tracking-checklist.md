# Conversion Tracking Checklist

## Primary conversions

- Quote form submission
- Contact form submission
- Thank-you page visit: `/thankyou.html?lead=1`
- Phone click: `tel:6473669495`
- Calendly click: `https://calendly.com/contact-coverandprotect/30min`

## Recommended Google Ads conversion actions

1. Lead form submit
   - Category: Submit lead form
   - Primary conversion: Yes

2. Phone click
   - Category: Contact
   - Primary conversion: Yes, if call quality is good

3. Calendly booking click
   - Category: Book appointment
   - Primary conversion: Yes

4. Page view of thank-you page
   - Category: Submit lead form
   - Primary conversion: Yes only if form reliably redirects to thank-you page

## GA4 events to verify

- generate_lead
- click_to_call
- calendly_click
- form_submit

## Testing

After deployment:

- Submit test quote form
- Submit test contact form
- Click phone number on mobile
- Click Calendly button
- Confirm events appear in GA4 Realtime
- Confirm conversions appear in Google Ads diagnostics
