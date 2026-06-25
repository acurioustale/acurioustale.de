# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The personal landing page for [acurioustale.de](https://acurioustale.de): a single
static `index.html` styled as a terminal "whoami" card, with one stylesheet. No
framework and no build step; the deployed site ships no dependencies (the only npm
packages are dev-time linters, see below).

## Commands

```bash
python3 -m http.server 8000   # serve locally, then visit http://localhost:8000
./deploy.sh                   # deploy to production by hand (uses your own SSH access)
./deploy.sh --dry-run         # preview what the deploy would change
```

There is no build step for the site — edit the files and reload the browser. CI
validates the HTML, CSS and SVG (Nu Html Checker), checks formatting (Prettier),
keeps the SVGs optimised (svgo), lints the shell scripts (ShellCheck and shfmt),
the workflows (actionlint), the inline JS and JSON (ESLint) and the Markdown
(markdownlint-cli2) on every push and pull request, and deploys are gated on all
of them passing. Run the same checks locally with `./validate.sh` (needs `brew
install vnu prettier shellcheck shfmt actionlint` plus `npm install` for the
npm-only tools: ESLint, markdownlint-cli2 and svgo). Link checking is separate
and non-gating — the `links` workflow runs lychee on pull requests and a weekly
schedule. ESLint/markdownlint/svgo are the only tools needing `package.json`; the
site itself still ships no dependencies. Prettier uses its defaults; keep the
Prettier, shfmt and actionlint versions in `deploy.yml` in sync with local.
`.claude/launch.json` defines a "site" launch config that serves on port 4174.

`npm audit` reports two moderate advisories for `js-yaml 4.1.1`, pulled in by
`markdownlint-cli2`. They are accepted, not fixable here: the only patched line
is `js-yaml@5`, which drops the default export `markdownlint-cli2` imports and so
breaks it. The advisory is a quadratic-complexity DoS, and this is dev-only
tooling that lints our own files, so there is no untrusted input. The
`markdown-it` advisory was fixable and is pinned via `overrides`.

## Theme system (the one piece of real logic)

Light/dark theming is split across three files and is easy to break if you touch
only one. The model is three-way — **auto** (follow OS), **light** and **dark** —
and the toggle cycles through all three. Because **auto** always looks like the
OS preference, one step of any three-way cycle can't change the colour; the cycle
order is derived from the OS preference so that unavoidable no-op lands on the
return to **auto**, and every other click visibly flips light/dark (no dead first
click on a light-mode OS).

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
- `index.html` has three inline scripts; the first two drive theming. The first
  (in `<head>`) applies a saved theme from `localStorage` before first paint to
  avoid a flash. The second (end of `<body>`) injects the toggle button as
  progressive enhancement — without JS, the OS preference still drives colours
  via CSS and no dead control is shown. "auto" clears the `data-theme` attribute
  and the `localStorage` key, handing control back to the OS. (The third script
  is the interactive terminal prompt — an easter egg, unrelated to theming.)

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
