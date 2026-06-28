# HTML Update Targets

Add the legal footer script and form consent text to these pages before final launch:

- index.html
- travel-insurance.html
- health-insurance.html
- group-benefits.html
- critical-illness.html
- estate-planning.html
- long-term-care.html
- savings-plans.html
- super-visa-insurance-ontario.html
- visitor-insurance-canada.html
- blog-supervisa-cost.html
- thankyou.html

## Footer script

Place before closing body tag:

```html
<script src="legal-footer.js" defer></script>
```

## Form consent

Place under each form submit button:

```html
<p class="form-disclaimer">
  By submitting this form, you consent to Cover &amp; Protect contacting you regarding your insurance inquiry.
  Your information will be handled according to our <a href="privacy-policy.html">Privacy Policy</a>.
  FSRA Licence #10112782.
</p>
```
