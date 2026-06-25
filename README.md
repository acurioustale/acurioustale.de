# acurioustale.de

Personal landing page — a terminal-styled "whoami" card, deployed at
[acurioustale.de](https://acurioustale.de).

It's a single static `index.html` with one stylesheet, no framework and no build
step. Three small inline scripts power it. Two handle theming: one applies a
saved theme before first paint (to avoid a flash), the other injects an
auto/light/dark toggle as progressive enhancement — without JavaScript the OS
`prefers-color-scheme` still drives the colours via CSS and no dead control is
shown. The chosen theme is persisted in `localStorage`. The third turns the
prompt into an interactive, always-denied terminal easter egg (desktop only).

```text
.
├── index.html          ← the page (markup + inline theme scripts)
├── css/style.css       ← terminal styling, light/dark via CSS custom properties
├── assets/             ← favicon, apple-touch icon, Open Graph share image
├── robots.txt          ← allow-all crawl rule + sitemap pointer
├── sitemap.xml         ← single-page sitemap
├── humans.txt          ← the people behind the site (linked via rel="author")
├── og-image.src.svg    ← editable source for assets/og-image.png (not deployed)
├── lychee.toml         ← link-checker config (used by the links workflow)
├── package.json        ← npm-only lint tools (ESLint, markdownlint-cli2, svgo)
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

Before pushing, run the same gating checks CI runs (validation, formatting and
linting across the repo). Install the tools once, then run the script:

```bash
brew install vnu prettier shellcheck shfmt actionlint   # one-time
npm install                                             # one-time (ESLint, markdownlint-cli2, svgo)
./validate.sh
```

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

## Deployment

Pushing to `main` deploys automatically. The
[`deploy` workflow](.github/workflows/deploy.yml) first runs a `validate` gate: it
validates the HTML, CSS and SVG with the
[Nu Html Checker](https://validator.github.io/validator/), checks formatting with
Prettier, keeps the SVGs optimised with svgo, and lints the shell scripts
(ShellCheck, shfmt), the workflows (actionlint), and the inline JS, JSON and
Markdown (ESLint, markdownlint-cli2). Only if everything passes does it run
`deploy.sh`. The workflow runs on every push to `main` (and can be triggered
manually from the Actions tab); pull requests run the same gate without deploying.
Link checking runs separately (see Development) so flaky external hosts never
block a deploy.

`deploy.sh` is an `rsync -avz --delete` of `index.html`, `robots.txt`,
`sitemap.xml`, `humans.txt`, `css/` and `assets/` to the web root on the host:

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
(`index.html`, `robots.txt`, `sitemap.xml`, `humans.txt`, `css/` and `assets/`)
are pushed, so unrelated files elsewhere in the web root are left untouched.

## License

[MIT](LICENSE) © Markus Spitzner
