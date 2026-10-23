/* index.html is a wrapper: it renders _includes/homepage-original.html and
   rewrites a few exact strings in it to the copy we want search engines to see.
   A `replace_first` whose needle no longer matches does not fail — it quietly
   does nothing, and the page ships with the old wording and no error anywhere.

   These tests read the needles out of the wrapper itself, so a fourth
   replacement is covered the day it is added. */
import fs from 'fs';

const root = new URL('../../../', import.meta.url).pathname;
const wrapper = fs.readFileSync(root + 'index.html', 'utf8');
const source  = fs.readFileSync(root + '_includes/homepage-original.html', 'utf8');

let fail = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fail++; };
const short = (s) => s.length > 52 ? s.slice(0, 49) + '…' : s;

/* replace_first: 'needle', 'replacement'  — Liquid single-quoted strings. */
const rules = [...wrapper.matchAll(/replace_first:\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g)]
  .map(m => ({ needle: m[1], replacement: m[2] }));

ok(rules.length > 0, `the wrapper declares ${rules.length} rewrite(s)`);

for (const { needle, replacement } of rules) {
  const hits = source.split(needle).length - 1;
  ok(hits === 1,
     `"${short(needle)}" is in the homepage exactly once` + (hits === 1 ? '' : ` (found ${hits})`));
  ok(!source.includes(replacement),
     `…and its replacement is not already there (which would make the rule a no-op)`);
}

/* The wrapper drops the include's own front-matter delimiter by character
   count. If that file stops starting with "---\n---\n", the slice eats real
   markup instead. */
const slice = wrapper.match(/slice:\s*(\d+)\s*,/);
ok(!!slice, 'the wrapper slices off the front matter' + (slice ? ` (${slice[1]} chars)` : ''));
if (slice) {
  const n = Number(slice[1]);
  ok(source.slice(0, n).trim() === '---\n---'.trim().replace(/\n/g, '\n'),
     `the first ${n} characters are exactly the front matter, not page content` +
     ` (got ${JSON.stringify(source.slice(0, n))})`);
  ok(source.slice(n).trimStart().startsWith('<!DOCTYPE'),
     'and the document starts right after it');
}

console.log(fail ? `\n${fail} FAILED` : "\nall homepage tests passed");
process.exit(fail ? 1 : 0);
