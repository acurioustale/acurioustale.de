import { test } from "node:test";
import assert from "node:assert/strict";

import { capLimit, recallHistory, shouldRefit } from "../js/terminal-ui.js";

test("capLimit drops only the overflow past the cap, never at or below it", () => {
  assert.equal(capLimit(0, 200), 0);
  assert.equal(capLimit(200, 200), 0); // at the cap: nothing to drop
  assert.equal(capLimit(201, 200), 1); // one over: drop one
  assert.equal(capLimit(250, 200), 50);
});

test("capLimit never returns a negative count", () => {
  assert.equal(capLimit(5, 200), 0);
});

// recallHistory is the ↑/↓ command recall as a pure transition. index ranges
// [0, entries.length]; index === entries.length is the live prompt.
const H = ["first", "second", "third"];

test("ArrowUp from the live prompt saves the current buffer and shows the last entry", () => {
  const next = recallHistory(H, H.length, "", "half-typed", "up");
  assert.deepEqual(next, { index: 2, buffer: "half-typed", value: "third" });
});

test("ArrowUp keeps the saved buffer while walking further up the history", () => {
  const next = recallHistory(H, 2, "half-typed", "third", "up");
  assert.deepEqual(next, { index: 1, buffer: "half-typed", value: "second" });
});

test("ArrowUp at the oldest entry does not move", () => {
  assert.equal(recallHistory(H, 0, "buf", "first", "up"), null);
});

test("ArrowUp on empty history does not move", () => {
  assert.equal(recallHistory([], 0, "", "", "up"), null);
});

test("ArrowDown walks back toward the prompt", () => {
  const next = recallHistory(H, 0, "buf", "first", "down");
  assert.deepEqual(next, { index: 1, buffer: "buf", value: "second" });
});

test("ArrowDown off the last entry restores the saved live buffer", () => {
  const next = recallHistory(H, H.length - 1, "half-typed", "third", "down");
  assert.deepEqual(next, {
    index: H.length,
    buffer: "half-typed",
    value: "half-typed",
  });
});

test("ArrowDown at the live prompt does not move", () => {
  assert.equal(recallHistory(H, H.length, "buf", "buf", "down"), null);
});

test("ArrowDown on empty history does not move", () => {
  assert.equal(recallHistory([], 0, "", "", "down"), null);
});

// A full up-then-down round trip returns the field to exactly what was typed.
test("recall round trip restores the live buffer after stepping up and back down", () => {
  let index = H.length;
  let buffer = "";
  const typed = "in progress";
  let up = recallHistory(H, index, buffer, typed, "up");
  ({ index, buffer } = up);
  const down = recallHistory(H, index, buffer, up.value, "down");
  assert.equal(down.index, H.length);
  assert.equal(down.value, typed);
});

// shouldRefit gates the screen-height re-freeze: only a width change reflows the
// card, so a height-only resize (same width) must be a no-op.
test("shouldRefit re-freezes only when the width changed", () => {
  assert.equal(shouldRefit(500, 400), true); // width grew
  assert.equal(shouldRefit(400, 500), true); // width shrank
  assert.equal(shouldRefit(400, 400), false); // height-only resize: no-op
});
