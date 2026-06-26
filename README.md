# acurioustale.de

Personal landing page — a terminal-styled "whoami" card, deployed at
[acurioustale.de](https://acurioustale.de).

It's a single static `index.html` with one stylesheet, no framework and no build
step. A little JavaScript powers it. One tiny inline script applies a saved theme
before first paint (to avoid a flash); the rest lives in two small ES modules in
`js/`. One injects an auto/light/dark toggle as progressive enhancement — without
JavaScript the OS `prefers-color-scheme` still drives the colours via CSS and no
dead control is shown; the chosen theme is persisted in `localStorage`. The other
turns the prompt into an interactive, always-denied terminal easter egg (desktop
only). The pure logic behind both (the theme cycle and the command replies) is
factored into `js/theme.js` and `js/commands.js` and unit-tested in `test/`.

```text
.
├── index.html          ← the page (markup + the inline pre-paint theme guard)
├── css/style.css       ← terminal styling, light/dark via CSS custom properties
├── js/                 ← theme toggle + terminal easter egg, and their pure logic
├── test/               ← unit tests for the pure logic (node --test)
├── tools/              ← dev-time CI checks (CSP hash, og-image dimensions)
├── assets/             ← favicon, apple-touch icon, Open Graph share image
├── .htaccess           ← Apache security headers + production CSP (deployed)
├── robots.txt          ← allow-all crawl rule + sitemap pointer
├── sitemap.xml         ← single-page sitemap
├── humans.txt          ← the people behind the site (linked via rel="author")
├── og-image.src.svg    ← editable source for assets/og-image.png (not deployed)
├── lychee.toml         ← link-checker config (used by the links workflow)
├── package.json        ← npm-only lint tools (ESLint, stylelint, markdownlint, svgo)
├── .github/workflows/  ← deploy (gating checks) + links (lychee) CI
├── validate.sh         ← run all gating CI checks locally
└── deploy.sh           ← rsync deploy to the web host
```

## Development

No tooling required to edit — open `index.html` in a browser, or serve the folder
for a realistic origin:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Before pushing, run the same gating checks CI runs (validation, formatting,
linting, the unit tests and the CSP/og-image guards). Install the tools once,
then run the script:

```bash
brew install vnu prettier shellcheck shfmt actionlint   # one-time
npm install                                             # one-time (ESLint, stylelint, markdownlint, svgo)
./validate.sh
```

`validate.sh` skips any of the brew-installed CLIs that aren't present (with a
notice — CI always enforces them), so it stays runnable on a fresh checkout;
Node and npm are the only hard requirements. When a pinned tool (Prettier, shfmt,
actionlint) _is_ present, it asserts the version matches the one in `deploy.yml`,
so a drifted local tool is caught before it surfaces as a mystery CI reformat.

Links are checked separately (they need the network and external hosts flake, so
they never gate a deploy) — on pull requests and a weekly schedule via the
[`links` workflow](.github/workflows/links.yml). To check them by hand:

```bash
brew install lychee
lychee --config lychee.toml index.html README.md CLAUDE.md
```

### Regenerating the share image

`assets/og-image.png` (the Open Graph card) is rendered from `og-image.src.svg`.
The SVG is the source of truth; edit it, then rasterise to a 1200×630 PNG. The
text must be rendered by a real browser (Menlo), so the reliable path is to load
the SVG in a browser and draw it to a `<canvas>` at 1200×630, then export PNG —
headless tools without a proper font stack drop the text.

This last step is manual, so it's easy to forget after editing the source. CI
can't verify the rendered text (that's the whole font problem), but it does
guard the dimensions: `tools/check-og-image.mjs` fails the build if
`assets/og-image.png` isn't the declared 1200×630. So a wrong-size export is
caught; a stale-but-correctly-sized one is on you to remember to regenerate.

## Deployment

Pushing to `main` deploys automatically. The
[`deploy` workflow](.github/workflows/deploy.yml) first runs a `validate` gate: it
validates the HTML, CSS and SVG with the
[Nu Html Checker](https://validator.github.io/validator/), checks formatting with
Prettier, keeps the SVGs optimised with svgo, lints the shell scripts
(ShellCheck, shfmt), the workflows (actionlint), and the JS, JSON, CSS and
Markdown (ESLint, stylelint, markdownlint-cli2), runs the unit tests
(`node --test`), and checks the CSP hash and og-image dimensions. Only if
everything passes does it run `deploy.sh`. The workflow runs on every push to `main` (and can be triggered
manually from the Actions tab); pull requests run the same gate without deploying.
Link checking runs separately (see Development) so flaky external hosts never
block a deploy.

`deploy.sh` is an `rsync -avz --delete` of `index.html`, `.htaccess`,
`robots.txt`, `sitemap.xml`, `humans.txt`, `css/`, `js/` and `assets/` to the web
root on the host:

```text
web4186@http2.core-networks.de:html/acurioustale.de/
```

CI authenticates with a dedicated SSH deploy key, stored as the repository
secrets `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`. The key is harmless if
leaked: on the host it's pinned to a forced command
(`~web4186/bin/rsync-jail-acurioustale.sh`, wired up in that account's
`authorized_keys`) that allows only an rsync _push_ into
`html/acurioustale.de/` — no shell, no pull, and no path traversal outside that
directory. This is why the deploy target in `deploy.sh` must keep its trailing
slash; the jail matches on that exact prefix.

To deploy by hand instead (uses your own SSH access), run:

```bash
./deploy.sh            # live
./deploy.sh --dry-run  # preview what would change
```

The `--delete` flag keeps the deployed `css/` and `assets/` directories in sync —
files removed locally are removed on the server too. Only the files listed above
(`index.html`, `.htaccess`, `robots.txt`, `sitemap.xml`, `humans.txt`, `css/`,
`js/` and `assets/`) are pushed, so unrelated files elsewhere in the web root are
left untouched.

### Security headers

`.htaccess` sets the production security headers the static files can't set
themselves: a `Content-Security-Policy` plus `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`. The CSP is
all-same-origin (`default-src 'none'`, `script-src`/`style-src`/`img-src 'self'`)
with the one inline script — the pre-paint theme guard — allowlisted by its
`sha256` hash. This header CSP is the production superset of the `<meta>` CSP in
`index.html`: it adds `frame-ancestors 'none'` and `upgrade-insecure-requests`,
which a meta tag can't express. The meta stays as the locally-testable baseline
(the python dev server doesn't apply `.htaccess`), and `tools/check-csp.mjs`
asserts the inline-script hash matches in both — so editing that script fails the
build until both are updated. Verify the live headers after a deploy with
`curl -sI https://acurioustale.de/ | grep -i 'content-security\|x-frame'`.

## License

[MIT](LICENSE) © Markus Spitzner
