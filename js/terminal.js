import { reply, help } from "./commands.js";

// Easter egg: turn the static prompt into a real input as progressive
// enhancement. Without JS the blinking cursor stays and nothing breaks.
// Most commands are denied, with the flavour reply() picks. The few that
// work: clear wipes the whole screen (the boot card included, like a real
// terminal), help lists the commands, and ./whoami.sh and ls projects/
// reprint the whoami card and the projects list.
(function () {
  var last = document.querySelector(".prompt-last");
  if (!last) return;

  // Desktop only: on touch devices the static cursor is left untouched so
  // a stray tap never pops up the on-screen keyboard.
  if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches)
    return;

  var screen = last.parentNode;
  var cursor = last.querySelector(".cursor");

  // Scrollback for echoed commands and their replies. The prompt line
  // stays at the bottom; new output is inserted just above it.
  var log = document.createElement("div");
  log.setAttribute("aria-live", "polite");
  screen.insertBefore(log, last);

  // The page's boot output — the login line, the whoami card, the projects
  // list and their command lines — is static markup above the scrollback.
  // clear hides all of it so the screen truly empties; the originals stay in
  // the DOM (just hidden) so echoBlock can still clone them when a command
  // reprints. Everything except the scrollback and the live prompt counts.
  var boot = [];
  for (var b = 0; b < screen.children.length; b++) {
    if (screen.children[b] !== log && screen.children[b] !== last) {
      boot.push(screen.children[b]);
    }
  }

  var input = document.createElement("input");
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
    var prevLogDisplay = log.style.display;
    var prevBootDisplay = [];
    for (var i = 0; i < boot.length; i++) {
      prevBootDisplay.push(boot[i].style.display);
      boot[i].style.display = "";
    }
    log.style.display = "none";
    screen.style.height = "auto";
    // Round up and add a hair of slack: the content height is often
    // fractional, and freezing to a value even a sub-pixel short trips the
    // scrollbar at some zoom levels and device pixel ratios.
    var height = Math.ceil(screen.getBoundingClientRect().height) + 2;
    log.style.display = prevLogDisplay;
    for (var j = 0; j < boot.length; j++)
      boot[j].style.display = prevBootDisplay[j];
    screen.style.height = height + "px";
    screen.scrollTop = screen.scrollHeight;
  }
  fitScreen();
  // Recompute on resize: the card reflows, changing the boot height. fitScreen
  // forces a synchronous layout, so coalesce a burst of resize events into one
  // measurement per frame instead of running it on every event.
  var resizeFrame = 0;
  window.addEventListener("resize", function () {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = 0;
      fitScreen();
    });
  });

  // Echo the typed command, reusing the prompt/run styling. textContent
  // only — never innerHTML — so typed input can't inject markup.
  function echoLine(raw) {
    var echo = document.createElement("p");
    echo.className = "cmd";
    var p = document.createElement("span");
    p.className = "prompt";
    p.textContent = "$";
    var c = document.createElement("span");
    c.className = "run";
    c.textContent = " " + raw;
    echo.appendChild(p);
    echo.appendChild(c);
    log.appendChild(echo);
  }

  // Replay a static block (the whoami card or the projects list) as output
  // by cloning the original node, so it stays in sync with the page.
  function echoBlock(selector) {
    var node = document.querySelector(selector);
    if (!node) return;
    var clone = node.cloneNode(true);
    // The original is hidden once clear has run; cloneNode copies that inline
    // display:none, so reset it or the reprinted block would be invisible.
    clone.style.display = "";
    // Demote any cloned <h1> so replayed output doesn't add duplicate
    // top-level headings to the document outline.
    var heading = clone.querySelector("h1");
    if (heading) {
      var p = document.createElement("p");
      p.className = heading.className;
      p.textContent = heading.textContent;
      heading.replaceWith(p);
    }
    log.appendChild(clone);
  }

  function replyLine(text) {
    var out = document.createElement("p");
    out.className = "reply";
    out.textContent = text;
    log.appendChild(out);
  }

  // The help listing is a preformatted block so its aligned columns and line
  // breaks survive (a <p> would collapse them onto one line).
  function helpBlock() {
    var out = document.createElement("pre");
    out.className = "help";
    out.textContent = help();
    log.appendChild(out);
  }

  function run() {
    var raw = input.value;
    var cmd = raw.trim();
    if (!cmd) return;

    // clear empties the screen: wipe the scrollback and hide the boot output,
    // leaving just the prompt, like a real terminal. Re-running a command
    // reprints the relevant block.
    if (cmd === "clear") {
      log.textContent = "";
      for (var k = 0; k < boot.length; k++) boot[k].style.display = "none";
      input.value = "";
      size();
      return;
    }

    echoLine(raw);

    // Commands that produce real output replay the matching static block;
    // help lists them; everything else is denied with reply()'s flavour.
    if (cmd === "./whoami.sh") {
      echoBlock(".whoami");
    } else if (cmd === "ls projects/" || cmd === "ls projects") {
      echoBlock(".projects");
    } else if (cmd === "help") {
      helpBlock();
    } else {
      replyLine(reply(cmd));
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
    var ae = document.activeElement;
    if (ae && ae !== document.body) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    input.focus({ preventScroll: true });
  });

  // Focus on load so typing works right away.
  input.focus({ preventScroll: true });
})();
