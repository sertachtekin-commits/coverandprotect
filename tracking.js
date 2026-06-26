/* Cover & Protect campaign measurement foundation.
 * GA4 receives only engagement metadata—never form values or contact details.
 * Mark "generate_lead" as a conversion in GA4, then import it to Google Ads.
 */
(function () {
  "use strict";

  var fired = {};
  var attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid"];

  function readAttribution() {
    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem("cp_campaign_attribution") || "{}"); } catch (e) {}
    var params = new URLSearchParams(window.location.search);
    attributionKeys.forEach(function (key) {
      var value = params.get(key);
      if (value) { saved[key] = value; }
    });
    try { sessionStorage.setItem("cp_campaign_attribution", JSON.stringify(saved)); } catch (e) {}
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

    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(["event", name, params]);
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
  }, true);

  document.addEventListener("focusin", function (event) {
    var form = event.target && event.target.form;
    if (!form) { return; }
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
          once("lead-" + window.location.pathname, "generate_lead", {
            lead_source: "website_form",
            form_provider: "formspree"
          });
        }
        return response;
      });
    };
  }

  if (Object.keys(attribution).length) {
    sendEvent("campaign_landing", { campaign_source: attribution.utm_source || "" });
  }
}());
