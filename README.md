# codex-multi-account

Use multiple Codex accounts locally without changing how the official Codex CLI works.

The installed commands are still short:

```sh
cx        # run Codex with automatic account selection
cxa       # same idea, explicit auto mode
cxr       # resume the selected account's last conversation
cx-setup  # create independent account folders
```

## Install

```sh
npm install -g github:kazzix14/codex-multi-account
```

Update with the same command. Install the complete package (including `lib` and its pinned TOML dependency); copying an individual executable is not supported.

This is the kazzix14 fork of [rmqg/codex-multi-account](https://github.com/rmqg/codex-multi-account).

## First Setup

Create independent account folders; replace `3` with your account count. Codex can keep running during this setup.

```sh
cx-setup --accounts 3
```

Log in once per account:

```sh
CODEX_HOME="$HOME/.codex-account1" codex login
CODEX_HOME="$HOME/.codex-account2" codex login
CODEX_HOME="$HOME/.codex-account3" codex login
```

Check everything:

```sh
cx status
cx quota
```

New account homes receive a private copy of `~/.codex/config.toml` (or the `--home` source). The source stays unchanged, including `notify`. Existing account homes are left untouched when you rerun setup. The initial copy is not kept in sync afterward.

Authentication, skills/plugins, history, and SQLite databases are not copied during setup. Log in separately for each account. During automatic handoff, only the exact interrupted conversation is copied to the next account. Independent homes do not expose all past conversations to every account: `cxr` resumes the selected account's last conversation, or use `cx --account 1 resume --last` to choose its home explicitly.

Sharing is optional: `--share` creates shared links; `--migrate` and `--full` retain their existing sharing behavior. Those modes, account removal, and updates to existing API-key accounts still use the activity guard. On macOS that guard can require all Codex processes to exit; ordinary independent setup skips it because it leaves existing homes untouched.

`cx quota` shows a weighted weekly total first, then one weekly bar and reset time for each account.
It identifies the weekly quota by Codex's reported 10080-minute window instead of assuming `primary` or `secondary` means a fixed quota type.
When Codex does not report a capacity for the weekly window, that account is counted as one equal-weight unit and the total label says so.
Every ChatGPT-account quota probe reads the current server-side weekly limit; `cx` does not select accounts from a local quota cache.
Probes use a 30s timeout, up to 3 attempts, and a 1500ms retry delay by default; expired access tokens with a refresh token receive one refresh attempt through the official Codex app-server. Refresh failures and non-retryable authentication errors stop probing that account.
Tune `CX_LIMIT_TIMEOUT_MS`, `CX_LIMIT_RETRIES`, and `CX_LIMIT_RETRY_DELAY_MS` if your network is unstable.

During one auto-switched task, model/profile/reasoning defaults stay with the task.
New Codex task runs leave `service_tier` unset so Codex can use the selected model's default without unsupported-tier warnings.
If you use `/fast` or `/fast on` during the task, retries inherit `service_tier="fast"`; `/fast off` removes that override instead of changing reasoning effort.
If the interrupted session records a later reasoning effort, for example from `/slow` or turn context, retries keep that reasoning effort too.

Run Codex:

```sh
cxa
cx exec "explain this repo"
cxr
```

## Automatic handoff boundaries

- API-key accounts are excluded from automatic selection by default (`CX_API_KEY_MODE=off`). `cx --account <name>` still selects one explicitly. Enabling `fallback` or `prefer` opts into possible API charges and that account's configured provider; cx has no monetary spending cap. Restrict candidates with `CX_ACCOUNT_HOMES`.
- Handoff requires an exact thread ID on the quota error in the current run's private Codex log, plus a matching, current transcript and working directory. Missing/ambiguous IDs, corrupt transcripts, and conflicting destination copies stop the run. It never substitutes the newest shared conversation or `--last` during handoff. Codex versions without the required log context need manual resume. Only transcripts with a top-level `cli` or `exec` source can be handed off; subordinate/unknown sources stop safely.
- Ordinary resume leaves goal status alone. Automatic handoff can reactivate only a `usageLimited` goal for that exact interrupted thread; `paused` and `blocked` remain unchanged. Set `CX_AUTO_RESUME_GOAL=0` to disable recovery.
- Codex receives SIGTERM, then SIGKILL if still alive after three seconds. A replacement starts after the previous process exits. The optional PATH wrapper gives its own child two seconds to exit.
- The existing bypass and automatic project-trust defaults remain unchanged in this security update.

See [security changes and verification](docs/SECURITY-FIXES.md) for the audit mapping and remaining limitations.

## Optional

Install the direct `codex` wrapper so plain `codex` also auto-trusts the current project:

```sh
cx-setup --install-codex-wrapper --force
```

## Docs

- [English guide](docs/README.en.md)
- [中文教程](docs/README.zh-CN.md)

License: GPL-3.0-only.
