# Security Policy

This is the personal landing page served at <https://acurioustale.de> — a
single static page with no backend, no accounts and no data collection. The
attack surface is small, but good-faith reports are welcome.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue:

- Preferred: GitHub's [private vulnerability reporting][advisory]
- Email: <me@acurioustale.de>

Please include the affected URL or file, a description of the issue and, where
possible, steps to reproduce. I aim to acknowledge reports within a few days.

## Scope

In scope:

- The deployed site at acurioustale.de — its content, response headers and
  Content-Security-Policy
- Source in this repository

Out of scope:

- The third-party host and its infrastructure
- Findings that require an already-compromised client or browser
- Missing hardening with no demonstrable impact (handled best-effort)

There is no bug-bounty programme; this is a personal project and any report is
appreciated on a good-faith basis.

[advisory]: https://github.com/acurioustale/acurioustale-de/security/advisories/new
