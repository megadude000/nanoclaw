# Phase 21: Nightshift Reconciliation - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement Cortex reconciliation as a Night Shift activity: staleness cascade (flag old entries by level TTL), CROSS_LINK auto-discovery (semantic similarity above threshold), orphan cleanup (entries with no references/searches), and summary report to #agents. This is NOT a fixed cron job — it's integrated into the Night Shift planning/execution system as a fallback/maintenance activity.

</domain>

<decisions>
## Implementation Decisions

### Scheduling & agent integration
- **D-01:** Cortex reconciliation is a Night Shift fallback activity, NOT a separate scheduled task. When Friday/Alfred finish planned tasks and the idea pool is empty, they pick up Cortex maintenance work.
- **D-02:** The Night Shift planner generates Cortex maintenance tasks when no other work is queued — staleness checks, CROSS_LINK discovery, orphan cleanup, documentation alignment, Cortex knowledge consolidation.
- **D-03:** This integrates into the existing Night Shift planning phase (21:03) and execution phase (23:27). No new cron entries needed.

### Claude's Discretion
- Frequency balance: whether to guarantee periodic Cortex maintenance (e.g., weekly) even when other tasks exist, or keep it strictly as fallback
- How Night Shift planner detects "nothing else to do" and pivots to Cortex maintenance
- Reconciliation step ordering (re-embed first, then staleness, then CROSS_LINK, then orphans)
- Staleness TTLs per cortex_level (Phase 14 deferred this to Claude)
- CROSS_LINK cosine similarity threshold for auto-discovery
- Orphan detection criteria (no references, no searches, missing frontmatter)
- Summary report format for #agents (embed type, fields, detail level)
- Whether reconciliation runs as a single task or split into sub-tasks per step

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/14-cortex-schema-standard/14-CONTEXT.md` — Staleness TTLs at Claude's discretion (Claude's Discretion section). Schema fields for staleness tracking.
- `.planning/phases/16-embedding-pipeline/16-CONTEXT.md` — Batch re-embed command (D-02) for reconciliation re-embedding step
- `.planning/phases/19-knowledge-graph/19-CONTEXT.md` — cortex-graph.json where CROSS_LINK edges get written

### Research findings
- `.planning/research/FEATURES.md` — Nightshift reconciliation as capstone, 4-step process, HIGH complexity
- `.planning/research/ARCHITECTURE.md` — Leverages existing task scheduler infrastructure
- `.planning/research/PITFALLS.md` — Knowledge staleness is most insidious long-term problem, source_hash + reconciliation essential

### Night Shift system
- `cortex/Areas/Projects/NightShift/NightShift.md` — Night Shift architecture, planning 21:03, execution 23:27, Alfred as research bot
- `cortex/Areas/Projects/NightShift/nightshift.architecture.md` — Full technical spec

### Existing infrastructure
- `src/task-scheduler.ts` — Task scheduler that runs Night Shift phases
- Agent status reporting (Phase 10) — #agents embed posting for summary reports

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 16 batch re-embed command — reconciliation calls this for re-embedding changed files
- Phase 19 cortex-graph.json — CROSS_LINK edges written here during discovery
- Agent status reporting (Phase 10) — buildProgressEmbed/buildClosedEmbed for summary reports to #agents
- Night Shift planning system — existing pattern for generating and executing tasks

### Established Patterns
- Night Shift 3-phase cycle: Planning → Execution → Wrap-up
- Alfred handles research and ideas, Friday handles code and docs
- Task results posted to #agents via embed builders

### Integration Points
- Night Shift planner checks task queue → if empty, generates Cortex maintenance tasks
- Reconciliation uses Phase 16 embedding, Phase 19 graph, Phase 17 search (for orphan detection via search counts)
- Summary report posts to #agents using existing embed infrastructure

</code_context>

<specifics>
## Specific Ideas

- User wants agents to "investigate, consolidate, check Cortex alignment" — this is broader than just the 4 reconciliation steps. It includes agents actively improving knowledge quality, not just running automated checks.
- Think of Cortex maintenance as "keeping documentation and Cortex in best shape" — agents should exercise judgment about what needs attention, not just follow a checklist.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-nightshift-reconciliation*
*Context gathered: 2026-03-28*
