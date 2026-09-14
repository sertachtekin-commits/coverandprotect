# Google Analytics MCP — setup

This repo ships a project-scoped MCP server config (`.mcp.json`) for the
official [Google Analytics MCP server](https://github.com/googleanalytics/google-analytics-mcp)
(PyPI package `analytics-mcp`). Once it is set up, you can ask Claude Code
questions about the live GA4 data for `coverandprotect.ca` — traffic, events,
campaigns and lead conversions — without leaving the terminal.

The server is **read-only**: it only ever asks for the
`https://www.googleapis.com/auth/analytics.readonly` scope, so it can report on
the property but can never change it.

There are two parts: a program that runs the server (step 1) and a Google
credential that lets it read your property (step 2). Both are one-time.

---

## Step 1 — Install uv

`.mcp.json` runs the server with `uvx`, which comes with
[uv](https://docs.astral.sh/uv/). uv is a single self-contained program — it
does **not** need Python, pip or pipx installed first, and `uvx` downloads
`analytics-mcp` on first run, so there is nothing else to install afterwards.

**macOS / Linux** — paste into Terminal:

```shell
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows** — paste into PowerShell:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Close the terminal and open a new one, then confirm it worked:

```shell
uvx --version
```

If that prints a version number, step 1 is done. If it says "command not
found", the installer printed a line about adding uv to your PATH — follow it,
or just restart the terminal once more.

> Prefer pipx? It works too — install pipx, then change `.mcp.json` to
> `"command": "pipx", "args": ["run", "analytics-mcp"]`. uv is only the default
> because it installs in one line with no prerequisites.

---

## Step 2 — Give it read access to the GA4 property

Pick **one** of these. Option A needs no extra software and is the simpler
route; Option B avoids keeping a key file on disk but requires installing the
Google Cloud CLI.

### Option A — Service account key (no extra software)

1. Go to the [Google Cloud console](https://console.cloud.google.com/) and
   select a project, or create one. Note its
   [project ID](https://support.google.com/googleapi/answer/7014113).

2. Enable both APIs in that project (click through and press **Enable**):
   - [Google Analytics Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com)
   - [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)

3. Create a service account: **IAM & Admin → Service Accounts → Create service
   account**. Name it something like `analytics-mcp`. You can skip the optional
   role and user-access steps. Copy the account's email address — it looks like
   `analytics-mcp@YOUR_PROJECT.iam.gserviceaccount.com`.

4. On that service account, open the **Keys** tab → **Add key → Create new key
   → JSON**. A `.json` file downloads. **Move it somewhere outside this repo**,
   for example `~/.config/analytics-mcp-key.json` — it is a live credential,
   and keeping it out of the project folder means it can never be committed by
   accident.

5. Grant it access to the property in Google Analytics: **Admin → Property
   access management → +** → paste the service account email → role
   **Viewer** → uncheck "Notify new users by email" → **Add**.

6. Tell the server where the key is, by adding this line to your shell profile
   (`~/.zshrc` on modern macOS, `~/.bashrc` on Linux):

   ```shell
   export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/analytics-mcp-key.json"
   ```

   On Windows, set `GOOGLE_APPLICATION_CREDENTIALS` under **Settings → System →
   About → Advanced system settings → Environment Variables**.

   Then open a new terminal so the variable is actually set.

### Option B — Your own login, via gcloud (no key file)

1. Do steps 1 and 2 from Option A (project + enable the two APIs).

2. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install).

3. Create an OAuth desktop client
   ([how](https://support.google.com/cloud/answer/15549257)), download its JSON,
   then run:

   ```shell
   gcloud auth application-default login \
     --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
     --client-id-file=YOUR_CLIENT_JSON_FILE
   ```

   Sign in as the Google account that already has access to the Cover & Protect
   GA4 property.

4. Nothing else to configure — this writes the credential to the standard
   location the server checks automatically. No environment variable needed.

   These credentials expire periodically; re-run the command when that happens.

---

## Step 3 — Use it

Start Claude Code in this repo. The first time, it asks whether to trust the
project MCP server — approve it. Then type `/mcp`; `analytics-mcp` should show
as connected.

The site's `G-J7F01SWCLW` is a **measurement** ID, not the numeric **property**
ID the tools take. Ask this first and the `get_account_summaries` tool resolves
it for you:

```
list my Google Analytics properties
```

### What the site already sends to GA4

Useful when phrasing questions (defined in `tracking.js`):

| Event | Meaning |
|---|---|
| `generate_lead` | A form was submitted — the main conversion |
| `begin_checkout` | Opened an insurer's pay portal (TruStone, TuGo) |
| `quote_start` | Opened the 21st Century quote tool |
| `select_item` | Moved toward a buy path elsewhere on the site |
| `phone_click`, `email_click`, `whatsapp_click`, `booking_click` | Contact attempts |
| `campaign_landing`, `form_start` | Top and middle of the lead funnel |
| `app_step`, `app_plan_matched`, `app_installed` | The installable app |

### Prompts worth trying

```
How many generate_lead events did the site get in the last 90 days, broken
down by landing page?
```

```
Which sources and campaigns produced begin_checkout events in the last 60 days?
```

```
Build a funnel for the last 90 days: campaign_landing -> form_start ->
generate_lead, split by device category.
```

```
Compare Super Visa landing page traffic to visitor insurance landing page
traffic over the last 6 months.
```

```
Which blog articles brought in the most organic traffic last quarter, and did
any of them produce leads?
```

---

## Tools the server provides

Verified against `analytics-mcp` 0.7.0:

- `get_account_summaries` — your GA4 accounts and properties
- `get_property_details` — details for one property
- `list_google_ads_links` — linked Google Ads accounts
- `list_property_annotations`
- `get_custom_dimensions_and_metrics`
- `run_report` — core reports
- `run_realtime_report`
- `run_funnel_report`
- `run_conversions_report`

## Troubleshooting

- **`Executable not found in $PATH: uvx`** — step 1 did not finish, or the
  terminal was opened before uv was installed. Run `uvx --version` in a fresh
  terminal; if it fails, re-run the install command.
- **Server connects but every query fails with `403` / `PERMISSION_DENIED`** —
  usually one of: the two APIs are not enabled in the project, or (Option A) the
  service account email was never added under Property access management.
- **`Could not automatically determine credentials`** — Option A's
  `GOOGLE_APPLICATION_CREDENTIALS` is not set in the terminal that launched
  Claude Code, or the path in it is wrong. Check with
  `echo $GOOGLE_APPLICATION_CREDENTIALS`.
- **Worked before, now fails to authenticate** — Option B's credentials expired.
  Re-run the `gcloud auth application-default login` command.
- **First query is slow** — `uvx` is downloading the package. It is cached after
  that.
