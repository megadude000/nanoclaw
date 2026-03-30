---
type: reference
cortex_level: L10
confidence: high
domain: nanoclaw
scope: cortex schema specification
---

# Cortex Schema Standard

This document defines the YAML frontmatter specification for all Cortex knowledge entries.

## Required Fields

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `cortex_level` | enum | `L10` / `L20` / `L30` / `L40` / `L50` | Knowledge pyramid level |
| `confidence` | enum | `low` / `medium` / `high` | How reliable this knowledge is |
| `domain` | string | project scope identifier (e.g., `nanoclaw`, `yourwave`) | Which project this entry belongs to |
| `scope` | string | free text | What this entry covers |

## Embedding Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `source_hash` | string (SHA-256) | Hash of markdown body (excludes frontmatter). Changes trigger re-embedding. |
| `embedding_model` | string | Model used for last embedding (e.g., `text-embedding-3-small`) |

## Knowledge Pyramid

| Level | Name | Definition | Examples | Staleness TTL |
|-------|------|------------|----------|---------------|
| L10 | File Facts | Individual file, API, env var, config entry | System templates, source file docs | 14 days |
| L20 | Behavior Patterns | How components interact, routing, data flow | Research docs, sub-project files (yw.branding.md) | 30 days |
| L30 | System Topology | How subsystems compose, deployment, infrastructure | Architecture specs (nightshift.architecture.md) | 60 days |
| L40 | Project Domains | Project overviews, business context, domain knowledge | YourWave.md, NightShift.md, daily notes | 90 days |
| L50 | Experiential | User journeys, session insights, decision rationale | Session logs | 180 days |

**Staleness TTL meaning:** After N days without re-validation, the entry is flagged as `stale` and demoted in search ranking. It is NOT deleted -- just deprioritized. Configurable per deployment.

## Validation Modes

### Strict

All four Cortex fields (`cortex_level`, `confidence`, `domain`, `scope`) are required. Used by the `cortex_write` MCP tool for new entries. Invalid entries are rejected with errors naming the bad field.

### Permissive

Missing fields get defaults inferred from file path. Used for indexing existing vault files. Entries are indexed with warnings, never rejected. Everything is searchable from day one.

## Path-Based Inference

When indexing existing vault files that lack Cortex fields, defaults are inferred from the file path:

| Path Pattern | Inferred Level | Inferred Domain |
|-------------|----------------|-----------------|
| `Session-Logs/*` | L50 | from `project` field |
| `Calendar/Daily/*` | L40 | personal |
| `System/*` | L10 | nanoclaw |
| `Research/*` | L20 | from parent directory |
| `Projects/{Name}/{Name}.md` (hub) | L40 | from `project` field |
| `Projects/{Name}/*.md` (sub-file) | L20 | from `project` field |
| Default | L20 | general |

## Existing Fields

Existing Obsidian frontmatter fields (`type`, `status`, `tags`, `created`, `updated`, `project`, `last_updated`, `date`, `topics`, `domain`, `day`) are preserved as-is. The Cortex schema extends but never breaks existing frontmatter.

**Note on `domain` field:** Some existing vault files use `domain` for sub-file topics (e.g., `domain: branding` in `yw.branding.md`). The Cortex `domain` field means "project scope identifier" (e.g., `nanoclaw`, `yourwave`). When both `project` and `domain` exist in legacy frontmatter, the existing `domain` value is preserved. Cortex domain inference uses the `project` field instead.

## Schema Lock Notice

This schema is LOCKED as of Phase 14. Field names and types must not change after vectors are stored in Qdrant (Phase 15+). Adding new optional fields is safe; changing existing field names or types requires full re-embedding.
