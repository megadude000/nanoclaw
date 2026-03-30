---
plan: 17-03
phase: 17-search-mcp-tools
status: complete
completed: 2026-03-30
requirements_addressed: [MCP-03, MCP-05]
---

# Plan 17-03: Host Infrastructure for Cortex MCP Tools

## What Was Built

Host-side wiring enabling container agents to write Cortex entries and access the vault.

## Key Files

### Modified
- `src/ipc.ts` — cortex_write IPC message handler in messages loop (path traversal guard + vault write)
- `src/container-runner.ts` — cortex vault read-only bind mount (/workspace/cortex) + OPENAI_API_KEY + QDRANT_URL env injection

## Self-Check: PASSED

- [x] grep "cortex_write" src/ipc.ts — handler present
- [x] grep "/workspace/cortex" src/container-runner.ts — vault mount present
- [x] grep "OPENAI_API_KEY" src/container-runner.ts — env injection present
- [x] grep "QDRANT_URL" src/container-runner.ts — Qdrant URL present
- [x] 92 cortex tests pass

## Deviations

Two plan interface references were stale (CONTAINER_HOST_GATEWAY and thirdPartyKeys block) — auto-fixed inline. Applied via manual worktree merge due to pre-existing uncommitted changes in working tree.
