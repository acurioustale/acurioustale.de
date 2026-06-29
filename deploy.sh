#!/usr/bin/env bash
# Deploy the static site to the web host via rsync.
# Usage: ./deploy.sh [--dry-run]
set -euo pipefail

cd "$(dirname "$0")"

# Stamp the deploy time into js/commands.js so the live site's `uptime` counts
# from this deploy, then restore the exact pre-deploy bytes when the script exits
# for any reason (normal, error or interrupt). The backup lives outside the repo
# so rsync never ships it, and restoring the original bytes reverts the stamp
# without touching git and preserves any uncommitted local edits.
backup="$(mktemp)"
cp js/commands.js "$backup"
stage="$(mktemp -d)"
trap 'mv -f "$backup" js/commands.js 2>/dev/null || true; rm -rf "$stage"' EXIT INT TERM

echo "==> Updating deploy timestamp in js/commands.js"
node -e '
	const fs = require("fs");
	const file = "js/commands.js";
	const before = fs.readFileSync(file, "utf8");
	const after = before.replace(/export const LAST_DEPLOY = \d+;/, "export const LAST_DEPLOY = " + Date.now() + ";");
	if (after === before) {
		console.error("deploy: could not find a LAST_DEPLOY assignment to stamp in " + file);
		process.exit(1);
	}
	fs.writeFileSync(file, after);
'

REMOTE="web4186@http2.core-networks.de"
TARGET="html/acurioustale.de/"

# Stage exactly the deploy set, then mirror that directory. A flat file list
# with --delete only prunes inside the synced subdirectories (css/, js/,
# assets/), never the target root, so a file dropped from the set would linger
# on the host forever. Syncing a directory that holds only the deploy set lets
# --delete remove anything no longer shipped. TARGET is unchanged, so the
# server-side rsync jail still matches.
cp -R index.html .htaccess robots.txt sitemap.xml humans.txt css js assets "$stage"/
rsync -avz --delete "$@" "$stage"/ "${REMOTE}:${TARGET}"
