import { test } from "node:test";
import assert from "node:assert/strict";

import { reply } from "../js/commands.js";

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

// Regression guard for the array-not-object choice in reply(): inherited
// Object.prototype member names must not be treated as known commands.
test("Object.prototype member names are command not found, not privileged", () => {
  for (const cmd of ["toString", "constructor", "hasOwnProperty"]) {
    assert.equal(reply(cmd), "bash: " + cmd + ": command not found");
  }
});
