# codex-multi-account Beginner Guide

This tool helps you use multiple Codex accounts on one machine.

You still use the official Codex CLI. `codex-multi-account` only adds a local account layer:

- It creates one `CODEX_HOME` folder per account.
- It selects a usable account before launching Codex.
- When one account hits usage limits, it tries to switch to another account and continue the same task.

It is not a model proxy. It does not forward model traffic. It does not share your `auth.json` login files.

## When To Use It

Use it if:

- You have multiple ChatGPT/Codex accounts.
- You want those accounts to share conversation sessions.
- You want official Codex CLI behavior, not a relay/proxy workflow.
- You often hit usage limits and want smoother account handoff.

You probably do not need it if:

- You only use one account.
- You only need one OpenAI API key and do not need account switching.

## Before Installing

Check that Node.js and Codex are installed:

```sh
node --version
codex --version
```

Requirements:

- Node.js 18 or newer.
- The official OpenAI Codex CLI, with `codex --version` working.

## Install

```sh
npm install -g github:kazzix14/codex-multi-account
```

Update with the same command:

```sh
npm install -g github:kazzix14/codex-multi-account
```

Confirm the commands are available:

```sh
cx --help
cx-setup --help
```

## First Setup

If you have 3 accounts, create 3 account folders:

```sh
cx-setup --accounts 3 --migrate
```

This creates:

```text
~/.codex-account1
~/.codex-account2
~/.codex-account3
```

Log in once for each account:

```sh
CODEX_HOME="$HOME/.codex-account1" codex login
CODEX_HOME="$HOME/.codex-account2" codex login
CODEX_HOME="$HOME/.codex-account3" codex login
```

Check status:

```sh
cx status
```

Check remaining quota:

```sh
cx quota
```

`cx quota` prints a weekly total first, then one block per account, with a colored ASCII bar and reset time for the remaining weekly quota.
cx identifies the weekly window from Codex's reported 10080-minute duration, so it does not assume the nullable `primary` or `secondary` protocol slots have fixed meanings.
The total is not a simple average; when Codex reports a weekly-window capacity, cx weights the remaining quota by that capacity, which fits mixed account types with different limits.
If a weekly window has no capacity field, cx counts that account as one equal-weight unit and marks the Total title with fallback.
If Codex does not report a reset time, the weekly window shows `reset unknown`.
Quota probes wait up to 30s per account, try 3 times, and wait 1500ms between failed attempts by default; tune the `CX_LIMIT_*` variables below for unstable networks.

## Daily Use

Start Codex with automatic account selection:

```sh
cxa
```

After one task starts, model, profile, and reasoning effort stay with that task instead of changing to the next account's defaults.
New Codex task runs leave `service_tier` unset so Codex can use the selected model's default without unsupported-tier warnings.
If you use `/fast` or `/fast on` during the task, automatic handoff inherits `service_tier="fast"`; `/fast off` removes that override instead of lowering reasoning effort.
If the interrupted session records a later reasoning effort, for example from `/slow` or turn context, automatic handoff keeps that reasoning effort too.

Run a one-shot task:

```sh
cx exec "explain this repo"
```

Resume the last conversation:

```sh
cxr
```

Force one account:

```sh
cx --account 1
cx --account account2
```

Show account status:

```sh
cx status
```

Show remaining quota:

```sh
cx quota
cx limits
cx remaining
```

These three quota commands are equivalent.

## Command Cheat Sheet

```sh
cx [codex args...]              # Run Codex with automatic account selection
cxa [codex args...]             # Auto mode, same as cx auto
cxr [extra resume args...]      # Resume the last conversation
cx status                       # Show account status and used quota
cx quota                        # Show weighted total, reset times, and per-account bars
cx --account 2                  # Use only account 2
cx --no-trust                   # Do not write project trust automatically
cx --no-bypass                  # Do not add the bypass flag automatically
cx-setup --accounts 3 --migrate # Create 3 account folders
cx-setup --list                 # List account folders
```

## What Auto Trust Means

Codex may ask this when entering a project for the first time:

```text
Do you trust the contents of this directory?
```

With multiple accounts, seeing that prompt for every account is annoying.

By default, `cx` writes the current project to the selected account's:

```text
CODEX_HOME/config.toml
```

The entry looks like this:

```toml
[projects."/some/path"]
trust_level = "trusted"
```

This helps account switching continue without a trust prompt.

To keep Codex's original trust prompt:

```sh
cx --no-trust
CX_NO_TRUST=1 cxa
```

## Make Plain codex Auto Trust Too

If you sometimes run `codex` directly instead of `cx` or `cxa`, install the PATH wrapper:

```sh
cx-setup --install-codex-wrapper --force
```

Confirm it is first in PATH:

```sh
command -v codex
```

Expected output:

```text
~/.local/bin/codex
```

If your old shell cached the previous path, run:

```sh
rehash
```

Or open a new terminal.

## What Gets Shared

Default shared items:

```text
sessions
archived_sessions
memories
skills
shell_snapshots
cache
generated_images
history.jsonl
models_cache.json
```

Important points:

- Session history is shared, so switching accounts can continue more easily.
- `auth.json` is not shared.
- Every account keeps its own login.
- `config.toml` is not symlinked. Each account can keep its own auth, provider,
  profile, model, and project-trust settings.
- During setup, top-level shared user-only settings such as `notify` are copied
  from the shared `~/.codex/config.toml` into every selected account
  `config.toml`, then removed from the shared file. This avoids Codex startup
  warnings when `~/.codex/config.toml` is seen as a project-local `.codex` layer.
- Multiline arrays and strings are parsed as complete TOML values. All config outputs are validated before setup changes homes. Existing configs receive `config.toml.cx-backup-*` backups with mode `0600`; config write failures roll back earlier writes. Unrelated settings and comments stay intact. Symlinked config files and invalid TOML are rejected. Backups are retained for recovery; directory migrations are not one atomic transaction.

If you also want logs, goals, state, and memories sqlite files shared:

```sh
cx-setup --accounts 3 --full --migrate
```

Stop Codex sessions and app-servers before setup, removal, pruning, or `--full` migration. Linux checks explicit and default homes, including shared storage referenced by other running accounts. macOS cannot unambiguously resolve each process's home with `ps`, so setup blocks mutations while any Codex process is running. Unreadable process state also blocks mutation. `--allow-active` is an explicit override that accepts the risk; use it only when the affected state is idle. The check cannot prevent a separate Codex process starting after inspection. `--full` also shares SQLite/WAL files; it does not make concurrent writers safe.

## API Key Account

You can add an API key account. Creating it does not enable automatic selection.

Prefer reading the key from an environment variable:

```sh
OPENAI_API_KEY=sk-... cx-setup --add-api-key free --api-key-env OPENAI_API_KEY --openai-base-url https://proxy.example.com/v1 --model gpt-5.5 --api-key-check --migrate
```

Or read it from stdin so it is not stored in shell history:

```sh
printf '%s' "$OPENAI_API_KEY" | cx-setup --add-api-key free --api-key-stdin --openai-base-url https://proxy.example.com/v1 --model gpt-5.5 --api-key-check --migrate
```

Default selection policy:

- `off` (default): automatically select ChatGPT/Codex accounts only. API accounts remain available through `cx --account <name>`.
- `fallback`: explicitly allow API accounts when subscription accounts are unavailable or exhausted.
- `prefer`: explicitly prefer API accounts.

`CX_API_KEY_MODE=fallback cxa` enables fallback for one run. `cx-setup --api-key-mode fallback` persists it; `cx-setup --api-key-mode off` disables it again. Existing explicitly saved `fallback`/`prefer` preferences are retained.

Enabling API selection may incur charges and sends the resumed conversation to the selected account's configured provider, including a custom `openai_base_url`. API quota bars are placeholders, not verified balances. cx does not enforce a spending cap. Use provider-side budgets and `CX_ACCOUNT_HOMES=name=/path,...` to restrict allowed destinations.

To prefer API key accounts:

```sh
CX_API_KEY_MODE=prefer cxa
cx-setup --api-key-mode prefer
```

The local API key mode is stored in `~/.config/codex-cx/config.json`. The directory keeps the old name for compatibility with existing installs.

## Add Accounts

If you had 3 accounts and now want 4:

```sh
cx-setup --accounts 4 --migrate
CODEX_HOME="$HOME/.codex-account4" codex login
```

## Remove Accounts

Remove account `free`:

```sh
cx-setup --remove free
```

Remove account 3:

```sh
cx-setup --remove 3
```

Removal does not delete data. It moves the account folder to a `.cx-backup-*` backup path.

## Custom Account Folders

If you do not want numbered folders:

```sh
cx-setup --homes work=~/.codex-work,school=~/.codex-school --migrate
```

Use them like this:

```sh
cx --account work
CX_ACCOUNT_HOMES=work=~/.codex-work,school=~/.codex-school cxa
```

## Environment Variables

Common variables:

```text
CX_ACCOUNT=1
CX_ACCOUNT_COUNT=3
CX_ACCOUNT_HOMES=work=/path/a,school=/path/b
CX_API_KEY_MODE=prefer
CX_NO_BYPASS=1
CX_NO_TRUST=1
CX_COLOR=1
NO_COLOR=1
```

Meaning:

- `CX_ACCOUNT=1`: always use account 1.
- `CX_ACCOUNT_COUNT=3`: only probe accounts 1 through 3.
- `CX_API_KEY_MODE=prefer`: prefer API key accounts.
- `CX_NO_BYPASS=1`: do not add the bypass flag automatically.
- `CX_NO_TRUST=1`: do not write project trust automatically.
- `CX_COLOR=1`: force colored quota bars.
- `CX_COLOR=0` or `NO_COLOR=1`: disable color.

Advanced variables:

```text
CODEX_TRUST_ALL=0
CX_REAL_CODEX=/path/to/codex
CX_AUTO_RESUME_GOAL=0
CX_LIMIT_TIMEOUT_MS=30000
CX_LIMIT_RETRIES=3
CX_LIMIT_RETRY_DELAY_MS=1500
CX_AUTO_MAX_SWITCHES=5
CX_INTERACTIVE_AUTO_EXEC=1
```

`CX_LIMIT_TIMEOUT_MS` controls the per-probe timeout, `CX_LIMIT_RETRIES` controls attempts per account, and `CX_LIMIT_RETRY_DELAY_MS` controls the wait before retrying a failed probe.

Every ChatGPT-account probe reads the current server-side weekly limit; `cx` does not select accounts from a local quota cache. Network timeouts and temporary service failures still retry as configured. Expired access tokens with a refresh token get one official `account/read {refreshToken:true}` refresh attempt. A failed refresh, missing refresh token, or non-retryable authentication error such as 401/403 stops probing that account. Authentication files are never copied between homes.

## How Auto-Switch Continues Work

When the current account hits a usage limit, `cx` tries to:

1. Stop the current Codex process.
2. Mark that account unavailable for this wrapper run.
3. Pick another usable account.
4. Resume the exact interrupted session first.
5. Send a continuation prompt so the next account continues the unfinished work.

Common retry shapes:

```sh
codex resume <interrupted-session-id> "Continue the interrupted task ..."
codex exec resume <interrupted-session-id> "Continue the interrupted task ..."
```

The quota error in the current run's private log must contain a valid `session_loop{thread_id=<UUID>}` context. cx then reads only the matching transcript, validates its freshness and working directory, and replaces named/`--last` targets with that exact ID. If attribution is unavailable or conflicting, cx stops and asks you to resume the intended thread manually. A newer shared session is never a substitute, even in the same project. Codex log-format changes may therefore disable automatic handoff safely. The transcript source must be top-level `cli` or `exec`; subagent and unknown sources are rejected because their quota errors may share the process log.

When account session directories are separate, the matching transcript is copied with mode `0600`. A stale, corrupt, changed, or conflicting copy stops handoff; cx does not silently overwrite it. Transcript copying cannot transfer every kind of Codex state (for example an unshared goal database).

The old process receives SIGTERM, followed by SIGKILL after three seconds if needed, and must exit before another account launches. The optional PATH wrapper first gives its child two seconds to exit. Codex remains responsible for its own tool subprocesses.

Normal `resume`, including forced account selection, does not query or change goal status. Only a handoff triggered by this run's quota error can reactivate a `usageLimited` goal on the exact thread. `paused`, `blocked`, and other states stay unchanged. `CX_AUTO_RESUME_GOAL=0` disables goal recovery.

This update intentionally preserves the existing approval/sandbox bypass and automatic project-trust behavior. See [security changes](SECURITY-FIXES.md).

## Troubleshooting

`No Codex account homes found`

Create account folders first:

```sh
cx-setup --accounts 3 --migrate
```

`missing ~/.codex-accountN/auth.json`

That account is not logged in:

```sh
CODEX_HOME="$HOME/.codex-accountN" codex login
```

`access token expired` / `token refresh failed`

The account's access token expired and its refresh token is missing or refreshing failed. Log in again:

```sh
CODEX_HOME="$HOME/.codex-accountN" codex login
```

`All candidate accounts are exhausted or unavailable`

All accounts are unavailable, not logged in, failed probing, or hit limits. Check:

```sh
cx status
cx quota
```

Auto-switch still shows the trust prompt

Confirm this is not set:

```sh
CX_NO_TRUST=1
```

You can also reinstall the direct `codex` wrapper:

```sh
cx-setup --install-codex-wrapper --force
```

`cx status` does not show active accounts

Linux uses `/proc`. macOS uses `ps` and reports `unknown` when homes cannot be identified reliably; unknown accounts are treated conservatively during selection, and setup refuses mutation. Exit all Codex sessions/app-servers before setup on macOS.

API key checking fails

Check that `--openai-base-url` points to the correct API root. It usually ends in `/v1`.

## License

GPL-3.0-only. See [LICENSE](../LICENSE).
