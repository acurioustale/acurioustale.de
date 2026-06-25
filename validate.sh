#!/usr/bin/env bash
# Local pre-push checks, mirroring the CI "validate" job:
#   1. W3C Nu Html Checker (vnu) over the HTML, CSS and SVG
#   2. Prettier formatting check
# Usage: ./validate.sh
#
# Install the tools once with: brew install vnu prettier
set -euo pipefail

cd "$(dirname "$0")"

# Select files by extension, exactly like the CI job — never hand vnu the
# assets/ directory, or it will try to parse the binary PNGs as text.
files=$(find . -path ./.git -prune -o \
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

echo "==> All checks passed"
