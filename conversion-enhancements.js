/* Progressive conversion enhancements for Cover & Protect.
 * Enhances existing forms and CTA attribution without collecting sensitive data.
 */
(function () {
  "use strict";

  function text(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function sectionName(element) {
    var section = element.closest && element.closest("section,header,nav,footer,.hero,.cta,.quote-section");
    if (!section) return "unknown";
    return section.id || section.getAttribute("data-section") || section.className || section.tagName.toLowerCase();
  }

  function addHidden(form, name, value) {
    if (!form || !value || form.querySelector('[name="' + name + '"]')) return;
    var input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value).slice(0, 200);
    form.appendChild(input);
  }

  function addLeadSourceQuestion(form) {
    if (!form || form.querySelector('[name="heard_about_us"]')) return;
    var wrapper = document.createElement("label");
    wrapper.className = "cp-source-field";
    wrapper.style.cssText = "display:block;margin:12px 0;font-size:.88rem";
    wrapper.innerHTML = '<span style="display:block;margin-bottom:6px">How did you hear about us?</span>' +
      '<select name="heard_about_us" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:#fff;color:#0a1628">' +
      '<option value="">Select one</option><option>Google Search</option><option>Google Maps</option><option>AI assistant</option><option>Referral</option><option>Social media</option><option>Other</option></select>';
    var submit = form.querySelector('[type="submit"],button:not([type])');
    if (submit) form.insertBefore(wrapper, submit); else form.appendChild(wrapper);
  }

  function addFormReassurance(form) {
    if (!form || form.querySelector(".cp-form-reassurance")) return;
    var note = document.createElement("div");
    note.className = "cp-form-reassurance";
    note.style.cssText = "margin:10px 0 14px;padding:10px 12px;border-radius:8px;background:rgba(14,124,123,.12);font-size:.8rem;line-height:1.45";
    note.textContent = "Free, no-obligation comparison. Please do not submit sensitive medical details through this form.";
    var submit = form.querySelector('[type="submit"],button:not([type])');
    if (submit) form.insertBefore(note, submit); else form.appendChild(note);
  }

  function enhanceForm(form) {
    if (!form || form.dataset.cpConversionEnhanced) return;
    form.dataset.cpConversionEnhanced = "1";
    addHidden(form, "landing_page", window.location.pathname);
    addHidden(form, "referrer", document.referrer);
    addLeadSourceQuestion(form);
    addFormReassurance(form);
  }

  function markCtas() {
    Array.prototype.forEach.call(document.querySelectorAll('a[href*="#quote"],a[href^="tel:"],a[href*="calendly"],button[type="submit"]'), function (el, index) {
      if (!el.dataset.ctaSection) el.dataset.ctaSection = sectionName(el);
      if (!el.dataset.ctaVariant) el.dataset.ctaVariant = text(el.textContent) || (el.tagName.toLowerCase() + "-" + index);
    });
  }

  function addStickyMobileCta() {
    if (document.querySelector(".cp-mobile-cta")) return;
    var bar = document.createElement("div");
    bar.className = "cp-mobile-cta";
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9997;display:none;gap:8px;padding:10px;background:rgba(10,22,40,.97);border-top:1px solid rgba(255,255,255,.12)";
    bar.innerHTML = '<a href="tel:6473669495" data-cta-section="mobile_sticky" data-cta-variant="call_advisor" style="flex:1;text-align:center;padding:11px 8px;border-radius:8px;background:#0e7c7b;color:#fff;text-decoration:none;font-weight:700">Call Advisor</a>' +
      '<a href="/#quote" data-cta-section="mobile_sticky" data-cta-variant="compare_options" style="flex:1;text-align:center;padding:11px 8px;border-radius:8px;background:#c9973a;color:#0a1628;text-decoration:none;font-weight:700">Compare Options</a>';
    document.body.appendChild(bar);
    var style = document.createElement("style");
    style.textContent = "@media(max-width:760px){.cp-mobile-cta{display:flex!important}body{padding-bottom:70px!important}}";
    document.head.appendChild(style);
  }

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("form"), enhanceForm);
    markCtas();
    addStickyMobileCta();
  });
}());
