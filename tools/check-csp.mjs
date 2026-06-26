// Verify the Content-Security-Policy in index.html still covers every inline
// script. Each inline <script> (one with no src and no non-JS type) must run
// under script-src, which forbids 'unsafe-inline', so each needs its sha256
// hash listed in the policy. This recomputes those hashes from the live markup
// and fails if any is missing — so the CSP can never silently drift out of sync
// when the inline theme guard is edited. Run from validate.sh and deploy.yml.
//
// Dependency-free on purpose: a small regex over our own well-formatted file,
// not a general HTML parser.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

// The CSP content attribute. The attribute is quoted with one quote char and
// its value contains the other (the source-list keywords are single-quoted), so
// match on the opening quote via a backreference rather than a "neither quote"
// class, which would truncate at the first inner quote.
const cspMatch = html.match(
  /http-equiv=["']Content-Security-Policy["']\s+content=(["'])([\s\S]*?)\1/i,
);
if (!cspMatch) {
  console.error("check-csp: no Content-Security-Policy meta tag found");
  process.exit(1);
}
const csp = cspMatch[2];

// Every <script> element, capturing its opening-tag attributes and body.
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

let failed = false;
for (const [, attrs, body] of scripts) {
  if (/\bsrc=/i.test(attrs)) continue; // external: covered by script-src 'self'
  const type = (attrs.match(/\btype=["']([^"']*)["']/i) || [])[1];
  // Non-JS data blocks (e.g. application/ld+json) are not executed and so are
  // not subject to script-src; only real inline scripts need a hash.
  const isJs =
    !type || /^(module|text\/javascript|application\/javascript)$/i.test(type);
  if (!isJs) continue;

  const hash = createHash("sha256").update(body, "utf8").digest("base64");
  const token = `'sha256-${hash}'`;
  if (!csp.includes(token)) {
    failed = true;
    console.error(
      `check-csp: inline script not allowed by the CSP.\n  expected token: ${token}`,
    );
  }
}

if (failed) process.exit(1);
console.log("check-csp: all inline scripts are covered by the CSP");
