// Pure interaction logic for the terminal glue in terminal.js, extracted so the
// fiddly parts (the scrollback cap threshold, history recall's index arithmetic
// and the focus-steal guard) can be unit-tested without a DOM. The DOM wiring
// that calls these lives in terminal.js. See test/terminalUi.test.js.

// How many leading scrollback nodes to drop so the log holds at most `max`.
// A strict upper bound: exactly `count - max` when over the cap, never negative.
// Kept as a function so the boundary (drop only past `max`, never at it) is
// pinned rather than buried in a loop condition.
export function capLimit(count, max) {
  return Math.max(0, count - max);
}

// The ↑/↓ command-history recall as a pure state transition. `index` ranges over
// [0, entries.length]; index === entries.length is the live prompt — the buffer
// the user was typing, passed as `current`. `buffer` is that live input saved
// when first stepping up off the prompt, so stepping back down restores it
// rather than an empty field. `direction` is "up" or "down".
//
// Returns the next { index, buffer, value } — `value` being what to place in the
// input — or null when the key doesn't move (empty history, or already at an
// end), so the caller leaves the input untouched.
export function recallHistory(entries, index, buffer, current, direction) {
  if (direction === "up") {
    if (index <= 0) return null;
    const nextBuffer = index === entries.length ? current : buffer;
    const nextIndex = index - 1;
    return { index: nextIndex, buffer: nextBuffer, value: entries[nextIndex] };
  }
  if (direction === "down") {
    if (index < entries.length - 1) {
      const nextIndex = index + 1;
      return { index: nextIndex, buffer, value: entries[nextIndex] };
    }
    // Stepping down off the last entry returns to the saved live buffer.
    if (index === entries.length - 1) {
      return { index: index + 1, buffer, value: buffer };
    }
    return null;
  }
  return null;
}

// Whether a keydown on the terminal container should pull focus into the input
// so the first keystroke lands there. True only for a bare printable character
// (key.length === 1) while focus is "passive" — on nothing in particular, so we
// never steal it from a real control. Never for editing shortcuts (Ctrl/Meta/Alt
// combos) so browser combos still work, except AltGr (reported as Ctrl+Alt on
// Windows), which types real characters on many layouts and so counts as typing.
export function shouldGrabFocus({
  activePassive,
  metaKey,
  ctrlKey,
  altKey,
  altGraph,
  key,
}) {
  if (!activePassive) return false;
  if (metaKey || ((ctrlKey || altKey) && !altGraph)) return false;
  return key.length === 1;
}

// Whether a resize warrants re-freezing the screen height. Only a width change
// reflows the card and so changes the boot height; a height-only resize leaves
// the frozen height correct, so it must be a no-op (this guard is the whole
// reason the ResizeObserver is preferred over window resize events). Shared by
// both the ResizeObserver and the resize-listener fallback in terminal.js.
export function shouldRefit(newWidth, lastWidth) {
  return newWidth !== lastWidth;
}
