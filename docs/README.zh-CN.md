# codex-multi-account 中文教程

这个工具用来在本机管理多个 Codex 账号。

你继续使用官方 Codex CLI，`codex-multi-account` 只负责三件事：

- 给每个账号准备独立的 `CODEX_HOME`。
- 在多个账号之间自动选择可用账号。
- 某个账号触达额度时，尽量切到下一个账号继续刚才的任务。

它不是中转服务，不会转发模型请求，也不会共享你的 `auth.json` 登录凭据。

## 什么时候需要它

适合这些情况：

- 你有多个 ChatGPT/Codex 账号。
- 你希望额度耗尽时，把中断的会话复制给下一个账号继续。
- 你不想用模型中转，想保留官方 Codex CLI 的原生功能。
- 你经常遇到额度限制，希望自动换账号继续。

不适合这些情况：

- 你只有一个账号。
- 你只想配置一个 OpenAI API key，不需要多个账号切换。

## 安装前准备

先确认你已经有这两个东西：

```sh
node --version
codex --version
```

要求：

- Node.js 18 或更新版本。
- 官方 OpenAI Codex CLI 已安装，并且 `codex --version` 能正常输出。

## 安装

```sh
npm install -g github:kazzix14/codex-multi-account
```

以后升级也运行同一条命令：

```sh
npm install -g github:kazzix14/codex-multi-account
```

安装后确认命令存在：

```sh
cx --help
cx-setup --help
```

## 第一次配置

假设你有 3 个账号，先创建 3 个账号目录：

```sh
cx-setup --accounts 3
```

它会创建：

```text
~/.codex-account1
~/.codex-account2
~/.codex-account3
```

每个账号都要登录一次：

```sh
CODEX_HOME="$HOME/.codex-account1" codex login
CODEX_HOME="$HOME/.codex-account2" codex login
CODEX_HOME="$HOME/.codex-account3" codex login
```

登录完成后检查状态：

```sh
cx status
```

查看每个账号还剩多少额度：

```sh
cx quota
```

`cx quota` 会先显示加权后的 weekly 总剩余，再按账号分块显示 weekly 剩余、恢复时间，并用彩色 ASCII 进度条显示大概情况。
它会根据 Codex 返回的 10080 分钟窗口识别 weekly，不再假定可为空的 `primary` 或 `secondary` 槽位各自代表固定额度类型。
总剩余不是简单平均；如果 Codex 返回了 weekly 窗口上限，它会按上限加权，适合不同账号类型额度上限不一样的情况。
如果 weekly 窗口没有上限字段，它会按 1 个单位兜底，并在 Total 标题里标出 fallback。
如果 Codex 没有返回恢复时间，weekly 窗口会显示 `reset unknown`。
额度探测默认每个账号最多等 30 秒，失败后重试 3 次，每次间隔 1500ms；网络不稳时可以调大下面的 `CX_LIMIT_*` 环境变量。

## 日常使用

自动选择账号启动 Codex：

```sh
cxa
```

一次任务开始后，模型、profile 和 reasoning 档位会跟着这次任务走，不会因为切到另一个账号就变成另一个账号的默认档位。
新开的 Codex 任务不再设置 `service_tier`，由 Codex 使用所选模型的默认值，避免不受支持的 tier 警告。
如果你在任务中用 `/fast` 或 `/fast on`，自动切号续跑会继承 `service_tier="fast"`；`/fast off` 会移除该覆盖，不会把 reasoning 档位改成低档。
如果中断会话记录了更新的 reasoning 档位，例如 `/slow` 或 turn context 里的值，自动续跑也会继续沿用这个 reasoning 档位。

执行一次非交互任务：

```sh
cx exec "帮我总结这个项目"
```

恢复上一次会话：

```sh
cxr
```

只用某一个账号：

```sh
cx --account 1
cx --account account2
```

查看账号状态：

```sh
cx status
```

查看剩余额度：

```sh
cx quota
cx limits
cx remaining
```

这三个额度命令等价。

## 常用命令速查

```sh
cx [codex args...]              # 自动选择账号运行 Codex
cxa [codex args...]             # 自动模式，等价于 cx auto
cxr [extra resume args...]      # 恢复所选账号的最后一个会话
cx status                       # 查看账号状态和已用额度
cx quota                        # 查看加权总剩余、恢复时间和每账号进度条
cx --account 2                  # 只用第 2 个账号
cx --no-trust                   # 不自动写入项目 trust
cx --no-bypass                  # 不自动加 bypass 参数
cx-setup --accounts 3 # 创建 3 个账号目录
cx-setup --list                 # 列出账号目录
```

## 自动 trust 是什么

Codex 第一次进入某个项目时，可能会问：

```text
Do you trust the contents of this directory?
```

多账号切换时，如果每个账号都弹一次这个确认，会很烦。

默认情况下，`cx` 会在启动 Codex 前，把当前目录写进所选账号的：

```text
CODEX_HOME/config.toml
```

写入内容类似：

```toml
[projects."/some/path"]
trust_level = "trusted"
```

这样切账号时通常不会再弹 trust 提示。

如果你想保留官方确认提示：

```sh
cx --no-trust
CX_NO_TRUST=1 cxa
```

## 让普通 codex 也自动 trust

如果你直接运行 `codex`，而不是 `cx` 或 `cxa`，可以安装一个 PATH 包装器：

```sh
cx-setup --install-codex-wrapper --force
```

确认它生效：

```sh
command -v codex
```

理想输出是：

```text
~/.local/bin/codex
```

如果旧终端缓存了命令路径，运行：

```sh
rehash
```

或者重新打开一个终端。

## 独立目录与可选共享

默认的 `cx-setup --accounts 3` 只创建缺少的账号目录，并将 `~/.codex/config.toml` 校验后复制到每个新目录。`--home /path/to/source` 可以指定配置来源。新目录权限为 `0700`，配置副本权限为 `0600`。

- 来源配置及其中的 `notify` 保持原样。
- 已有目录、配置、登录信息和链接不变。增大 `--accounts` 只初始化新增目录；重复运行不会同步之后的配置修改。
- 不复制或链接 `auth.json`，每个账号分别登录。
- setup 不复制 skills/plugins、历史、缓存或 SQLite 数据库。
- 自动切换时，只将精确匹配的中断会话复制到下一账号，原文件保留；目标副本冲突时停止。
- `cxr` / `resume --last` 读取所选账号的历史。要指定保存位置，可使用 `cx --account 1 resume --last`，或为该账号指定会话 ID。自动模式中已经运行的会话仍可在额度耗尽时复制并恢复。
- 创建独立目录不修改已有目录或共享数据，因此不检查运行中的 Codex，也不要求退出 Codex。

### 可选共享存储

显式启用共享链接：

```sh
cx-setup --accounts 3 --share
```

共享项为 `sessions`、`archived_sessions`、`memories`、`skills`、`shell_snapshots`、`cache`、`generated_images`、`history.jsonl` 和 `models_cache.json`。

账号目录已有这些内容时，`--migrate` 将其合并到共享目录，备份原内容后建立链接。`--full` 还包括日志和 SQLite/WAL：

```sh
cx-setup --accounts 3 --share --migrate
cx-setup --accounts 3 --full --migrate
```

为兼容旧命令，单独指定 `--migrate` 或 `--full` 也会启用共享；单独 `--force` 不会。默认 setup 不会拆除已有共享链接。

共享模式仍会把共享配置中的 `notify` 迁移到各账号配置。多行值完整解析，修改前校验，原配置以 `0600` 权限备份，配置写入失败时恢复。目录迁移并非原子事务。

共享/迁移、移除/prune、更新已有 API-key 账号仍检查 Codex 是否运行。Linux 检查显式/默认 home 及共享资源；macOS 无法确认具体 home 时保守地停止这些操作。普通独立目录创建跳过该检查。`--allow-active` 是显式覆盖选项。执行受保护操作时应让相关数据保持空闲；检查无法阻止其他进程随后启动，共享 SQLite/WAL 仍需注意并发写入。

## API key 账号

你可以创建 API key 账号；创建账号不会自动启用 API 切换。

推荐从环境变量读取 key：

```sh
OPENAI_API_KEY=sk-... cx-setup --add-api-key free --api-key-env OPENAI_API_KEY --openai-base-url https://proxy.example.com/v1 --model gpt-5.5 --api-key-check
```

或者从 stdin 读取，避免 key 留在 shell 历史里：

```sh
printf '%s' "$OPENAI_API_KEY" | cx-setup --add-api-key free --api-key-stdin --openai-base-url https://proxy.example.com/v1 --model gpt-5.5 --api-key-check
```

默认选择策略是：

- `off`（默认）：自动选择只使用 ChatGPT/Codex 账号；仍可用 `cx --account <name>` 显式选择 API 账号。
- `fallback`：显式允许订阅账号不可用或额度耗尽时使用 API 账号。
- `prefer`：显式优先使用 API 账号。

`CX_API_KEY_MODE=fallback cxa` 仅对本次运行启用兜底；`cx-setup --api-key-mode fallback` 保存偏好，`cx-setup --api-key-mode off` 关闭。之前显式保存的 `fallback` / `prefer` 偏好会保留。

启用 API 自动选择可能产生费用，并把恢复的会话发送给该账号配置的 provider，包括自定义 `openai_base_url`。API 额度条是占位值，不代表实际余额；cx 没有金额上限控制。请在 provider 端设置预算，并用 `CX_ACCOUNT_HOMES=name=/path,...` 限定允许的目标账号。

如果想优先用 API key 账号：

```sh
CX_API_KEY_MODE=prefer cxa
cx-setup --api-key-mode prefer
```

本机 API key 选择偏好会写到 `~/.config/codex-cx/config.json`。这个目录名保留旧名是为了兼容已安装用户。

## 增加账号

例如原来有 3 个账号，现在要加到 4 个：

```sh
cx-setup --accounts 4
CODEX_HOME="$HOME/.codex-account4" codex login
```

## 移除账号

移除 `free` 账号：

```sh
cx-setup --remove free
```

移除第 3 个账号：

```sh
cx-setup --remove 3
```

移除不会删除数据，而是把账号目录移动到 `.cx-backup-*` 备份路径。

## 自定义账号目录

如果你不想用 `~/.codex-account1` 这种编号目录：

```sh
cx-setup --homes work=~/.codex-work,school=~/.codex-school
```

使用时：

```sh
cx --account work
CX_ACCOUNT_HOMES=work=~/.codex-work,school=~/.codex-school cxa
```

## 环境变量

常用：

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

说明：

- `CX_ACCOUNT=1`：固定只用第 1 个账号。
- `CX_ACCOUNT_COUNT=3`：只探测 1 到 3 号账号。
- `CX_API_KEY_MODE=prefer`：优先使用 API key 账号。
- `CX_NO_BYPASS=1`：不要自动添加 bypass 参数。
- `CX_NO_TRUST=1`：不要自动写入项目 trust。
- `CX_COLOR=1`：强制彩色额度进度条。
- `CX_COLOR=0` 或 `NO_COLOR=1`：关闭颜色。

进阶：

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

`CX_LIMIT_TIMEOUT_MS` 控制单次额度探测的超时时间，`CX_LIMIT_RETRIES` 控制每个账号最多尝试几次，`CX_LIMIT_RETRY_DELAY_MS` 控制失败后再试前等待多久。

每次 ChatGPT 额度探测都读取服务端当前数据。网络超时和临时错误按设置重试。访问 token 过期且存在 refresh token 时，通过官方 `account/read {refreshToken:true}` 尝试刷新一次；刷新失败、缺少 refresh token 或 401/403 等认证错误会停止该账号的探测。认证文件不会在账号之间复制。

## 自动切号怎么继续任务

如果当前账号触达额度限制，`cx` 会：

1. 停掉当前 Codex 进程。
2. 把这个账号标记为本轮不可用。
3. 找下一个可用账号。
4. 优先恢复刚刚中断的精确 session。
5. 发送继续提示，让新账号接着做未完成任务。

常见恢复命令形态：

```sh
codex resume <interrupted-session-id> "Continue the interrupted task ..."
codex exec resume <interrupted-session-id> "Continue the interrupted task ..."
```

本次运行的独立日志中，额度错误必须包含有效的 `session_loop{thread_id=<UUID>}`。cx 只读取该 ID 对应的最新内容，校验工作目录，并将名称或 `--last` 转为精确 ID。ID 缺失、冲突、记录过旧或损坏时停止自动切换，请手动恢复目标会话。同一项目里较新的其他会话也不会被选中。Codex 日志格式变化可能导致自动切换安全停止。只接受来源为顶层 `cli` / `exec` 的记录；子代理和未知来源会被拒绝，避免把子代理的额度错误误认为主会话。

不同账号不共享 sessions 时，以 `0600` 权限复制对应记录。目标副本过旧、冲突或复制失败时停止，不静默覆盖。复制记录无法迁移全部 Codex 状态，例如独立的 goal 数据库。

先发送 SIGTERM，三秒内未退出再发送 SIGKILL；旧进程退出后才启动新账号。可选 PATH 包装器先给其子进程两秒退出时间。Codex 自身负责工具子进程的清理。

普通 `resume` 不读取或改变 goal 状态。只有本次额度错误触发的切换，才会恢复对应线程的 `usageLimited` goal；`paused`、`blocked` 等状态保持不变。`CX_AUTO_RESUME_GOAL=0` 可关闭恢复。

本次修复按要求保留既有的审批/沙箱 bypass 和项目自动信任行为。详见 [安全修复记录](SECURITY-FIXES.md)。

## 常见问题

`No Codex account homes found`

先创建账号目录：

```sh
cx-setup --accounts 3
```

`missing ~/.codex-accountN/auth.json`

对应账号还没登录：

```sh
CODEX_HOME="$HOME/.codex-accountN" codex login
```

`access token expired` / `token refresh failed`

访问 token 已过期，且缺少 refresh token 或刷新失败。请重新登录：

```sh
CODEX_HOME="$HOME/.codex-accountN" codex login
```

`All candidate accounts are exhausted or unavailable`

所有账号都不可用、未登录、探测失败或额度耗尽。先看：

```sh
cx status
cx quota
```

自动切号后仍然弹 trust 提示

确认没有设置：

```sh
CX_NO_TRUST=1
```

也可以重新安装 direct `codex` 包装器：

```sh
cx-setup --install-codex-wrapper --force
```

`cx status` 不显示 active

Linux 使用 `/proc`，macOS 使用 `ps`。无法可靠识别 home 时显示 `unknown`，选择账号时保守处理。创建独立目录不受此检查阻止；共享/迁移、移除和更新已有 API-key 账号仍保留检查，macOS 上这些操作可能要求退出 Codex。

API key 校验失败

检查 `--openai-base-url` 是否是正确 API 根路径，通常以 `/v1` 结尾。

## 许可证

GPL-3.0-only。见 [LICENSE](../LICENSE)。
