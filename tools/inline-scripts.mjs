// Shared inline-<script> extractor. The CSP guard (tools/check-csp.mjs) and the
// theme-guard test (test/themeGuard.test.js) both pull the inline scripts out of
// index.html, and must agree on exactly which scripts exist — so the fiddly
// matcher lives here once instead of being copy-pasted into both.
//
// Dependency-free on purpose: a small regex over our own well-formatted markup,
// not a general HTML parser.

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script(?:\s[^>]*)?>/gi;

// Every <script> element in the given HTML, in document order, as { attrs, body }
// objects (attrs is the opening tag's attribute text, body its contents).
export function scriptElements(html) {
  return [...html.matchAll(SCRIPT_RE)].map(([, attrs, body]) => ({
    attrs,
    body,
  }));
}

// Inline scripts only — those with no src attribute. External scripts carry no
// inline body to hash or inspect and are covered by script-src 'self'.
export function inlineScripts(html) {
  return scriptElements(html).filter(({ attrs }) => !/\bsrc=/i.test(attrs));
}
