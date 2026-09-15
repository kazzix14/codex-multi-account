"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function isCodexCommand(args) {
  // Include app-server and the account wrapper, but not cx-setup itself.
  return args.some((arg) => /^(?:codex|cx|cxa|cxr)(?:\.exe)?$/.test(path.basename(arg)));
}

function canonical(file) {
  try { return fs.realpathSync(file); } catch { return path.resolve(file); }
}

function inspectCodexProcesses() {
  const homes = new Set();
  let unknown = false;
  try {
    if (process.platform === "linux") {
      for (const pid of fs.readdirSync("/proc").filter((name) => /^\d+$/.test(name))) {
        if (Number(pid) === process.pid) continue;
        try {
          if (fs.statSync(`/proc/${pid}`).uid !== process.getuid()) continue;
          const args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
          if (!isCodexCommand(args)) continue;
          const env = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8")
            .split("\0").filter((entry) => entry.includes("="))
            .map((entry) => [entry.slice(0, entry.indexOf("=")), entry.slice(entry.indexOf("=") + 1)]));
          const dir = env.CODEX_HOME || (env.HOME && path.join(env.HOME, ".codex"));
          if (!dir) { unknown = true; continue; }
          const cwd = path.isAbsolute(dir) ? "/" : fs.readlinkSync(`/proc/${pid}/cwd`);
          homes.add(canonical(path.resolve(cwd, dir)));
        } catch (error) {
          // Vanished processes are harmless; unreadable live processes are not.
          if (error.code !== "ENOENT" && error.code !== "ESRCH") unknown = true;
        }
      }
    } else if (process.platform === "darwin") {
      // ps does not expose an unambiguous, NUL-delimited environment on macOS.
      // Do not guess a home from its command/environment text (or expose secrets).
      const listing = execFileSync("/bin/ps", ["-axo", "pid=,uid=,comm="], {
        encoding: "utf8", timeout: 5000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of listing.split("\n")) {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if (!match || Number(match[1]) === process.pid || Number(match[2]) !== process.getuid()) continue;
        if (isCodexCommand([match[3]])) { unknown = true; continue; }
        if (!/^(?:node|sh|bash|zsh)$/.test(path.basename(match[3]))) continue;
        try {
          const args = execFileSync("/bin/ps", ["-p", match[1], "-o", "args="], {
            encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"],
          }).trim().split(/\s+/);
          if (isCodexCommand(args)) unknown = true;
        } catch (error) {
          if (error.status !== 1) unknown = true; // ps exits 1 when the PID has gone.
        }
      }
    } else {
      unknown = true;
    }
  } catch {
    unknown = true;
  }
  return { homes, unknown };
}

function assertHomesInactive(targetHomes, sharedItems, inspection = inspectCodexProcesses()) {
  if (inspection.unknown) {
    throw new Error("Cannot verify inactive Codex homes. On macOS, exit all Codex sessions/app-servers before setup; --allow-active explicitly overrides this check.");
  }
  const resources = (dir) => [canonical(dir), ...sharedItems.map((item) => canonical(path.join(dir, item)))];
  const targets = new Set(targetHomes.flatMap(resources));
  for (const dir of inspection.homes) {
    if (resources(dir).some((resource) => targets.has(resource))) {
      throw new Error(`Refusing to modify active Codex homes or shared state: ${dir}. Exit Codex first, or explicitly use --allow-active.`);
    }
  }
}

// child.killed only means a signal was sent. Wait for exit, then resolve.
function stopChild(child, signal = "SIGTERM", graceMs = 3000) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, graceMs);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill(signal);
  });
}

module.exports = { assertHomesInactive, canonical, inspectCodexProcesses, isCodexCommand, stopChild };
