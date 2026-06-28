# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The personal landing page for [acurioustale.de](https://acurioustale.de): a single
static `index.html` styled as a terminal "whoami" card, with one stylesheet and
two small ES modules in `js/`. No framework and no build step; the deployed site
ships no dependencies (the only npm packages are dev-time linters, see below). The
`js/` modules are plain ES modules served as-is and loaded with `type="module"` —
no bundling.

## Commands

```bash
python3 -m http.server 8000   # serve locally, then visit http://localhost:8000
./deploy.sh                   # deploy to production by hand (uses your own SSH access)
./deploy.sh --dry-run         # preview what the deploy would change
```

There is no build step for the site — edit the files and reload the browser. CI
validates the HTML, CSS and SVG (Nu Html Checker), checks formatting (Prettier),
keeps the SVGs optimised (svgo), lints the shell scripts (ShellCheck and shfmt),
the workflows (actionlint), the JS and JSON (ESLint), the CSS (stylelint) and the
Markdown (markdownlint-cli2), runs the unit tests (`node --test`, via `npm test`)
and the CSP and og-image guards (`tools/check-csp.mjs`, `tools/check-og-image.mjs`)
on every push and pull request, and deploys are gated on all of them passing. Run
the same checks locally with `./validate.sh` (needs `brew install vnu prettier
shellcheck shfmt actionlint` plus `npm install` for the npm-only tools: ESLint,
stylelint, markdownlint-cli2 and svgo). `validate.sh` skips any brew CLI that
isn't installed (with a notice — CI still enforces it) so it runs on a fresh
checkout; Node and npm are the only hard requirements. Link checking is separate
and non-gating — the `links` workflow runs lychee on pull requests and a weekly
schedule. ESLint/stylelint/markdownlint/svgo are the only tools needing
`package.json`; the tests and guards use only Node's standard library, and the
site itself still ships no dependencies. Prettier uses its defaults; keep the
Prettier, shfmt and actionlint versions pinned in `deploy.yml` in sync with
`validate.sh`, which asserts the local versions match when present (so drift is
caught before push). `.claude/launch.json` defines a "site" launch config that
serves on port 4174.

Two transitive dev dependencies of `markdownlint-cli2` carried advisories and are
pinned to patched versions through `overrides` in `package.json`: `markdown-it`
(`^14.2.0`) and `js-yaml` (`^4.3.0`). The js-yaml pin deliberately stays on the
4.x line: the fix for its quadratic-complexity DoS in merge-key handling was
backported to 4.2.0, while the 5.x line drops the default export
`markdownlint-cli2` imports and so would break it. Both are dev-only tooling that
lints our own files, so there is no untrusted input regardless, and `npm audit`
is clean.

## Theme system (the one piece of real logic)

Light/dark theming is split across the stylesheet, the inline `<head>` guard and
the `js/theme-toggle.js` module, and is easy to break if you touch only one. The
model is three-way — **auto** (follow OS), **light** and **dark** — and the
toggle cycles through all three. Because **auto** always looks like the OS
preference, one step of any three-way cycle can't change the colour; the cycle
order is derived from the OS preference so that unavoidable no-op lands on the
return to **auto**, and every other click visibly flips light/dark (no dead first
click on a light-mode OS). That cycle order is the pure function `nextTheme()` in
`js/theme.js`, unit-tested in `test/theme.test.js` — change the order there, not
by editing the toggle inline.

- `css/style.css` sets `color-scheme: light dark` on `:root` and defines each
  active `--*` token **once** as `--token: light-dark(<light>, <dark>)`. The
  browser resolves each `light-dark()` to its light or dark value from the used
  `color-scheme`, so the OS preference drives the colours for free (this is what
  makes the no-JS path follow the OS). The explicit toggle does not re-map any
  colour — it only forces the scheme: `:root[data-theme="light"]` sets
  `color-scheme: light` and `:root[data-theme="dark"]` sets `color-scheme: dark`,
  and every token follows. When adding or renaming a colour, add the one
  `light-dark()` token; there are no separate palette vars or activation blocks
  to keep in sync. (`light-dark()` is Baseline since mid-2024 — Chrome 123,
  Firefox 120, Safari 17.5; pre-2024 browsers are intentionally out of scope and
  there is no fallback.)
- The theme logic lives in two places. One small inline script in `<head>`
  applies a saved theme from `localStorage` before first paint to avoid a flash;
  it must stay inline (an external/deferred script would flash). `js/theme-toggle.js`
  (a `type="module"` script at the end of `<body>`) injects the toggle button as
  progressive enhancement — without JS, the OS preference still drives colours via
  CSS and no dead control is shown. "auto" clears the `data-theme` attribute and
  the `localStorage` key, handing control back to the OS. What counts as a valid
  override is `normalizeMode()` in `js/theme.js` (reused by the toggle); the inline
  guard duplicates that check by hand only because it must run before any module
  can load.

Keep these consistent: the `localStorage` key is `"theme"` with values
`"light"`/`"dark"` (absent = auto), and the override is the `data-theme`
attribute on `<html>`. The two `<meta name="theme-color">` values (one per
`prefers-color-scheme`) must equal the CSS `--page-bg` light/dark sides;
`test/themeColor.test.js` enforces that so the browser chrome can't drift from
the page background.

## JavaScript layout and the CSP

`index.html` carries exactly one inline script — the pre-paint theme guard above.
Everything else is in `js/`, loaded with `type="module"`: `theme-toggle.js` (the
toggle UI) and `terminal.js` (the interactive guest-shell easter egg, desktop
only, unrelated to theming). The card is dressed as a macOS Terminal session and
the prompt accepts commands: `./whoami.sh` and `ls projects/` reprint the boot
blocks, `ls` lists the directory, `uptime`/`date`/`echo` behave like their shell
namesakes, `sudo` returns the classic lecture, `clear` empties the screen (hiding
the boot output, like a real terminal), `help` lists the working commands, and
everything else is denied with a fitting shell error. The pure logic each depends
on is factored out for testing — `theme.js` (`nextTheme()`) and `commands.js`
(`reply()` for the command replies and denials, `help()` for the listing) — and
exercised by `test/`. The DOM glue in the two UI modules is thin
and verified in the browser, not unit-tested.

The page sends a strict Content-Security-Policy **twice**: a `<meta http-equiv>`
tag in `index.html` and an HTTP header in `.htaccess`. Both are `default-src
'none'` with `script-src 'self'` (the `js/` modules) plus a single `'sha256-…'`
for the inline guard, `style-src 'self'`, `img-src 'self'`, and
`base-uri`/`form-action 'none'`. The `.htaccess` header is the production
superset — it adds `frame-ancestors 'none'` and `upgrade-insecure-requests`,
which a meta CSP can't express — while the meta stays as the baseline the python
dev server actually applies (so CSP is testable locally). Three consequences when
editing:

- **Edit the inline `<head>` script and its hash changes.** `tools/check-csp.mjs`
  recomputes the sha256 of every inline script and fails the build if it isn't in
  **both** policies, so CI catches a stale hash. Run `npm run check:csp`, copy the
  `expected token` it prints into the `script-src` list in **both `index.html` and
  `.htaccess`**, and re-run. New external scripts under `js/` need no hash (covered
  by `'self'`); a `<script>` of a non-JS type like `application/ld+json` is data,
  not executed, and needs none either.
- The other security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`) and long-cache for static images also
  live in `.htaccess`. None of these apply under the python dev server; verify
  them after a deploy with `curl -sI https://acurioustale.de/`.
- `.htaccess` is in the deploy set and ships to the web root; the rsync jail's
  path prefix already covers it, so no server-side change is needed.

## Deployment

Pushing to `main` auto-deploys via `.github/workflows/deploy.yml`, which runs
`deploy.sh` (an `rsync -avz --delete` of `index.html`, `.htaccess`, `robots.txt`,
`sitemap.xml`, `humans.txt`, `css/`, `js/` and `assets/`). Before the rsync,
`deploy.sh` shells out to `node` to stamp the current time into `LAST_DEPLOY` in
`js/commands.js` (so the terminal's `uptime` counts from the live deploy), backs
the file up outside the repo and restores it on exit, so the edit ships to the
host but never lands in git; the `deploy` job therefore sets up Node too. CI
authenticates with
the `DEPLOY_SSH_KEY` / `DEPLOY_KNOWN_HOSTS` repo secrets. The workflow sets
least-privilege token scopes at the top level (`permissions: contents: read`) —
neither the `validate` nor the `deploy` job writes to the repo (deploy
authenticates over SSH, not the `GITHUB_TOKEN`), so keep that block if you edit
the workflow.

The `TARGET` in `deploy.sh` **must keep its trailing slash** (`html/acurioustale.de/`).
The deploy key is jailed server-side to a forced `rsync` command that matches that
exact path prefix — no shell, no pull, no traversal. Changing the target breaks the
deploy. See the README for the full explanation.
