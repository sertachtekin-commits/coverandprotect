# Connecting QuickBooks Online to Claude Code via MCP

This guide walks you through connecting your QuickBooks Online (QBO) company to
Claude Code using the **official Intuit MCP server**
(<https://github.com/intuit/quickbooks-online-mcp-server>).

Once connected, you can ask Claude things like *"show me unpaid invoices,"*
*"create a customer,"* or *"give me a profit & loss summary for last quarter"* —
and it will read/write your real QuickBooks data.

---

## What you'll need

- **Node.js 18+** and **git** installed on your computer
- An **Intuit Developer account** (free) — we'll create the app below
- Your QuickBooks Online company (you already have this)

---

## Step 1 — Create an Intuit Developer app

1. Go to <https://developer.intuit.com> and sign in with your existing Intuit/QuickBooks login.
2. Click **Dashboard → Create an app**.
3. Choose **QuickBooks Online and Payments** as the platform.
4. When asked for scopes, select **`com.intuit.quickbooks.accounting`** (Accounting).
5. Open your new app, then go to **Keys & credentials**. You'll see two sets of keys:
   - **Development** keys → for the **Sandbox** test company
   - **Production** keys → for your **real** company data
6. Copy the **Client ID** and **Client Secret** for the environment you want
   (start with **Production** if you want your real data).
7. Still under **Keys & credentials**, add a **Redirect URI**:
   ```
   http://localhost:8000/callback
   ```
   > Sandbox accepts `http://localhost` URIs directly. For **production**, Intuit
   > requires an HTTPS redirect URI — `http://localhost:8000/callback` works for the
   > one-time local OAuth handshake, but if Intuit rejects it you can use a tunnel
   > like `ngrok` and register that HTTPS URL instead.

---

## Step 2 — Install the MCP server

```bash
git clone https://github.com/intuit/quickbooks-online-mcp-server.git
cd quickbooks-online-mcp-server
npm install
npm run build
```

Note the **full path** to the built server (you'll need it below):
```bash
echo "$(pwd)/dist/index.js"
```

---

## Step 3 — Get your Refresh Token and Realm ID (OAuth)

The Client ID/Secret alone aren't enough — you need to authorize the app against
your company once to get a **Refresh Token** and your **Realm ID** (company ID).

The server ships with a helper that does the browser handshake for you. From
inside the `quickbooks-online-mcp-server` folder, create a `.env` file:

```
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_ENVIRONMENT=production
```

> Use `QUICKBOOKS_ENVIRONMENT=sandbox` if you're testing against the sample company.

Then run:

```bash
npm run auth
```

This opens your browser, asks you to pick your QuickBooks company and approve
access, and writes the **Refresh Token** and **Realm ID** back into `.env`.

⚠️ **Keep `.env` private.** It contains secrets. Never commit it to git.

---

## Step 4 — Add the server to your local Claude Code

Run this once (replace the path and the four values with your own). This registers
the server at **user scope** so it's available in every project:

```bash
claude mcp add quickbooks -s user \
  --env QUICKBOOKS_CLIENT_ID=your_client_id \
  --env QUICKBOOKS_CLIENT_SECRET=your_client_secret \
  --env QUICKBOOKS_REFRESH_TOKEN=your_refresh_token \
  --env QUICKBOOKS_REALM_ID=your_realm_id \
  --env QUICKBOOKS_ENVIRONMENT=production \
  -- node /full/path/to/quickbooks-online-mcp-server/dist/index.js
```

Prefer editing config by hand? Add this block to your Claude Code config instead
(`~/.claude.json`, or a project-local `.mcp.json`):

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "node",
      "args": ["/full/path/to/quickbooks-online-mcp-server/dist/index.js"],
      "env": {
        "QUICKBOOKS_CLIENT_ID": "your_client_id",
        "QUICKBOOKS_CLIENT_SECRET": "your_client_secret",
        "QUICKBOOKS_REFRESH_TOKEN": "your_refresh_token",
        "QUICKBOOKS_REALM_ID": "your_realm_id",
        "QUICKBOOKS_ENVIRONMENT": "production",
        "QUICKBOOKS_DISABLE_WRITE": "false",
        "QUICKBOOKS_DISABLE_UPDATE": "false",
        "QUICKBOOKS_DISABLE_DELETE": "false"
      }
    }
  }
}
```

### Safety tip — start read-only
Until you trust the setup, set these to `"true"` so Claude can read but not
change your books:

```
QUICKBOOKS_DISABLE_WRITE=true
QUICKBOOKS_DISABLE_UPDATE=true
QUICKBOOKS_DISABLE_DELETE=true
```

---

## Step 5 — Verify

1. Restart Claude Code (or run `/mcp` inside it).
2. Run `claude mcp list` — `quickbooks` should show as **connected**.
3. Ask Claude: *"List my QuickBooks customers"* or *"Show me a profit and loss
   summary."*

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `quickbooks` shows as failed/disconnected | Double-check the path to `dist/index.js` and that `npm run build` succeeded. |
| `401 / invalid_grant` | Refresh token expired or wrong environment. Re-run `npm run auth`. |
| Production OAuth redirect rejected | Register an HTTPS redirect URI (e.g. via `ngrok`) in the Intuit app's Keys & credentials. |
| Tools missing | Make sure the `QUICKBOOKS_DISABLE_*` flags aren't all set to `true`. |

---

## Security notes

- Your Client Secret and Refresh Token grant access to your accounting data —
  treat them like passwords.
- Never commit `.env` or your real credentials to this (public) repository.
- Consider using the **sandbox** environment first to confirm everything works
  before pointing it at your real company.
