# Search & AI visibility audit

Checks a list of searches against every page in `sitemap.xml` and reports what
to fix so each search has one page that answers it directly. It is the same
work for Google and for AI assistants (ChatGPT, Claude, Perplexity, Google AI
Overviews): they pick one page and quote a clear answer from it.

The report has four sections, each sorted by how ready the searcher is to buy:

1. **No page is about this search.** Write a page or section, starting from
   the closest page listed.
2. **The right page exists but answers weakly.** Its answer score is below
   3 / 4. Put a direct, specific answer in the first paragraph, one that could
   be quoted on its own.
3. **Pages competing for the same search.** Make one page the clear answer
   and link the others to it.
4. **Answered well.** Nothing to do.

## How it works

For each search:

1. **Code** shortlists the 6 pages whose words best match it. Words in the
   URL, title, description and headings count most.
2. **TypeSafe, request 1** answers two questions together. A Choice picks the
   shortlisted page that is mainly about the search, or "none". A Noul gives
   the probability that the searcher is ready to get a quote or buy.
3. **TypeSafe, request 2**, only if a page was picked: a Score rates how
   directly that page answers the search, from 0 (not at all) to 4 (a
   quotable answer near the top).

That makes at most 2 TypeSafe requests per search. The run stops at 150
searches.

If two pages each get at least 30% of the Choice's probability, they are
reported as competing. Matches TypeSafe was unsure about are listed at the
end of the report. The thresholds are starting points; adjust them in
`lib.mjs` after reviewing a real report.

The audit only reads the public pages, so no client data is involved.

## Run it

**In GitHub (no setup on your computer):**

1. Once: repository **Settings → Secrets and variables → Actions → New
   repository secret**, named `TYPESAFE_API_KEY`, with your TypeSafe key.
2. **Actions → Search & AI visibility audit → Run workflow.** To try it
   cheaply first, enter `5` as the limit.
3. Open the finished run. The report is on its summary page, and
   `report.md` can be downloaded under Artifacts.

**Locally:** `npm install`, then `TYPESAFE_API_KEY=… node audit.mjs`. Other
commands:

- `node audit.mjs --dry-run` shows each search's shortlist without calling
  TypeSafe.
- `npm test` runs the offline tests.

## The searches

`queries.txt` starts with a guessed list. Real searches are better:

1. Open Google Search Console → Performance → Search results → Queries.
2. Export them.
3. Paste the searches the site shows up for into `queries.txt`, especially
   ones with impressions but few clicks.

Add the questions clients actually ask you, too, phrased the way they would
ask an AI assistant.
