import worker from '../worker.js';

let sent = null;
global.fetch = async (url, init) => {
  sent = JSON.parse(init.body);
  return { ok: true, json: async () => ({ choices: [{ message: { content: "ok" } }] }) };
};
const env = { OPENAI_API_KEY: "sk-test", ALLOWED_ORIGIN: "https://coverandprotect.ca" };
const post = (b) => new Request("https://w/", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "https://coverandprotect.ca" },
  body: JSON.stringify(b),
});

let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };

// --- round 1
let res = await worker.fetch(post({ message: "my mom is 68, coming from India", profile: { product: "supervisa" } }), env);
ok(res.status === 200, "round 1 returns 200");
ok(Array.isArray(sent.tools) && sent.tools.length === 4, "4 tools sent to OpenAI (got " + (sent.tools||[]).length + ")");
ok(sent.tool_choice === "auto", "tool_choice auto");
ok(sent.messages[0].role === "system", "system prompt first");
ok(sent.messages.some(x => x.role === "system" && x.content.includes("supervisa")), "known profile injected so it never re-asks");

// --- round 2: replay assistant tool_calls + results, OpenAI shape must be legal
const tc = [{ id: "call_1", type: "function", function: { name: "estimate_premium", arguments: "{}" } }];
res = await worker.fetch(post({
  history: [{ role: "user", content: "how much for my mom" }],
  profile: { product: "supervisa", age: 68 },
  assistant: { content: "", tool_calls: tc },
  tool_results: [{ tool_call_id: "call_1", content: '{"low":2000,"high":3800}' }],
}), env);
ok(res.status === 200, "round 2 returns 200");
const m = sent.messages;
const ai = m.findIndex(x => x.role === "assistant" && x.tool_calls);
ok(ai > -1, "assistant tool_calls message replayed");
ok(m[ai + 1] && m[ai + 1].role === "tool", "tool result immediately follows (OpenAI requires this)");
ok(m[ai + 1].tool_call_id === "call_1", "tool_call_id matches");
const ids = new Set(m[ai].tool_calls.map(c => c.id));
const answered = m.slice(ai + 1).filter(x => x.role === "tool").map(x => x.tool_call_id);
ok([...ids].every(i => answered.includes(i)), "every tool_call id has a result (else OpenAI 400s)");

// --- round 2 with no message must still be accepted
ok(res.status !== 400, "round 2 accepted without a 'message' field");

// --- guards still intact
res = await worker.fetch(new Request("https://w/", { method: "GET" }), env);
ok(res.status === 405, "GET still 405 (this is what the browser screenshot showed — correct)");
res = await worker.fetch(new Request("https://w/", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }), env);
ok(res.status === 403, "foreign Origin rejected 403");
res = await worker.fetch(post({ message: "hi" }), { ALLOWED_ORIGIN: env.ALLOWED_ORIGIN });
ok(res.status === 500 && (await res.json()).error === "not_configured", "missing key -> not_configured, no leak");
// no secret anywhere in a response body
res = await worker.fetch(post({ message: "hi" }), env);
ok(!(await res.text()).includes("sk-test"), "API key never appears in a response");

// --- the tool chain must accumulate, or the model loops and the chat dies
sent = null;
const chain = [
  { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "save_profile", arguments: "{}" } }] },
  { role: "tool", tool_call_id: "c1", content: '{"saved":true}' },
  { role: "assistant", content: "", tool_calls: [{ id: "c2", type: "function", function: { name: "estimate_premium", arguments: "{}" } }] },
  { role: "tool", tool_call_id: "c2", content: '{"low":55,"high":125}' },
];
res = await worker.fetch(post({ history: [{ role: "user", content: "53" }], profile: { product: "travel" }, chain }), env);
ok(res.status === 200, "a multi-round chain is accepted");
let cm = sent.messages;
let asst = cm.filter(x => x.role === "assistant" && x.tool_calls);
let tools = cm.filter(x => x.role === "tool");
ok(asst.length === 2, "BOTH assistant tool turns are replayed (got " + asst.length + ") — only 1 was the bug");
ok(tools.length === 2, "both tool results are replayed (got " + tools.length + ")");
ok(tools.some(x => x.content.includes("55")), "the earlier round's result survives, so the model stops re-asking");
for (let i = 0; i < cm.length; i++) {
  if (cm[i].role === "assistant" && cm[i].tool_calls) {
    ok(cm[i + 1] && cm[i + 1].role === "tool" && cm[i + 1].tool_call_id === cm[i].tool_calls[0].id,
       "each assistant tool turn is immediately answered (OpenAI 400s otherwise)");
  }
}

// --- the secret may be named with hyphens; Cloudflare cannot rename one
sent = null;
res = await worker.fetch(post({ message: "hi" }), { "OPENAI-API-KEY": "sk-hyphen", ALLOWED_ORIGIN: env.ALLOWED_ORIGIN });
ok(res.status === 200, "hyphenated OPENAI-API-KEY is found");
ok(sent !== null, "…and the request actually reached OpenAI");
res = await worker.fetch(post({ message: "hi" }), { OPENAI_API_KEY: "sk-under", ALLOWED_ORIGIN: env.ALLOWED_ORIGIN });
ok(res.status === 200, "underscored OPENAI_API_KEY still works");
res = await worker.fetch(post({ message: "hi" }), { ALLOWED_ORIGIN: env.ALLOWED_ORIGIN });
ok((await res.json()).error === "not_configured", "neither spelling present -> not_configured");
res = await worker.fetch(post({ message: "hi" }), { "OPENAI-API-KEY": "sk-x", "ALLOWED-ORIGIN": "https://coverandprotect.ca" });
ok(res.status === 200, "hyphenated ALLOWED-ORIGIN also resolves");

console.log(fail ? "\n" + fail + " FAILED" : "\nall worker tests passed");
process.exit(fail ? 1 : 0);
