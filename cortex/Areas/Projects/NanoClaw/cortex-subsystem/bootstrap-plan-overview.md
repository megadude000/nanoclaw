---
type: reference
cortex_level: L20
confidence: high
domain: nanoclaw
scope: cortex L20/L30 knowledge bootstrap plan for all major systems
created: '2026-03-31'
updated: '2026-03-31'
source_hash: cc095ab439bc3a8f84bd41cf7bcfa2d21659789a6d10e7e0809d5bf932bd73b7
embedding_model: text-embedding-3-small
---

# Cortex Bootstrap Plan Overview

Phase 22 created L10 file-level entries for all `src/` files (42 entries). What's missing:
**L20/L30 architectural decisions** — why things are built the way they are, constraints,
rejected alternatives, key patterns. This plan fills that gap.

## Full Plan

`cortex/System/bootstrap-plan.md` — 7 systems, ~21 entries to create, each specified with:
- Exact git commits/files to read (no ambiguity)
- Table of entries to create (path, level, what to capture)
- `cortex_relate` instructions with edge types
- Done criteria: specific `cortex_search` query + minimum score 0.7

## Systems Covered

| System | Entries | Focus |
|--------|---------|-------|
| NanoClaw Core Architecture | 5 | Message flow, IPC protocol, channel registry, container isolation, security model |
| NanoClaw Subsystems | 4 | Task scheduler, webhook routing, health monitor, Discord server manager |
| Cortex Pipeline | 5 | Pipeline architecture, MCP tools, knowledge graph, reconciliation, lore mining |
| GSD Workflow | 3 | Phase structure, lifecycle, lore trailer convention |
| Night Shift | 2 | Orchestration model, approval tiers |
| YourWave Platform | 1 | Platform decisions |
| ContentFactory | 1 | Pipeline decisions |

## How Night Shift Should Use This

1. Pick any `pending` system from the progress table in `bootstrap-plan.md`
2. Follow the step-by-step instructions exactly — read the specified git commits/files
3. Write each entry in the table — don't skip, write partial entries with `confidence: medium` if needed
4. Apply 5 quality gates before marking done
5. Do not batch multiple systems in one shift — finish and verify one before starting the next

## Quality Gates (apply to every entry before marking done)

1. Valid frontmatter: `cortex_level`, `confidence`, `domain`, `scope`
2. Connected to hub via `cortex_relate`
3. `cortex_search("{scope}")` returns the entry with score > 0.7
4. Entry body ≥ 150 words
5. L20 entries explain **why** not just **what** — include constraints and rejected alternatives
