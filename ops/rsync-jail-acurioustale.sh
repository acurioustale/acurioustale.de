#!/bin/sh
# rsync-jail-acurioustale.sh - forced command jailing the CI deploy key.
#
# Reviewed source, manually installed by an admin; the SERVER FILE IS
# AUTHORITATIVE. This copy is kept in version control for review and recovery
# only - it is not installed, run, or linted by CI or deploy.sh. On the host it
# lives at ~web4186/bin/rsync-jail-acurioustale.sh, wired into that account's
# ~/.ssh/authorized_keys as command="bin/rsync-jail-acurioustale.sh". Keep this
# copy in sync when the host file changes; the host wins. See ops/README.md.
#
# Forced command: confine this SSH key to pushing into one directory via rsync.
set -f                                    # no filename globbing
ALLOWED='html/acurioustale.de/'
cmd=$SSH_ORIGINAL_COMMAND
reject() { printf 'rsync-jail: %s\n' "$1" >&2; exit 1; }

case "$cmd" in
  rsync\ --server\ --sender\ *) reject 'pull not allowed' ;;
  rsync\ --server\ *)           : ;;
  *)                            reject 'only rsync push allowed' ;;
esac
case "$cmd" in *..*) reject 'path traversal rejected' ;; esac

dest=${cmd##* }
case "$dest" in
  "$ALLOWED"*) : ;;
  *)           reject "destination outside $ALLOWED" ;;
esac

exec $cmd
