#!/usr/bin/env bash
# Local pre-push checks, mirroring the CI "validate" job: vnu (HTML/CSS/SVG),
# Prettier formatting, ShellCheck + shfmt, actionlint, and ESLint + markdownlint.
# Usage: ./validate.sh
#
# Install the tools once with: brew install vnu prettier shellcheck shfmt actionlint
# and `npm install` (for ESLint and markdownlint-cli2).
set -euo pipefail

cd "$(dirname "$0")"

# Select files by extension, exactly like the CI job — prune .git and
# node_modules, and never hand vnu the assets/ dir (it parses PNGs as text).
files=$(find . \( -path ./.git -o -path ./node_modules \) -prune -o \
	\( -name '*.html' -o -name '*.css' -o -name '*.svg' \) -print)

echo "==> Validating HTML, CSS and SVG (vnu)"
# Filter the benign "trailing slash on void elements" info: Prettier adds `/>`
# to void elements as house style, and vnu notes (info level) that it is a no-op.
# $files is intentionally unquoted so each path becomes a separate argument.
# shellcheck disable=SC2086
vnu --filterpattern '.*Trailing slash on void elements.*' \
	--also-check-css --also-check-svg $files

echo "==> Checking formatting (prettier)"
prettier --check .

echo "==> Linting shell scripts (shellcheck)"
shellcheck deploy.sh validate.sh

echo "==> Checking shell formatting (shfmt)"
shfmt -d deploy.sh validate.sh

echo "==> Linting workflows (actionlint)"
actionlint

echo "==> Linting JS and Markdown (eslint, markdownlint-cli2)"
npm run --silent lint

echo "==> All checks passed"
