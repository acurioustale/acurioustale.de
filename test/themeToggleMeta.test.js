import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// theme-toggle.js locates the two <meta name="theme-color"> tags by hardcoding
// their exact content= hex into its querySelector calls, then keeps each tag's
// `media` attribute in sync as the toggle forces a scheme. Those hex literals
// duplicate the content values in index.html with nothing binding them: rename
// the page palette (updating the CSS and the metas — which themeColor.test.js
// still passes for, since it only binds meta<->CSS) and the selectors match
// nothing. The `if (lightMeta && darkMeta)` guard then silently skips the
// update, so the browser-chrome tint stops following the toggle, with no error
// and no failing test. This binds the selectors back to the metas so that drift
// fails the build instead — the same drift guard every other cross-file coupling
// in this repo already has.

const repoFile = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const html = readFileSync(repoFile("index.html"), "utf8");
const toggle = readFileSync(repoFile("js/theme-toggle.js"), "utf8");

// The content= hex each theme-color meta declares, keyed by prefers-color-scheme.
// Attribute order varies, so match the tag first, then the content independently.
function metaContent(scheme) {
  const re = /<meta[^>]*name=["']theme-color["'][^>]*>/gi;
  for (const [tag] of html.matchAll(re)) {
    if (!new RegExp(`prefers-color-scheme:\\s*${scheme}`).test(tag)) continue;
    const content = tag.match(/content=["'](#[0-9a-fA-F]{3,8})["']/);
    return content && content[1].toLowerCase();
  }
  return null;
}

// The hex values theme-toggle.js hardcodes into its
// meta[name="theme-color"][content="..."] selectors, in source order.
function selectorContents() {
  const re =
    /meta\[name=["']theme-color["']\]\[content=["'](#[0-9a-fA-F]{3,8})["']\]/gi;
  return [...toggle.matchAll(re)].map((m) => m[1].toLowerCase());
}

// Guard the derivation itself: if a refactor changes how theme-toggle.js selects
// the metas so the regex matches nothing, the binding checks below would pass
// vacuously — fail loudly instead so this guard gets revisited (e.g. dropped if
// the hardcoded selectors are ever replaced by a drift-free lookup).
test("theme-toggle.js selects the theme-color metas by exactly two content= hex values", () => {
  assert.equal(
    selectorContents().length,
    2,
    'expected two meta[name="theme-color"][content="#..."] selectors in theme-toggle.js',
  );
});

test("index.html declares a light and a dark theme-color meta", () => {
  assert.ok(
    metaContent("light"),
    "index.html is missing a light theme-color meta",
  );
  assert.ok(
    metaContent("dark"),
    "index.html is missing a dark theme-color meta",
  );
});

test("every theme-toggle.js selector matches a theme-color meta content, and vice versa", () => {
  const selectors = selectorContents();
  const metas = [metaContent("light"), metaContent("dark")];

  // Each meta the toggle must keep in sync has a selector that finds it.
  for (const meta of metas) {
    assert.ok(
      selectors.includes(meta),
      `no theme-toggle.js selector targets the theme-color meta content ${meta}`,
    );
  }

  // No selector points at a hex that no theme-color meta declares (which would
  // resolve to null at runtime and silently skip the tint update).
  for (const selector of selectors) {
    assert.ok(
      metas.includes(selector),
      `theme-toggle.js selects content ${selector}, but no theme-color meta declares it`,
    );
  }
});
