#!/usr/bin/env bash
# Local pre-push checks, mirroring the CI "validate" job: vnu (HTML/CSS/SVG),
# xmllint (sitemap.xml well-formedness), Prettier formatting, ShellCheck + shfmt,
# actionlint, ESLint (JS + JSON) + stylelint (CSS) + markdownlint, the unit tests
# (node --test), the CSP and og-image guards, and svgo (SVG optimisation).
# Usage: ./validate.sh
#
# Node + npm are required (the repo's own tooling, tests and guards run on them).
# The other CLIs are optional: each is skipped with a notice when absent so this
# stays runnable everywhere, while CI pins and always enforces them. Install them
# with: brew install vnu prettier shellcheck shfmt actionlint, plus `npm install`.
set -euo pipefail

cd "$(dirname "$0")"

# Versions pinned in .github/workflows/deploy.yml. Asserted here (only when the
# tool is present) so a drifted local tool is caught before it surfaces as a
# mystery formatting failure in CI. Keep these in sync with deploy.yml.
PRETTIER_VERSION="3.8.3"
SHFMT_VERSION="3.13.1"
ACTIONLINT_VERSION="1.7.12"

have() { command -v "$1" >/dev/null 2>&1; }
skip() { echo "note: $1 not installed - skipping $2 (CI enforces it)." >&2; }

# Assert a tool reports the pinned version; the needle is matched literally so
# the surrounding "v"/extra output in --version lines doesn't matter.
require_version() {
	local name="$1" want="$2" got="$3"
	case "$got" in
	*"$want"*) ;;
	*)
		echo "  $name version mismatch: want $want, got: $got" >&2
		echo "  install the pinned version (see deploy.yml) so local matches CI" >&2
		exit 1
		;;
	esac
}

# CI pins Node 22. Warn (don't block) on a mismatch: a different engine can pass
# here yet behave differently in CI.
ci_node_major=22
local_node_major="$(node -v | sed 's/^v//; s/\..*//')"
if [[ "$local_node_major" != "$ci_node_major" ]]; then
	echo "warning: local Node is v$local_node_major, CI uses v$ci_node_major." >&2
fi

# Select files by extension, exactly like the CI job — prune .git and
# node_modules, and never hand vnu the assets/ dir (it parses PNGs as text).
files=$(find . \( -path ./.git -o -path ./node_modules \) -prune -o \
	\( -name '*.html' -o -name '*.css' -o -name '*.svg' \) -print)

if have vnu; then
	echo "==> Validating HTML, CSS and SVG (vnu)"
	# Filter two benign infos. "Trailing slash on void elements": Prettier adds
	# `/>` as house style and vnu notes (info level) it's a no-op. "Content
	# Security Policy": vnu checks the page over file://, where script-src 'self'
	# resolves to a null origin and so appears to block the same-origin js/
	# modules; over https the policy allows them (verified in-browser).
	# $files is intentionally unquoted so each path becomes a separate argument.
	# shellcheck disable=SC2086
	vnu --filterpattern '.*(Trailing slash on void elements|Content Security Policy).*' \
		--also-check-css --also-check-svg $files
else
	skip vnu "HTML/CSS/SVG validation"
fi

if have xmllint; then
	echo "==> Checking XML well-formedness (xmllint)"
	# vnu only covers the SVG XML; sitemap.xml is otherwise unchecked. Plain
	# --noout (well-formedness, no network) keeps this gating; full schema
	# validation needs the sitemaps.org XSD and is left out like link checking.
	xmllint --noout sitemap.xml
else
	skip xmllint "sitemap XML check"
fi

if have prettier; then
	require_version prettier "$PRETTIER_VERSION" "$(prettier --version)"
	echo "==> Checking formatting (prettier)"
	prettier --check .
else
	skip prettier "formatting check"
fi

if have shellcheck; then
	echo "==> Linting shell scripts (shellcheck)"
	shellcheck deploy.sh validate.sh
else
	skip shellcheck "shell lint"
fi

if have shfmt; then
	require_version shfmt "$SHFMT_VERSION" "$(shfmt --version)"
	echo "==> Checking shell formatting (shfmt)"
	shfmt -d deploy.sh validate.sh
else
	skip shfmt "shell format check"
fi

if have actionlint; then
	require_version actionlint "$ACTIONLINT_VERSION" "$(actionlint --version | head -1)"
	echo "==> Linting workflows (actionlint)"
	actionlint
else
	skip actionlint "workflow lint"
fi

echo "==> Linting JS, CSS and Markdown (eslint, stylelint, markdownlint-cli2)"
npm run --silent lint

echo "==> Running unit tests (node --test)"
npm test --silent

echo "==> Checking the CSP covers the inline scripts"
npm run --silent check:csp

echo "==> Checking the og-image dimensions"
npm run --silent check:og

echo "==> Checking SVG optimisation (svgo)"
for f in assets/favicon.svg og-image.src.svg; do
	npx svgo --config svgo.config.mjs -i "$f" -o - | diff -q - "$f" >/dev/null ||
		{
			echo "  $f is not optimised; run: npx svgo --config svgo.config.mjs $f"
			exit 1
		}
done

echo "==> All checks passed"
