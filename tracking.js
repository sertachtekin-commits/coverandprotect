/* Cover & Protect campaign measurement foundation.
 * GA4 receives only engagement metadata—never form values or contact details.
 * Mark "generate_lead" as a conversion in GA4, then import it to Google Ads.
 * For a direct Google Ads conversion tag, set window.CP_ADS_CONVERSION in
 * _includes/analytics.html (see the comment there); generate_lead will then
 * also fire the Ads conversion event.
 */
(function () {
  "use strict";

  var fired = {};
  var attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid"];
  var ATTRIBUTION_STORE = "cp_campaign_attribution";
  var ATTRIBUTION_MAX_AGE_DAYS = 90; // matches the Google Ads click-through conversion window

  function readStore(storage) {
    try { return JSON.parse(storage.getItem(ATTRIBUTION_STORE) || "{}"); } catch (e) { return {}; }
  }

  function readAttribution() {
    // localStorage keeps attribution across visits (a lead that returns days
    // after the ad click still credits the campaign); sessionStorage is the
    // fallback and migration source from the previous version of this script.
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

  var attribution = readAttribution();

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
    // Direct Google Ads conversion tag (optional): set
    // window.CP_ADS_CONVERSION = "AW-XXXXXXXXXX/xxxxxxxxxxx" in analytics.html.
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

  // Stamp lead forms with campaign attribution so each Formspree email shows
  // which campaign/click produced the lead. This adds ad-click metadata to the
  // owner's own lead email only—nothing extra is sent to analytics.
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
  }

  document.addEventListener("click", function (event) {
    var link = closestLink(event.target);
    if (!link) { return; }

    var href = link.href || "";
    var details = {
      link_url: href,
      link_text: cleanText(link.textContent)
    };

    if (/^tel:/i.test(href)) {
      sendEvent("phone_click", details);
    } else if (/^mailto:/i.test(href)) {
      sendEvent("email_click", details);
    } else if (/wa\.me|api\.whatsapp\.com|web\.whatsapp\.com/i.test(href)) {
      sendEvent("whatsapp_click", details);
    }

    if (/trustonehealth\.ca/i.test(href) || link.dataset.trustonePlan) {
      sendEvent("truestone_click", Object.assign({}, details, {
        provider: "TruStone Health",
        plan_code: link.dataset.trustonePlan || "",
        application_type: link.dataset.applicationType || "online_application"
      }));
    }
  }, true);

  document.addEventListener("focusin", function (event) {
    var form = event.target && event.target.form;
    if (!form) { return; }
    stampForm(form);
    once("form-start-" + (form.id || form.name || "unknown"), "form_start", {
      form_id: form.id || "",
      form_name: form.name || ""
    });
  }, true);

  var nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function () {
      var args = arguments;
      return nativeFetch.apply(this, args).then(function (response) {
        var requestUrl = "";
        var request = args[0];
        if (typeof request === "string") {
          requestUrl = request;
        } else if (request && request.url) {
          requestUrl = request.url;
        }

        if (response && response.ok && /formspree\.io/i.test(requestUrl)) {
          if (!fired["lead-" + window.location.pathname]) {
            fired["lead-" + window.location.pathname] = true;
            sendLead({ lead_source: "website_form", form_provider: "formspree" });
          }
        }
        return response;
      });
    };
  }

  var pageParams = new URLSearchParams(window.location.search);
  if (/\/thankyou\.html$/i.test(window.location.pathname) && pageParams.get("lead") === "1") {
    // Guard against refreshes/back-navigation re-firing the conversion and
    // inflating the numbers Google Ads bids against.
    var alreadyCounted = false;
    try { alreadyCounted = sessionStorage.getItem("cp_lead_counted") === "1"; } catch (e) {}
    if (!alreadyCounted) {
      try { sessionStorage.setItem("cp_lead_counted", "1"); } catch (e) {}
      sendLead({ lead_source: "website_form", form_provider: "formspree" });
    }
  }

  if (Object.keys(attribution).length) {
    sendEvent("campaign_landing", { campaign_source: attribution.utm_source || "" });
  }
}());
