/**
 * Cover & Protect chatbot — AI fallback (Cloudflare Worker, free tier)
 *
 * What it does: receives a visitor's question from the website chatbot,
 * forwards it to OpenAI with a Cover & Protect system prompt, returns the answer.
 *
 * Your OpenAI key is stored in Cloudflare as an encrypted secret. It NEVER
 * appears in your website code, in this file, or in the GitHub repo.
 *
 * SETUP (Cloudflare dashboard):
 *  1. Workers & Pages -> Create Worker -> Deploy -> Edit code -> paste this file -> Deploy.
 *  2. Settings -> Variables and Secrets -> Add secret:
 *       name  = OPENAI_API_KEY
 *       value = your OpenAI API key (from https://platform.openai.com/api-keys)
 *     (Optional variables: OPENAI_MODEL = gpt-4o-mini, ALLOWED_ORIGIN = https://coverandprotect.ca)
 *  3. Copy the worker's https://xxx.workers.dev URL and send it to your developer
 *     to wire into the chatbot.
 */

const SYSTEM_PROMPT = [
  "You are the website assistant for Cover & Protect, an independent insurance brokerage in Ontario, Canada.",
  "Licence: FSRA #10112782. Phone/WhatsApp: 437-385-6173. Email: contact@coverandprotect.ca. Site: coverandprotect.ca.",
  "Services: Super Visa insurance, Visitor to Canada insurance, snowbird / long-stay travel insurance, annual multi-trip travel insurance, individual health insurance, group benefits.",
  "Rules:",
  "- Answer in plain Canadian English, under 120 words unless the visitor asks for detail.",
  "- Never invent prices or premiums. If asked about cost, say what affects the price and invite a free comparison via WhatsApp 437-385-6173 or the site's instant quote tool.",
  "- Never give binding insurance advice; say coverage depends on the insurer's policy wording and offer to connect them with Sertac, the licensed advisor.",
  "- If the question is unrelated to insurance or travel, politely redirect to insurance topics.",
  "- Do not claim to be human; you are the Cover & Protect website assistant.",
  "Remember customer details already shared and ask only for missing information, one question at a time.",
  "Never invent an insurer premium, claim to have a live insurer quote, guarantee coverage, or bind a policy. No insurer rating API is integrated.",
  "For a real premium, guide customers to the linked insurer quotation application or licensed advisor Sertac.",
  "For pre-existing conditions, eligibility and medical stability periods, explain that insurer policy wording and underwriting govern; refer decisions to the insurer or advisor.",
  "Do not request detailed medical histories, health card numbers, or payment data in chat.",
  "Your goal is to move visitors toward a quote:",
  "- Ask at most 2 short qualifying questions (who needs coverage, destination and dates, ages).",
  "- Then point to the right next step:",
  "  * Visitor to Canada / Super Visa: the instant quote tool at https://coverandprotect.ca/instant-quote.html",
  "  * Travel abroad / annual plans: https://coverandprotect.ca/buy-online.html (TuGo store and TruStone applications)",
  "  * Complex cases or pre-existing conditions: WhatsApp 437-385-6173 for a personal quote from Sertac.",
].join("\n");

const MAX_MESSAGE = 1000;
const MAX_HISTORY = 6;
const RATE_LIMIT = 20;        // max requests
const RATE_WINDOW_MS = 60000; // per minute, per IP (per isolate — best effort)
const hits = new Map();

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, cors),
  });
}

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_LIMIT;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = String(env.ALLOWED_ORIGIN || "https://coverandprotect.ca")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405, headers: cors });
    if (origin && !allowed.includes(origin))
      return new Response("Forbidden", { status: 403, headers: cors });

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip)) return json({ error: "rate_limited" }, 429, cors);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "bad_request" }, 400, cors);
    }

    const message = String(body.message || "").slice(0, MAX_MESSAGE).trim();
    if (!message) return json({ error: "empty_message" }, 400, cors);

    const history = Array.isArray(body.history)
      ? body.history.slice(-MAX_HISTORY).map((m) => ({
          role: m && m.role === "assistant" ? "assistant" : "user",
          content: String((m && m.content) || "").slice(0, MAX_MESSAGE),
        }))
      : [];

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) return json({ error: "not_configured" }, 500, cors);
    const model = env.OPENAI_MODEL || "gpt-4o-mini";

    let r;
    try {
      r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
            { role: "user", content: message },
          ],
          max_tokens: 300,
          temperature: 0.4,
        }),
      });
    } catch (e) {
      return json({ error: "upstream_failed" }, 502, cors);
    }

    if (!r.ok) return json({ error: "provider_error" }, 502, cors);

    let data;
    try {
      data = await r.json();
    } catch (e) {
      return json({ error: "bad_response" }, 502, cors);
    }
    const reply = String((((data.choices || [])[0] || {}).message || {}).content || "").trim();
    if (!reply) return json({ error: "empty_reply" }, 502, cors);
    return json({ reply }, 200, cors);
  },
};
