# Phase 18: Knowledge Bootstrap - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate NanoClaw L10-L20 entries (~50-100) via a fully automated bootstrap script and wire container CLAUDE.md so agents auto-query Cortex at task start. First real value delivery — an agent in a container searches for a NanoClaw concept and gets a relevant result.

</domain>

<decisions>
## Implementation Decisions

### Bootstrap approach
- **D-01:** Fully automated — script parses `src/*.ts`, extracts exports/interfaces/env vars/IPC contracts, generates entries with auto-inferred frontmatter, writes directly to vault + triggers embedding. Run once, no manual review step.
- **D-02:** NanoClaw codebase only (per research recommendation). Multi-project bootstrap is Phase 22.

### Agent auto-query wiring
- **D-03:** Agents query Cortex always before any task — every agent invocation, not just code tasks. Instruction added to container CLAUDE.md.

### Claude's Discretion
- Exact wording of the CLAUDE.md auto-query instruction
- What keywords agents extract from the task prompt for the cortex_search call
- Bootstrap script's extraction logic (AST parsing vs regex vs heuristic)
- Entry naming convention and vault path structure for generated entries
- How to handle entries for files that already exist as vault entries (merge vs skip)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/14-cortex-schema-standard/14-CONTEXT.md` — L10 = file facts, L20 = behavior patterns (D-04). All vault files indexed (D-05). Permissive defaults (D-08).
- `.planning/phases/17-search-mcp-tools/17-CONTEXT.md` — cortex_search/read/write MCP tools in ipc-mcp-stdio.ts

### Research findings
- `.planning/research/FEATURES.md` — Bootstrap is HIGH complexity, ~50-100 entries for NanoClaw. Programmatic extraction from src/ exports, IPC contracts, env vars, channel interfaces.
- `.planning/research/PITFALLS.md` — Bootstrap scope creep: NanoClaw first, other projects after end-to-end validation.

### Existing vault
- `cortex/CLAUDE.md` — Current vault configuration, active projects, key decisions
- `container/agents/` — Agent CLAUDE.md templates that will receive the auto-query instruction

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 14 Zod schema — validate generated entry frontmatter
- Phase 16 embedding function — embed generated entries into Qdrant
- `src/*.ts` files — source material for L10 extraction

### Established Patterns
- Cortex vault structure: `cortex/Areas/Projects/`, `cortex/Areas/Work/` — bootstrap entries need a consistent home
- Container CLAUDE.md files in `container/agents/` and group-specific `groups/{name}/CLAUDE.md`

### Integration Points
- Bootstrap script writes to `cortex/` vault directory
- Embedding pipeline (Phase 16) auto-embeds new files via debounced fs.watch (10-minute window)
- Or bootstrap can call the batch re-embed command directly for immediate indexing
- Container CLAUDE.md modification affects all future agent invocations

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- Multi-project bootstrap (YourWave, ContentFactory, NightShift) — Phase 22

</deferred>

---

*Phase: 18-knowledge-bootstrap*
*Context gathered: 2026-03-28*
