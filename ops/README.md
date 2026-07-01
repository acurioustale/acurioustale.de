# ops/

Operational configuration that is **not** part of the deployed site and is
**not** run by CI or `deploy.sh`. Files here are reviewed reference copies of
things installed by hand on the web host, kept in version control so they can be
reviewed, diffed and restored.

## `rsync-jail-acurioustale.sh`

The forced command that jails the CI deploy key on the host. It is wired into
the `web4186` account's `~/.ssh/authorized_keys` as
`command="bin/rsync-jail-acurioustale.sh"` and permits only an `rsync` _push_
into `html/acurioustale.de/` - no shell, no pull, no path traversal. This is
what makes the `DEPLOY_SSH_KEY` secret harmless if leaked (see the README
"Deployment" section).

**Reviewed source, manually installed by an admin; the server file is
authoritative.** CI does not install this file. Changing the jail's behaviour
means editing the copy on the host _and_ updating this one to match; the two can
drift, and the host wins. If `deploy.sh` ever issues a new remote SSH command
(anything beyond the current `rsync` push), it needs a matching allow-entry
added here and on the host, or the forced command will reject it.
