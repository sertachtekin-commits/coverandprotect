# cpbot-ai — the Cover & Protect sales assistant

Two pieces that work together:

- **`worker.js`** — a Cloudflare Worker that holds the OpenAI key and runs the
  conversation. Deployed as `coverandprotect.sertach-tekin.workers.dev`.
- **`cpbot.js`** (site root) — the chat UI, the illustrative estimate engine, and
  the tool implementations the model calls. One cached file for the whole site;
  `_includes/cpbot.html` is now just the markup, the styles and a
  `<script src="cpbot.js?v=N">`. Bump that `N` and the `sw.js` PRECACHE entry
  together when this file changes.

## Where the conversation's facts live

One object: `PROFILE`, in `_includes/cpbot.html`, with one write path.

```js
setFact(field, value)   // normalise, store, and derive what follows
getFact(field) / known(field)
said(field)             // the visitor's own wording, for the lead email
forgetFacts()           // only "start over" does this
```

There used to be three stores — `AIP` (what the AI tools saved), `cpKnownTravel`
(facts read out of free text) and `session.data` (guided-flow answers) — holding
the same information under different names, plus four bridges to copy between
them (`seedFromAI`, `absorbKnown`, `normalizeCtx`, `aiNode`). Every
repeat-question bug came from the same place: one store knew the answer and the
store being read did not.

Now:

- each guided-flow step names the field it answers (`f:`), so a step whose field
  is already known is skipped — wherever the answer came from;
- `setFact` derives what an answer implies, so `"Dec 18 departure 2 weeks"` fills
  the trip length and the next question is not asked;
- the AI tools write through the same `setFact`, mapped from the model's own
  field names by `AI_FIELD` (the Worker's tool schema is fixed and deploys
  separately, so the mapping lives in the page);
- `pricingNode()` is the single reader that shapes the facts for
  `estimateFor()` / `recommendFor()`, so the guided flow and the agent cannot
  price the same visitor differently;
- pre-existing answers are normalised to one vocabulary (`none`, `stable`,
  `recent_change`, `not_sure`) by `normPre()`, so the safety gate reads one form
  instead of every path's wording.

Steps in different flows that mean the same thing point at the same field —
`travellers`, `ages`, `destination`, `days`, `preExisting` — which is what makes
"you already told me this" true across the whole conversation.

`cancel` stops the questions and keeps the answers ("we can pick up anywhere").
`start over` (`#restart`) is the only thing that forgets.

## Why the tools run in the browser

The model has four tools. They execute **in the page**, not in the Worker,
because the illustrative rate bands already live in `cpbot.js` and
have to match `travel-insurance-calculator.html`. Putting them in the Worker too
would create a third copy, and drifting rate tables are how a customer gets
quoted one number and shown another.

So the Worker is the conversation brain and the page is the calculator.

## The protocol

```
Round 1   browser  -> {message, history, profile}
          worker   -> OpenAI (with tools)
          worker   -> {reply}                     … model answered directly
                   or {tool_calls, assistant}     … model wants data

Round 2   browser runs the tools locally
          browser  -> {history, profile, assistant, tool_results}
          worker   -> OpenAI (results appended)
          worker   -> {reply}
```

Up to `AI_MAX_ROUNDS` (3) tool rounds per visitor message.

## The tools

| Tool | What it does |
|------|--------------|
| `save_profile` | Records product, age, days, destination, dates, travellers, pre-existing status, monthly-payment preference. Returns what is still missing. This is why the agent stops re-asking. |
| `estimate_premium` | Returns an illustrative band from the page's estimate engine, plus `price_drivers` — what moved it. **The only source of a number the model is allowed to say.** |
| `recommend_path` | Returns the right insurer/tool, the reason, and a URL — from the same `recommendFor()` the guided flows use. |
| `create_lead` | Posts the profile to Formspree. Refuses without a name and a phone or email. |

## Saying why, not just how much

`estimate_premium` returns `price_drivers` alongside the band: the USA loading
(about 25%), a declared stable condition (about 25%), the age and the trip
length — built by `priceDrivers()` from the factors `estAbroad()` actually
applies, so the explanation cannot drift from the arithmetic.

The system prompt requires the not-a-quote wording in the **same** message as
the number, and then the drivers. A visitor told only the number asks "why so
much?"; a visitor told the US leg adds about 25% asks whether to drop it, which
is a conversation worth having.

## The rule that matters

A visitor who reports a **recent medication, dosage or treatment change**, or
says they are **not sure**, must never be shown a price or a buy link. A change
inside the insurer's stability period is the most common reason a large claim is
refused, and which insurer you pick changes the answer. Both tools return
`advisor_required` in that case and the chips drop to advisor-only.

`app.html` has always routed its "not sure" answer to a phone call rather than a
checkout. The chat now does the same — in the AI path (`aiAdvisorRequired`) and
in the guided flows (`needsAdvisor`, gating `showRecommend`).

Do not "simplify" this away. `normCond()` still maps `recent` → `stable` for the
*pricing* factor; the advisor gate is what stops that reaching a customer, and it
runs before pricing.

## Tests

No build step, no dependencies — plain Node.

```sh
cd workers/cpbot-ai && npm test
```

runs all four:

| Suite | What it covers |
|---|---|
| `worker.test.mjs` | protocol, OpenAI message shape, CORS/rate/secret guards |
| `tools.test.mjs` | tool behaviour, the advisor gate, routing, lead capture |
| `flow.test.mjs` | the guided flow's step sequence, driven for real |
| `characterize.test.mjs` | every flow's question order, and that nothing is asked twice |

`characterize.test.mjs` exists to make a change to the state model provable: it
drives every flow and records the questions each one asks, in order. If a refactor
changes what a visitor is asked, it fails.

`worker.test.mjs` stubs `fetch`, so it never calls OpenAI and needs no key.
`tools.test.mjs` evaluates `cpbot.js` itself against a minimal DOM stub, so it
tests the shipped file rather than a copy.

Run both after touching `worker.js`, the tool implementations, the rate bands, or
the pre-existing-condition wording.

## Deploy

The Worker is **not** deployed by the GitHub Pages build — it is separate.

Normally Cloudflare Workers Builds deploys it automatically on every push to
`main` (dashboard → the Worker → Settings → Builds). Its build config must be:

| Setting | Value |
|---|---|
| Root directory | `workers/cpbot-ai` |
| Build command | *(none)* |
| Deploy command | `npx wrangler deploy` |

`wrangler` is pinned in `package.json`, so the build's install step resolves it
locally instead of `npx` fetching it mid-deploy — that fetch is non-interactive in
CI and is a known way for the Deploying step to fail. `account_id` is set in
`wrangler.toml` so wrangler never has to ask which account to use. (An account ID
is an identifier, not a credential — it appears in every dashboard URL.)

To deploy by hand instead:

```sh
cd workers/cpbot-ai
npm install
npx wrangler login
npm run deploy
npx wrangler secret put OPENAI_API_KEY   # never commit this, never screenshot it
```

Validate a change without deploying:

```sh
npm install && npx wrangler deploy --dry-run
```

Optional plain variables: `OPENAI_MODEL` (default `gpt-4o-mini`),
`ALLOWED_ORIGIN` (default `https://coverandprotect.ca`, comma-separated for more).

**Secret naming.** Cloudflare accepts hyphens in a secret name and will not let you
rename one afterwards — you would have to delete and re-add it. The Worker
therefore reads either spelling: `OPENAI_API_KEY` or `OPENAI-API-KEY`, and the
same for `OPENAI_MODEL` and `ALLOWED_ORIGIN`. A name mismatch here is silent: the
Worker returns `not_configured` and the chat quietly falls back to canned
answers, which looks exactly like "the AI is broken".

A `GET` on the Worker URL returning **`Method not allowed`** is correct — it
accepts `POST` only. That response means it is alive, not broken.

## If the chat falls back to canned answers

`aiFallback()`'s `unavailable()` branch runs whenever the Worker call throws.
Check, in order:

1. `wrangler tail` — the Worker logs a one-line diagnostic for every failure
   (`missing OPENAI_API_KEY`, `provider rejected request http_status=…`,
   `upstream network failure`). It never logs the key or the visitor's message.
2. A `401` from the provider means the key is wrong, revoked or out of credit.
3. A `403` from the Worker means `ALLOWED_ORIGIN` does not list the origin the
   browser sent.
