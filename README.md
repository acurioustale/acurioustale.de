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
├── index.html        ← the page (markup + inline theme scripts)
├── css/style.css     ← terminal styling, light/dark via CSS custom properties
└── deploy.sh         ← rsync deploy to the web host
```

## Development

No tooling required — open `index.html` in a browser, or serve the folder for a
realistic origin:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deployment

Pushing to `main` deploys automatically. The
[`deploy` workflow](.github/workflows/deploy.yml) runs on every push to `main`
(and can be triggered manually from the Actions tab) and simply runs `deploy.sh`.

`deploy.sh` is an `rsync -avz --delete` of `index.html` and `css/` to the web
root on the host:

```
web4186@http2.core-networks.de:html/acurioustale.de/
```

CI authenticates with a dedicated SSH deploy key, stored as the repository
secrets `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`. The key is harmless if
leaked: on the host it's pinned to a forced command
(`~web4186/bin/rsync-jail-acurioustale.sh`, wired up in that account's
`authorized_keys`) that allows only an rsync *push* into
`html/acurioustale.de/` — no shell, no pull, and no path traversal outside that
directory. This is why the deploy target in `deploy.sh` must keep its trailing
slash; the jail matches on that exact prefix.

To deploy by hand instead (uses your own SSH access), run:

```bash
./deploy.sh            # live
./deploy.sh --dry-run  # preview what would change
```

The `--delete` flag mirrors the local tree to the server, so anything in the web
root that isn't tracked here is removed on deploy.

## License

[MIT](LICENSE) © Markus Spitzner
