---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Agent Cortex Intelligence
status: verifying
stopped_at: Completed 23-01-PLAN.md
last_updated: "2026-03-31T12:11:02.503Z"
last_activity: 2026-03-31
progress:
  total_phases: 10
  completed_phases: 10
  total_plans: 19
  completed_plans: 19
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** Agents can retrieve surgically scoped context before every task -- closing the "decision shadow" where agents see what code does but not why decisions were made.
**Current focus:** Phase 22 — Multi-Project Bootstrap

## Current Position

Phase: 22
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-03-31

Progress: [████████░░] 83%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: --
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

| Phase 14 P01 | 15min | 3 tasks | 8 files |
| Phase 15 P01 | 3min | 2 tasks | 3 files |
| Phase 16 P01 | 10 | 2 tasks | 6 files |
| Phase 16-embedding-pipeline P02 | 3 | 2 tasks | 4 files |
| Phase 17-search-mcp-tools P01 | 2min | 1 tasks | 1 files |
| Phase 17-search-mcp-tools P03 | 126 | 2 tasks | 2 files |
| Phase 17-search-mcp-tools P02 | 4 | 2 tasks | 4 files |
| Phase 18 P01 | 1 | 1 tasks | 1 files |
| Phase 18 P03 | 91s | 2 tasks | 0 files |
| Phase 19 P02 | 4min | 2 tasks | 4 files |
| Phase 20-lore-protocol P01 | 3min | 2 tasks | 2 files |
| Phase 20-lore-protocol P02 | 3min | 2 tasks | 3 files |
| Phase 21-nightshift-reconciliation P01 | 3min | 1 tasks | 2 files |
| Phase 21-nightshift-reconciliation P02 | 3min | 2 tasks | 4 files |
| Phase 22-multi-project-bootstrap P01 | 6 | 3 tasks | 65 files |
| Phase 22-multi-project-bootstrap P02 | 3 | 1 tasks | 1 files |
| Phase 23 P01 | 2 | 2 tasks | 3 files |

### Decisions

All v2.0 decisions logged in PROJECT.md Key Decisions table.
v3.0 decisions pending -- schema standard is first decision point.

- [Phase 14]: Schema locked: cortex_level/confidence/domain/scope/source_hash/embedding_model field names and types final
- [Phase 14]: Zod v4 passthrough() must be called after merge() to preserve unknown fields
- [Phase 14]: Domain inference: project field > path inference > general fallback; existing domain never overwritten
- [Phase 15]: Removed Requires=docker.service from qdrant.service -- Docker is system-level, not user-level
- [Phase 15]: Vector size 1536 for OpenAI text-embedding-3-small, HNSW m=16 ef_construct=100 defaults
- [Phase 16]: Dependency injection for openai/qdrant in embedEntry() enables unit testing without live services
- [Phase 16]: deterministicId strips prefix before cortex/ — same vault file gets same Qdrant point ID regardless of absolute path prefix
- [Phase 16]: vi.hoisted() required for gray-matter.stringify mock — vitest hoists vi.mock() factories before const declarations
- [Phase 16]: watcher.ts uses module-level state (not class) -- consistent with embedder.ts singleton pattern
- [Phase 16]: cortex-reembed.ts uses node:fs/promises glob (Node 22 built-in) -- zero new dependencies
- [Phase 16]: startCortexWatcher called with .catch() in index.ts -- failure never crashes main process (best-effort non-blocking)
- [Phase 17-01]: Factory pattern for handlers: buildSearchHandler/buildReadHandler/buildWriteHandler take deps as constructor args — enables DI without full module mock
- [Phase 17-01]: checkConfidenceFirewall(level, domain, qdrant) takes qdrant as 3rd param — same DI pattern as embedEntry() in embedder.ts
- [Phase 17-03]: Used host.docker.internal literal for QDRANT_URL — no CONTAINER_HOST_GATEWAY constant in container-runtime.ts; hostGatewayArgs() handles --add-host mapping
- [Phase 17-03]: Added readEnvFile import to container-runner.ts for OPENAI_API_KEY — plan's thirdPartyKeys block no longer exists; OneCLI handles other credentials
- [Phase 17-02]: Named fs imports in cortex-mcp-tools.ts — test mocks node:fs as named exports; default import fails vitest mock resolution
- [Phase 17-02]: Inline logic in ipc-mcp-stdio.ts — container build cannot cross-import from host src/cortex/ packages
- [Phase 18]: Cortex query threshold 0.7; agents extract 2-3 key concepts; skip for conversational tasks
- [Phase 18]: Qdrant healthy but 0 points -- embedding blocked on OPENAI_API_KEY availability
- [Phase 18]: E2E smoke test: vault files correct, infrastructure ready, only embedding data load missing
- [Phase 19]: Inline graph loading in container (loadGraphIndex) since container cannot import host src/cortex/
- [Phase 19]: Graph loaded once at MCP server startup, read-only stale during session (acceptable per Phase 19 design)
- [Phase 19]: Related array only included when neighbors exist (empty arrays omitted for cleaner output)
- [Phase 20-lore-protocol]: Native git parsing with execSync and %(trailers) format -- no external CLI dependency (D-03)
- [Phase 20-lore-protocol]: Vault files: {7-char-hash}-{key-lowercase}.md naming, idempotent writes, lore_mined flag for confidence tracking
- [Phase 20-lore-protocol]: Forward-only convention: agents add trailers to new commits, never rewrite existing (D-01)
- [Phase 20-lore-protocol]: Mining capped at 40 entries when >50 candidates -- quality over quantity (Pitfall 4)
- [Phase 20-lore-protocol]: Bullet-only mining: only '- ' prefixed lines are candidates to reduce false positives
- [Phase 21]: Orphan detection requires ALL 3 conditions (no edges + bad frontmatter + short content) to avoid false positives
- [Phase 21]: Graceful Qdrant failure: runReconciliation returns partial report with empty newLinks on connection error
- [Phase 21]: Dynamic import of QdrantClient in IPC handler for graceful degradation
- [Phase 21]: No new cron entries -- cortex_reconcile integrates into existing Night Shift cycle (D-01/D-03)
- [Phase 22-01]: Pure logic extracted to src/cortex/multi-project-bootstrap.ts to satisfy rootDir: src constraint while keeping generateProjectEntries() unit-testable
- [Phase 22-01]: MAX_CONTENT_LENGTH=24000 chars truncation in bootstrap entries to prevent OpenAI 8192 token limit errors on large source docs
- [Phase 22-02]: No changes to cortex-mcp-tools.ts required — buildSearchHandler already supported project param from Plan 01
- [Phase 22-02]: Project filter scoping tests assert filter.must shape directly using mocked QdrantClient — no live Qdrant required
- [Phase 23]: openai optional in ReconciliationOptions — backward compat preserved, existing tests unchanged
- [Phase 23]: createOpenAIClient() failure in IPC handler is caught — lore mining skips gracefully, reconciliation always continues

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260331-irl | Hook cortex into global Claude Code MCP | 2026-03-31 | 7aed599 | [260331-irl-hook-cortex-into-global-claude-code-mcp](./quick/260331-irl-hook-cortex-into-global-claude-code-mcp/) |

### Blockers/Concerns

- Schema must be locked before first vector is stored (highest-cost pitfall per research)
- host.docker.internal on Linux requires --add-host flag -- verify in Phase 17
- Lore Protocol CLI existence is LOW confidence -- use native git parsing only
- MCP tool count ceiling: 3 Cortex tools (search/read/write) initially, cortex_relate added in Phase 19

## Session Continuity

Last session: 2026-03-31T12:11:02.499Z
Stopped at: Completed 23-01-PLAN.md
Resume file: None
