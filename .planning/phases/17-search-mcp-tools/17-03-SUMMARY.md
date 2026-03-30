---
phase: 17-search-mcp-tools
plan: "03"
subsystem: host-infrastructure
tags: [ipc, container-runner, cortex, mcp-tools, security]
dependency_graph:
  requires: [17-01, 17-02]
  provides: [cortex-vault-mount, cortex_write-ipc-handler, openai-env-injection, qdrant-env-injection]
  affects: [src/ipc.ts, src/container-runner.ts]
tech_stack:
  added: []
  patterns: [path-traversal-guard, readEnvFile-injection, existsSync-guard, readonly-bind-mount]
key_files:
  created: []
  modified:
    - src/ipc.ts
    - src/container-runner.ts
decisions:
  - "Used host.docker.internal:6333 literal for QDRANT_URL — no CONTAINER_HOST_GATEWAY constant exists in container-runtime.ts (hostGatewayArgs() handles --add-host mapping)"
  - "Added readEnvFile import to container-runner.ts for OPENAI_API_KEY injection — plan's interface referenced a thirdPartyKeys block that no longer exists in the file"
  - "cortex_write handler placed in messages loop (not tasks loop) per plan requirement — fire-and-forget, no reply sent back to container"
metrics:
  duration_seconds: 126
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 2
---

# Phase 17 Plan 03: Host Infrastructure for Cortex MCP Tools Summary

**One-liner:** Host-side cortex_write IPC handler with path traversal guard, read-only cortex vault mount for all containers, and OPENAI_API_KEY + QDRANT_URL env injection.

## What Was Built

### Task 1: cortex_write IPC handler (src/ipc.ts)

Added `else if (data.type === 'cortex_write' && data.path && data.content)` branch to the messages processing loop in `processIpcFiles`. The handler:

- Resolves `targetPath` using `path.resolve(vaultRoot, data.path)` where `vaultRoot = path.join(process.cwd(), 'cortex')`
- Blocks path traversal: checks `!targetPath.startsWith(vaultRoot + path.sep)` and logs a warning if violated
- Creates intermediate directories: `fs.mkdirSync(path.dirname(targetPath), { recursive: true })`
- Writes the vault file: `fs.writeFileSync(targetPath, data.content, 'utf-8')`
- Fire-and-forget: no reply sent back to container (container already returned "Entry queued for write")
- The cortex watcher in `src/cortex/watcher.ts` picks up the change and triggers re-embedding

### Task 2: Cortex vault mount + env vars (src/container-runner.ts)

Three changes to `buildVolumeMounts()` and `buildContainerArgs()`:

1. **Cortex vault mount** (in `buildVolumeMounts()`): After the main/non-main if/else block, added a read-only bind mount of `{projectRoot}/cortex` → `/workspace/cortex` with `existsSync` guard. Applies to ALL containers (both main and non-main) since Cortex is shared knowledge.

2. **OPENAI_API_KEY injection**: Added `readEnvFile` import from `./env.js`. After `hostGatewayArgs()` call, reads OPENAI_API_KEY from .env and injects as container env var.

3. **QDRANT_URL injection**: Pushes `QDRANT_URL=http://host.docker.internal:6333` as env var. Works because `hostGatewayArgs()` already adds `--add-host=host.docker.internal:host-gateway` on Linux.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CONTAINER_HOST_GATEWAY constant does not exist**
- **Found during:** Task 2
- **Issue:** Plan's interface section referenced `CONTAINER_HOST_GATEWAY` imported from `./container-runtime.js`, but `container-runtime.ts` only exports `hostGatewayArgs()` (a function), not a `CONTAINER_HOST_GATEWAY` constant.
- **Fix:** Used `'host.docker.internal'` literal string directly in the QDRANT_URL env var. This is safe because `hostGatewayArgs()` already injects `--add-host=host.docker.internal:host-gateway` for Linux containers, so the hostname resolves correctly.
- **Files modified:** src/container-runner.ts
- **Commit:** cc7055e

**2. [Rule 1 - Bug] thirdPartyKeys/readEnvFile block not present in container-runner.ts**
- **Found during:** Task 2
- **Issue:** Plan's interface section referenced a `readEnvFile([...thirdPartyKeys...])` block in `buildContainerArgs()` where OPENAI_API_KEY should be added. This block does not exist — the current file uses OneCLI for credential injection.
- **Fix:** Added `readEnvFile` import from `./env.js` and injected OPENAI_API_KEY separately after `hostGatewayArgs()`, consistent with how readEnvFile is used in config.ts. Pattern is still correct — reads from .env file and injects as env var.
- **Files modified:** src/container-runner.ts
- **Commit:** cc7055e

## Verification Results

- `grep "cortex_write" src/ipc.ts` — shows handler
- `grep "workspace/cortex" src/container-runner.ts` — shows mount
- `grep "QDRANT_URL" src/container-runner.ts` — shows env injection
- `grep "OPENAI_API_KEY" src/container-runner.ts` — shows key injection
- `npm run build` — exits 0, zero TypeScript errors
- `npm run test` — 239/239 tests pass (18 test files)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 943b107 | feat(17-03): add cortex_write IPC handler to messages loop |
| Task 2 | cc7055e | feat(17-03): add cortex vault mount + env vars to container-runner |

## Self-Check: PASSED
