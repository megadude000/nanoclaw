---
phase: quick
plan: 260331-irl
subsystem: cortex
tags: [mcp, cortex, claude-code, global-tools]
tech-stack:
  added:
    - "@modelcontextprotocol/sdk@1.29.0 — stdio MCP server transport"
  patterns:
    - "Proxy stub objects for graceful degradation when optional deps absent"
    - "Hardcoded absolute paths for cwd-independent server startup"
key-files:
  created:
    - scripts/cortex-mcp-server.ts
  modified:
    - ~/.claude/mcp.json (outside repo — global Claude Code config)
    - package.json / package-lock.json (new dependency)
decisions:
  - "Import QdrantClient directly instead of createQdrantClient() — qdrant-client.ts imports src/logger.ts which pulls host-only deps (WhatsApp, Telegram) and would crash the standalone server"
  - "mcpServers registered in ~/.claude/mcp.json (not settings.json) — settings.json schema strictly rejects unknown fields and has no mcpServers key"
metrics:
  duration: "8 minutes"
  completed: "2026-03-31"
  tasks: 2
  files: 3
---

# Quick Task 260331-irl: Hook Cortex into Global Claude Code MCP

**One-liner:** Stdio MCP server exposing cortex_search/read/write/relate to every Claude Code session via npx tsx + ~/.claude/mcp.json registration.

## What Was Built

`scripts/cortex-mcp-server.ts` — a standalone stdio MCP server that:
- Imports `buildSearchHandler`, `buildReadHandler`, `buildWriteHandler`, `buildRelateHandler` from `src/cortex/cortex-mcp-tools.ts`
- Uses hardcoded absolute paths (VAULT_ROOT, GRAPH_PATH, IPC_DIR) so it works from any Claude Code working directory
- Starts without crashing when OPENAI_API_KEY is absent or Qdrant is unreachable — uses Proxy stubs that return meaningful error messages at call time
- Vault path queries (ending in `.md` or starting with `Areas/`, `Calendar/`, `System/`) bypass OpenAI entirely and read the filesystem directly

`~/.claude/mcp.json` updated to add the `nanoclaw-cortex` entry pointing to this script.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create scripts/cortex-mcp-server.ts | 14328f1 | scripts/cortex-mcp-server.ts, package.json, package-lock.json |
| 2 | Register in ~/.claude/mcp.json | (outside repo) | ~/.claude/mcp.json |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used mcp.json instead of settings.json for mcpServers**
- **Found during:** Task 2
- **Issue:** Plan said to add `mcpServers` to `~/.claude/settings.json`, but Claude Code's settings.json schema rejects unknown fields and `mcpServers` is not a valid key there. Edit tool validation blocked the change.
- **Fix:** Wrote the `nanoclaw-cortex` entry to `~/.claude/mcp.json` instead — the correct location for MCP server registrations alongside the existing `obsidian` entry.
- **Files modified:** `~/.claude/mcp.json`

**2. [Rule 1 - Bug] Skipped createQdrantClient() import — avoids logger.ts host-only chain**
- **Found during:** Task 1 (reading qdrant-client.ts)
- **Issue:** `createQdrantClient()` in `src/cortex/qdrant-client.ts` imports `src/logger.ts` which pulls in WhatsApp/Telegram deps. Importing it would crash the standalone server.
- **Fix:** Created the QdrantClient directly: `new QdrantClient({ host: 'localhost', port: 6333 })` — same one-liner, zero extra deps.
- **Commit:** 14328f1

## Verification

```
cd /home/andrii-panasenko/nanoclaw && timeout 3 npx tsx scripts/cortex-mcp-server.ts 2>&1
# Output:
# [cortex-mcp] WARNING: OPENAI_API_KEY not set — semantic search disabled, vault path reads still work
# [cortex-mcp] Server started on stdio

node -e "const s=require('/home/andrii-panasenko/.claude/mcp.json'); console.log(s.mcpServers?.['nanoclaw-cortex']?.command)"
# Output: npx

npx tsc --noEmit 2>&1 | grep -i cortex-mcp-server
# Output: No TypeScript errors in cortex-mcp-server
```

## Known Stubs

None — all four tools are fully wired to the factory handlers.

## Self-Check: PASSED

- [x] `scripts/cortex-mcp-server.ts` exists and starts cleanly
- [x] `~/.claude/mcp.json` contains `nanoclaw-cortex` entry with correct command + args
- [x] TypeScript: no errors in the new file
- [x] Commit 14328f1 exists (`git log --oneline | grep 14328f1`)
