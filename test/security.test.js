"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { once } = require("events");
const toml = require("smol-toml");
const { retryPlanAfterRateLimit, ensureRetrySessionAvailable, isUsageLimitLogLine,
  usageLimitThreadId, selectResult, runCodexMonitored, appServerRequest } = require("../bin/cx");
const { planSharedUserConfig, commitConfigs, editTopLevel } = require("../lib/config-migration");
const { inspectCodexProcesses, assertHomesInactive, canonical, stopChild } = require("../lib/processes");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "cx-security-test-"));
const id = "019eaaaa-bbbb-7ccc-8ddd-000000000001";
const foreignId = "019eaaaa-bbbb-7ccc-8ddd-000000000002";
const repo = path.resolve(__dirname, "..");

function transcript(home, threadId, cwd = process.cwd(), name = threadId) {
  const file = path.join(home, "sessions", `${name}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [
    { type: "session_meta", payload: { id: threadId, cwd, source: "cli" } },
    { type: "turn_context", payload: { model: threadId === id ? "wanted-model" : "foreign-model" } },
    { type: "event_msg", payload: { type: "task_started" } },
    { type: "event_msg", payload: { type: "user_message", message: "Continue my task" } },
  ].map(JSON.stringify).join("\n") + "\n");
  return file;
}

function checkSessionBinding() {
  const home = path.join(root, "source");
  const file = transcript(home, id);
  const foreign = transcript(home, foreignId);
  fs.utimesSync(foreign, new Date(), new Date(Date.now() + 10000));
  for (const args of [["exec", "task"], ["resume", id], ["resume", "named-task"], ["resume", "--last"]]) {
    const plan = retryPlanAfterRateLimit(args, home, { threadId: id });
    assert.ok(plan.args.includes(id));
    assert.equal(plan.args.includes("--last"), false);
    assert.equal(plan.args.includes("named-task"), false);
    assert.ok(plan.args.includes("wanted-model"));
    assert.equal(plan.session.file, file);
    assert.equal(plan.args.includes("foreign-model"), false);
  }
  assert.throws(() => retryPlanAfterRateLimit(["resume", id], home), /Cannot identify/);
  assert.throws(() => retryPlanAfterRateLimit(["resume", foreignId], home, { threadId: id }), /does not match/);
  assert.throws(() => retryPlanAfterRateLimit(["exec", "task"], home, { threadId: id, minMtimeMs: Date.now() + 60000 }), /No fresh transcript/);
  assert.throws(() => retryPlanAfterRateLimit(["-C", root, "exec", "task"], home, { threadId: id }), /different working directory/);
  const copy = transcript(home, id, process.cwd(), "duplicate");
  assert.throws(() => retryPlanAfterRateLimit([], home, { threadId: id }), /Multiple transcripts/);
  fs.unlinkSync(copy);
  const subordinate = fs.readFileSync(file, "utf8").replace('"source":"cli"', '"source":{"subagent":{"thread_spawn":{"parent_thread_id":"parent"}}}');
  fs.writeFileSync(file, subordinate);
  assert.throws(() => retryPlanAfterRateLimit([], home, { threadId: id }), /Cannot read interrupted transcript/);
  transcript(home, id);

  const plan = retryPlanAfterRateLimit([], home, { threadId: id });
  const target = { name: "target", home: path.join(root, "target") };
  ensureRetrySessionAvailable(plan.session, target);
  const dest = path.join(target.home, "sessions", `${id}.jsonl`);
  assert.equal(fs.readFileSync(dest, "utf8"), fs.readFileSync(file, "utf8"));
  assert.equal(fs.statSync(dest).mode & 0o777, 0o600);
  ensureRetrySessionAvailable(plan.session, target);
  fs.appendFileSync(dest, "{}\n");
  assert.throws(() => ensureRetrySessionAvailable(plan.session, target), /stale, conflicting/);
  assert.throws(() => ensureRetrySessionAvailable(plan.session, { name: "bad", home: file }), /ENOTDIR/);
  fs.appendFileSync(file, "broken JSON\n");
  assert.throws(() => ensureRetrySessionAvailable(plan.session, target), /changed or is invalid/);
  assert.throws(() => retryPlanAfterRateLimit([], home, { threadId: id }), /corrupt/);
}

function checkConfigMigration() {
  const shared = path.join(root, "config-shared");
  const accounts = ["config-a", "config-b"].map((name) => ({ home: path.join(root, name) }));
  for (const dir of [shared, ...accounts.map((a) => a.home)]) fs.mkdirSync(dir);
  const source = path.join(shared, "config.toml");
  const original = `# header\n"notify" = [\n  "/bin/echo", # preserved value\n  """line one\nline two""",\n  'literal # value',\n]\nmodel = "fixture" # keep me\n[features]\njs_repl = false\n`;
  const targetOriginal = `# account comment\nnotify = [\n "old",\n]\nmodel = "account"\n[features]\njs_repl = true\n`;
  fs.writeFileSync(source, original);
  const target = path.join(accounts[0].home, "config.toml");
  fs.writeFileSync(target, targetOriginal);
  let plan = planSharedUserConfig(shared, accounts);
  commitConfigs(plan, { dryRun: true });
  assert.equal(fs.readFileSync(source, "utf8"), original);
  // Inject a failure writing the source after both destinations were written.
  const rename = fs.renameSync;
  let injected = false;
  fs.renameSync = (from, to) => {
    if (to === source && !injected) { injected = true; throw new Error("injected disk failure"); }
    return rename(from, to);
  };
  try { assert.throws(() => commitConfigs(plan), /rolled back/); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(source, "utf8"), original);
  assert.equal(fs.readFileSync(target, "utf8"), targetOriginal);
  assert.equal(fs.existsSync(path.join(accounts[1].home, "config.toml")), false);
  commitConfigs(plan);
  for (const account of accounts) {
    assert.deepEqual(toml.parse(fs.readFileSync(path.join(account.home, "config.toml"), "utf8")).notify, toml.parse(original).notify);
  }
  const migrated = fs.readFileSync(source, "utf8");
  assert.equal(toml.parse(migrated).notify, undefined);
  assert.ok(migrated.includes('model = "fixture" # keep me\n[features]\njs_repl = false\n'));
  assert.ok(fs.readFileSync(target, "utf8").includes("# account comment"));
  const backups = fs.readdirSync(shared).filter((name) => name.includes(".cx-backup-"));
  assert.ok(backups.length > 0);
  for (const backup of backups) {
    assert.equal(fs.readFileSync(path.join(shared, backup), "utf8"), original);
    assert.equal(fs.statSync(path.join(shared, backup)).mode & 0o777, 0o600);
  }
  assert.equal(planSharedUserConfig(shared, accounts).length, 0);
  fs.writeFileSync(source, original);
  fs.writeFileSync(target, 'notify = [\n"unfinished"');
  assert.throws(() => planSharedUserConfig(shared, accounts), /Invalid TOML/);
  assert.equal(fs.readFileSync(source, "utf8"), original);
  fs.unlinkSync(target);
  fs.symlinkSync(source, target);
  assert.throws(() => planSharedUserConfig(shared, accounts), /regular file/);
  const other = 'description = """\n[not_a_table]\nnotify = ["inside a string"]\n"""\nmodel = "keep"\n';
  const edited = editTopLevel(other, { notify: ["actual"] });
  assert.deepEqual(toml.parse(edited).notify, ["actual"]);
  assert.ok(edited.includes(other));
  const dotted = 'features.first = true\nfeatures.second = false\n';
  assert.ok(editTopLevel(dotted, { notify: ["actual"] }).includes(dotted));
}

function checkQuotaDetection() {
  const prefix = `2026-09-15T00:00:00Z ERROR session_loop{thread_id=${id}}: Turn error: `;
  for (const body of [
    "HTTP status client error (401 Unauthorized) for url https://example.com/429",
    "unexpected status 403 Forbidden, request_id=429",
    "connection failed for url https://example.com/429",
  ]) assert.equal(isUsageLimitLogLine(prefix + body), false, body);
  assert.equal(usageLimitThreadId(prefix + "HTTP status client error (429 Too Many Requests)"), id);
  assert.equal(usageLimitThreadId(prefix.replace(id, "019e-short") + "usage limit reached"), null);
  const api = { account: { name: "paid" }, authMode: "apikey", ok: true,
    limits: { weekly: { usedPercent: 0, windowDurationMins: 10080 } } };
  assert.equal(selectResult([api], { apiKeyMode: "off" }), null);
  assert.equal(selectResult([api], { apiKeyMode: "fallback" }), api);
  assert.equal(selectResult([api], { apiKeyMode: "prefer" }), api);
}

async function checkProcesses() {
  const bin = path.join(root, "process-bin");
  fs.mkdirSync(bin);
  const executable = path.join(bin, "codex");
  const home = path.join(root, "process home");
  fs.mkdirSync(home);
  fs.writeFileSync(executable, `process.stdout.write("ready\\n"); setInterval(() => {}, 1000);`);
  for (const args of [[], ["app-server"]]) {
    const child = spawn(process.execPath, [executable, ...args], {
      env: { ...process.env, CODEX_HOME: home }, stdio: ["ignore", "pipe", "ignore"],
    });
    try {
      await once(child.stdout, "data");
      const inspection = inspectCodexProcesses();
      if (process.platform === "linux") assert.ok(inspection.homes.has(canonical(home)));
      else assert.equal(inspection.unknown, true);
      assert.throws(() => assertHomesInactive([home], ["sessions"], inspection), /active|inactive/);
      const setup = spawnSync(process.execPath, [path.join(repo, "bin/cx-setup"), "--homes", `test=${home}`, "--remove", "test"], {
        env: { ...process.env, HOME: root }, encoding: "utf8",
      });
      assert.equal(setup.status, 2, setup.stderr);
      assert.ok(fs.existsSync(home), "active home must not be renamed");
      const create = spawnSync(process.execPath, [path.join(repo, "bin/cx-setup"), "--accounts", "2", "--home", home], {
        env: { ...process.env, HOME: root }, encoding: "utf8",
      });
      assert.equal(create.status, 0, create.stderr);
      assert.equal(child.exitCode, null, "creating independent homes must leave the running Codex alone");
      const migrate = spawnSync(process.execPath, [path.join(repo, "bin/cx-setup"), "--accounts", "2", "--home", home, "--share"], {
        env: { ...process.env, HOME: root }, encoding: "utf8",
      });
      assert.equal(migrate.status, 2, "sharing a running source still requires the activity guard");
      assert.equal(fs.existsSync(path.join(root, ".codex-account1", "sessions")), false);
      const update = spawnSync(process.execPath, [path.join(repo, "bin/cx-setup"), "--add-api-key", "running", "--account-home", home, "--api-key", "fixture-only"], {
        env: { ...process.env, HOME: root }, encoding: "utf8",
      });
      assert.equal(update.status, 2, "replacing credentials in an existing active home must remain guarded");
      assert.equal(fs.existsSync(path.join(home, "auth.json")), false);
    } finally { await stopChild(child); }
  }
  // Default HOME without CODEX_HOME is protected on Linux too.
  const env = { ...process.env, HOME: home };
  delete env.CODEX_HOME;
  const child = spawn(process.execPath, [executable, "app-server"], { env, stdio: ["ignore", "pipe", "ignore"] });
  try {
    await once(child.stdout, "data");
    const inspection = inspectCodexProcesses();
    if (process.platform === "linux") assert.ok(inspection.homes.has(canonical(path.join(home, ".codex"))));
    else assert.equal(inspection.unknown, true);
  } finally { await stopChild(child); }

  const shared = path.join(root, "live-shared");
  fs.mkdirSync(shared);
  fs.symlinkSync(shared, path.join(home, "sessions"));
  assert.throws(() => assertHomesInactive([shared], ["sessions"], { homes: new Set([home]), unknown: false }), /shared state/);
  assert.throws(() => assertHomesInactive([root], [], { homes: new Set(), unknown: true }), /Cannot verify/);

  // Exercise the actual monitor and optional PATH wrapper, with a real process
  // that acknowledges SIGTERM but refuses to exit.
  const pidFile = path.join(root, "stubborn.pid");
  const logDir = path.join(root, "monitor-log");
  fs.mkdirSync(logDir);
  fs.writeFileSync(executable, `#!${process.execPath}\nconst fs = require('fs');
fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
process.on('SIGTERM', () => {});
if (!process.argv.includes('app-server')) fs.writeFileSync(${JSON.stringify(path.join(logDir, "codex-tui.log"))}, ${JSON.stringify(`2026-09-15T00:00:00Z ERROR session_loop{thread_id=${id}}: Turn error: usage limit reached\n`)});
setInterval(() => {}, 1000);\n`, { mode: 0o755 });
  fs.chmodSync(executable, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${path.join(repo, "bin")}:${bin}:${previousPath}`;
  try {
    const result = await runCodexMonitored({ home }, [], logDir);
    assert.equal(result.rateLimited, true);
    assert.equal(result.threadId, id);
    assert.throws(() => process.kill(Number(fs.readFileSync(pidFile, "utf8")), 0), /ESRCH/);
    await assert.rejects(() => appServerRequest(home, "account/read", null, { timeoutMs: 500 }), /timeout/);
    assert.throws(() => process.kill(Number(fs.readFileSync(pidFile, "utf8")), 0), /ESRCH/);
  } finally { process.env.PATH = previousPath; }
}

(async () => {
  try {
    checkSessionBinding();
    checkConfigMigration();
    checkQuotaDetection();
    await checkProcesses();
    console.log("Security regressions passed");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
