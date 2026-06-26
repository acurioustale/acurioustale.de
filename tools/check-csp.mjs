// Verify both Content-Security-Policies still cover every inline script. The
// policy is declared twice: a <meta> tag in index.html (the locally-testable
// baseline) and an HTTP header in .htaccess (the production superset). Each
// inline <script> (one with no src and no non-JS type) runs under script-src,
// which forbids 'unsafe-inline', so each needs its sha256 hash in BOTH policies.
// This recomputes the hashes from the live markup and fails if any is missing
// from either policy — so neither can silently drift when the inline theme guard
// is edited. Run from validate.sh and deploy.yml.
//
// Dependency-free on purpose: small regexes over our own well-formatted files,
// not a general HTML/Apache parser.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const htaccess = await readFile(
  new URL("../.htaccess", import.meta.url),
  "utf8",
);

// The <meta> CSP. The attribute is quoted with one quote char and its value
// contains the other (the source-list keywords are single-quoted), so match on
// the opening quote via a backreference rather than a "neither quote" class,
// which would truncate at the first inner quote.
const metaCsp = html.match(
  /http-equiv=["']Content-Security-Policy["']\s+content=(["'])([\s\S]*?)\1/i,
)?.[2];

// The header CSP: Header always set Content-Security-Policy "...".
const headerCsp = htaccess.match(/Content-Security-Policy\s+"([^"]*)"/i)?.[1];

const policies = [
  { name: "index.html <meta> CSP", csp: metaCsp },
  { name: ".htaccess header CSP", csp: headerCsp },
];

let failed = false;
for (const { name, csp } of policies) {
  if (!csp) {
    failed = true;
    console.error(`check-csp: no Content-Security-Policy found in ${name}`);
  }
}
if (failed) process.exit(1);

// Every <script> element in index.html, capturing opening-tag attributes + body.
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

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
  for (const { name, csp } of policies) {
    if (!csp.includes(token)) {
      failed = true;
      console.error(
        `check-csp: inline script not allowed by the ${name}.\n  expected token: ${token}`,
      );
    }
  }
}

if (failed) process.exit(1);
console.log("check-csp: all inline scripts are covered by both CSPs");
