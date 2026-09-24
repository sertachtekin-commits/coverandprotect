// Runs the search & AI-visibility audit over every page in sitemap.xml.
//
//   node audit.mjs              full audit (needs TYPESAFE_API_KEY), writes report.md
//   node audit.mjs --dry-run    no API calls: shows each search's shortlisted pages
//   node audit.mjs --limit 10   only the first 10 searches (to try it cheaply)
//
// In GitHub Actions the report also goes to the run's summary page.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { AuthenticationError, PermissionDeniedError, TypeSafeClient } from '@typesafe-ai/sdk';
import { auditSearch, buildIndex, EXCLUDED_PAGES, readPage, report } from './lib.mjs';

const here = (p) => new URL(p, import.meta.url);
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitAt = args.indexOf('--limit');
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
const MAX_SEARCHES = 150; // cost guard: at most two TypeSafe requests per search

const sitemap = readFileSync(here('../../sitemap.xml'), 'utf8');
const pages = [...sitemap.matchAll(/<loc>https:\/\/coverandprotect\.ca\/([^<]*)<\/loc>/g)]
  .map((m) => m[1] || 'index.html')
  .filter((f) => !EXCLUDED_PAGES.has(f) && existsSync(here('../../' + f)))
  .map((f) => readPage(f, readFileSync(here('../../' + f), 'utf8')));

const searches = readFileSync(here('./queries.txt'), 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .slice(0, Math.min(limit, MAX_SEARCHES));

const shortlistFor = buildIndex(pages);
console.log(`${pages.length} pages, ${searches.length} searches${dryRun ? ' (dry run)' : ''}`);

if (dryRun) {
  for (const s of searches) console.log(`\n${s}\n  ${shortlistFor(s).map((p) => p.file).join('\n  ') || '(no page mentions these words)'}`);
  process.exit(0);
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is not set. In GitHub, add it under Settings → Secrets and variables → Actions.');
  process.exit(1);
}
const client = new TypeSafeClient();
const ask = (req) => client.systemOne(req);
const results = [];
for (const [i, search] of searches.entries()) {
  try {
    results.push(await auditSearch(search, shortlistFor, ask));
  } catch (err) {
    if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
      console.error('TypeSafe rejected the API key. Check the TYPESAFE_API_KEY secret.');
      process.exit(1);
    }
    results.push({ search, error: String(err.message ?? err).slice(0, 200) });
  }
  console.log(`${i + 1}/${searches.length} ${search}`);
}

const md = report(results);
writeFileSync(here('./report.md'), md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log('\nWrote tools/search-audit/report.md');
if (results.every((r) => r.error)) process.exit(1);
