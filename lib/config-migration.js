"use strict";

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const toml = require("smol-toml");

function readConfig(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat && !stat.isFile()) throw new Error(`Config must be a regular file: ${file}`);
  const text = stat ? fs.readFileSync(file, "utf8") : "";
  try { toml.parse(text); } catch { throw new Error(`Invalid TOML; no config changed: ${file}`); }
  return { file, original: stat ? text : null, text };
}

function topLevelSpans(text, keys) {
  // Parse complete statements, including multiline arrays/strings. Preserve the
  // bytes of all unrelated statements and comments instead of reserializing them.
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const spans = new Map();
  let offset = 0;
  for (let index = 0; index < lines.length;) {
    if (/^\s*(?:#.*)?$/.test(lines[index])) { offset += lines[index++].length; continue; }
    if (/^\s*\[/.test(lines[index])) break;
    const start = offset;
    let statement = "";
    let parsed;
    while (index < lines.length) {
      statement += lines[index];
      offset += lines[index++].length;
      try { parsed = toml.parse(statement); break; } catch { /* incomplete statement */ }
    }
    if (!parsed) throw new Error("Cannot safely identify TOML statement boundaries");
    for (const key of Object.keys(parsed)) {
      if (!keys.has(key)) continue;
      if (spans.has(key)) throw new Error(`Cannot safely migrate dotted TOML key: ${key}`);
      spans.set(key, { start, end: offset });
    }
  }
  return spans;
}

function editTopLevel(text, values, remove = false) {
  const spans = topLevelSpans(text, new Set(Object.keys(values)));
  const edits = [];
  let prefix = "";
  for (const [key, value] of Object.entries(values)) {
    const replacement = remove ? "" : toml.stringify({ [key]: value });
    if (spans.has(key)) edits.push({ ...spans.get(key), replacement });
    else if (!remove) prefix += replacement;
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
  }
  text = prefix + text;
  toml.parse(text);
  return text;
}

function atomicWrite(file, text) {
  const temp = `${file}.cx-tmp-${randomUUID()}`;
  try {
    fs.writeFileSync(temp, text, { mode: 0o600, flag: "wx" });
    const fd = fs.openSync(temp, "r");
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
  } finally { fs.rmSync(temp, { force: true }); }
}

function commitConfigs(changes, options = {}) {
  changes = changes.filter((change) => change.original !== change.text);
  if (options.dryRun) {
    for (const change of changes) console.log(`[dry-run] validate, back up and write ${change.file}`);
    return;
  }
  const written = [];
  const backups = [];
  try {
    for (const change of changes) {
      if (readConfig(change.file).original !== change.original) throw new Error(`Config changed during setup: ${change.file}`);
      toml.parse(change.text);
      fs.mkdirSync(path.dirname(change.file), { recursive: true, mode: 0o700 });
      if (change.original !== null) {
        const backup = `${change.file}.cx-backup-${randomUUID()}`;
        fs.writeFileSync(backup, change.original, { mode: 0o600, flag: "wx" });
        backups.push(backup);
      }
    }
    // The source config is last: a crash never removes the only copy of notify.
    for (const change of changes) {
      if (readConfig(change.file).original !== change.original) throw new Error(`Config changed during setup: ${change.file}`);
      atomicWrite(change.file, change.text);
      written.push(change);
    }
  } catch (error) {
    const failures = [];
    for (const change of written.reverse()) {
      try {
        if (change.original === null) fs.unlinkSync(change.file);
        else atomicWrite(change.file, change.original);
      } catch { failures.push(change.file); }
    }
    throw new Error(`Config migration failed: ${error.message}. ${failures.length ? `Restore manually: ${failures.join(", ")}.` : "Config writes rolled back."} Backups: ${backups.join(", ") || "none needed"}`);
  }
}

function planSharedUserConfig(sharedHome, accounts) {
  const source = readConfig(path.join(sharedHome, "config.toml"));
  const parsed = toml.parse(source.text);
  if (!Object.hasOwn(parsed, "notify") || !accounts.length) return [];
  if (!Array.isArray(parsed.notify) || parsed.notify.some((arg) => typeof arg !== "string")) {
    throw new Error("notify must be an array of strings; no config changed");
  }
  const values = { notify: parsed.notify };
  const changes = accounts.map((account) => {
    const target = readConfig(path.join(account.home, "config.toml"));
    return { ...target, text: editTopLevel(target.text, values) };
  });
  changes.push({ ...source, text: editTopLevel(source.text, values, true) });
  return changes;
}

module.exports = { commitConfigs, editTopLevel, planSharedUserConfig, readConfig };
