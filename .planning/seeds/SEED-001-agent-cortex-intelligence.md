---
id: SEED-001
status: dormant
planted: 2026-03-28
planted_during: v2.0 Agent Dashboard — Phase 13 complete, Phase 14 remaining
trigger_when: After v2.0 closes, when starting v3.0 or any milestone focused on agent memory, knowledge retrieval, or system self-awareness
scope: large
---

# SEED-001: v3.0 Agent Cortex Intelligence — bullet-fast queryable knowledge layer for agents

## Why This Matters

Agents currently see ~30% of system knowledge — the "decision shadow" problem. They see what
code does but not WHY decisions were made, what was rejected, or how components relate across
domains. Every new conversation starts from scratch.

The vision: agents query a structured Cortex via MCP tools and get distilled, perfectly scoped
context in milliseconds — no loading gigabytes, no wasting tokens on irrelevant files. The system
is fast enough to use for detailed bullet-level knowledge of every part of NanoClaw, YourWave,
and any future project.

**The self-reinforcing loop:**
```
Agents write code → Lore git trailers capture WHY
                  → Nightshift shift reconciles nightly
                  → Cortex L10-L50 entries updated
                  → Qdrant vector index reconciled
                  → MCP Server feeds updated context back to agents
                  → Agents write better code
```

**Core value:** If it's bullet-fast, agents can use it for real-time detailed knowledge of the
entire system — not just high-level context loading but surgical per-query retrieval.

## When to Surface

**Trigger:** When v2.0 Agent Dashboard milestone closes AND the next milestone is being scoped.
Also surface if any milestone touches: agent memory, knowledge persistence, Cortex vault
structure, vector search, or MCP tool expansion.

This seed should be presented during `/gsd:new-milestone` when:
- Milestone name/scope mentions "memory", "knowledge", "cortex", "search", "intelligence"
- v2.0 is complete (all 6 phases done)
- User is planning a new major milestone for NanoClaw

## Scope Estimate

**Large** — full milestone (v3.0), likely 8-12 phases:
1. Cortex schema standardization (YAML frontmatter, L10-L50 pyramid adapted to NanoClaw domains)
2. Qdrant deployment (Docker container, collection schema, embedding pipeline)
3. Cortex MCP tools in containers (`cortex_search`, `cortex_write`, `cortex_read`, `cortex_relate`)
4. cortex-graph.json — explicit relationship tracking (BUILT_FROM, REFERENCES, BLOCKS)
5. Lore-protocol git trailers — agents commit with Constraint/Rejected/Directive metadata
6. Embedding pipeline — on cortex write → auto-embed → upsert to Qdrant
7. Nightly reconciliation shift (Alfred) — staleness cascade, CROSS_LINK discovery
8. MCP Server routing — vault (exact) vs Qdrant (semantic) based on query type
9. Knowledge pyramid population — bootstrap L10-L20 entries for NanoClaw codebase
10. Agent CLAUDE.md integration — agents auto-query before starting tasks

## Architecture (from NotebookLM session 2026-03-28)

**Two-level memory:**
- **Micro (Lore Protocol):** Git trailers — knowledge atoms at commit time. `Lore-id`, `Constraint:`, `Rejected:`, `Directive:`. Lives in git, no external DB. Agents query before touching code to learn what NOT to do.
- **Macro (Nightshift/Cortex):** Nightly autonomous documentation. Knowledge pyramid L10→L50. Markdown Vault (source of truth) + Qdrant (semantic index). MCP Server as the query gate.

**Knowledge Pyramid for NanoClaw:**
| Level | Domain |
|-------|--------|
| L10 | Files, channels, IPC contracts, env vars, API surfaces |
| L20 | Agent behavior patterns, scheduling, routing, embed builders |
| L30 | System topology — NanoClaw + Alfred + Friday + Discord + Cortex |
| L40 | Projects — YourWave, ContentFactory, NightShift domains |
| L50 | User journeys, recurring scenarios, edge cases encountered |

**Hybrid graph:**
- `cortex-graph.json` — explicit edges (BUILT_FROM, REFERENCES, BLOCKS) — deterministic, declared by agents
- Qdrant CROSS_LINK — implicit semantic similarity > 0.8 threshold → auto-promoted to graph

**Confidence firewall:** L(N) only builds when L(N-1) has zero stubs and medium+ confidence. Prevents hallucinations at high abstraction levels.

## Source Documents

- `/home/andrii-panasenko/Downloads/Telegram Desktop/TD-001-cortex-vault.md` — Full Cortex architecture spec
- `/home/andrii-panasenko/Downloads/Telegram Desktop/TD-008-vector-db.md` — Qdrant integration spec
- `/home/andrii-panasenko/Downloads/AI_Native_Knowledge_Architecture.pdf` — Slides: full system synthesis (Ukrainian)
- `https://github.com/Ian-stetsenko/lore-protocol` — Lore Protocol CLI (git trailers)

## Breadcrumbs in Current Codebase

- `cortex/` — existing Obsidian vault, becomes the Markdown Vault (L10-L50 entries go here)
- `cortex/CLAUDE.md` — existing shift memory, adapt to Nightshift CLAUDE.md pattern
- `cortex/Areas/` — existing area structure, maps to L40 domains
- `groups/*/CLAUDE.md` — per-group memory, complement (not replace) with Cortex MCP queries
- `container/skills/context-mode/` — existing context tools, Cortex MCP tools follow same pattern
- `container/skills/host-management/` — Alfred's skill, Nightshift shift runs via Alfred
- `src/task-scheduler.ts` — nightly reconciliation shift hooks in here
- `src/ipc.ts` — MCP tool calls from containers come through IPC

## Notes

User's exact framing: "if it bullet fast — we can use it for detailed bullet knowledge of the system"

The key bet: if Qdrant semantic search returns in <50ms and MCP overhead is low, agents can
query Cortex at the START of every task (not just once at session start) — making each
individual action informed by the full system context. This changes the quality ceiling
for autonomous agent work dramatically.

Postgres/pgvector relationship: planned for YourWave coffee (shared infra). For NanoClaw,
Qdrant as a local Docker container is simpler and purpose-built. These are independent
decisions — Qdrant for agent memory, pgvector for YourWave product data.
