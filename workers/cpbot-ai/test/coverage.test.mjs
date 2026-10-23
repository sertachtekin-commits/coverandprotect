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

/* The launcher is fixed at bottom:20px and the mobile buy bar occupies roughly
   12–53px, so without a clearance rule the launcher covers the bar's "Get a
   Quote" button — measured at 2067px², on every page carrying both. This only
   checks the rules still exist; tools/layout-check measures them in a browser. */
const css = include.slice(include.indexOf('<style>'), include.indexOf('</style>'));
const raise = (q) => {
  const m = css.match(new RegExp(`max-width:${q}px\\)\\{[^]*?#cpbot-launch\\{bottom:(\\d+)px`));
  return m ? Number(m[1]) : null;
};
ok(/bottom:20px/.test(css.match(/#cpbot-launch\{[^}]*\}/)?.[0] || ''),
   'the launcher still rests at bottom:20px (these numbers assume it)');
ok(raise(900) !== null && raise(900) >= 65,
   `a page with a buy bar lifts the launcher clear of it (${raise(900)}px)`);
ok(raise(360) !== null && raise(360) >= 113,
   `and clears the two-row bar under 360px (${raise(360)}px)`);
ok(/:has\(#cpbot-panel\.cpbot-open\)[^]*?(cp-buybar|sticky-call)[^}]*display:none/.test(css),
   'the bar hides while the chat is open');
ok(/display-mode:standalone\)\{[^]*?#cpbot-launch\{bottom:20px/.test(css),
   'and the lift is undone in the installed app, where the bar is hidden anyway');

console.log(fail ? `\n${fail} FAILED` : "\nall coverage tests passed");
process.exit(fail ? 1 : 0);
