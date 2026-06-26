// Pure terminal command logic, extracted so it can be unit-tested without a DOM
// (see test/commands.test.js). The DOM wiring lives in terminal.js.

// Pick the denial that fits: privileged → permission denied, a bare ls is
// locked down, ls of any other path errors like ls, anything else that looks
// like a path → no such file, otherwise command not found.
export function reply(cmd) {
  const argv = cmd.split(/\s+/);
  // An array, not an object-as-set: a plain object would match inherited
  // Object.prototype members (toString, constructor, …) as commands.
  const PRIV = ["sudo", "su", "doas", "chmod", "chown"];
  if (PRIV.indexOf(argv[0]) !== -1) return argv[0] + ": permission denied";
  if (argv[0] === "ls") {
    if (argv.length < 2) return "ls: .: Permission denied";
    return "ls: " + argv.slice(1).join(" ") + ": No such file or directory";
  }
  if (cmd.indexOf("/") !== -1) {
    return "bash: " + argv[argv.length - 1] + ": No such file or directory";
  }
  return "bash: " + argv[0] + ": command not found";
}
