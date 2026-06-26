import { nextTheme, normalizeMode } from "./theme.js";

// Inject the theme toggle as progressive enhancement: without JS the OS
// preference still drives light/dark via CSS, and no dead control shows.
// The toggle cycles through auto, light and dark; "auto" clears the override
// and hands control back to the OS preference.
(function () {
  var root = document.documentElement;
  var bar = document.querySelector(".titlebar");
  if (!bar) return;

  var GLYPH = { auto: "◐", light: "☼", dark: "☾" };

  // The current explicit override, or "auto" when none is set.
  function mode() {
    return normalizeMode(root.getAttribute("data-theme"));
  }

  // The next theme in the cycle, with the order derived from the OS preference
  // so the unavoidable colour-neutral step lands on the wrap back to auto.
  function next(m) {
    var osLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    return nextTheme(m, osLight);
  }

  function apply(to) {
    try {
      if (to === "auto") localStorage.removeItem("theme");
      else localStorage.setItem("theme", to);
    } catch (e) {}
    if (to === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", to);
  }

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme-toggle";

  function render() {
    var m = mode();
    var label = "Theme: " + m + " — switch to " + next(m);
    btn.textContent = GLYPH[m];
    btn.setAttribute("aria-label", label);
    btn.title = label;
  }

  btn.addEventListener("click", function () {
    apply(next(mode()));
    render();
  });

  // Re-render the glyph on OS changes while in auto mode (it follows the OS).
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", function () {
      if (mode() === "auto") render();
    });

  bar.appendChild(btn);
  render();
})();
