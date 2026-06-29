import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  reply,
  help,
  formatUptime,
  MS_PER_MIN,
  MIN_PER_HOUR,
  MIN_PER_DAY,
} from "../js/commands.js";

test("privileged commands are denied with permission denied", () => {
  for (const cmd of ["su", "doas", "chmod", "chown"]) {
    assert.equal(reply(cmd), cmd + ": permission denied");
    // The denial names the bare command, ignoring any arguments.
    assert.equal(reply(cmd + " -R /"), cmd + ": permission denied");
  }
});

test("sudo returns the classic lecture and incident report", () => {
  const res = reply("sudo su");
  assert.match(res, /We trust you have received the usual lecture/);
  assert.match(
    res,
    /guest is not in the sudoers file\. {2}This incident will be reported\./,
  );
});

test("a bare ls lists projects/ and whoami.sh", () => {
  assert.equal(reply("ls"), "projects/ whoami.sh");
});

test("ls of any other path errors like real ls", () => {
  assert.equal(reply("ls foo"), "ls: foo: No such file or directory");
  assert.equal(reply("ls a b"), "ls: a b: No such file or directory");
});

test("uptime returns calculated uptime string", () => {
  assert.match(reply("uptime"), /^up \d/);
});

// formatUptime is pure, so exercise every branch directly — reply("uptime")
// alone only ever hits one form (whatever the real elapsed time happens to be).
const MIN = MS_PER_MIN;
const HOUR = MIN_PER_HOUR * MIN;
const DAY = MIN_PER_DAY * MIN;

test("formatUptime shows minutes only under an hour", () => {
  assert.equal(formatUptime(0), "up 0 min");
  assert.equal(formatUptime(5 * MIN), "up 5 min");
  assert.equal(formatUptime(59 * MIN), "up 59 min");
});

test("formatUptime switches to H:MM at an hour, zero-padding minutes", () => {
  assert.equal(formatUptime(HOUR), "up 1:00");
  assert.equal(formatUptime(3 * HOUR + 7 * MIN), "up 3:07");
  assert.equal(formatUptime(23 * HOUR + 59 * MIN), "up 23:59");
});

test("formatUptime prefixes the day count, singular and plural", () => {
  assert.equal(formatUptime(DAY + 3 * HOUR + 4 * MIN), "up 1 day, 3:04");
  assert.equal(formatUptime(2 * DAY + 13 * HOUR), "up 2 days, 13:00");
});

test("formatUptime keeps the minutes-only form past a day when the hour is 0", () => {
  // The regression this guards: it must read "up 1 day, 5 min", not "0:05".
  assert.equal(formatUptime(DAY + 5 * MIN), "up 1 day, 5 min");
  assert.equal(formatUptime(2 * DAY), "up 2 days, 0 min");
});

test("formatUptime clamps a negative (backwards clock) to up 0 min", () => {
  assert.equal(formatUptime(-5 * MIN), "up 0 min");
  assert.equal(formatUptime(-DAY), "up 0 min");
});

test("date returns a Date.toString()-style string", () => {
  // Assert the actual shape (weekday, month, day, year, time, GMT offset) so a
  // broken date branch can't slip through, rather than just a length bound any
  // non-empty string would clear.
  assert.match(
    reply("date"),
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}/,
  );
});

test("echo echoes back arguments", () => {
  assert.equal(reply("echo hello world"), "hello world");
  assert.equal(reply("echo"), "");
});

test("a path-like command reports no such file, naming the executable path", () => {
  assert.equal(reply("./run.sh"), "bash: ./run.sh: No such file or directory");
  assert.equal(
    reply("/usr/bin/custom"),
    "bash: /usr/bin/custom: No such file or directory",
  );
});

test("anything else is command not found", () => {
  assert.equal(reply("cat /etc/passwd"), "bash: cat: command not found");
  assert.equal(reply("whoami"), "bash: whoami: command not found");
  assert.equal(reply("vim foo"), "bash: vim: command not found");
});

test("empty command returns empty string", () => {
  assert.equal(reply(""), "");
  assert.equal(reply("   "), "");
});

// help() must list every command that terminal.js actually handles, so the
// listing can't drift out of sync with what the prompt accepts.
test("help lists each advertised command", () => {
  const text = help();
  assert.match(text, /^available commands:/);
  for (const cmd of ["ls", "uptime", "date", "sudo", "echo", "clear", "help"]) {
    assert.ok(text.includes(cmd), `help should mention ${cmd}`);
  }
});

// whoami.sh and projects/ are filesystem entries discovered via `ls` and run
// directly, not advertised commands, so help() must not list them.
test("help does not advertise the discoverable filesystem entries", () => {
  const text = help();
  assert.ok(!text.includes("whoami.sh"), "help should not list whoami.sh");
  assert.ok(!text.includes("projects/"), "help should not list projects/");
});

// Regression guard for the array-not-object choice in reply(): inherited
// Object.prototype member names must not be treated as known commands.
test("Object.prototype member names are command not found, not privileged", () => {
  for (const cmd of ["toString", "constructor", "hasOwnProperty"]) {
    assert.equal(reply(cmd), "bash: " + cmd + ": command not found");
  }
});

// The tests above prove help() advertises each command; the two below bind that
// listing to terminal.js's actual dispatch, so adding, renaming or dropping a
// command on one side without the other fails CI. terminal.js's DOM glue isn't
// unit-tested, but its command set is plain string comparisons we read from the
// source.
const terminalSource = readFileSync(
  fileURLToPath(new URL("../js/terminal.js", import.meta.url)),
  "utf8",
);

const commandsSource = readFileSync(
  fileURLToPath(new URL("../js/commands.js", import.meta.url)),
  "utf8",
);

// Commands terminal.js dispatches on: every `cmd === "..."` literal, plus the
// keys of the BLOCKS map (commands that replay a static block, written as
// `"cmd": ".selector"`). Plus commands commands.js handles directly: every
// `argv[0] === "..."` literal.
const dispatched = new Set([
  ...[...terminalSource.matchAll(/cmd === "([^"]+)"/g)].map((m) => m[1]),
  ...[...terminalSource.matchAll(/"([^"]+)":\s*"\.[\w-]+"/g)].map((m) => m[1]),
  ...[...commandsSource.matchAll(/argv\[0\] === "([^"]+)"/g)].map((m) => m[1]),
]);

// Commands help() advertises: the first column of each listing line (the
// command, separated from its description by two or more spaces).
const advertised = help()
  .split("\n")
  .slice(1)
  .map((line) => line.trim().split(/\s{2,}/)[0])
  .filter(Boolean);

// Commands terminal.js accepts but help() intentionally omits: the filesystem
// entries you discover with `ls` and run directly (`./whoami.sh`, `ls projects`).
const ALIASES = new Set(["ls projects", "./whoami.sh"]);

test("every command help() lists is actually dispatched by terminal.js", () => {
  for (const cmd of advertised) {
    assert.ok(
      dispatched.has(cmd),
      `help() lists "${cmd}" but terminal.js never dispatches it`,
    );
  }
});

test("every command terminal.js dispatches is listed by help() (aliases aside)", () => {
  for (const cmd of dispatched) {
    if (ALIASES.has(cmd)) continue;
    assert.ok(
      advertised.includes(cmd),
      `terminal.js handles "${cmd}" but help() omits it`,
    );
  }
});
