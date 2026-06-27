import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { reply, help } from "../js/commands.js";

test("privileged commands are denied with permission denied", () => {
  for (const cmd of ["sudo", "su", "doas", "chmod", "chown"]) {
    assert.equal(reply(cmd), cmd + ": permission denied");
    // The denial names the bare command, ignoring any arguments.
    assert.equal(reply(cmd + " -R /"), cmd + ": permission denied");
  }
});

test("a bare ls is locked down", () => {
  assert.equal(reply("ls"), "ls: .: Permission denied");
});

test("ls of any other path errors like real ls", () => {
  assert.equal(reply("ls foo"), "ls: foo: No such file or directory");
  assert.equal(reply("ls a b"), "ls: a b: No such file or directory");
});

test("a path-like command reports no such file, naming the last token", () => {
  assert.equal(
    reply("cat /etc/passwd"),
    "bash: /etc/passwd: No such file or directory",
  );
  assert.equal(reply("./run.sh"), "bash: ./run.sh: No such file or directory");
});

test("anything else is command not found", () => {
  assert.equal(reply("whoami"), "bash: whoami: command not found");
  assert.equal(reply("vim foo"), "bash: vim: command not found");
});

// help() must list every command that terminal.js actually handles, so the
// listing can't drift out of sync with what the prompt accepts.
test("help lists each working command", () => {
  const text = help();
  assert.match(text, /^available commands:/);
  for (const cmd of ["./whoami.sh", "ls projects/", "clear", "help"]) {
    assert.ok(text.includes(cmd), `help should mention ${cmd}`);
  }
});

// Regression guard for the array-not-object choice in reply(): inherited
// Object.prototype member names must not be treated as known commands.
test("Object.prototype member names are command not found, not privileged", () => {
  for (const cmd of ["toString", "constructor", "hasOwnProperty"]) {
    assert.equal(reply(cmd), "bash: " + cmd + ": command not found");
  }
});

// The test above proves help() advertises the four commands; the two below bind
// that listing to terminal.js's actual dispatch, so adding, renaming or dropping
// a command on one side without the other fails CI. terminal.js's DOM glue isn't
// unit-tested, but its command set is plain string comparisons we read from the
// source.
const terminalSource = readFileSync(
  fileURLToPath(new URL("../js/terminal.js", import.meta.url)),
  "utf8",
);

// Commands terminal.js dispatches on: every `cmd === "..."` literal.
const dispatched = new Set(
  [...terminalSource.matchAll(/cmd === "([^"]+)"/g)].map((m) => m[1]),
);

// Commands help() advertises: the first column of each listing line (the
// command, separated from its description by two or more spaces).
const advertised = help()
  .split("\n")
  .slice(1)
  .map((line) => line.trim().split(/\s{2,}/)[0])
  .filter(Boolean);

// Lenient aliases terminal.js accepts but help() intentionally omits (e.g.
// `ls projects` without the trailing slash mirrors the documented form).
const ALIASES = new Set(["ls projects"]);

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
