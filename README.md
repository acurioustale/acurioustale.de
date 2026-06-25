# acurioustale.de

Personal landing page — a terminal-styled "whoami" card, deployed at
[acurioustale.de](https://acurioustale.de).

It's a single static `index.html` with one stylesheet, no framework and no build
step. Two small inline scripts handle theming: one applies a saved theme before
first paint (to avoid a flash), the other injects a light/dark toggle as
progressive enhancement — without JavaScript the OS `prefers-color-scheme` still
drives the colours via CSS and no dead control is shown. The chosen theme is
persisted in `localStorage`.

```
.
├── index.html          ← the page (markup + inline theme scripts)
├── css/style.css       ← terminal styling, light/dark via CSS custom properties
├── assets/             ← favicon, apple-touch icon, Open Graph share image
├── og-image.src.svg    ← editable source for assets/og-image.png (not deployed)
├── validate.sh         ← run the CI checks locally (vnu + prettier)
└── deploy.sh           ← rsync deploy to the web host
```

## Development

No tooling required to edit — open `index.html` in a browser, or serve the folder
for a realistic origin:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Before pushing, run the same checks CI runs (HTML/CSS/SVG validation and
formatting). Install the tools once, then run the script:

```bash
brew install vnu prettier shellcheck shfmt   # one-time
./validate.sh
```

### Regenerating the share image

`assets/og-image.png` (the Open Graph card) is rendered from `og-image.src.svg`.
The SVG is the source of truth; edit it, then rasterise to a 1200×630 PNG. The
text must be rendered by a real browser (Menlo), so the reliable path is to load
the SVG in a browser and draw it to a `<canvas>` at 1200×630, then export PNG —
headless tools without a proper font stack drop the text.

## Deployment

Pushing to `main` deploys automatically. The
[`deploy` workflow](.github/workflows/deploy.yml) first validates the HTML, CSS
and SVG with the [Nu Html Checker](https://validator.github.io/validator/),
checks formatting with Prettier, and lints the shell scripts with ShellCheck and
shfmt, then runs `deploy.sh` only if everything passes. It runs on every push to
`main` (and can be triggered manually from the Actions tab); pull requests run
the same checks without deploying.

`deploy.sh` is an `rsync -avz --delete` of `index.html`, `css/` and `assets/` to
the web root on the host:

```
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
files removed locally are removed on the server too. Only `index.html`, `css/`
and `assets/` are pushed, so unrelated files elsewhere in the web root are left
untouched.

## License

[MIT](LICENSE) © Markus Spitzner
