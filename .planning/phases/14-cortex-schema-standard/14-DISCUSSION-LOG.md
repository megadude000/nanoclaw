# Phase 14: Cortex Schema Standard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 14-cortex-schema-standard
**Areas discussed:** Schema fields, Knowledge pyramid, Validation approach

---

## Schema Fields

### Migration strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing | Keep current fields, ADD new Cortex fields alongside them | ✓ |
| Clean break | Define strict new schema, migrate all existing entries | |
| You decide | Claude picks during implementation | |

**User's choice:** Extend existing
**Notes:** Preserves Obsidian compatibility and existing vault files

### Required vs optional fields

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal required | Only cortex_level required, others optional with defaults | |
| Full required | cortex_level, confidence, domain, scope ALL required on indexed entries | ✓ |
| Tiered | Requirements scale with abstraction level | |

**User's choice:** Full required
**Notes:** Strict data quality from day one

### Embedding metadata location

| Option | Description | Selected |
|--------|-------------|----------|
| In frontmatter | source_hash and embedding_model in YAML, visible in Obsidian and git-tracked | ✓ |
| Qdrant-only | Embedding metadata in Qdrant payload only, invisible to Obsidian | |
| You decide | Claude picks during implementation | |

**User's choice:** In frontmatter
**Notes:** Research strongly recommended carrying metadata from day one to prevent model lock-in

---

## Knowledge Pyramid

### Session log indexing

| Option | Description | Selected |
|--------|-------------|----------|
| Index them | Session logs L50, daily notes L40, everything searchable | ✓ |
| Exclude from Cortex | Session logs Obsidian-only, only authored entries indexed | |
| Selective | Only session logs with explicit lore atoms get indexed | |

**User's choice:** Index them
**Notes:** Everything in vault is searchable

### Staleness TTLs

| Option | Description | Selected |
|--------|-------------|----------|
| Aggressive | L10: 7d, L20: 14d, L30: 30d, L40: 60d, L50: 90d | |
| Relaxed | L10: 30d, L20: 60d, L30: 90d, L40: 180d, L50: 365d | |
| You decide | Claude picks reasonable defaults, configurable later | ✓ |

**User's choice:** You decide
**Notes:** Claude has flexibility on TTLs

---

## Validation Approach

### Enforcement mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Zod schema (Recommended) | TypeScript Zod validates at write time, reusable across host and container | ✓ |
| Convention only | Documented spec, no runtime validation | |
| You decide | Claude picks based on complexity | |

**User's choice:** Zod schema
**Notes:** Code-enforced validation

### Strictness for existing files

| Option | Description | Selected |
|--------|-------------|----------|
| Strict reject | Invalid entries rejected from Qdrant, invisible to agents until fixed | |
| Permissive with defaults | Missing fields get defaults, indexed with warnings, everything searchable | ✓ |
| You decide | Claude picks the balance | |

**User's choice:** Permissive with defaults
**Notes:** Everything searchable from day one, even with incomplete frontmatter

---

## Claude's Discretion

- Staleness TTLs per level
- Exact Zod schema field types and validation rules
- Default inference logic for cortex_level based on file path patterns
- Schema documentation format and location

## Deferred Ideas

None — discussion stayed within phase scope
