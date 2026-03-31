---
type: reference
cortex_level: L20
confidence: high
domain: nanoclaw
scope: cortex staleness detection and stale marking implementation
created: '2026-03-31'
updated: '2026-03-31'
---

# Cortex Stale Marking

How agents detect and handle stale Cortex entries.

## The Problem

`checkStaleness()` in the reconciler finds entries past their TTL, but previously only reported
them in the reconciliation embed — no signal was written back to the files themselves.
Agents doing `cortex_read` had no way to know an entry was stale.

## Solution: markStaleEntries()

New function in `src/cortex/reconciler.ts` that runs as Step 1b of `runReconciliation()`.
For each stale entry:
1. Reads the file with gray-matter
2. Sets `stale: true` in frontmatter
3. Writes back via `matter.stringify()` — preserves all existing fields including Obsidian ones
4. Skips files already marked `stale: true`

Returns count of files actually written. Exposed in `ReconciliationReport` as `markedStale`.

## Agent Behavior

When `cortex_read` returns an entry with `stale: true` in frontmatter:
- Treat as **low-confidence**
- Verify against current code before acting on it
- If content is still valid — rewrite via `cortex_write` on the same path
  (updated date refreshes, stale flag cleared on next reconciliation)

## TTLs by Level

| Level | TTL | Rationale |
|-------|-----|-----------|
| L10 | 14 days | Code changes fast |
| L20 | 30 days | Behavior patterns change with features |
| L30 | 60 days | System topology is more stable |
| L40 | 90 days | Project context changes slowly |
| L50 | 180 days | Experiential knowledge stays relevant longest |

## Constraint

gray-matter stringify is used (not manual YAML serialization) to preserve all existing frontmatter
fields. The source_hash does not change when only frontmatter is updated — watcher re-indexes
metadata but does not re-embed the vector (body unchanged). This means Qdrant payload will not
reflect `stale: true` — only the on-disk file does. Agents must use `cortex_read` (not just
`cortex_search` results) to see the stale flag.
