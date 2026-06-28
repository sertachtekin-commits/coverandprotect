# TODO Before Merge

This branch is ready for review, but do these checks before merging to `main`:

1. Review all legal wording.
2. Confirm FSRA Licence #10112782.
3. Confirm phone and email.
4. Decide whether to insert `legal-footer.js` into all public HTML pages before merge.
5. Add the form consent snippet to all existing forms.
6. Test all new pages in browser after deployment.
7. Submit sitemap in Google Search Console after deployment.

Recommended final technical step:

Add before `</body>` on every public page:

```html
<script src="legal-footer.js" defer></script>
```
