---
phase: 17-search-mcp-tools
plan: "02"
subsystem: cortex-mcp-tools
tags:
  - cortex
  - mcp
  - qdrant
  - openai
  - container
dependency_graph:
  requires:
    - 17-01
    - phase-15-qdrant
    - phase-16-embedding-pipeline
  provides:
    - cortex_search MCP tool (semantic + vault-path hybrid routing)
    - cortex_read MCP tool (direct vault file access)
    - cortex_write MCP tool (IPC write + confidence firewall)
  affects:
    - container/agent-runner (new deps + 3 new tools)
    - src/cortex/ (new testable module)
tech_stack:
  added:
    - openai ^6.33.0 (container agent-runner)
    - "@qdrant/js-client-rest ^1.17.0 (container agent-runner)"
    - gray-matter ^4.0.3 (container agent-runner)
  patterns:
    - Factory functions (buildSearchHandler, buildReadHandler, buildWriteHandler) for DI and testability
    - Inline Zod schema in container (no host-only imports)
    - Hybrid routing: isVaultPath heuristic for direct reads vs semantic Qdrant search
    - Confidence firewall: L20+ writes blocked unless L(N-10) medium+ entries exist
key_files:
  created:
    - src/cortex/cortex-mcp-tools.ts
  modified:
    - container/agent-runner/package.json
    - container/agent-runner/src/ipc-mcp-stdio.ts
    - src/cortex/cortex-mcp-tools.test.ts
decisions:
  - "Named fs imports in cortex-mcp-tools.ts (not default import) — test mocks node:fs as named exports only; default import causes vitest mock resolution failure"
  - "Inline logic in ipc-mcp-stdio.ts (not cross-package import) — container build cannot import from host src/cortex/"
metrics:
  duration: "4 min"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_changed: 4
---

# Phase 17 Plan 02: Cortex MCP Tools Summary

**One-liner:** Three container MCP tools (cortex_search, cortex_read, cortex_write) with hybrid Qdrant/vault-path routing, confidence firewall, and factory DI pattern for unit testing.

## What Was Built

### src/cortex/cortex-mcp-tools.ts

Testable handler factory module with 5 exports:

- **`isVaultPath(query)`** — Heuristic: `.md` extension or `Areas/`, `Calendar/`, `System/` prefix = exact vault path; otherwise natural language
- **`checkConfidenceFirewall(level, domain, qdrant)`** — For L20+, scrolls Qdrant to verify L(N-10) entries with medium/high confidence exist in the same domain; returns `true` (blocked) if none found; L10 always allowed
- **`buildSearchHandler({ qdrant, openai, vaultRoot })`** — Hybrid routing: vault path → `readFileSync`, semantic query → OpenAI embed + Qdrant search with optional project/level/domain filters; limit capped at 20
- **`buildReadHandler({ vaultRoot })`** — `path.resolve` + `startsWith` path traversal guard; returns raw markdown (frontmatter included)
- **`buildWriteHandler({ qdrant, writeIpc, vaultRoot })`** — gray-matter parse → CortexFieldsStrict Zod validation → confidence firewall check → `writeIpc()` call

All 27 unit tests pass. No host-only imports.

### container/agent-runner/src/ipc-mcp-stdio.ts

Three `server.tool()` registrations added before `StdioServerTransport` initialization:

- **`cortex_search`** — inline vault-path/semantic hybrid logic with `QDRANT_URL` env var
- **`cortex_read`** — inline path traversal guard + vault file read from `/workspace/cortex`
- **`cortex_write`** — inline CortexFieldsStrict validation + confidence firewall + `writeIpcFile(MESSAGES_DIR, { type: 'cortex_write', ... })`

Container TypeScript build: exits 0 (zero errors after `npm install`).

### container/agent-runner/package.json

Added three dependencies: `openai ^6.33.0`, `@qdrant/js-client-rest ^1.17.0`, `gray-matter ^4.0.3`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed node:fs default import causing test mock failure**

- **Found during:** Task 1 TDD GREEN phase
- **Issue:** `import fs from 'node:fs'` (default import) fails when vitest mocks `node:fs` as named exports only — `[vitest] No "default" export is defined on the "node:fs" mock`
- **Fix:** Changed to `import { existsSync, readFileSync } from 'node:fs'` (named imports)
- **Files modified:** `src/cortex/cortex-mcp-tools.ts`
- **Commit:** 0e6b1f2

**2. [Rule 1 - Bug] Fixed typo in test mock setup**

- **Found during:** Task 1 TDD GREEN phase
- **Issue:** `mockFsReadFileSync.mockReturnValue('...arcitecture content')` — missing 'h', so `toContain('architecture content')` assertion could never pass
- **Fix:** Corrected `arcitecture` to `architecture` in test mock setup
- **Files modified:** `src/cortex/cortex-mcp-tools.test.ts`
- **Commit:** 0e6b1f2

**3. [Rule 3 - Blocker] Ran npm install in container/agent-runner**

- **Found during:** Task 2 build verification
- **Issue:** `node_modules` missing in container/agent-runner; tsc could not resolve `@modelcontextprotocol/sdk` and other packages
- **Fix:** Ran `npm install` to install all container dependencies (including newly added openai/qdrant/gray-matter)
- **Files modified:** container/agent-runner/node_modules (not committed)

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| src/cortex/cortex-mcp-tools.test.ts | 27/27 | GREEN |
| src/cortex/ (full cortex suite) | 92/92 | GREEN |
| container/agent-runner npm run build | — | EXIT 0 |

## Known Stubs

None. All three tools are fully implemented with real logic:
- cortex_search calls real Qdrant (QDRANT_URL env var required in container)
- cortex_read reads real vault mount (/workspace/cortex)
- cortex_write writes real IPC files via writeIpcFile

## Self-Check: PASSED

Files created/modified:
- FOUND: src/cortex/cortex-mcp-tools.ts
- FOUND: container/agent-runner/package.json
- FOUND: container/agent-runner/src/ipc-mcp-stdio.ts
- FOUND: src/cortex/cortex-mcp-tools.test.ts

Commits verified:
- FOUND: 0e6b1f2 (feat(17-02): create cortex-mcp-tools.ts with testable handler factories)
- FOUND: 03f2193 (feat(17-02): add container deps + wire cortex_search/read/write into MCP server)
