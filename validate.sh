#!/usr/bin/env bash
# Local pre-push checks, mirroring the CI "validate" job: vnu (HTML/CSS/SVG),
# xmllint (sitemap.xml well-formedness), Prettier formatting, svgo (SVG),
# ShellCheck + shfmt, actionlint, ESLint (JS + JSON) + markdownlint, the unit
# tests (node --test), and the CSP and og-image guards.
# Usage: ./validate.sh
#
# Install the tools once with: brew install vnu prettier shellcheck shfmt actionlint
# and `npm install` (for ESLint and markdownlint-cli2).
set -euo pipefail

cd "$(dirname "$0")"

# Versions pinned in .github/workflows/deploy.yml. Kept here too so a local
# tool that has drifted from CI is caught before push instead of surfacing as a
# mystery formatting failure in the pipeline. Keep these in sync with deploy.yml.
PRETTIER_VERSION="3.8.3"
SHFMT_VERSION="3.13.1"
ACTIONLINT_VERSION="1.7.12"

# Assert a tool reports the pinned version; the needle is matched literally so
# the surrounding "v"/extra output in --version lines doesn't matter.
require_version() {
	local name="$1" want="$2" got="$3"
	case "$got" in
	*"$want"*) ;;
	*)
		echo "  $name version mismatch: want $want, got: $got"
		echo "  install the pinned version (see deploy.yml) so local matches CI"
		exit 1
		;;
	esac
}

echo "==> Checking tool versions match CI"
require_version prettier "$PRETTIER_VERSION" "$(prettier --version)"
require_version shfmt "$SHFMT_VERSION" "$(shfmt --version)"
require_version actionlint "$ACTIONLINT_VERSION" "$(actionlint --version | head -1)"

# Select files by extension, exactly like the CI job — prune .git and
# node_modules, and never hand vnu the assets/ dir (it parses PNGs as text).
files=$(find . \( -path ./.git -o -path ./node_modules \) -prune -o \
	\( -name '*.html' -o -name '*.css' -o -name '*.svg' \) -print)

echo "==> Validating HTML, CSS and SVG (vnu)"
# Filter two benign infos. "Trailing slash on void elements": Prettier adds `/>`
# as house style and vnu notes (info level) it's a no-op. "Content Security
# Policy": vnu checks the page over file://, where script-src 'self' resolves to
# a null origin and so appears to block the same-origin js/ modules; served over
# https the policy allows them (verified in-browser, no console violations).
# $files is intentionally unquoted so each path becomes a separate argument.
# shellcheck disable=SC2086
vnu --filterpattern '.*(Trailing slash on void elements|Content Security Policy).*' \
	--also-check-css --also-check-svg $files

echo "==> Checking XML well-formedness (xmllint)"
# vnu only covers the SVG XML; sitemap.xml is otherwise unchecked. Plain
# --noout (well-formedness, no network) keeps this gating; full schema
# validation needs the sitemaps.org XSD and is left out like link checking.
xmllint --noout sitemap.xml

echo "==> Checking formatting (prettier)"
prettier --check .

echo "==> Checking SVG optimisation (svgo)"
for f in assets/favicon.svg og-image.src.svg; do
	npx svgo --config svgo.config.mjs -i "$f" -o - | diff -q - "$f" >/dev/null ||
		{
			echo "  $f is not optimised; run: npx svgo --config svgo.config.mjs $f"
			exit 1
		}
done

echo "==> Linting shell scripts (shellcheck)"
shellcheck deploy.sh validate.sh

echo "==> Checking shell formatting (shfmt)"
shfmt -d deploy.sh validate.sh

echo "==> Linting workflows (actionlint)"
actionlint

echo "==> Linting JS and Markdown (eslint, markdownlint-cli2)"
npm run --silent lint

echo "==> Running unit tests (node --test)"
npm test --silent

echo "==> Checking the CSP covers the inline scripts"
npm run --silent check:csp

echo "==> Checking the og-image dimensions"
npm run --silent check:og

echo "==> All checks passed"
