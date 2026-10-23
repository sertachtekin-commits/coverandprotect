# layout-check

Measures the chat launcher against the mobile buy bar's "Get a Quote" button in
a real browser, at real phone sizes. Not published; `tools/` is excluded from
the Jekyll build.

The assistant went from 8 pages to 53 on 23 October. That made a long-standing
bug visible: `#cpbot-launch` sits at `bottom:20px` and the buy bar occupies
roughly 12–53px, so the launcher covered **2067px² of the quote button** — on
every page carrying both, including `buy-online.html`, where the two had been
together since 5 October. It is the one button on the bar the launcher most
needs to leave alone.

It checks, for a sample page of each kind and each bar implementation:

- closed: the launcher does not intersect the quote button;
- open: the bar is hidden and the panel fits entirely on screen.

## Running it

```sh
npm i --no-save playwright
cd ../.. && jekyll build && cd tools/layout-check
python3 -m http.server 8111 --directory ../../_site &
node check.mjs
```

On a machine where Playwright's browsers live elsewhere (the Claude Code cloud
container, for one), point it at the binary:

```sh
CHROME=/opt/pw-browsers/chromium-*/chrome-linux/chrome node check.mjs
```

It needs a browser, so it is deliberately **not** part of `npm test` in
`workers/cpbot-ai` — that suite is plain Node with no dependencies and should
stay that way. Run this by hand after changing the launcher's position, either
bar's geometry, or the panel's size.

`workers/cpbot-ai/test/coverage.test.mjs` keeps a cheap, dependency-free guard
that the clearance rules still exist at all; only this one proves they work.
