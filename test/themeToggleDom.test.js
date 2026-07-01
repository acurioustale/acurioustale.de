import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./helpers/dom.js";

// The pure cycle order (nextTheme) and the meta media mapping (metaMediaFor) are
// unit-tested in theme.test.js. These cover the wiring in theme-toggle.js: that a
// click, an OS change or a cross-tab storage event actually mutates the DOM,
// localStorage and the theme-color metas the way it should.

test("injects a theme toggle button into the titlebar", async () => {
  const { document } = await loadModule("js/theme-toggle.js");
  const btn = document.querySelector(".titlebar .theme-toggle");
  assert.ok(btn, "expected a .theme-toggle button in the titlebar");
  assert.equal(btn.getAttribute("type"), "button");
  assert.match(btn.getAttribute("aria-label"), /^Theme: auto/);
});

test("clicking cycles auto → light → dark → auto and persists each step", async () => {
  const { document, window } = await loadModule("js/theme-toggle.js", {
    prefersLight: false,
  });
  const root = document.documentElement;
  const btn = document.querySelector(".theme-toggle");

  assert.equal(root.hasAttribute("data-theme"), false); // auto: no override

  btn.click();
  assert.equal(root.getAttribute("data-theme"), "light");
  assert.equal(window.localStorage.getItem("theme"), "light");

  btn.click();
  assert.equal(root.getAttribute("data-theme"), "dark");
  assert.equal(window.localStorage.getItem("theme"), "dark");

  btn.click();
  assert.equal(root.hasAttribute("data-theme"), false); // back to auto
  assert.equal(window.localStorage.getItem("theme"), null); // override cleared
});

test("clicking keeps the two theme-color metas in sync", async () => {
  const { document } = await loadModule("js/theme-toggle.js", {
    prefersLight: false,
  });
  const light = document.querySelector(
    'meta[name="theme-color"][content="#e8e6df"]',
  );
  const dark = document.querySelector(
    'meta[name="theme-color"][content="#0e0f10"]',
  );
  const btn = document.querySelector(".theme-toggle");

  btn.click(); // → light
  assert.equal(light.getAttribute("media"), "all");
  assert.equal(dark.getAttribute("media"), "not all");

  btn.click(); // → dark
  assert.equal(light.getAttribute("media"), "not all");
  assert.equal(dark.getAttribute("media"), "all");

  btn.click(); // → auto: back to the prefers-color-scheme queries
  assert.equal(light.getAttribute("media"), "(prefers-color-scheme: light)");
  assert.equal(dark.getAttribute("media"), "(prefers-color-scheme: dark)");
});

test("a storage event from another tab mirrors the scheme without writing back", async () => {
  const { document, window } = await loadModule("js/theme-toggle.js");
  const root = document.documentElement;

  // Another tab persisted "dark"; this tab only reflects it.
  window.dispatchEvent(
    new window.StorageEvent("storage", { key: "theme", newValue: "dark" }),
  );
  assert.equal(root.getAttribute("data-theme"), "dark");
  assert.equal(
    window.localStorage.getItem("theme"),
    null,
    "mirroring must not re-persist the value",
  );
  assert.match(
    document.querySelector(".theme-toggle").getAttribute("aria-label"),
    /^Theme: dark/,
  );

  // A cleared key (another tab chose auto) hands control back to the OS.
  window.dispatchEvent(
    new window.StorageEvent("storage", { key: "theme", newValue: null }),
  );
  assert.equal(root.hasAttribute("data-theme"), false);
});
