---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  NanoClaw container isolation model - per-group VMs, volume mounts, env
  injection, CLAUDE.md, lifecycle
project: nanoclaw
tags:
  - nanoclaw
  - container
  - isolation
  - security
  - mounts
  - onecli
  - claude-md
created: 2026-03-31T00:00:00.000Z
source_hash: 30a707a890da2f485628701554bd49a49aa021cf58490e1894c1f5b13afa931e
embedding_model: text-embedding-3-small
---

# NanoClaw — Container Isolation Model

## Core Principle: Each Group = Isolated Container

Each registered NanoClaw group runs its agent in an isolated Docker (or Podman) container. Containers are ephemeral: spawned on message arrival, exit after producing a response. There are no long-running agent processes. This provides:
- Memory isolation: groups cannot read each other's conversation context
- Filesystem isolation: groups can only write to their own mounted directory
- Credential isolation: no raw API keys in container environment

## Volume Mount Structure

What a container sees at `/workspace/`:

| Container Path | Host Source | Writable | Who Gets It |
|----------------|-------------|----------|-------------|
| `/workspace/group` | `{GROUPS_DIR}/{folder}` | Yes | All groups |
| `/workspace/project` | Project root (NanoClaw repo) | No (read-only) | Main group only |
| `/workspace/project/.env` | `/dev/null` (shadow) | No | Main group — blocks secret reading |
| `/workspace/host` | `$HOME` (user home dir) | Yes | Main group only |
| `/workspace/cortex` | `{projectRoot}/cortex` | No (read-only) | All groups |
| `/workspace/global` | `{GROUPS_DIR}/global` | No (read-only) | Non-main groups |
| `/home/node/.claude` | `{DATA_DIR}/sessions/{folder}/.claude` | Yes | All groups |
| `{XDG_RUNTIME_DIR}` | systemd user socket | Yes | Main group only |

The `.env` shadow mount (`/dev/null` over `/workspace/project/.env`) is critical: it prevents agents in the main group from reading raw secrets even though the project root is mounted read-only. All credentials flow through OneCLI.

## Credential Injection: OneCLI Proxy

Containers do not receive API keys as environment variables. Instead, they authenticate via OneCLI — a credential proxy service that provides time-limited tokens to authorized containers. The `detectAuthMode()` function always returns `'onecli'` (the original direct credential proxy was removed in favor of this approach). This means:
- If OneCLI is unavailable, the container has no credentials and will fail gracefully rather than exposing secrets
- Credential rotation happens in OneCLI without touching container configuration
- Each container gets a scoped identity (identified by `group.folder`)

## CLAUDE.md Per Group

Each group folder contains a `CLAUDE.md` that defines the agent's identity, instructions, and context. When a new group is registered:
1. The system checks if a `CLAUDE.md` already exists in the group folder
2. If not, it copies from `{GROUPS_DIR}/{isMain ? 'main' : 'global'}/CLAUDE.md` template
3. The `ASSISTANT_NAME` token in the template is substituted with the configured name

This ensures every agent has identity and instructions from its first run. The main group's CLAUDE.md differs from other groups — it includes system-level instructions and awareness of the full NanoClaw architecture.

## Skills and Agents Sync

Before spawning the container, the runner syncs two directories into the group's `.claude/` session:
- **Skills**: copied from `container/skills/` (project-level) and `~/.claude/skills/` (user-level). Skills are slash-command extensions available to the agent.
- **Agents**: copied from `container/agents/` (project-level .md files). These define specialized sub-agents the main agent can spawn.

Symlink-aware: if source and destination resolve to the same real path (e.g., a symlink), the copy is skipped.

## Container Lifecycle

1. Message arrives → `GroupQueue` serializes for this group
2. `runContainerAgent()` called with prompt, session ID, and group config
3. Volume mounts computed (`buildVolumeMounts()`) based on `isMain` flag
4. Container spawned: `{CONTAINER_RUNTIME_BIN} run --rm ... --input-format stream-json`
5. Prompt written to stdin; output read from stdout via `OUTPUT_START_MARKER` / `OUTPUT_END_MARKER` sentinels
6. Container exits after writing final output; the process is gone
7. Session ID is preserved for the next run (conversation continuity)

## Additional Mounts (Security Gated)

Groups can request additional mounts beyond the standard set (e.g., for integrations needing specific host directories). These are validated against an allowlist at `~/.config/nanoclaw/mount-allowlist.json` — stored OUTSIDE the project root specifically to prevent agents from modifying their own mount permissions. The allowlist is loaded once at startup (cached in memory), so changes require a process restart.

## Rejected Alternatives

**Long-running agent processes** — rejected because they would accumulate state and make conversation isolation harder. Ephemeral containers keep each response clean.

**Shared session directories** — each group gets its own `.claude/sessions/{folder}/` to prevent cross-group session access. A shared `.claude/` would allow one group to read another's conversation history.
