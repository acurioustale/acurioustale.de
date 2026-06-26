import { test } from "node:test";
import assert from "node:assert/strict";

import { nextTheme } from "../js/theme.js";

// Walk the cycle from a starting mode for N clicks, returning the sequence of
// modes visited (excluding the start). osPrefersLight stays fixed, as it would
// during a burst of clicks.
function walk(start, osPrefersLight, clicks) {
  const seq = [];
  let m = start;
  for (let i = 0; i < clicks; i++) {
    m = nextTheme(m, osPrefersLight);
    seq.push(m);
  }
  return seq;
}

test("cycles auto → dark → light → auto when the OS prefers light", () => {
  assert.deepEqual(walk("auto", true, 3), ["dark", "light", "auto"]);
});

test("cycles auto → light → dark → auto when the OS prefers dark", () => {
  assert.deepEqual(walk("auto", false, 3), ["light", "dark", "auto"]);
});

test("returns to the start after three clicks (a closed three-way loop)", () => {
  for (const osLight of [true, false]) {
    for (const start of ["auto", "light", "dark"]) {
      assert.equal(
        nextTheme(nextTheme(nextTheme(start, osLight), osLight), osLight),
        start,
        `start=${start} osLight=${osLight}`,
      );
    }
  }
});

// The whole point of deriving the order from the OS preference: the one
// colour-neutral step (auto ↔ the matching explicit theme) must land on the
// wrap back to auto, so the two clicks that leave auto both flip the colour.
test("the colour-neutral step is the wrap back to auto, never the first click", () => {
  // OS light: auto and "light" both render light; that neutral pair must be
  // adjacent across the auto boundary, i.e. light → auto.
  assert.equal(nextTheme("light", true), "auto");
  // Leaving auto must change the colour (auto=light → dark).
  assert.equal(nextTheme("auto", true), "dark");

  // OS dark: the neutral pair is dark ↔ auto.
  assert.equal(nextTheme("dark", false), "auto");
  assert.equal(nextTheme("auto", false), "light");
});

// Defensive: an unrecognised stored value behaves like auto (index -1 → 0).
test("an unknown current mode steps to the start of the cycle", () => {
  assert.equal(nextTheme("bogus", true), "auto");
  assert.equal(nextTheme("bogus", false), "auto");
});
