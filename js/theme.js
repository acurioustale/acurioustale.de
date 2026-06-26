// Pure theme-cycle logic, extracted so it can be unit-tested without a DOM
// (see test/theme.test.js). The DOM wiring lives in theme-toggle.js.

// The next theme in the three-way cycle. "auto" looks identical to the OS
// preference, so one step of a three-way cycle is always colour-neutral.
// Visiting the theme that matches the OS last puts that neutral step on the
// wrap back to auto, so every other click visibly flips the colour (no dead
// first click). The cycle order is therefore derived from the OS preference.
export function nextTheme(current, osPrefersLight) {
  const order = osPrefersLight
    ? ["auto", "dark", "light"]
    : ["auto", "light", "dark"];
  return order[(order.indexOf(current) + 1) % order.length];
}
