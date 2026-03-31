# Phase 23: Lore Mining Production Wiring - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — skipping discuss)

<domain>
## Phase Boundary

Wire `mineLoreFromHistory()` (lore-mining.ts) into `runReconciliation()` (reconciler.ts) so it runs on every Night Shift cycle. The functions exist and work; they simply have no production call site yet. No new logic needed — pure wiring.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key facts from codebase scout:
- `mineLoreFromHistory(repoDir, vaultDir, openai, qdrant)` — needs OpenAI client not currently in reconciler
- `runReconciliation(cortexDir, graphPath, qdrant, options?)` — needs `openai` and `repoDir` added via `ReconciliationOptions` (optional, backward compatible)
- `createOpenAIClient()` in `embedder.ts` — standard way to create OpenAI client from .env
- IPC handler (`ipc.ts:168`) calls `runReconciliation` — needs to create OpenAI client and pass via options
- `ReconciliationReport` — should include optional `loreSummary?: MiningSummary`
- Existing reconciler tests pass `fakeQdrant` without openai — backward compat required

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createOpenAIClient()` from `src/cortex/embedder.ts` — creates OpenAI from .env OPENAI_API_KEY
- `mineLoreFromHistory()` from `src/cortex/lore-mining.ts` — fully implemented, just needs a caller
- `ReconciliationOptions` interface in `reconciler.ts` — extend with `openai?` and `repoDir?`
- `ReconciliationReport` interface in `reconciler.ts` — extend with `loreSummary?`

### Established Patterns
- DI pattern: openai/qdrant passed as params, not singletons
- Graceful failure: Qdrant step wraps in try/catch with logger.warn — apply same to lore mining step
- `process.cwd()` is the repo dir (used already in ipc.ts cortex_reconcile handler)

### Integration Points
- `reconciler.ts`: `runReconciliation()` — add step 4 after findOrphans
- `ipc.ts:172-176`: cortex_reconcile handler — add `createOpenAIClient()` call, pass via options
- `reconciler.test.ts`: add test for lore mining step, mock `./lore-mining.js`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow existing DI and graceful-failure patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
