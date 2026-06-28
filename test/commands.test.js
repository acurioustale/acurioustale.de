import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { reply, help } from "../js/commands.js";

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

test("date returns a date string", () => {
  assert.ok(reply("date").length > 10);
});

test("echo echoes back arguments", () => {
  assert.equal(reply("echo hello world"), "hello world");
  assert.equal(reply("echo"), "");
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

// Commands terminal.js dispatches on: every `cmd === "..."` literal.
// Plus commands commands.js handles directly: every `argv[0] === "..."` literal.
const dispatched = new Set([
  ...[...terminalSource.matchAll(/cmd === "([^"]+)"/g)].map((m) => m[1]),
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
// entries you discover with `ls` and run directly (`./whoami.sh`, `ls projects/`),
// and the trailing-slash-less `ls projects` alias.
const ALIASES = new Set(["ls projects", "ls projects/", "./whoami.sh"]);

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
