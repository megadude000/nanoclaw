# Phase 22: Multi-Project Bootstrap - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend Cortex L10-L20 coverage to YourWave, ContentFactory, and NightShift projects using the proven bootstrap pattern from Phase 18. Validate that project filter scoping in cortex_search works correctly — no cross-project contamination in filtered queries.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (all areas)

The user designated all gray areas as coding decisions for Claude:

**Project scope & sources:**
- Which projects get full codebase bootstrap (YW_Core has a separate repo) vs Cortex-doc-only bootstrap (ContentFactory, NightShift are primarily Cortex markdown + NanoClaw config)
- How to access YW_Core repo for extraction (path, git clone, or mount)
- Whether ContentFactory and NightShift bootstraps extract from existing Cortex vault docs or from NanoClaw source code where their logic lives

**Bootstrap approach:**
- Reuse Phase 18 bootstrap script with project parameter, or create per-project scripts
- Entry count targets per project
- How to handle the different source material shapes (TypeScript codebase vs Obsidian docs vs config files)

**Validation:**
- Test scenarios for project filter scoping (search with project=nanoclaw should not return yourwave entries)
- Cross-contamination detection approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/18-knowledge-bootstrap/18-CONTEXT.md` — Fully automated bootstrap (D-01), NanoClaw only (D-02). Same pattern reused here.
- `.planning/phases/14-cortex-schema-standard/14-CONTEXT.md` — domain field in schema (D-02) enables project scoping

### Research findings
- `.planning/research/FEATURES.md` — Multi-project scoping via Qdrant payload filter on `project` field
- `.planning/research/PITFALLS.md` — Bootstrap scope creep warning: NanoClaw first, other projects after validation

### Existing project sources
- `cortex/Areas/Projects/YourWave/YourWave.md` — YourWave project context, sub-files for each domain
- `cortex/Areas/Projects/ContentFactory/ContentFactory.md` — Content Factory project context
- `cortex/Areas/Projects/NightShift/NightShift.md` — Night Shift project context, architecture spec
- YW_Core repo (separate, at `~/YW_Core`) — Astro + React + Supabase codebase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 18 bootstrap script — proven extraction + indexing pattern for NanoClaw
- Phase 14 Zod schema — validate generated entries with domain field set per project
- Phase 16 embedding function — embed generated entries

### Established Patterns
- Cortex vault already has project-organized directories: `cortex/Areas/Projects/{ProjectName}/`
- Schema `domain` field maps to project name for Qdrant filtering

### Integration Points
- Bootstrap writes to existing cortex/ vault directory structure
- Qdrant payload filter `{ "project": "yourwave" }` enables scoped search
- cortex_search project parameter (Phase 17) must be validated end-to-end

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-multi-project-bootstrap*
*Context gathered: 2026-03-28*
