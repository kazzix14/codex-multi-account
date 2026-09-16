"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const repo = path.resolve(__dirname, "..");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "cx-virtual-e2e-"));
const fakeBin = path.join(root, "fake-bin");
const recordsFile = path.join(root, "records.jsonl");

fs.mkdirSync(fakeBin, { recursive: true });

const fakeCodex = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const home = process.env.CODEX_HOME || '';
const account = path.basename(home);
const records = process.env.FAKE_RECORDS;
function append(data) { if (records) fs.appendFileSync(records, JSON.stringify(data) + '\\n'); }
function send(data) { process.stdout.write(JSON.stringify(data) + '\\n'); }
function limits() { return JSON.parse(process.env.FAKE_LIMITS || '{}')[account] || { w: 99, r: '' }; }
function goals() { return JSON.parse(process.env.FAKE_GOALS || '{}')[account] || {}; }
function shouldFailLimitReadOnce() {
  if (process.env.FAKE_LIMIT_FAIL_ONCE !== '1') return false;
  const markerDir = process.env.FAKE_LIMIT_FAIL_ONCE_DIR || path.dirname(records || home);
  fs.mkdirSync(markerDir, { recursive: true });
  try {
    fs.writeFileSync(path.join(markerDir, 'limit-read-' + account), '1', { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}
function logDir() {
  let value = args.find((arg) => arg.startsWith('log_dir='));
  for (let index = 0; !value && index < args.length; index += 1) {
    if (args[index] === '-c' || args[index] === '--config') {
      const candidate = args[index + 1];
      if (candidate && candidate.startsWith('log_dir=')) value = candidate;
      index += 1;
    }
  }
  if (!value || !value.startsWith('log_dir=')) return null;
  const encoded = value.slice('log_dir='.length);
  try { return JSON.parse(encoded); } catch { return encoded; }
}
function writeIncompleteSession() {
  const dir = path.join(home, 'sessions', '2026', '06', '04');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rollout-e2e.jsonl'), [
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: '019eaaaa-bbbb-7ccc-8ddd-000000000001', cwd: process.cwd(), source: 'cli' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-e2e' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'implement feature' }] } })
  ].join('\\n') + '\\n');
}
function writeUsageLimitedCompleteSession() {
  const dir = path.join(home, 'sessions', '2026', '06', '04');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rollout-e2e.jsonl'), [
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: '019eaaaa-bbbb-7ccc-8ddd-000000000002', cwd: process.cwd(), source: 'cli' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-e2e' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'new request' }] } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'token_count', rate_limits: { credits: { has_credits: false }, rate_limit_reached_type: null } } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-e2e', last_agent_message: null } })
  ].join('\\n') + '\\n');
}
function writeQueuedFollowupUsageLimitedSession() {
  const dir = path.join(home, 'sessions', '2026', '06', '04');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rollout-e2e.jsonl'), [
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: '019eaaaa-bbbb-7ccc-8ddd-000000000003', cwd: process.cwd(), source: 'cli' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-e2e' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'make screen capture work' }] } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'I am updating the scene.' }] } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'call-e2e', arguments: '{}' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'can I choose the screen capture source' }] } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'token_count', rate_limits: { credits: { has_credits: false }, rate_limit_reached_type: null } } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-e2e', last_agent_message: null } })
  ].join('\\n') + '\\n');
}
function writeFastSwitchedUsageLimitedSession() {
  const dir = path.join(home, 'sessions', '2026', '06', '04');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rollout-e2e.jsonl'), [
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: '019eaaaa-bbbb-7ccc-8ddd-000000000004', cwd: process.cwd(), source: 'cli' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'turn_context', payload: { effort: 'xhigh', collaboration_mode: { settings: { reasoning_effort: 'xhigh' } } } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-e2e' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '/fast' }] } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'finish this fast' }] } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'token_count', rate_limits: { credits: { has_credits: false }, rate_limit_reached_type: null } } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-e2e', last_agent_message: null } })
  ].join('\\n') + '\\n');
}
function writeNoIdUsageLimitedSession() {
  const dir = path.join(home, 'sessions', '2026', '06', '04');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rollout-no-session-id.jsonl'), [
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-e2e' } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'find similar bugs' }] } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'token_count', rate_limits: { credits: { has_credits: false }, rate_limit_reached_type: null } } }),
    JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-e2e', last_agent_message: null } })
  ].join('\\n') + '\\n');
}
function writeLog(line) {
  const dir = logDir();
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'codex-tui.log'), line + '\\n');
}
if (args[0] === 'app-server') {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    for (;;) {
      const nl = buf.indexOf('\\n');
      if (nl < 0) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.method === 'initialize') send({ id: msg.id, result: { ok: true } });
      if (msg.method === 'account/read') {
        append({ type: 'account-read', home, params: msg.params });
        if (process.env.FAKE_REFRESH_ERROR === '1') send({ id: msg.id, error: { message: 'refresh rejected' } });
        else send({ id: msg.id, result: { account: { type: 'chatgpt' } } });
      }
      if (msg.method === 'account/rateLimits/read') {
        append({ type: 'limit-read', home });
        if (process.env.FAKE_LIMIT_ERROR) {
          send({ id: msg.id, error: { message: process.env.FAKE_LIMIT_ERROR } });
          continue;
        }
        if (shouldFailLimitReadOnce()) {
          send({ id: msg.id, error: { message: 'failed to fetch codex rate limits: error sending request for url (https://chatgpt.com/backend-api/wham/usage)' } });
          continue;
        }
        const x = limits();
        send({ id: msg.id, result: { rateLimitsByLimitId: { codex: {
          primary: { usedPercent: x.w, windowDurationMins: 10080, limit: x.wc, resetsAt: x.wr },
          secondary: null,
          rateLimitReachedType: x.r || ''
        } } } });
      }
      if (msg.method === 'thread/goal/get') {
        append({ type: 'goal-get', home, params: msg.params });
        const status = goals()[msg.params.threadId];
        send({ id: msg.id, result: { goal: status ? {
          threadId: msg.params.threadId,
          objective: 'fake goal',
          status,
          tokenBudget: null,
          tokensUsed: 0,
          timeUsedSeconds: 0,
          createdAt: 1,
          updatedAt: 1
        } : null } });
      }
      if (msg.method === 'thread/goal/set') {
        append({ type: 'goal-set', home, params: msg.params });
        send({ id: msg.id, result: { goal: {
          threadId: msg.params.threadId,
          objective: 'fake goal',
          status: msg.params.status || 'active',
          tokenBudget: null,
          tokensUsed: 0,
          timeUsedSeconds: 0,
          createdAt: 1,
          updatedAt: 2
        } } });
      }
    }
  });
} else if (args[0] === 'hold') {
  append({ type: 'hold', home, args });
  setInterval(() => {}, 1000);
} else {
  append({ type: 'run', home, args });
  if (process.env.FAKE_TOOL_TEXT_LOG === '1') {
    const first = 'usage';
    const second = 'limit';
    writeLog('2026-06-04T01:00:00Z INFO codex_core::stream_events_utils: ToolCall: exec_command {"cmd":"rg ' + first + ' ' + second + ' /tmp"}');
    process.exit(7);
  }
  if (process.env.FAKE_OUT_OF_CREDITS_TOOL_TEXT_LOG === '1') {
    writeLog('2026-06-04T01:00:00Z INFO codex_core::stream_events_utils: ToolCall: exec_command {"cmd":"printf \\"Your workspace is out of credits\\""}');
    process.exit(7);
  }
  if (account === process.env.FAKE_LIMIT_ACCOUNT) {
    if (process.env.FAKE_LIMIT_SESSION === 'usage-complete') {
      writeUsageLimitedCompleteSession();
    } else if (process.env.FAKE_LIMIT_SESSION === 'queued-follow-up') {
      writeQueuedFollowupUsageLimitedSession();
    } else if (process.env.FAKE_LIMIT_SESSION === 'fast-switched') {
      writeFastSwitchedUsageLimitedSession();
    } else if (process.env.FAKE_LIMIT_SESSION === 'no-id-usage-complete') {
      writeNoIdUsageLimitedSession();
    } else {
      writeIncompleteSession();
    }
    const sessionNumber = ({ 'usage-complete': '2', 'queued-follow-up': '3', 'fast-switched': '4' })[process.env.FAKE_LIMIT_SESSION] || '1';
    const threadId = process.env.FAKE_LIMIT_SESSION === 'no-id-usage-complete' ? '' : '019eaaaa-bbbb-7ccc-8ddd-00000000000' + sessionNumber;
    if (process.env.FAKE_LIMIT_LOG === 'out-of-credits') {
      writeLog('2026-06-04T03:28:15.620801Z  INFO session_loop{thread_id=' + threadId + '}:turn{model=gpt-5.5}: codex_core::session::turn: Turn error: Your workspace is out of credits. Add credits to continue.');
    } else if (process.env.FAKE_LIMIT_LOG === 'goal') {
      writeLog('2026-06-04T03:28:15.620801Z  INFO session_loop{thread_id=' + threadId + '}: codex_tui: Goal hit usage limits (/goal resume)');
    } else {
      writeLog('2026-06-04T01:00:00Z ERROR session_loop{thread_id=' + threadId + '}: Turn error: workspace_owner_credits_depleted');
    }
    process.exit(0);
  }
  process.exit(0);
}
`;

fs.writeFileSync(path.join(fakeBin, "codex"), fakeCodex, { mode: 0o755 });

const defaultLimits = {
  ".codex-account1": { w: 1, wc: 100, wr: 4103049600, r: "" },
  ".codex-account2": { w: 2, wc: 200, wr: 4103053200, r: "" },
  ".codex-account3": { w: 1, wc: 100, wr: 4103056800, r: "" },
  ".codex-account4": { w: 49, wc: 50, wr: 4103060400, r: "workspace_owner_credits_depleted" },
};

const envBase = {
  ...process.env,
  HOME: root,
  PATH: `${path.join(repo, "bin")}:${fakeBin}:${process.env.PATH}`,
  TZ: "UTC",
  FAKE_RECORDS: recordsFile,
  FAKE_LIMITS: JSON.stringify(defaultLimits),
  CX_LIMIT_TIMEOUT_MS: "3000",
  CX_LIMIT_RETRY_DELAY_MS: "10",
  CX_AUTO_MAX_SWITCHES: "6",
};

for (const key of [
  "CODEX_TRUST_ALL",
  "CX_ACCOUNT",
  "CX_ACCOUNT_COUNT",
  "CX_ACCOUNT_HOMES",
  "CX_AUTO_RESUME_GOAL",
  "CX_NO_BYPASS",
  "CX_NO_TRUST",
  "CX_REAL_CODEX",
  "CX_API_KEY_MODE",
]) {
  delete envBase[key];
}
delete envBase.CX_INTERACTIVE_AUTO_EXEC;

function run(cmd, args, extraEnv = {}) {
  // Filesystem fixtures use disposable homes; process guards have separate tests.
  if (cmd === "cx-setup") args = ["--allow-active", ...args];
  return spawnSync(cmd, args, { cwd: root, env: { ...envBase, ...extraEnv }, encoding: "utf8" });
}

function ok(cmd, args, extraEnv = {}) {
  const result = run(cmd, args, extraEnv);
  assert.equal(result.status, 0, `${cmd} ${args.join(" ")}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

function readRecords() {
  if (!fs.existsSync(recordsFile)) {
    return [];
  }
  return fs.readFileSync(recordsFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
}

function clearRecords() {
  fs.rmSync(recordsFile, { force: true });
}

function assertLink(link, target) {
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true, `${link} should be symlink`);
  assert.equal(path.resolve(path.dirname(link), fs.readlinkSync(link)), target, `${link} target`);
}

let sharedSessionMtimeCounter = 0;

function writeSharedSession(threadId, cwd = fs.realpathSync.native(root)) {
  const dir = path.join(root, ".codex", "sessions", "2026", "06", "04");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `rollout-2026-06-04T00-00-00-${threadId}.jsonl`);
  fs.writeFileSync(
    file,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "session_meta",
      payload: { id: threadId, cwd, source: "cli" },
    }) + "\n",
  );
  sharedSessionMtimeCounter += 1;
  const now = new Date(Date.now() + sharedSessionMtimeCounter * 1000);
  fs.utimesSync(file, now, now);
  return file;
}

function runVirtualE2e() {
  ok("cx-setup", ["--accounts", "4", "--full", "--migrate"]);
  const sharedItems = [
    "sessions",
    "archived_sessions",
    "memories",
    "skills",
    "shell_snapshots",
    "cache",
    "generated_images",
    "history.jsonl",
    "models_cache.json",
    "log",
    "goals_1.sqlite",
    "goals_1.sqlite-shm",
    "goals_1.sqlite-wal",
    "logs_2.sqlite",
    "logs_2.sqlite-shm",
    "logs_2.sqlite-wal",
    "memories_1.sqlite",
    "memories_1.sqlite-shm",
    "memories_1.sqlite-wal",
    "state_5.sqlite",
    "state_5.sqlite-shm",
    "state_5.sqlite-wal",
  ];
  for (let i = 1; i <= 4; i += 1) {
    const home = path.join(root, `.codex-account${i}`);
    fs.writeFileSync(path.join(home, "auth.json"), `${JSON.stringify({ email: `account${i}@example.com` })}\n`);
    for (const item of sharedItems) {
      assertLink(path.join(home, item), path.join(root, ".codex", item));
    }
    assert.equal(fs.lstatSync(path.join(home, "auth.json")).isSymbolicLink(), false);
  }
  ok("cx-setup", ["--accounts", "4", "--full", "--migrate"]);

  let result = ok("cx", ["status"]);
  assert.match(result.stderr, /account4\s+(?:-|unknown)\s+account\s+49%\s+credits depleted/);

  result = ok("cx", ["quota"]);
  assert.match(result.stderr, /Quota remaining:/);
  assert.match(result.stderr, /Total \[weighted by quota capacity\]\n  weekly \[###################-\] 93\.22%  reset .*2100-\d\d-\d\d \d\d:\d\d\)/);
  assert.match(result.stderr, /account1 \[account\]\n  weekly \[####################\] 99%  reset .*2100-\d\d-\d\d \d\d:\d\d\)/);
  assert.match(result.stderr, /account4 \[account\] \(credits depleted\)\n  weekly \[##########----------\] 51%  reset .*2100-\d\d-\d\d \d\d:\d\d\)/);
  assert.doesNotMatch(result.stderr, /^\s*5h\b/m);

  const holder = spawn(path.join(fakeBin, "codex"), ["hold"], {
    env: { ...envBase, CODEX_HOME: path.join(root, ".codex-account2") },
    stdio: "ignore",
  });
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    result = ok("cx", ["status"]);
    if (fs.existsSync("/proc")) {
      assert.match(result.stderr, /account2\s+yes/);
    } else {
      assert.match(result.stderr, /account2\s+unknown/);
    }
  } finally {
    holder.kill("SIGTERM");
  }

  result = ok("cxa", ["--dry-run", "exec", "hello"]);
  assert.match(result.stderr, /selected account1 \(account1@example\.com\)/);
  assert.match(result.stderr, /exec hello/);
  assert.doesNotMatch(result.stderr, /trust_level="trusted"/);

  clearRecords();
  ok("cx", ["--account", "1", "exec", "persist trust"]);
  assert.match(
    fs.readFileSync(path.join(root, ".codex-account1", "config.toml"), "utf8"),
    new RegExp(`\\[projects\\.${JSON.stringify(fs.realpathSync.native(root)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`),
  );
  assert.equal(readRecords().filter((entry) => entry.type === "run").length, 1);

  const directCodexHome = path.join(root, "direct-codex-home");
  const directTarget = fs.mkdtempSync(path.join(root, "direct-cd-"));
  clearRecords();
  ok("codex", ["--cd", directTarget, "--version"], { CODEX_HOME: directCodexHome });
  const directConfig = fs.readFileSync(path.join(directCodexHome, "config.toml"), "utf8");
  assert.match(
    directConfig,
    new RegExp(`\\[projects\\.${JSON.stringify(fs.realpathSync.native(root)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`),
  );
  assert.match(
    directConfig,
    new RegExp(`\\[projects\\.${JSON.stringify(fs.realpathSync.native(directTarget)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`),
  );

  result = ok("cx", ["--dry-run", "exec", "retry probe"], {
    FAKE_LIMIT_FAIL_ONCE: "1",
    FAKE_LIMIT_FAIL_ONCE_DIR: path.join(root, "limit-fail-once"),
  });
  assert.match(result.stderr, /selected account1/);
  assert.match(result.stderr, /exec 'retry probe'|exec retry probe/);
  assert.equal(readRecords().filter((entry) => entry.type === "limit-read").length, 8);

  clearRecords();
  result = ok("cx", ["status"], { FAKE_LIMIT_ERROR: "401 Unauthorized: token_expired" });
  assert.equal(
    readRecords().filter((entry) => entry.type === "limit-read").length,
    4,
    "non-retryable authentication failures should only be queried once per account",
  );

  const refreshAuth = path.join(root, ".codex-account1", "auth.json");
  const savedAuth = fs.readFileSync(refreshAuth, "utf8");
  const expiredAuth = { tokens: { access_token: "e30." + Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url") + ".sig", refresh_token: "fixture-refresh" } };
  fs.writeFileSync(refreshAuth, JSON.stringify(expiredAuth));
  clearRecords();
  ok("cx", ["status"]);
  let refreshes = readRecords().filter((entry) => entry.type === "account-read");
  assert.equal(refreshes.length, 1);
  assert.deepEqual(refreshes[0].params, { refreshToken: true });
  assert.equal(readRecords().filter((entry) => entry.type === "limit-read" && entry.home.endsWith("account1")).length, 1);
  clearRecords();
  result = ok("cx", ["status"], { FAKE_REFRESH_ERROR: "1" });
  assert.match(result.stderr, /token refresh failed/);
  assert.equal(readRecords().filter((entry) => entry.type === "account-read").length, 1);
  assert.equal(readRecords().filter((entry) => entry.type === "limit-read" && entry.home.endsWith("account1")).length, 0);
  fs.writeFileSync(refreshAuth, savedAuth);

  result = ok("cx", ["--account", "4", "--dry-run", "--no-bypass", "exec", "hello"]);
  assert.match(result.stderr, /\.codex-account4/);
  assert.doesNotMatch(result.stderr, /dangerously-bypass/);

  result = ok("cx", ["--account", "1", "--dry-run", "--", "--dry-run", "exec", "hello"]);
  assert.match(result.stderr, /--dry-run exec hello/);

  const exhaustedLimits = JSON.stringify({
    ".codex-account1": { w: 100, r: "" },
    ".codex-account2": { w: 100, r: "" },
    ".codex-account3": { w: 1, r: "rate_limit_reached" },
    ".codex-account4": { w: 49, r: "workspace_owner_credits_depleted" },
  });
  result = run("cx", ["--dry-run", "exec", "blocked"], { FAKE_LIMITS: exhaustedLimits });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /All candidate accounts are exhausted or unavailable/);

  ok("cx-setup", [
    "--add-api-key",
    "free",
    "--api-key",
    "sk-free",
    "--openai-base-url",
    "https://ai2.hhhl.cc/v1",
    "--model",
    "gpt-5.5",
    "--migrate",
  ]);
  result = ok("cx", ["--account", "free", "--dry-run", "exec", "explicit API account"]);
  assert.match(result.stderr, /codex-account-free/);
  result = ok("cxa", ["--dry-run", "exec", "default account first"]);
  assert.match(result.stderr, /selected account1 \(account1@example\.com\)/);
  result = ok("cxa", ["--dry-run", "exec", "api key first"], { CX_API_KEY_MODE: "prefer" });
  assert.match(result.stderr, /selected free \(api-key\)/);
  result = run("cxa", ["--dry-run", "exec", "API disabled by default"], { FAKE_LIMITS: exhaustedLimits });
  assert.equal(result.status, 1, result.stderr);
  result = ok("cxa", ["--dry-run", "exec", "fallback to api key"], { FAKE_LIMITS: exhaustedLimits, CX_API_KEY_MODE: "fallback" });
  assert.match(result.stderr, /selected free \(api-key\)/);
  ok("cx-setup", ["--remove", "free"]);
  result = ok("cxa", ["--dry-run", "exec", "after remove"], { CX_API_KEY_MODE: "prefer" });
  assert.match(result.stderr, /selected account1 \(account1@example\.com\)/);
  assert.doesNotMatch(result.stderr, /selected free/);
  assert.ok(fs.readdirSync(root).some((entry) => /^\.codex-account-free\.cx-backup-/.test(entry)));

  result = run("cx", ["status"], { CX_ACCOUNT_HOMES: `work=${root}/a,WORK=${root}/b` });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /duplicate account name/);
  result = run("cx-setup", ["--homes", `work=${root}/.codex`, "--dry-run"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Account home must not be the shared home/);
  result = run("cx", ["status"], { CX_LIMIT_TIMEOUT_MS: "bad" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /positive integer/);

  clearRecords();
  result = run("cxa", ["exec", "mentions tool text"], { FAKE_TOOL_TEXT_LOG: "1" });
  assert.equal(result.status, 7, result.stderr);
  assert.equal(readRecords().filter((entry) => entry.type === "run").length, 1);

  clearRecords();
  result = run("cxa", ["exec", "mentions out-of-credits text"], { FAKE_OUT_OF_CREDITS_TOOL_TEXT_LOG: "1" });
  assert.equal(result.status, 7, result.stderr);
  assert.equal(readRecords().filter((entry) => entry.type === "run").length, 1);

  const pausedGoalThreadId = "019eaaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
  const pausedGoalFile = writeSharedSession(pausedGoalThreadId);
  clearRecords();
  ok("cxa", ["resume", "--last"], {
    FAKE_GOALS: JSON.stringify({
      ".codex-account1": { [pausedGoalThreadId]: "paused" },
      ".codex-account2": { [pausedGoalThreadId]: "paused" },
      ".codex-account3": { [pausedGoalThreadId]: "paused" },
      ".codex-account4": { [pausedGoalThreadId]: "paused" },
    }),
  });
  let goalSets = readRecords().filter((entry) => entry.type === "goal-set");
  assert.equal(goalSets.length, 0, "ordinary resume must preserve a paused goal");

  assert.equal(readRecords().filter((entry) => entry.type === "goal-get").length, 0);
  for (const status of ["paused", "blocked", "usageLimited"]) {
    clearRecords();
    ok("cx", ["--account", "1", "resume", pausedGoalThreadId], {
      FAKE_GOALS: JSON.stringify({ ".codex-account1": { [pausedGoalThreadId]: status } }),
    });
    assert.equal(readRecords().filter((entry) => entry.type === "goal-get" || entry.type === "goal-set").length, 0);
  }

  const disabledGoalThreadId = "019eaaaa-bbbb-7ccc-8ddd-ffffffffffff";
  const disabledGoalFile = writeSharedSession(disabledGoalThreadId);
  clearRecords();
  ok("cxa", ["resume", "--last"], {
    CX_AUTO_RESUME_GOAL: "0",
    FAKE_GOALS: JSON.stringify({
      ".codex-account1": { [disabledGoalThreadId]: "paused" },
      ".codex-account2": { [disabledGoalThreadId]: "paused" },
      ".codex-account3": { [disabledGoalThreadId]: "paused" },
      ".codex-account4": { [disabledGoalThreadId]: "paused" },
    }),
  });
  goalSets = readRecords().filter((entry) => entry.type === "goal-set");
  assert.equal(goalSets.length, 0, JSON.stringify(goalSets));
  fs.rmSync(pausedGoalFile, { force: true });
  fs.rmSync(disabledGoalFile, { force: true });

  clearRecords();
  ok("cxa", ["resume", "--last"], { FAKE_LIMIT_ACCOUNT: ".codex-account1" });
  let runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 2, JSON.stringify(runs));
  assert.equal(path.basename(runs[0].home), ".codex-account1");
  assert.equal(path.basename(runs[1].home), ".codex-account3");
  assert.equal(runs[1].args.includes("exec"), false);
  assert.ok(runs[1].args.includes("resume"));
  assert.ok(runs[1].args.includes("019eaaaa-bbbb-7ccc-8ddd-000000000001"));
  assert.ok(runs[1].args.some((arg) => /Continue the interrupted task/.test(arg)));

  clearRecords();
  ok("cxa", ["exec", "implement feature"], {
    FAKE_LIMIT_ACCOUNT: ".codex-account1",
    FAKE_LIMIT_LOG: "out-of-credits",
  });
  runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 2, JSON.stringify(runs));
  assert.equal(path.basename(runs[1].home), ".codex-account3");
  assert.ok(runs[1].args.includes("exec"));
  assert.ok(runs[1].args.includes("resume"));
  assert.ok(runs[1].args.includes("019eaaaa-bbbb-7ccc-8ddd-000000000001"));
  assert.ok(runs[1].args.some((arg) => /Continue the interrupted task/.test(arg)));

  const account1Config = path.join(root, ".codex-account1", "config.toml");
  const account3Config = path.join(root, ".codex-account3", "config.toml");
  fs.writeFileSync(account1Config, 'model = "gpt-fast"\nmodel_reasoning_effort = "low"\nservice_tier = "fast"\n');
  fs.writeFileSync(account3Config, 'model = "gpt-slow"\nmodel_reasoning_effort = "high"\nservice_tier = "auto"\n');
  clearRecords();
  ok("cxa", ["exec", "task defaults stay pinned"], {
    FAKE_LIMIT_ACCOUNT: ".codex-account1",
    FAKE_LIMIT_LOG: "out-of-credits",
  });
  runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 2, JSON.stringify(runs));
  assert.equal(runs[0].args[runs[0].args.indexOf("--model") + 1], "gpt-fast");
  assert.ok(runs[0].args.includes('model_reasoning_effort="low"'));
  assert.equal(runs[0].args.some((arg) => arg.startsWith("service_tier=")), false);
  assert.equal(runs[0].args.includes('service_tier="fast"'), false);
  assert.equal(runs[1].args[runs[1].args.indexOf("--model") + 1], "gpt-fast");
  assert.ok(runs[1].args.includes('model_reasoning_effort="low"'));
  assert.equal(runs[1].args.some((arg) => arg.startsWith("service_tier=")), false);
  assert.equal(runs[1].args.includes('service_tier="fast"'), false);
  assert.equal(runs[1].args.includes("gpt-slow"), false);
  assert.equal(runs[1].args.includes('model_reasoning_effort="high"'), false);
  fs.rmSync(account1Config, { force: true });
  fs.rmSync(account3Config, { force: true });

  fs.writeFileSync(account1Config, 'model = "gpt-fast"\nmodel_reasoning_effort = "xhigh"\n');
  clearRecords();
  ok("cxa", ["exec", "task switches to fast"], {
    FAKE_LIMIT_ACCOUNT: ".codex-account1",
    FAKE_LIMIT_LOG: "out-of-credits",
    FAKE_LIMIT_SESSION: "fast-switched",
  });
  runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 2, JSON.stringify(runs));
  assert.ok(runs[0].args.includes('model_reasoning_effort="xhigh"'));
  assert.equal(runs[1].args[runs[1].args.indexOf("--model") + 1], "gpt-fast");
  assert.ok(runs[1].args.includes('model_reasoning_effort="xhigh"'));
  assert.ok(runs[1].args.includes('service_tier="fast"'));
  fs.rmSync(account1Config, { force: true });

  clearRecords();
  ok("cxa", ["resume", "--last"], {
    FAKE_LIMIT_ACCOUNT: ".codex-account1",
    FAKE_LIMIT_LOG: "out-of-credits",
    FAKE_LIMIT_SESSION: "usage-complete",
  });
  runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 2, JSON.stringify(runs));
  assert.equal(path.basename(runs[1].home), ".codex-account3");
  assert.equal(runs[1].args.includes("exec"), false);
  assert.ok(runs[1].args.includes("resume"));
  assert.ok(runs[1].args.includes("019eaaaa-bbbb-7ccc-8ddd-000000000002"));
  assert.ok(runs[1].args.some((arg) => /Continue the interrupted task/.test(arg)));

  clearRecords();
  ok("cxa", ["resume", "--last"], {
    FAKE_LIMIT_ACCOUNT: ".codex-account1",
    FAKE_LIMIT_LOG: "out-of-credits",
    FAKE_LIMIT_SESSION: "queued-follow-up",
  });
  runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 2, JSON.stringify(runs));
  assert.equal(path.basename(runs[1].home), ".codex-account3");
  assert.ok(runs[1].args.includes("resume"));
  assert.ok(runs[1].args.includes("019eaaaa-bbbb-7ccc-8ddd-000000000003"));
  assert.ok(
    runs[1].args.some((arg) => /Continue the interrupted task/.test(arg)),
    "queued follow-up usage-limit retries must explicitly send the continuation prompt",
  );

  clearRecords();
  result = run("cxa", ["resume", "--last"], {
    FAKE_LIMIT_ACCOUNT: ".codex-account1",
    FAKE_LIMIT_LOG: "out-of-credits",
    FAKE_LIMIT_SESSION: "no-id-usage-complete",
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Cannot identify the interrupted thread/);
  runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 1, "missing ID must stop before launching another account");

  const unsharedOne = path.join(root, "unshared-account1");
  const unsharedTwo = path.join(root, "unshared-account2");
  const independentSetup = run("cx-setup", ["--homes", `one=${unsharedOne},two=${unsharedTwo}`]);
  assert.equal(independentSetup.status, 0, independentSetup.stderr);
  assert.equal(fs.existsSync(path.join(unsharedOne, "sessions")), false);
  assert.equal(fs.existsSync(path.join(unsharedTwo, "sessions")), false);
  fs.writeFileSync(path.join(unsharedOne, "auth.json"), "{}\n");
  fs.writeFileSync(path.join(unsharedTwo, "auth.json"), "{}\n");
  clearRecords();
  ok("cxa", ["resume", "--last"], {
    CX_ACCOUNT_HOMES: `one=${unsharedOne},two=${unsharedTwo}`,
    FAKE_LIMITS: JSON.stringify({
      "unshared-account1": { w: 1, r: "" },
      "unshared-account2": { w: 2, r: "" },
    }),
    FAKE_LIMIT_ACCOUNT: "unshared-account1",
  });
  runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 2, JSON.stringify(runs));
  assert.equal(path.basename(runs[0].home), "unshared-account1");
  assert.equal(path.basename(runs[1].home), "unshared-account2");
  assert.ok(runs[1].args.includes("019eaaaa-bbbb-7ccc-8ddd-000000000001"));
  assert.equal(
    fs.existsSync(path.join(unsharedTwo, "sessions", "2026", "06", "04", "rollout-e2e.jsonl")),
    true,
    "the interrupted session should be copied into the next account home when sessions are not shared",
  );
  const fromSession = path.join(unsharedOne, "sessions", "2026", "06", "04", "rollout-e2e.jsonl");
  const toSession = path.join(unsharedTwo, "sessions", "2026", "06", "04", "rollout-e2e.jsonl");
  assert.equal(fs.lstatSync(path.join(unsharedTwo, "sessions")).isSymbolicLink(), false);
  assert.notEqual(fs.statSync(fromSession).ino, fs.statSync(toSession).ino);
  assert.equal(fs.readFileSync(fromSession, "utf8"), fs.readFileSync(toSession, "utf8"));

  for (const status of ["paused", "blocked", "usageLimited", "active", "complete"]) {
    clearRecords();
    ok("cxa", ["exec", "recover only a quota-stopped goal"], {
      FAKE_LIMIT_ACCOUNT: ".codex-account1",
      FAKE_GOALS: JSON.stringify({ ".codex-account3": { "019eaaaa-bbbb-7ccc-8ddd-000000000001": status } }),
    });
    const sets = readRecords().filter((entry) => entry.type === "goal-set");
    assert.equal(sets.length, status === "usageLimited" ? 1 : 0, status);
    if (sets.length) assert.deepEqual(sets[0].params, { threadId: "019eaaaa-bbbb-7ccc-8ddd-000000000001", status: "active" });
  }

  clearRecords();
  ok("cxa", ["exec", "recovery disabled"], {
    CX_AUTO_RESUME_GOAL: "0",
    FAKE_LIMIT_ACCOUNT: ".codex-account1",
    FAKE_GOALS: JSON.stringify({ ".codex-account3": { "019eaaaa-bbbb-7ccc-8ddd-000000000001": "usageLimited" } }),
  });
  assert.equal(readRecords().filter((entry) => entry.type === "goal-get" || entry.type === "goal-set").length, 0);

  clearRecords();
  ok("cxa", ["exec", "finish goal"], {
    FAKE_LIMIT_ACCOUNT: ".codex-account1",
    FAKE_LIMIT_LOG: "goal",
  });
  runs = readRecords().filter((entry) => entry.type === "run");
  assert.equal(runs.length, 2, JSON.stringify(runs));
  assert.equal(path.basename(runs[1].home), ".codex-account3");
}

try {
  runVirtualE2e();
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
