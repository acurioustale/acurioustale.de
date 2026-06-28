// Pure terminal command logic, extracted so it can be unit-tested without a DOM
// (see test/commands.test.js). The DOM wiring lives in terminal.js.

export const LAST_DEPLOY = 1782509511000;

// The commands that actually do something, printed by `help` so the prompt is
// discoverable — without it, a cleared screen gives no hint of what to type.
// Kept here next to reply() so a test can assert it lists every working command.
export function help() {
  return [
    "available commands:",
    "  ./whoami.sh    print the whoami card",
    "  ls projects/   list projects",
    "  ls             list directory contents",
    "  uptime         show how long the site has been running",
    "  date           print the current date and time",
    "  sudo           execute a command as superuser",
    "  echo           write arguments to the standard output",
    "  clear          clear the screen",
    "  help           show this help",
  ].join("\n");
}

// Mirror real `uptime`: minutes only under an hour ("up 5 min"), H:MM once past
// an hour, with a leading "D day(s)," past a day. Clamp negatives so a backwards
// clock (or a checkout whose LAST_DEPLOY is still in the future) can't print
// "up -1 days".
function formatUptime(ms) {
  const totalMins = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days === 0 && hours === 0) {
    return `up ${mins} min`;
  }
  const timeStr = `${hours}:${mins < 10 ? "0" + mins : mins}`;
  if (days > 0) {
    return `up ${days} ${days === 1 ? "day" : "days"}, ${timeStr}`;
  }
  return `up ${timeStr}`;
}

// Handle the commands terminal.js doesn't render as a block. A few produce real
// output (sudo's lecture, a bare ls listing, uptime, date, echo); the rest get
// the denial that fits: privileged → permission denied, ls of any path errors
// like ls, anything else that looks like a path → no such file, otherwise
// command not found.
export function reply(cmd) {
  const argv = cmd.split(/\s+/);
  // An array, not an object-as-set: a plain object would match inherited
  // Object.prototype members (toString, constructor, …) as commands.
  const PRIV = ["su", "doas", "chmod", "chown"];
  if (PRIV.indexOf(argv[0]) !== -1) return argv[0] + ": permission denied";
  if (argv[0] === "sudo") {
    return [
      "We trust you have received the usual lecture from the local System",
      "Administrator. It usually boils down to these three things:",
      "",
      "    #1) Respect the privacy of others.",
      "    #2) Think before you type.",
      "    #3) With great power comes great responsibility.",
      "",
      "guest is not in the sudoers file.  This incident will be reported.",
    ].join("\n");
  }
  if (argv[0] === "ls") {
    if (argv.length < 2) return "projects/ whoami.sh";
    return "ls: " + argv.slice(1).join(" ") + ": No such file or directory";
  }
  if (argv[0] === "uptime") {
    return formatUptime(Date.now() - LAST_DEPLOY);
  }
  if (argv[0] === "date") {
    return new Date().toString();
  }
  if (argv[0] === "echo") {
    return argv.slice(1).join(" ");
  }
  if (cmd.indexOf("/") !== -1) {
    return "bash: " + argv[argv.length - 1] + ": No such file or directory";
  }
  return "bash: " + argv[0] + ": command not found";
}
