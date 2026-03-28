# Phase 14: Cortex Schema Standard - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Define and lock the YAML frontmatter specification that ALL downstream components (embedder, MCP tools, reconciler) depend on. This is a convention + validation phase: schema definition, Zod validation code, knowledge pyramid documentation. No vector DB, no MCP tools, no embedding pipeline — those come in later phases.

</domain>

<decisions>
## Implementation Decisions

### Schema fields — migration strategy
- **D-01:** Extend existing frontmatter, don't break it. Current fields (type, status, tags, created, updated, project, last_updated) remain valid. New Cortex fields are ADDED alongside them.
- **D-02:** All four new Cortex fields are REQUIRED on entries that get indexed into Qdrant: `cortex_level` (L10-L50), `confidence` (low/medium/high), `domain` (project scope identifier), `scope` (what the entry covers).
- **D-03:** Embedding metadata fields (`source_hash`, `embedding_model`) are stored IN frontmatter, not Qdrant-only. This makes them visible in Obsidian and git-tracked.

### Knowledge pyramid levels
- **D-04:** All 5 levels (L10-L50) defined with clear examples. L10 = file facts, L20 = behavior patterns, L30 = system topology, L40 = project domains, L50 = user journeys/experiential.
- **D-05:** Session logs and daily notes ARE indexed into Cortex — everything in the vault is searchable. Session logs get L50 (experiential knowledge), daily notes get L40.
- **D-06:** Existing vault files (~80+) will all be indexed. The existing project summaries (YourWave.md, NightShift.md, etc.) are L40-level entries.

### Validation approach
- **D-07:** Zod runtime schema validates frontmatter at write time. Reusable across host (embedding pipeline) and container (cortex_write MCP tool).
- **D-08:** Permissive with defaults — existing vault files with incomplete frontmatter get sensible defaults (confidence: low, cortex_level inferred from path/content). Entries are indexed with warnings, not rejected. Everything searchable from day one.

### Claude's Discretion
- Staleness TTLs per level — Claude picks reasonable defaults, configurable later
- Exact Zod schema field types and validation rules
- Default inference logic for cortex_level based on file path patterns
- Schema documentation format and location

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research findings
- `.planning/research/STACK.md` — gray-matter ^4.0.3 for YAML parsing, Zod for validation
- `.planning/research/FEATURES.md` — L10-L50 pyramid definitions, feature dependencies, anti-features
- `.planning/research/ARCHITECTURE.md` — Schema as foundation, integration points with embedding pipeline
- `.planning/research/PITFALLS.md` — Schema-must-be-locked-before-first-vector pitfall, embedding model lock-in metadata

### Existing vault structure
- `cortex/CLAUDE.md` — Current vault configuration, project identity, active projects list
- `cortex/Areas/Projects/NightShift/NightShift.md` — Example of existing frontmatter (type, status, created, updated, tags)
- `cortex/Areas/Projects/YourWave/YourWave.md` — Example of existing frontmatter (type, project, status, last_updated, tags)

### Project context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — SCHEMA-01 requirement definition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Zod already in project (^4.3.6) — use for schema validation, no new dependency needed
- gray-matter (new dep, ^4.0.3) — standard YAML frontmatter parser, 5M+ weekly downloads

### Established Patterns
- Existing frontmatter fields: `type`, `status`, `tags`, `created`, `updated`, `project`, `last_updated` — inconsistent across files, need to coexist with new fields
- Obsidian wiki-links (`[[...]]`) used throughout vault — schema must not interfere with these
- Vault structure: `Areas/Projects/`, `Areas/Work/Session-Logs/`, `Calendar/Daily/`, `System/Templates/`

### Integration Points
- Schema validation module will be imported by embedding pipeline (Phase 16) and cortex_write MCP tool (Phase 17)
- gray-matter parser will be shared between host-side services and container-side MCP tools
- Qdrant collection schema (Phase 15) derives payload field types from this frontmatter schema

</code_context>

<specifics>
## Specific Ideas

- Existing vault has mix of English and Ukrainian content — schema must handle both, domain/scope fields in English for consistency
- Session logs at `Areas/Work/Session-Logs/` have date-prefixed filenames — path pattern can help auto-infer cortex_level (L50)
- Project files like `YourWave.md`, `NightShift.md` are clearly L40 — directory structure aids level inference

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-cortex-schema-standard*
*Context gathered: 2026-03-28*
