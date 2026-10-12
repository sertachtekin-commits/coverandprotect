/**
 * Cover & Protect sales assistant — Cloudflare Worker (OpenAI tool calling)
 *
 * What changed vs. the first version: the model now has TOOLS. Previously it
 * could only talk, which is why it behaved like a brochure — it had no way to
 * price anything, no memory of what the visitor had already said, and no way to
 * turn a good conversation into a lead. It now runs a two-round protocol:
 *
 *   Round 1  browser POSTs {message, history, profile}
 *            -> model may answer directly, or return tool_calls
 *            -> worker returns {tool_calls, assistant} and STOPS
 *   Round 2  browser executes the tools locally and POSTs
 *            {history, assistant, tool_results}
 *            -> worker feeds the results back, model writes the final answer
 *
 * The tools run in the BROWSER on purpose. The illustrative rate bands already
 * live in _includes/cpbot.html (and must match travel-insurance-calculator.html).
 * Executing them here would create a third copy to keep in sync, and drifting
 * rate tables is how a customer gets quoted one number and shown another.
 *
 * The OpenAI key is a Cloudflare encrypted secret. It never appears in this
 * file, in the website, or in the repo.
 *
 * SETUP
 *  1. Workers & Pages -> Create Worker -> Deploy -> Edit code -> paste -> Deploy.
 *  2. Settings -> Variables and Secrets -> Add secret:
 *       OPENAI_API_KEY = your key from https://platform.openai.com/api-keys
 *     Optional plain variables:
 *       OPENAI_MODEL   = gpt-4o-mini
 *       ALLOWED_ORIGIN = https://coverandprotect.ca
 *  3. GET on this URL returns 405 "Method not allowed" — that is correct and
 *     means it is alive. It only accepts POST.
 */

const SYSTEM_PROMPT = [
  "You are the sales assistant for Cover & Protect, an independent insurance advisory in Toronto, Ontario.",
  "Licensed advisor: Sertac Tekin, FSRA #10112782. Phone/WhatsApp 437-385-6173. contact@coverandprotect.ca.",
  "Products: Super Visa insurance, Visitor to Canada insurance, snowbird / long-stay travel, annual multi-trip, individual health, group benefits.",
  "",
  "YOUR JOB is to move a visitor from 'I need coverage' to either a buy link or a booked conversation. You are not an FAQ.",
  "",
  "HOW TO WORK:",
  "- Ask ONE question at a time, in plain Canadian English. Keep replies under 90 words.",
  "- As soon as you learn anything concrete (product, age, dates, trip length, destination, pre-existing conditions, monthly-payment preference), call save_profile. It remembers for you and tells you what is still missing. Never re-ask something the profile already holds.",
  "- Once you have enough, call estimate_premium, then recommend_path, then present both together.",
  "- When the visitor wants a person, or the case is complex, call create_lead. Ask for a name and a phone or email first — never call it without them.",
  "",
  "ABOUT PRICES — this is the rule that matters most:",
  "- NEVER state, guess, adjust or round a premium yourself. The ONLY number you may give is the one estimate_premium returns, repeated exactly.",
  "- Always call it an illustrative estimate, never a quote, and say the insurer sets the actual rate.",
  "- If you have not called estimate_premium, you have no number. Say what drives the price and offer to work it out.",
  "",
  "PRE-EXISTING CONDITIONS — the safety rule:",
  "- If the visitor reports a recent medication, dosage or treatment change, or says they are not sure, the tools will return advisor_required. When they do: do NOT give a buy link, and do not imply they can safely buy online. Explain that a recent change can place the condition outside the stability period and void a claim, and route them to Sertac.",
  "- Explain stability periods in general terms. Never collect a medical history, health card number or payment details in chat.",
  "",
  "OTHER LIMITS:",
  "- You cannot bind coverage, issue a policy or access a live insurer rating API. Say so plainly if asked.",
  "- Eligibility and coverage are governed by the insurer's policy wording.",
  "- If a question is unrelated to insurance or travel, redirect politely.",
  "- Do not claim to be human. You are the Cover & Protect assistant and Sertac is the licensed advisor.",
].join("\n");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "save_profile",
      description:
        "Record what the visitor has told you so far and find out what is still missing. Call this as soon as you learn any field. Returns the merged profile and a list of fields still needed before an estimate is possible.",
      parameters: {
        type: "object",
        properties: {
          product: {
            type: "string",
            enum: ["supervisa", "visitor", "travel", "annual", "topup"],
            description:
              "supervisa = parent/grandparent on a Super Visa. visitor = other visitor to Canada. travel = Canadian going abroad, single trip. annual = annual multi-trip. topup = extending an existing policy.",
          },
          age: { type: "integer", description: "Age of the traveller. If several, the oldest." },
          days: { type: "integer", description: "Days of coverage needed. Super Visa is 365." },
          destination: { type: "string", description: "Where they are going, or 'Canada' for visitors." },
          travel_dates: { type: "string", description: "Dates as the visitor said them." },
          travellers: { type: "integer", description: "How many people need covering." },
          pre_existing: {
            type: "string",
            enum: ["none", "stable", "recent_change", "not_sure"],
            description:
              "none = no conditions. stable = conditions unchanged for months. recent_change = any new medication, dosage change, test or treatment change. not_sure = visitor does not know.",
          },
          wants_monthly: { type: "boolean", description: "True if they asked to pay monthly rather than in full." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_premium",
      description:
        "Return an illustrative premium RANGE from the Cover & Protect estimate engine. This is the only source of a number you are allowed to give. Requires product, age and days to be in the profile already. Returns advisor_required when the medical answers mean the visitor should speak to Sertac instead of buying online.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_path",
      description:
        "Work out which insurer or tool this visitor should actually use, and why. Returns a title, a reason, and either a link or advisor_required. Call it after estimate_premium so you can present the number and the next step together.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description:
        "Send the conversation and the profile to Sertac so he can follow up. Only call this once you have asked for and been given a name and a phone number or email. Never invent contact details.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The visitor's name, as they gave it." },
          contact: { type: "string", description: "Their phone number or email address, as they gave it." },
          note: { type: "string", description: "One or two sentences on what they need. No medical detail." },
        },
        required: ["name", "contact"],
        additionalProperties: false,
      },
    },
  },
];

/* Cloudflare lets a secret be named with hyphens, and a secret cannot be renamed
   once created — you would have to delete and re-add it. So read either spelling.
   env.FOO only works for a valid identifier; a hyphenated name needs env["FOO-BAR"]. */
function envVar(env, name) {
  return env[name] || env[name.replace(/_/g, "-")] || undefined;
}

const MAX_MESSAGE = 1000;
const MAX_HISTORY = 12;
const MAX_TOOL_RESULT = 2000;
const RATE_LIMIT = 30; // per minute per IP (per isolate — best effort)
const RATE_WINDOW_MS = 60000;
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

/* Rebuild the OpenAI message list from what the browser sent. The browser is
   untrusted, so every field is clamped and anything unrecognised is dropped. */
function buildMessages(body) {
  const msgs = [{ role: "system", content: SYSTEM_PROMPT }];

  const profile = body.profile && typeof body.profile === "object" ? body.profile : null;
  if (profile) {
    msgs.push({
      role: "system",
      content: "Known so far about this visitor (do not ask again): " + JSON.stringify(profile).slice(0, 600),
    });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  for (const m of history) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = String(m.content || "").slice(0, MAX_MESSAGE);
    if (content) msgs.push({ role, content });
  }

  const message = String(body.message || "").slice(0, MAX_MESSAGE).trim();
  if (message) msgs.push({ role: "user", content: message });

  /* The tool chain, in order: every assistant turn that asked for tools and every
     result that answered it. This MUST accumulate across rounds. Sending only the
     latest pair means the model never sees what it already learned, so it calls
     the same tool again, loops until the round limit, and the page falls back to
     canned answers — which is indistinguishable from the AI being down. */
  const chain = Array.isArray(body.chain) ? body.chain.slice(0, 24) : null;
  if (chain) {
    for (const m of chain) {
      if (!m || typeof m !== "object") continue;
      if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
        msgs.push({
          role: "assistant",
          content: typeof m.content === "string" ? m.content.slice(0, MAX_MESSAGE) : "",
          tool_calls: m.tool_calls.slice(0, 6).map((c) => ({
            id: String((c && c.id) || "").slice(0, 80),
            type: "function",
            function: {
              name: String((c && c.function && c.function.name) || "").slice(0, 60),
              arguments: String((c && c.function && c.function.arguments) || "{}").slice(0, MAX_TOOL_RESULT),
            },
          })),
        });
      } else if (m.role === "tool") {
        msgs.push({
          role: "tool",
          tool_call_id: String(m.tool_call_id || "").slice(0, 80),
          content: String(m.content || "").slice(0, MAX_TOOL_RESULT),
        });
      }
    }
    return msgs;
  }

  /* Older page code sends a single {assistant, tool_results} pair. The Worker and
     the website deploy separately, so accept both shapes during the overlap. */
  const assistant = body.assistant;
  const results = Array.isArray(body.tool_results) ? body.tool_results.slice(0, 6) : [];
  if (assistant && Array.isArray(assistant.tool_calls) && assistant.tool_calls.length && results.length) {
    msgs.push({
      role: "assistant",
      content: typeof assistant.content === "string" ? assistant.content.slice(0, MAX_MESSAGE) : "",
      tool_calls: assistant.tool_calls.slice(0, 6).map((c) => ({
        id: String((c && c.id) || "").slice(0, 80),
        type: "function",
        function: {
          name: String((c && c.function && c.function.name) || "").slice(0, 60),
          arguments: String((c && c.function && c.function.arguments) || "{}").slice(0, MAX_TOOL_RESULT),
        },
      })),
    });
    for (const r of results) {
      msgs.push({
        role: "tool",
        tool_call_id: String((r && r.tool_call_id) || "").slice(0, 80),
        content: String((r && r.content) || "").slice(0, MAX_TOOL_RESULT),
      });
    }
  }
  return msgs;
}

async function callOpenAI(apiKey, model, messages) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 500,
      temperature: 0.3,
    }),
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = String(envVar(env, "ALLOWED_ORIGIN") || "https://coverandprotect.ca")
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

    const isRound2 =
      (Array.isArray(body.chain) && body.chain.length > 0) ||
      (body.assistant && Array.isArray(body.assistant.tool_calls) && Array.isArray(body.tool_results));
    if (!isRound2 && !String(body.message || "").trim())
      return json({ error: "empty_message" }, 400, cors);

    const apiKey = envVar(env, "OPENAI_API_KEY");
    if (!apiKey) {
      console.error("AI diagnostic: no secret found named OPENAI_API_KEY or OPENAI-API-KEY");
      return json({ error: "not_configured", detail: "AI server configuration missing" }, 500, cors);
    }
    const model = envVar(env, "OPENAI_MODEL") || "gpt-4o-mini";

    let r;
    try {
      r = await callOpenAI(apiKey, model, buildMessages(body));
    } catch (e) {
      console.error("AI diagnostic: upstream network failure", String((e && e.name) || "network_error"));
      return json({ error: "upstream_failed", detail: "Unable to connect to AI provider" }, 502, cors);
    }

    if (!r.ok) {
      let providerCode = "unknown";
      try {
        const failure = await r.json();
        providerCode = String(
          (failure && failure.error && failure.error.code) ||
            (failure && failure.error && failure.error.type) ||
            "unknown"
        ).slice(0, 80);
      } catch (_) {}
      console.error("AI diagnostic: provider rejected request", "http_status=" + r.status, "code=" + providerCode);
      return json({ error: "provider_error", provider_status: r.status, provider_code: providerCode }, 502, cors);
    }

    let data;
    try {
      data = await r.json();
    } catch (e) {
      console.error("AI diagnostic: invalid provider JSON");
      return json({ error: "bad_response" }, 502, cors);
    }

    const choice = (data.choices || [])[0] || {};
    const msg = choice.message || {};

    /* The model wants to use tools. Hand them to the browser to run. */
    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
      return json(
        {
          tool_calls: msg.tool_calls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.function && c.function.name, arguments: c.function && c.function.arguments },
          })),
          assistant: { content: msg.content || "", tool_calls: msg.tool_calls },
        },
        200,
        cors
      );
    }

    const reply = String(msg.content || "").trim();
    if (!reply) {
      console.error("AI diagnostic: empty model reply");
      return json({ error: "empty_reply" }, 502, cors);
    }
    return json({ reply }, 200, cors);
  },
};
