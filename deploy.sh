#!/usr/bin/env bash
# Deploy the static site to the web host via rsync.
# Usage: ./deploy.sh [--dry-run]
set -euo pipefail

cd "$(dirname "$0")"

stage="$(mktemp -d)"
# mktemp -d makes the staging dir 0700. Because the rsync below mirrors this
# directory with -a (which preserves permissions), that mode would be copied
# onto the web root and lock Apache out (403, "unable to read .htaccess").
# Make the staging root web-readable so the deploy keeps the web root at 0755.
chmod 755 "$stage"
trap 'rm -rf "$stage"' EXIT

REMOTE="web4186@http2.core-networks.de"
TARGET="html/acurioustale.de/"

# Stage exactly the deploy set, then mirror that directory. A flat file list
# with --delete only prunes inside the synced subdirectories (css/, js/,
# assets/), never the target root, so a file dropped from the set would linger
# on the host forever. Syncing a directory that holds only the deploy set lets
# --delete remove anything no longer shipped. TARGET is unchanged, so the
# server-side rsync jail still matches.
cp -R index.html .htaccess robots.txt sitemap.xml humans.txt css js assets "$stage"/

# Stamp the deploy time directly into the staged js/commands.js so the live
# site's `uptime` counts from this deploy. Stamping the staged copy leaves the
# git working directory untouched, avoiding dirty working trees or race conditions
# with local dev servers.
echo "==> Updating deploy timestamp in staged js/commands.js"
node -e '
	const fs = require("fs");
	const file = process.argv[1];
	const before = fs.readFileSync(file, "utf8");
	const after = before.replace(/export const LAST_DEPLOY = \d+;/, "export const LAST_DEPLOY = " + Date.now() + ";");
	if (after === before) {
		console.error("deploy: could not find a LAST_DEPLOY assignment to stamp in " + file);
		process.exit(1);
	}
	fs.writeFileSync(file, after);
' "$stage/js/commands.js"

rsync_args=()
for arg in "$@"; do
	case "$arg" in
	--dry-run) rsync_args+=("--dry-run") ;;
	*)
		echo "Usage: ./deploy.sh [--dry-run]" >&2
		exit 1
		;;
	esac
done

if [[ "${#rsync_args[@]}" -gt 0 ]]; then
	rsync -avz --delete "${rsync_args[@]}" "$stage"/ "${REMOTE}:${TARGET}"
else
	rsync -avz --delete "$stage"/ "${REMOTE}:${TARGET}"
fi
