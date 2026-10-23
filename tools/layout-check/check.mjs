/* Does the chat launcher cover the buy bar's "Get a Quote" button?
 *
 * The assistant is on 53 pages now, which is too many to eyeball. This loads a
 * sample in a real browser at real phone sizes and measures the two rectangles.
 * It found a clash of 2067px² over the quote button — on every page with both,
 * including buy-online.html, where the two had sat together since 5 October.
 *
 *   npm i --no-save playwright
 *   (cd ../.. && jekyll build)
 *   npx http-server ../../_site -p 8111   # or: python3 -m http.server 8111
 *   node check.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:8111';

/* One page per bar implementation and per page family, not all 53. */
const PAGES = [
  ['blog-supervisa-cost.html',             '.cp-buybar-quote',   'blog article'],
  ['super-visa-insurance-toronto.html',    '.cp-buybar-quote',   'landing page'],
  ['snowbird-travel-insurance-florida.html','.cp-buybar-quote',  'snowbird page'],
  ['health-insurance.html',                '.cp-buybar-quote',   'service page'],
  ['snowbird-60-day-split-calculator.html','.cp-buybar-quote',   'calculator'],
  ['travel-insurance.html',                '.sticky-call .quote','hand-written bar'],
  ['buy-online.html',                      '.cp-buybar-quote',   'buy hub'],
];
const SIZES = [[414,896,'large phone'],[390,844,'iPhone 14'],[375,812,'iPhone X'],
               [360,740,'small Android'],[320,568,'iPhone SE']];

const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {});
let bad = 0;

for (const [w, h, label] of SIZES) {
  console.log(`\n=== ${label} · ${w}x${h} ===`);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const [file, quoteSel, kind] of PAGES) {
    await page.goto(`${BASE}/${file}`, { waitUntil: 'domcontentloaded' });

    const closed = await page.evaluate((sel) => {
      const fab = document.querySelector('#cpbot-launch');
      const q = document.querySelector(sel);
      if (!fab || !q) return { missing: !fab ? 'launcher' : 'quote button' };
      const a = fab.getBoundingClientRect(), b = q.getBoundingClientRect();
      const hit = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      return {
        hit,
        area: hit ? Math.round((Math.min(a.right,b.right) - Math.max(a.left,b.left)) *
                               (Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top))) : 0,
        gap: Math.round(b.top - a.bottom),
      };
    }, quoteSel);

    if (closed.missing) { console.log(`  n/a    ${file.padEnd(40)} no ${closed.missing}`); continue; }
    if (closed.hit) {
      bad++;
      console.log(`  CLASH  ${file.padEnd(40)} launcher covers ${closed.area}px² of the quote button`);
      continue;
    }

    /* Open it: the bar should get out of the way and the panel must fit. */
    await page.click('#cpbot-launch');
    await page.waitForTimeout(350);
    const open = await page.evaluate((sel) => {
      const p = document.querySelector('#cpbot-panel').getBoundingClientRect();
      const bar = document.querySelector(sel).closest('.cp-buybar, .sticky-call');
      return {
        fits: p.top >= 0 && p.bottom <= innerHeight,
        top: Math.round(p.top), bottom: Math.round(p.bottom), vh: innerHeight,
        barHidden: !bar || getComputedStyle(bar).display === 'none',
      };
    }, quoteSel);

    const problems = [];
    if (!open.fits) problems.push(`panel off-screen (${open.top}..${open.bottom} of ${open.vh})`);
    if (!open.barHidden) problems.push('bar still showing behind the panel');
    if (problems.length) { bad++; console.log(`  CLASH  ${file.padEnd(40)} ${problems.join('; ')}`); }
    else console.log(`  ok     ${file.padEnd(40)} ${String(closed.gap).padStart(3)}px clear · ${kind}`);
  }
  await page.close();
}

await browser.close();
console.log(bad ? `\n${bad} layout problem(s)` : '\nno overlaps, panel fits everywhere');
process.exit(bad ? 1 : 0);
