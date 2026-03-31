---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: Cortex reconciliation pipeline - 4 steps, TTLs, staleness detection, orphan detection, trigger mechanism
project: nanoclaw
tags: [nanoclaw, cortex, reconciliation, staleness, orphan, nightshift, qdrant]
created: 2026-03-31
---

# Cortex — Reconciliation Pipeline

## Purpose

The reconciliation pipeline keeps the Cortex knowledge base healthy over time. Vault files accumulate, entries go stale, relationships that should exist don't, and orphaned files with no connections and bad frontmatter waste search space. Reconciliation is the maintenance process that addresses all three: staleness, missing cross-links, and orphans.

It is triggered by Night Shift agents via the `cortex_reconcile` IPC message (as a fallback activity when no planned tasks or ideas remain in the pool). It can also be triggered manually.

## 4-Step Process (runReconciliation)

### Step 1: checkStaleness

Scans all vault `.md` files. For each file, reads the `updated` or `last_updated` or `created` frontmatter field (never file mtime — file modification times are unreliable and change on any edit, not just content updates). Compares against `STALENESS_TTLS` per `cortex_level`:

| Level | TTL |
|-------|-----|
| L10 | 14 days |
| L20 | 30 days |
| L30 | 60 days |
| L40 | 90 days |
| L50 | 180 days |

Entries without any date fields are flagged with `Infinity` staleness (always stale). Returns a list of stale entry paths — these are reported in the reconciliation summary but NOT automatically deleted or modified. The human/Night Shift agent decides what to do with stale entries.

### Step 2: discoverCrossLinks

Scrolls all Qdrant points and discovers semantically similar pairs not yet connected by any graph edge. Uses cosine similarity threshold 0.85. Creates `CROSS_LINK` edges for qualifying pairs, capped at 3 new links per entry. Writes updated graph to `cortex-graph.json` atomically.

Graceful Qdrant failure: if Qdrant is unavailable, `discoverCrossLinks` is wrapped in try/catch and the reconciliation continues with empty `newLinks`. The report reflects this gracefully.

### Step 3: findOrphans

Identifies entries that are both structurally isolated and low quality. Three conditions ALL required (to avoid false positives):
1. No graph edges (neither outgoing nor incoming) — checked via `getNeighbors()`
2. Missing or invalid frontmatter — checked via schema validation
3. Content body < 50 characters — too short to be useful

An entry with any edges, valid frontmatter, OR substantial content is NOT flagged as an orphan. The three-condition gate prevents flagging legitimate entries that simply haven't been linked yet.

### Step 4: mineLoreFromHistory (Phase 23)

Runs `mineLoreFromHistory(repoDir, cortexDir, openai, qdrant)` to extract new `Constraint/Rejected/Directive` git trailers from recent commit history and write them as `lore-atom` vault entries. This step only runs when `options.openai` and `options.repoDir` are provided — gated to avoid failures when OpenAI is unavailable.

New lore atoms written to `cortex/Lore/` are picked up by the vault watcher and embedded automatically.

## ReconciliationReport

`runReconciliation()` returns a typed report:
```typescript
{
  staleEntries: string[]    // paths of stale entries
  newLinks: Edge[]          // new CROSS_LINK edges created
  orphans: string[]         // paths of orphan entries
  loreSummary?: { decisions_extracted, files_written, files_skipped }
  runAt: string             // ISO timestamp
  durationMs: number
}
```

The report is posted to the #agents Discord channel as a purple embed by the IPC handler.

## When Triggered

- **Night Shift fallback**: agents send `cortex_reconcile` IPC when the idea pool is empty. No new cron entries needed — it integrates into the existing 21:03 planning / 23:27 execution cycle.
- **Manual trigger**: any agent or the operator can send a `cortex_reconcile` IPC message at any time.

The reconciliation does not run on a fixed schedule by default — it runs opportunistically. This was a deliberate decision: adding a separate daily reconciliation cron would create a background process that's hard to observe. Running it during Night Shift's idle time gives it visibility through the shift report.
