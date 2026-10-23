/* The assistant spent its first three weeks on eight pages — the buy pages —
   while every blog article and landing page built to catch search traffic had
   none. Nothing failed when that happened, which is why it went unnoticed.
   This fails. */
import fs from 'fs';
import path from 'path';

const root = new URL('../../../', import.meta.url).pathname;

/* A sales assistant has no business on the legal pages, and thankyou.html
   redirects away after a few seconds. Everything else gets it. */
const EXEMPT = new Set([
  'privacy-policy.html',
  'terms.html',
  'thankyou.html',
  'googledb2fcfa7efcf42c9.html',   // Google Search Console token, left as-is
]);

let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };

const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const missing = [];
for (const f of pages) {
  if (EXEMPT.has(f)) continue;
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  /* index.html is a thin wrapper around _includes/homepage-original.html,
     which carries the include itself. */
  const body = src.includes('homepage-original.html')
    ? fs.readFileSync(path.join(root, '_includes/homepage-original.html'), 'utf8')
    : src;
  if (!body.includes('{% include cpbot.html %}')) missing.push(f);
}
ok(missing.length === 0,
   `every page carries the assistant (${pages.length - EXEMPT.size + 1} checked)` +
   (missing.length ? ` — missing on: ${missing.join(', ')}` : ''));

/* One cached file, and its version has to match what the service worker
   precaches — otherwise returning visitors keep the old chat for ever. */
const include = fs.readFileSync(path.join(root, '_includes/cpbot.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const inPage = include.match(/cpbot\.js\?v=(\d+)/);
const inSw = sw.match(/cpbot\.js\?v=(\d+)/);
ok(!!inPage, 'the include loads cpbot.js' + (inPage ? ` (v${inPage[1]})` : ''));
ok(!!inSw, 'the service worker precaches it' + (inSw ? ` (v${inSw[1]})` : ''));
ok(inPage && inSw && inPage[1] === inSw[1],
   'and the two versions agree' + (inPage && inSw ? ` (${inPage[1]} vs ${inSw[1]})` : ''));

ok(!include.includes('CPBOT_WORKER_URL'),
   'the include no longer carries the script inline');

console.log(fail ? `\n${fail} FAILED` : "\nall coverage tests passed");
process.exit(fail ? 1 : 0);
