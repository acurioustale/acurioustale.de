import { nextTheme, normalizeMode } from "./theme.js";

// Inject the theme toggle as progressive enhancement: without JS the OS
// preference still drives light/dark via CSS, and no dead control shows.
// The toggle cycles through auto, light and dark; "auto" clears the override
// and hands control back to the OS preference.
const root = document.documentElement;
const bar = document.querySelector(".titlebar");
if (bar) {
  const GLYPH = { auto: "◐", light: "☼", dark: "☾" };

  // The OS scheme drives both the cycle order and the live label, so query it
  // once and reuse the same MediaQueryList for reads and the change listener.
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)");

  // The current explicit override, or "auto" when none is set.
  function mode() {
    return normalizeMode(root.getAttribute("data-theme"));
  }

  // The next theme in the cycle, with the order derived from the OS preference
  // so the unavoidable colour-neutral step lands on the wrap back to auto.
  function next(m) {
    return nextTheme(m, prefersLight.matches);
  }

  function apply(to) {
    try {
      if (to === "auto") localStorage.removeItem("theme");
      else localStorage.setItem("theme", to);
    } catch {}
    if (to === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", to);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme-toggle";

  function render() {
    const m = mode();
    const label = "Theme: " + m + " — switch to " + next(m);
    btn.textContent = GLYPH[m];
    btn.setAttribute("aria-label", label);
    btn.title = label;
  }

  btn.addEventListener("click", function () {
    apply(next(mode()));
    render();
  });

  // The label's "switch to" target is derived from the OS preference (it sets
  // the cycle order), so re-render on every OS change in any mode — not just
  // auto, where the glyph also follows the OS.
  prefersLight.addEventListener("change", render);

  bar.appendChild(btn);
  render();
}
