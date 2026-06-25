# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The personal landing page for [acurioustale.de](https://acurioustale.de): a single
static `index.html` styled as a terminal "whoami" card, with one stylesheet. No
framework, no build step, no dependencies.

## Commands

```bash
python3 -m http.server 8000   # serve locally, then visit http://localhost:8000
./deploy.sh                   # deploy to production by hand (uses your own SSH access)
./deploy.sh --dry-run         # preview what the deploy would change
```

There is no build step for the site — edit the files and reload the browser. CI
validates the HTML, CSS and SVG (Nu Html Checker), checks formatting (Prettier),
lints the shell scripts (ShellCheck and shfmt), the workflows (actionlint), the
inline JS (ESLint) and the Markdown (markdownlint-cli2) on every push and pull
request, and deploys are gated on all of them passing. Run the same checks
locally with `./validate.sh` (needs `brew install vnu prettier shellcheck shfmt
actionlint` plus `npm install` for the npm-only linters). Link checking is
separate and non-gating — the `links` workflow runs lychee on pull requests and a
weekly schedule. ESLint/markdownlint are the only tools needing `package.json`;
the site itself still ships no dependencies. Prettier uses its defaults; keep the
Prettier, shfmt and actionlint versions in `deploy.yml` in sync with local.
`.claude/launch.json` defines a "site" launch config that serves on port 4174.

## Theme system (the one piece of real logic)

Light/dark theming is split across three files and is easy to break if you touch
only one. The model is three-way: **auto** (follow OS) → **light** → **dark**.

- `css/style.css` defines every colour twice in `:root` as `--dark-*` and
  `--light-*` custom properties, then maps one set onto the active `--*`
  variables. Dark is the default. Light activates from **two** triggers that
  must stay in sync: `@media (prefers-color-scheme: light)` scoped to
  `:root:not([data-theme="dark"])` (OS preference when no explicit choice), and
  `:root[data-theme="light"]` (explicit toggle). When adding or renaming a
  colour, update the `--dark-*`/`--light-*` definitions **and** both activation
  blocks.
- `index.html` has two inline scripts. The first (in `<head>`) applies a saved
  theme from `localStorage` before first paint to avoid a flash. The second (end
  of `<body>`) injects the toggle button as progressive enhancement — without
  JS, the OS preference still drives colours via CSS and no dead control is
  shown. "auto" clears the `data-theme` attribute and the `localStorage` key,
  handing control back to the OS.

Keep these consistent: the `localStorage` key is `"theme"` with values
`"light"`/`"dark"` (absent = auto), and the override is the `data-theme`
attribute on `<html>`.

## Deployment

Pushing to `main` auto-deploys via `.github/workflows/deploy.yml`, which runs
`deploy.sh` (an `rsync -avz --delete` of `index.html`, `css/` and `assets/`). CI
authenticates with the `DEPLOY_SSH_KEY` / `DEPLOY_KNOWN_HOSTS` repo secrets.

The `TARGET` in `deploy.sh` **must keep its trailing slash** (`html/acurioustale.de/`).
The deploy key is jailed server-side to a forced `rsync` command that matches that
exact path prefix — no shell, no pull, no traversal. Changing the target breaks the
deploy. See the README for the full explanation.
