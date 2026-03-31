---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: Cortex knowledge graph - cortex-graph.json schema, edge types, graph-augmented search, cross-link discovery
project: nanoclaw
tags: [nanoclaw, cortex, knowledge-graph, graph, edges, cross-link, search]
created: 2026-03-31
---

# Cortex — Knowledge Graph

## What the Graph Is

The Cortex knowledge graph is a JSON file (`cortex/cortex-graph.json`) that stores typed directional edges between vault entries. It is separate from the Qdrant vector store: Qdrant handles semantic similarity; the graph handles explicit declared relationships. Together they provide two complementary search modes: semantic similarity and structured navigation.

The graph is loaded into memory at MCP server startup as a `GraphIndex` (a `Map<string, NeighborEntry[]>`) for O(1) neighbor lookup. It's read-only during the session and updated only when `cortex_relate` IPC messages are processed by the host.

## Schema (cortex-graph.json)

```json
{
  "version": 1,
  "generated": "2026-03-31T00:00:00.000Z",
  "nodes": ["Areas/Projects/Foo/bar.md", ...],
  "edges": [
    {
      "source": "Areas/Projects/Foo/bar.md",
      "target": "Areas/Projects/Foo/hub.md",
      "edge_type": "REFERENCES",
      "created": "2026-03-31T00:00:00.000Z"
    }
  ]
}
```

Saved atomically: written to `.tmp` then renamed to prevent partial-write corruption on crash.

## Edge Types

Five edge types (Zod enum, fixed set — not extensible without a schema change):

| Type | Meaning |
|------|---------|
| `BUILT_FROM` | Implementation was built from this spec/decision |
| `REFERENCES` | Cites or depends on the target entry |
| `BLOCKS` | Target is a prerequisite for source |
| `CROSS_LINK` | Related across domains (discovered semantically by reconciler) |
| `SUPERSEDES` | Newer entry replaces the target entry |

Edge deduplication: `addEdge()` rejects duplicate (source, target, type) triples silently. Self-edges (source === target) are also rejected.

The index is bidirectional: each edge creates both an outgoing entry (under the source key) and an incoming entry (under the target key), enabling both "what does this entry point to" and "what points to this entry" queries in O(1).

## Graph-Augmented Search

When `cortex_search` returns results, each result is enriched with a `related` array containing 1-hop neighbors from the graph index. This surfaces explicitly declared relationships that might have lower semantic similarity than the threshold but are structurally important.

Example: searching for "IPC protocol" returns `ipc-protocol.md`. The graph augmentation adds `container-isolation.md` (RELATES_TO edge) to the result's `related` array, even if the isolation entry doesn't appear in the top-5 semantic results.

The related array is only included when neighbors exist — empty arrays are omitted for cleaner output.

## Cross-Link Discovery: discoverCrossLinks

The reconciler's `discoverCrossLinks()` function finds semantically similar pairs that aren't already explicitly linked. It:
1. Scrolls all Qdrant points
2. For each point, searches for vectors within **cosine distance threshold 0.85**
3. Filters: skip self-matches, skip pairs already connected by any edge (via `hasEdge`)
4. Creates `CROSS_LINK` edges for qualifying pairs
5. Cap: `MAX_LINKS_PER_ENTRY = 3` new CROSS_LINKs per entry per reconciliation run

The 0.85 threshold was chosen to catch strongly related but not identical entries. Lower thresholds produce too many spurious links; higher thresholds miss legitimate relationships.

The cap of 3 prevents graph explosion in high-similarity clusters (e.g., 20 articles all about coffee origins would otherwise all get cross-linked to each other, creating 380 edges).

## When the Graph Is Updated

- **Manual**: `cortex_relate` IPC message or MCP tool call from an agent
- **Automatic**: `discoverCrossLinks()` during Night Shift reconciliation (runs as Step 2 of `runReconciliation()`)

The graph is NOT updated during `cortex_write` — writing an entry doesn't automatically create any edges. Edges must be declared explicitly or discovered by the reconciler.

## Container Graph Loading

Containers cannot import from the host's `src/cortex/` (different filesystem context). Container agents that need graph access use an inline `loadGraphIndex()` function in the container's MCP server (`container/agent-runner/src/ipc-mcp-stdio.ts`) that reads the graph JSON at startup from the mounted vault path. The graph is loaded once and is read-only during the container session — changes made by the host during the session are not reflected until the next container spawn.
