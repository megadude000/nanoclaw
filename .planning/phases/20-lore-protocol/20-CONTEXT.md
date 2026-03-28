# Phase 20: Lore Protocol - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Define git trailer convention (Constraint/Rejected/Directive atoms), implement native git parsing to extract lore atoms from commit trailers, and index them as searchable Cortex entries of type `lore-atom`. Document the convention in CLAUDE.md so agents adopt it going forward.

</domain>

<decisions>
## Implementation Decisions

### Trailer adoption strategy
- **D-01:** Forward-only convention — agents write lore trailers in new commits starting immediately after this phase ships. No retroactive rewriting of existing commits.
- **D-02:** One-time Night Shift mining task — Alfred runs a scheduled one-off to heuristically parse existing commit messages (~200+ commits) for implicit decisions (constraints, rejections, directives). Results indexed as lore-atom entries with lower confidence.
- **D-03:** No CLI dependency — native git parsing using `git log --format='%(trailers)'` (per research recommendation, ~10 lines of code).

### Claude's Discretion
- Exact trailer key format (e.g., `Constraint:` vs `Lore-Constraint:` vs `lore:constraint`)
- Git parsing implementation details
- How mined entries differ from explicit trailer entries (confidence level, metadata)
- CLAUDE.md instruction wording for agent trailer adoption
- Whether to add a `lore_source` field (commit hash + trailer key) to entry frontmatter
- Night Shift mining task prompt design and heuristic patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/14-cortex-schema-standard/14-CONTEXT.md` — Schema with cortex_level, confidence fields. Permissive defaults.
- `.planning/phases/16-embedding-pipeline/16-CONTEXT.md` — Embedding pipeline for indexing extracted lore atoms

### Research findings
- `.planning/research/FEATURES.md` — Lore Protocol as differentiator, git trailer format, independence from other components
- `.planning/research/ARCHITECTURE.md` — LOW confidence on Ian's CLI, native git parsing recommended
- `.planning/research/PITFALLS.md` — Lore adoption depth considerations

### Existing infrastructure
- `cortex/CLAUDE.md` — Where agent convention documentation goes
- Night Shift system: `cortex/Areas/Projects/NightShift/NightShift.md` — Alfred runs scheduled tasks, planning at 21:03, execution at 23:27

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 14 Zod schema — validate lore-atom entry frontmatter
- Phase 16 embedding function — embed extracted lore atoms
- Night Shift task scheduling — existing pattern for the one-time mining task

### Established Patterns
- Agent CLAUDE.md conventions — documented in container and group CLAUDE.md files
- Scheduled tasks via `task-scheduler.ts` — Alfred already runs nightly tasks

### Integration Points
- Lore atoms written to cortex/ vault as markdown files with frontmatter
- Embedding pipeline (Phase 16) auto-embeds via debounced fs.watch
- cortex_search (Phase 17) returns lore atoms alongside other entries
- Night Shift mining task scheduled via existing task infrastructure

</code_context>

<specifics>
## Specific Ideas

- Mining task should be a Night Shift one-off, not a recurring task — run once, index results, done
- Mined entries should have lower confidence than explicit trailer entries to reflect heuristic extraction

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-lore-protocol*
*Context gathered: 2026-03-28*
