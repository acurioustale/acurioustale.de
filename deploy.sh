#!/usr/bin/env bash
# Deploy the static site to the web host via rsync.
# Usage: ./deploy.sh [--dry-run]
set -euo pipefail

cd "$(dirname "$0")"

REMOTE="web4186@http2.core-networks.de"
TARGET="html/acurioustale.de/"

rsync -avz --delete "$@" \
	index.html .htaccess robots.txt sitemap.xml humans.txt css js assets \
	"${REMOTE}:${TARGET}"
