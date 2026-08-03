/* Cover & Protect campaign and conversion measurement foundation.
 * GA4 receives only engagement metadata—never form values or contact details.
 * Mark "generate_lead" as a key event in GA4, then import it to Google Ads.
 */
(function () {
  "use strict";

  var fired = {};
  var attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid"];
  var ATTRIBUTION_STORE = "cp_campaign_attribution";
  var ATTRIBUTION_MAX_AGE_DAYS = 90;

  function readStore(storage) {
    try { return JSON.parse(storage.getItem(ATTRIBUTION_STORE) || "{}"); } catch (e) { return {}; }
  }

  function readAttribution() {
    var saved = {};
    var stored = readStore(window.localStorage || {});
    var legacy = readStore(window.sessionStorage || {});
    var fresh = stored._ts && (Date.now() - stored._ts) < ATTRIBUTION_MAX_AGE_DAYS * 864e5;
    attributionKeys.forEach(function (key) {
      var value = (fresh && stored[key]) || legacy[key];
      if (value) { saved[key] = value; }
    });
    var params = new URLSearchParams(window.location.search);
    var updated = false;
    attributionKeys.forEach(function (key) {
      var value = params.get(key);
      if (value) { saved[key] = value; updated = true; }
    });
    if (updated || !fresh) {
      var toStore = Object.assign({}, saved, { _ts: (fresh && !updated) ? stored._ts : Date.now() });
      try { localStorage.setItem(ATTRIBUTION_STORE, JSON.stringify(toStore)); } catch (e) {}
    }
    try { sessionStorage.setItem(ATTRIBUTION_STORE, JSON.stringify(saved)); } catch (e) {}
    return saved;
  }

  function identifyAIReferrer() {
    var host = "";
    try { host = new URL(document.referrer || "").hostname.toLowerCase(); } catch (e) {}
    var patterns = [
      ["chatgpt", /chatgpt\.com|chat\.openai\.com|openai\.com/],
      ["perplexity", /perplexity\.ai/],
      ["copilot", /copilot\.microsoft\.com|bing\.com/],
      ["gemini", /gemini\.google\.com|bard\.google\.com/],
      ["claude", /claude\.ai|anthropic\.com/],
      ["you.com", /you\.com/],
      ["phind", /phind\.com/]
    ];
    for (var i = 0; i < patterns.length; i += 1) {
      if (patterns[i][1].test(host)) { return { assistant: patterns[i][0], referrer_host: host }; }
    }
    return null;
  }

  var attribution = readAttribution();
  var aiReferral = identifyAIReferrer();

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 100);
  }

  function sendEvent(name, details) {
    var params = Object.assign({
      page_location: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title
    }, attribution, details || {});
    delete params._ts;
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(["event", name, params]);
    }
  }

  function sendLead(details) {
    sendEvent("generate_lead", details);
    if (window.CP_ADS_CONVERSION && typeof window.gtag === "function") {
      window.gtag("event", "conversion", { send_to: window.CP_ADS_CONVERSION });
    }
  }

  function once(key, name, details) {
    if (fired[key]) { return; }
    fired[key] = true;
    sendEvent(name, details);
  }

  function closestLink(target) {
    while (target && target !== document) {
      if (target.tagName === "A" && target.href) { return target; }
      target = target.parentNode;
    }
    return null;
  }

  function elementSection(element) {
    var section = element && element.closest ? element.closest("section,header,nav,footer,.hero,.cta,.quote-section") : null;
    return cleanText((section && (section.id || section.className)) || "unknown");
  }

  function stampForm(form) {
    if (!form || form.dataset.cpStamped || !/formspree\.io/i.test(form.action || "")) { return; }
    form.dataset.cpStamped = "1";
    attributionKeys.forEach(function (key) {
      var value = attribution[key];
      if (!value || form.querySelector('input[name="' + key + '"]')) { return; }
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value).slice(0, 200);
      form.appendChild(input);
    });
    var sourcePairs = [
      ["source_page", window.location.pathname],
      ["source_title", document.title],
      ["product_interest", form.dataset.product || document.body.dataset.product || ""],
      ["ai_assistant", aiReferral ? aiReferral.assistant : ""],
      ["referrer_host", aiReferral ? aiReferral.referrer_host : ""]
    ];
    sourcePairs.forEach(function (pair) {
      if (form.querySelector('input[name="' + pair[0] + '"]')) { return; }
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = pair[0];
      input.value = String(pair[1] || "").slice(0, 200);
      form.appendChild(input);
    });
    if (!form.querySelector(".cp-form-consent")) {
      var consent = document.createElement("p");
      consent.className = "cp-form-consent";
      consent.style.cssText = "font-size:.78rem;line-height:1.45;opacity:.78;margin:12px 0";
      consent.innerHTML = 'By submitting, you agree that Cover &amp; Protect may contact you about this request. See our <a href="/privacy-policy.html">Privacy Policy</a>.';
      var submit = form.querySelector('[type="submit"],button:not([type])');
      if (submit) { form.insertBefore(consent, submit); } else { form.appendChild(consent); }
    }
  }

  document.addEventListener("click", function (event) {
    var link = closestLink(event.target);
    if (!link) { return; }
    var href = link.href || "";
    var details = {
      link_url: href,
      link_text: cleanText(link.textContent),
      cta_section: elementSection(link),
      cta_variant: cleanText(link.dataset.ctaVariant || link.className || "")
    };
    if (/^tel:/i.test(href)) {
      sendEvent("phone_click", details);
    } else if (/^mailto:/i.test(href)) {
      sendEvent("email_click", details);
    } else if (/wa\.me|api\.whatsapp\.com|web\.whatsapp\.com/i.test(href)) {
      sendEvent("whatsapp_click", details);
    } else if (/calendly\.com/i.test(href)) {
      sendEvent("booking_click", details);
    }
    if (link.dataset.cta || /#quote|quote|consultation|calculator/i.test(cleanText(link.textContent) + " " + href)) {
      sendEvent("cta_click", details);
    }
    if (/travel-insurance-calculator\.html/i.test(href)) {
      sendEvent("calculator_click", details);
    }
    if (/trustonehealth\.ca/i.test(href) || link.dataset.trustonePlan) {
      sendEvent("truestone_click", Object.assign({}, details, { provider: "TruStone Health", plan_code: link.dataset.trustonePlan || "", application_type: link.dataset.applicationType || "online_application" }));
    }
    if (/tugo\.com/i.test(href) || link.dataset.tugoStore) {
      sendEvent("tugo_click", Object.assign({}, details, { provider: "TuGo", application_type: link.dataset.applicationType || "online_store" }));
    }
  }, true);

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("form"), stampForm);
    if (aiReferral) {
      sendEvent("ai_referral_visit", aiReferral);
    }
  });

  document.addEventListener("focusin", function (event) {
    var form = event.target && event.target.form;
    if (!form) { return; }
    stampForm(form);
    once("form-start-" + (form.id || form.name || "unknown"), "form_start", {
      form_id: form.id || "",
      form_name: form.name || "",
      form_section: elementSection(form)
    });
  }, true);

  document.addEventListener("change", function (event) {
    var field = event.target;
    var form = field && field.form;
    if (!form) { return; }
    var name = String(field.name || "").toLowerCase();
    if (/product|insurance|coverage|interest|service/.test(name)) {
      sendEvent("lead_interest_selected", {
        form_id: form.id || "",
        interest_field: cleanText(field.name),
        interest_value: cleanText(field.value)
      });
    }
  }, true);

  var nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function () {
      var args = arguments;
      return nativeFetch.apply(this, args).then(function (response) {
        var requestUrl = "";
        var request = args[0];
        if (typeof request === "string") { requestUrl = request; }
        else if (request && request.url) { requestUrl = request.url; }
        if (response && response.ok && /formspree\.io/i.test(requestUrl)) {
          if (!fired["lead-" + window.location.pathname]) {
            fired["lead-" + window.location.pathname] = true;
            sendLead({ lead_source: "website_form", form_provider: "formspree", ai_assistant: aiReferral ? aiReferral.assistant : "" });
          }
        }
        return response;
      });
    };
  }

  var pageParams = new URLSearchParams(window.location.search);
  if (/\/thankyou\.html$/i.test(window.location.pathname) && pageParams.get("lead") === "1") {
    var alreadyCounted = false;
    try { alreadyCounted = sessionStorage.getItem("cp_lead_counted") === "1"; } catch (e) {}
    if (!alreadyCounted) {
      try { sessionStorage.setItem("cp_lead_counted", "1"); } catch (e) {}
      sendLead({ lead_source: "website_form", form_provider: "formspree", ai_assistant: aiReferral ? aiReferral.assistant : "" });
    }
  }

  if (Object.keys(attribution).length) {
    sendEvent("campaign_landing", { campaign_source: attribution.utm_source || "" });
  }
}());
