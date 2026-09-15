# Security fixes: 0.8.11

Reviewed against the 2026-09-15 audit of upstream commit `20bf67aebcc7b780b9825596843b44f5c64575db` (0.8.10).

## Audit findings

| Finding | Change | Regression coverage |
| --- | --- | --- |
| Wrong conversation resumed | Require the quota error's exact thread ID from this run's private log. Validate matching transcript metadata, working directory, freshness and content. Stop on missing/ambiguous identity or conflicting copies. Remove recency/filename/`--last` fallbacks from handoff. | New, named, explicit and last-session invocations; a newer concurrent conversation in the same directory; foreign directory; missing metadata; stale/corrupt/duplicate/subagent transcripts; copy failure and conflicting destination. |
| Unattended API billing/provider change | Default API auto-selection to `off`; require explicit `fallback`/`prefer` or forced `--account`. Display a billing/provider notice when auto mode chooses an API account. | Default exclusion, exhaustion without fallback, explicit opt-in modes. |
| Approval/sandbox bypass and automatic project trust | **Deferred at the user's request. Existing behavior retained.** | Existing safety-override and trust tests retained. |
| Multiline TOML corruption | Parse complete values using pinned `smol-toml@1.8.0`. Validate all affected configs before changing homes, preserve unrelated statements, back up originals with mode `0600`, stage file replacement and roll back failed config writes. | Multiline arrays and strings, quoted keys, comments, unrelated dotted keys, malformed TOML, symlinks, idempotency, dry run and injected write failure. |
| Active homes modified on macOS | Check processes on Linux and macOS, including app-server/default homes and shared resources. Fail closed when activity cannot be resolved. On macOS, conservatively block setup while any Codex process runs. | Actual temporary Codex processes protect removal; Linux explicit/default homes; shared storage; unknown inspection. |
| Manually stopped goals reactivated | Normal resume does not query/change goals. Quota-triggered handoff only reactivates `usageLimited` on its exact thread. | Ordinary/forced resume and automatic handoff with `paused`, `blocked`, `usageLimited`, `active`, `complete`; recovery opt-out. |
| SIGKILL escalation skipped | Test process exit state instead of `child.killed`. Wait for termination before handoff/RPC completion; forward signals to probe children. Give the optional PATH wrapper's child a shorter grace period. | Real subprocess ignoring SIGTERM, monitor cleanup and app-server timeout through the PATH wrapper; verify the underlying PID has exited. |

Additional fixes: expired access tokens with refresh tokens get one official Codex `account/read` refresh attempt; failed refresh stops probing that account. Incidental `429` text in non-quota HTTP errors no longer triggers switching. Install/update commands and package links now target the kazzix14 fork; upstream authorship remains credited.

## Validation

- `npm test`: syntax checks, account-selection tests, setup tests, virtual CLI end-to-end tests and security regressions.
- Local validation: macOS, Node.js 26.7.0. Tests ran with disposable homes, fake credentials, a fake Codex executable and network access denied by `sandbox-exec`. Real authentication/configuration directories were denied to test processes.
- CI runs the suite with Node.js 22 on Ubuntu and macOS, installing dependencies through `npm ci --ignore-scripts`.
- No real-account quota exhaustion or paid model request was used to validate these changes.

## Limits and operational notes

- Automatic handoff depends on Codex log format: the quota error must identify a full UUID in `session_loop{thread_id=...}`. Unsupported logs stop automatic handoff; resume the intended thread manually. Only top-level `cli`/`exec` transcript sources are accepted; subagent/unknown sources stop safely. This is not a guarantee of compatibility with every Codex version.
- API balances remain unknown. cx does not enforce a monetary budget. Explicitly saved `prefer`/`fallback` preferences remain effective after upgrading. Use `cx-setup --api-key-mode off` to disable them and `CX_ACCOUNT_HOMES` to limit candidate accounts.
- Process inspection is a preflight check, not a lock respected by independently launched Codex instances. Keep Codex stopped throughout setup. `--allow-active` explicitly overrides the guard. Full shared SQLite/WAL state still requires care with concurrent writers.
- Config backups remain on disk. Individual config replacements are atomic, and detected write failures roll back; a whole directory migration is not a single transaction. After a crash, restore from the reported backups if necessary.
- Only session transcripts are copied between separate homes. Other state, such as an unshared goal database, stays local. Authentication files are never copied or linked.
- The wrapper waits for its Codex process to exit. The supplied PATH wrapper also terminates its child. Codex is responsible for its own tool subprocesses; arbitrary third-party wrappers are outside this guarantee.
- Install the full package, including `lib` and dependencies. A copied standalone `cx` file is no longer supported.
