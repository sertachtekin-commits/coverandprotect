# Google Analytics MCP — setup

This repo ships a project-scoped MCP server config (`.mcp.json`) for the
official [Google Analytics MCP server](https://github.com/googleanalytics/google-analytics-mcp)
(PyPI package `analytics-mcp`). Once it is set up, you can ask Claude Code
questions about the live GA4 data for `coverandprotect.ca` — traffic, events,
campaigns and lead conversions — without leaving the terminal.

The server is **read-only**: it holds only the
`https://www.googleapis.com/auth/analytics.readonly` scope, so it can report on
the property but can never modify it.

## What the site already sends to GA4

Useful when writing report questions (see `tracking.js` and
`_includes/analytics.html`):

| | |
|---|---|
| GA4 measurement ID | `G-J7F01SWCLW` |
| Lead conversion event | `generate_lead` |
| Purchase-intent event | `begin_checkout` (TruStone / TuGo portals) |
| Quote-tool event | `quote_start` (21st Century) |
| On-site buy-path step | `select_item` |
| Contact events | `phone_click`, `email_click`, `whatsapp_click`, `booking_click` |
| App events | `app_step`, `app_plan_matched`, `app_installed` |

The measurement ID above is **not** the numeric property ID the MCP tools take.
Ask Claude `list my Google Analytics properties` and the `get_account_summaries`
tool returns the numeric ID.

## One-time setup

Do this once on each machine where you run Claude Code. Nothing here is stored
in the repo — the credentials stay on your machine.

### 1. Install pipx

Follow <https://pipx.pypa.io/stable/#install-pipx>.

### 2. Enable the two APIs in your Google Cloud project

In the Cloud console, enable:

- [Google Analytics Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com)
- [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)

Note the [project ID](https://support.google.com/googleapi/answer/7014113) —
you need it in step 4.

### 3. Create Application Default Credentials

Create an OAuth desktop client
([how](https://support.google.com/cloud/answer/15549257)), download its JSON,
then run:

```shell
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=YOUR_CLIENT_JSON_FILE
```

Sign in as the Google account that has access to the Cover & Protect GA4
property. When the command finishes it prints:

```
Credentials saved to file: [PATH_TO_CREDENTIALS_JSON]
```

Copy that path.

### 4. Point the two environment variables at it

`.mcp.json` deliberately reads these from the environment rather than hard-coding
them, so no credential path or project ID is ever committed. Add them to your
shell profile (`~/.zshrc`, `~/.bashrc`, or the Windows environment variables
dialog):

```shell
export GOOGLE_APPLICATION_CREDENTIALS="PATH_TO_CREDENTIALS_JSON"
export GOOGLE_PROJECT_ID="YOUR_PROJECT_ID"
```

Open a new terminal so the variables are set, then start Claude Code in this
repo. It will ask you to approve the project MCP server the first time — say
yes. Check it with `/mcp`; `analytics-mcp` should be listed as connected.

## Alternative: a user-scoped server instead

If you would rather have the server available in every repo, not just this one,
skip `.mcp.json` and run this once (substituting the real values):

```shell
claude mcp add analytics-mcp \
  --scope user \
  -e "GOOGLE_APPLICATION_CREDENTIALS=PATH_TO_CREDENTIALS_JSON" \
  -e "GOOGLE_PROJECT_ID=YOUR_PROJECT_ID" \
  -- pipx run analytics-mcp
```

## Alternative: uv instead of pipx

If you have [uv](https://docs.astral.sh/uv/) but not pipx, change the `command`
and `args` in `.mcp.json` to:

```json
"command": "uvx",
"args": ["analytics-mcp"]
```

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

## Prompts worth trying

```
Give me details about my Google Analytics property for coverandprotect.ca
```

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

## Troubleshooting

- **Server not listed under `/mcp`** — the environment variables were not set in
  the shell that launched Claude Code. Echo them to confirm, then restart.
- **`403` or `PERMISSION_DENIED`** — either the two APIs are not enabled in the
  project from step 2, or the signed-in Google account has no access to the GA4
  property.
- **Auth errors after a while** — ADC user credentials expire. Re-run the
  `gcloud auth application-default login` command from step 3.
