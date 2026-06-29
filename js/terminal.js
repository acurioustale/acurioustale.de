import { reply, help } from "./commands.js";

// Easter egg: turn the static prompt into a real input as progressive
// enhancement. Without JS the blinking cursor stays and nothing breaks.
// Most commands are denied, with the flavour reply() picks. The few that
// work: clear wipes the whole screen (the boot card included, like a real
// terminal), help lists the commands, and ./whoami.sh and ls projects/
// reprint the whoami card and the projects list.
const last = document.querySelector(".prompt-last");

// Desktop only: enable the input only on a device with a fine pointer and no
// touch at all, so a stray tap never pops up the on-screen keyboard. Checking
// `(pointer: fine)` alone isn't enough — it reports the primary pointer, so a
// touchscreen laptop or a tablet with a trackpad still matches; excluding
// `(any-pointer: coarse)` leaves those hybrids on the static cursor.
if (
  last &&
  window.matchMedia &&
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(any-pointer: coarse)").matches
) {
  const screen = last.parentNode;
  const cursor = last.querySelector(".cursor");

  // Scrollback for echoed commands and their replies. The prompt line
  // stays at the bottom; new output is inserted just above it.
  const log = document.createElement("div");
  log.setAttribute("aria-live", "polite");
  screen.insertBefore(log, last);

  // The page's boot output — the login line, the whoami card, the projects
  // list and their command lines — is static markup above the scrollback.
  // clear hides all of it so the screen truly empties; the originals stay in
  // the DOM (just hidden) so echoBlock can still clone them when a command
  // reprints.
  const boot = document.querySelector(".boot-container");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "cmd-input";
  input.setAttribute("aria-label", "Terminal — type a command");
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  last.insertBefore(input, cursor);

  // Grow the field with its content so the block cursor trails the text.
  function size() {
    input.style.width = input.value.length + "ch";
  }
  size();
  input.addEventListener("input", size);

  // Freeze the screen at its boot height so command history scrolls inside
  // the window instead of growing it. Measured with the scrollback hidden and
  // the boot output momentarily restored, so the size is always the initial
  // card at the current width — never whatever has been typed since, and never
  // the collapsed single line left after clear has hidden the boot output.
  function fitScreen() {
    const prevLogDisplay = log.style.display;
    const prevBootDisplay = boot.style.display;
    boot.style.display = "";
    log.style.display = "none";
    screen.style.height = "auto";
    // Round up and add a hair of slack: the content height is often
    // fractional, and freezing to a value even a sub-pixel short trips the
    // scrollbar at some zoom levels and device pixel ratios.
    const height = Math.ceil(screen.getBoundingClientRect().height) + 2;
    log.style.display = prevLogDisplay;
    boot.style.display = prevBootDisplay;
    screen.style.height = height + "px";
    screen.scrollTop = screen.scrollHeight;
  }
  fitScreen();
  // Recompute only when the terminal's actual width changes: the card reflows,
  // changing the boot height. Using ResizeObserver avoids the layout thrashing
  // of window resize events (which fire on vertical resizes or when the window
  // exceeds the terminal's max-width).
  let lastWidth = screen.getBoundingClientRect().width;
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(function () {
      const newWidth = screen.getBoundingClientRect().width;
      if (newWidth !== lastWidth) {
        lastWidth = newWidth;
        fitScreen();
      }
    });
    ro.observe(screen);
  } else {
    let resizeFrame = 0;
    window.addEventListener("resize", function () {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(function () {
        resizeFrame = 0;
        const newWidth = screen.getBoundingClientRect().width;
        if (newWidth !== lastWidth) {
          lastWidth = newWidth;
          fitScreen();
        }
      });
    });
  }

  // Echo the typed command, reusing the prompt/run styling. textContent
  // only — never innerHTML — so typed input can't inject markup.
  function echoLine(raw) {
    const echo = document.createElement("p");
    echo.className = "cmd";
    const p = document.createElement("span");
    p.className = "prompt";
    p.textContent = "$";
    const c = document.createElement("span");
    c.className = "run";
    c.textContent = " " + raw;
    echo.appendChild(p);
    echo.appendChild(c);
    log.appendChild(echo);
  }

  // Replay a static block (the whoami card or the projects list) as output
  // by cloning the original node, so it stays in sync with the page.
  function echoBlock(selector) {
    const node = document.querySelector(selector);
    if (!node) return;
    const clone = node.cloneNode(true);
    // Demote any cloned <h1> so replayed output doesn't add duplicate
    // top-level headings to the document outline.
    const heading = clone.querySelector("h1");
    if (heading) {
      const p = document.createElement("p");
      p.className = heading.className;
      p.textContent = heading.textContent;
      heading.replaceWith(p);
    }
    log.appendChild(clone);
  }

  function replyLine(text) {
    const out = document.createElement("p");
    out.className = "reply";
    out.textContent = text;
    log.appendChild(out);
  }

  // The help listing is a preformatted block so its aligned columns and line
  // breaks survive (a <p> would collapse them onto one line).
  function helpBlock() {
    const out = document.createElement("pre");
    out.className = "help";
    out.textContent = help();
    log.appendChild(out);
  }

  // Commands that replay a static block, keyed by the canonical command and
  // mapped to the selector they reprint. A trailing slash on the path is
  // ignored (so `ls projects` and `ls projects/` are one command); to support
  // another listable block, add a row here rather than another branch.
  // Created with a null prototype so inherited Object.prototype properties
  // (toString, __proto__, ...) cannot be exploited as commands.
  const BLOCKS = Object.assign(Object.create(null), {
    "./whoami.sh": ".whoami",
    "ls projects": ".projects",
  });

  function run() {
    const raw = input.value;
    const rawCmd = raw.trim();
    if (!rawCmd) return;

    // Normalize internal consecutive whitespace to a single space for matching.
    const cmd = rawCmd.replace(/\s+/g, " ");

    // clear empties the screen: wipe the scrollback and hide the boot output,
    // leaving just the prompt, like a real terminal. Re-running a command
    // reprints the relevant block.
    if (cmd === "clear") {
      log.textContent = "";
      boot.style.display = "none";
      input.value = "";
      size();
      return;
    }

    echoLine(raw);

    // Commands that produce real output replay the matching static block;
    // help lists them; everything else is denied with reply()'s flavour.
    const blockSelector = BLOCKS[cmd.replace(/\/+$/, "")];
    if (blockSelector) {
      echoBlock(blockSelector);
    } else if (cmd === "help") {
      helpBlock();
    } else {
      replyLine(reply(rawCmd));
    }

    input.value = "";
    size();
    // Keep the prompt in view as history scrolls up.
    screen.scrollTop = screen.scrollHeight;
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
  });

  // Click the prompt line to focus it.
  last.addEventListener("click", function () {
    input.focus();
  });

  // Type anywhere to focus the prompt — the first keystroke lands in the
  // field with no click needed, and refocuses it if focus drifted away.
  // Ignore shortcuts and non-text keys so browser combos still work, and
  // never steal focus from a real control: a button activates on Space's
  // keyup, so grabbing focus on keydown would swallow the theme toggle.
  document.addEventListener("keydown", function (e) {
    const ae = document.activeElement;
    if (ae && ae !== document.body) return;
    // AltGr (reported as Ctrl+Alt on Windows) produces text on many layouts —
    // it types @ { } [ ] etc. — so treat it as typing, not a shortcut.
    const altGraph = !!(e.getModifierState && e.getModifierState("AltGraph"));
    if (e.metaKey || ((e.ctrlKey || e.altKey) && !altGraph)) return;
    if (e.key.length !== 1) return;
    input.focus({ preventScroll: true });
  });

  // Focus on load so typing works right away.
  input.focus({ preventScroll: true });
}
