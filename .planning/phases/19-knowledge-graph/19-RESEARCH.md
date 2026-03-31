# Phase 19: Knowledge Graph - Research

**Researched:** 2026-03-31
**Domain:** JSON adjacency list knowledge graph with MCP tool integration
**Confidence:** HIGH

## Summary

Phase 19 adds explicit typed relationships between Cortex entries via a `cortex-graph.json` file, a `cortex_relate` MCP tool for agents to declare edges, and graph-augmented search results in `cortex_search`. The scope is narrow: one new JSON file, one new MCP tool, and a modification to the existing search handler.

The graph data structure is a simple JSON adjacency list with edges array -- not a graph database. At ~200 vault files and an expected edge count well under 500, the entire graph loads into memory trivially. The graph file lives at `cortex/cortex-graph.json`, is git-tracked, and follows the same Zod-validated JSON config pattern as `config/routing.json`.

**Primary recommendation:** Load cortex-graph.json into memory at MCP server startup in the container. cortex_relate writes via IPC to the host (same pattern as cortex_write). Host appends the edge to the JSON file and the fs.watch watcher or a manual reload refreshes the in-memory copy. cortex_search reads neighbors from the in-memory graph and appends them to search results.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all areas designated as Claude's Discretion.

### Claude's Discretion
- Edge types and semantics (which types, fixed enum vs custom, directionality)
- Graph data structure (JSON schema, file location, caching strategy, git tracking)
- cortex_relate tool design (parameters, IPC vs direct write, validation)
- Search integration (how 1-hop neighbors appear in results, format, performance)

### Deferred Ideas (OUT OF SCOPE)
- CROSS_LINK auto-discovery (semantic similarity) -- Phase 21 Nightshift
- Graph visualization -- out of scope (Obsidian graph view exists for humans)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRAPH-01 | cortex-graph.json stores explicit edges (BUILT_FROM, REFERENCES, BLOCKS, CROSS_LINK) | JSON adjacency list schema with typed edges, Zod validation, 5 edge types defined |
| GRAPH-02 | Graph queryable from cortex_search results (traverse related entries) | 1-hop neighbor lookup from in-memory graph, appended to search results as `related` array |
| MCP-04 | cortex_relate tool available in container agents -- declare graph edges between entries | New MCP tool in ipc-mcp-stdio.ts using IPC write pattern, host-side handler in ipc.ts |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6 | Validate cortex-graph.json schema | Already in project, same pattern as routing.json |
| better-sqlite3 | ^11.8.1 | NOT NEEDED this phase | Graph stays JSON until >500 edges |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | built-in | Read/write cortex-graph.json | Host-side graph file management |
| node:path | built-in | Resolve graph file path | Both container and host |
| node:crypto | built-in | Edge dedup via hash (optional) | If deduplication by content hash is preferred over source+target+type key |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON file | SQLite table | Only worth it at >500 edges; adds query complexity for no benefit at current scale |
| JSON file | Neo4j/ArangoDB | Massively overkill -- see REQUIREMENTS.md Out of Scope |
| In-memory Map | Disk reads per search | Unacceptable latency; graph must be in memory |

**Installation:**
```bash
# No new dependencies needed -- all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure
```
cortex/
  cortex-graph.json           # NEW: typed edges between entries
src/cortex/
  cortex-graph.ts             # NEW: graph schema, load/save, in-memory operations
  cortex-graph.test.ts        # NEW: unit tests
  cortex-mcp-tools.ts         # MODIFIED: add buildRelateHandler + graph neighbor lookup in search
  cortex-mcp-tools.test.ts    # MODIFIED: add cortex_relate + graph-augmented search tests
container/agent-runner/src/
  ipc-mcp-stdio.ts            # MODIFIED: register cortex_relate tool + load graph for search
src/
  ipc.ts                      # MODIFIED: handle cortex_relate IPC messages
```

### Pattern 1: cortex-graph.json Schema

**What:** JSON adjacency list with version, updated timestamp, and edges array. No separate nodes object -- entries already exist in the vault and Qdrant. Edges reference entries by their vault-relative path (same ID used everywhere).

**When to use:** Always -- this is the canonical graph format.

**Example:**
```json
{
  "version": 1,
  "updated": "2026-03-31T12:00:00Z",
  "edges": [
    {
      "source": "Areas/Projects/YourWave/yw.platform-spec.md",
      "target": "Areas/Projects/YourWave/YourWave.md",
      "type": "BUILT_FROM",
      "created": "2026-03-31T12:00:00Z"
    }
  ]
}
```

**Design decisions:**
- **No `nodes` object** -- The original ARCHITECTURE.md research proposed a `nodes` object, but this duplicates data already in Qdrant payloads and vault frontmatter. Edges reference entries by path; entry metadata lives in its canonical source. This prevents staleness where node metadata in the graph drifts from the actual entry.
- **Edges as array, not adjacency map** -- An array of edge objects is simpler to append, validate, and serialize. For <500 edges, O(n) scan is negligible. An adjacency map (keyed by source) would only help at >1000 edges.
- **Vault-relative paths as IDs** -- Consistent with Qdrant `file_path` payload, cortex_read path parameter, and cortex_search result paths.
- **ISO timestamps** -- `created` on each edge for audit trail, `updated` at top level for cache invalidation.

### Pattern 2: Edge Type Enum (Fixed, Not Arbitrary)

**What:** Five fixed edge types as a Zod enum. No custom/arbitrary types.

**When to use:** All edges must use one of these types.

```typescript
const EdgeTypeSchema = z.enum([
  'BUILT_FROM',   // Implementation derived from spec/plan
  'REFERENCES',   // Cites or depends on
  'BLOCKS',       // Blocked by / prerequisite
  'CROSS_LINK',   // Related across projects or domains
  'SUPERSEDES',   // Newer version replaces older
]);
```

**Why fixed enum:** Arbitrary edge types would create a proliferation problem -- agents would invent types like "INSPIRED_BY", "SIMILAR_TO", "MAYBE_RELATED" that are meaningless noise. A fixed enum forces intentional edge creation. Phase 21 Nightshift auto-discovers CROSS_LINK edges only. New types can be added to the enum in future phases.

**Directionality:** All edges are directed (source -> target). The semantic meaning flows from source to target:
- `A --BUILT_FROM--> B` means A was built from B
- `A --REFERENCES--> B` means A references B
- `A --BLOCKS--> B` means A is blocked by B
- `A --CROSS_LINK--> B` means A is cross-linked to B (bidirectional semantically, but stored as one directed edge)
- `A --SUPERSEDES--> B` means A supersedes B

For 1-hop neighbor lookup, traverse both directions (outgoing from source AND incoming to target) to find all related entries.

### Pattern 3: cortex_relate via IPC (Same as cortex_write)

**What:** The `cortex_relate` MCP tool writes an IPC file to the host, and the host-side handler appends the edge to cortex-graph.json. The container does NOT write directly to the graph file.

**Why IPC, not direct write:** cortex-graph.json lives on the host filesystem. The container has a read-only mount of cortex/. Writes must go through IPC, exactly like cortex_write. This is a locked architectural pattern from Phase 17 (all container-to-host mutations use IPC).

**IPC message format:**
```json
{
  "type": "cortex_relate",
  "source": "Areas/Projects/NanoClaw/ipc-design.md",
  "target": "Areas/Projects/NanoClaw/container-runner.md",
  "edge_type": "REFERENCES",
  "groupFolder": "main",
  "timestamp": "2026-03-31T12:00:00Z"
}
```

### Pattern 4: Graph-Augmented Search Results

**What:** After cortex_search returns semantic results from Qdrant, look up 1-hop neighbors for each result in the in-memory graph. Append neighbors as a `related` array on each result object.

**Result format enhancement:**
```json
[
  {
    "path": "Areas/Projects/NanoClaw/ipc-design.md",
    "score": 0.89,
    "level": "L20",
    "domain": "nanoclaw",
    "project": "nanoclaw",
    "related": [
      {
        "path": "Areas/Projects/NanoClaw/container-runner.md",
        "edge_type": "REFERENCES",
        "direction": "outgoing"
      },
      {
        "path": "Areas/Projects/NanoClaw/NanoClaw.md",
        "edge_type": "BUILT_FROM",
        "direction": "incoming"
      }
    ]
  }
]
```

**Performance:** Graph is in memory. For 5 search results with <500 total edges, neighbor lookup is sub-millisecond. No performance concern.

**Empty graph handling:** If cortex-graph.json does not exist or has no edges, search results return without `related` arrays. The feature degrades gracefully.

### Pattern 5: In-Memory Graph with File Persistence

**What:** Load cortex-graph.json into a Map-based index at startup. All reads are from memory. Writes append to the array and persist to disk atomically (temp file + rename, same as writeIpcFile pattern).

**Container side:** The container reads cortex-graph.json from the read-only mount at `/workspace/cortex/cortex-graph.json` and builds an in-memory index at MCP server startup. This is read-only in the container -- graph mutation goes through IPC.

**Host side:** The IPC handler in ipc.ts loads the graph, appends the edge (with dedup check), and writes it back atomically.

**In-memory index structure:**
```typescript
// Efficient lookup: given an entry path, find all edges it participates in
type GraphIndex = Map<string, Array<{ target: string; type: string; direction: 'outgoing' | 'incoming' }>>;
```

Build from edges array at load time. For each edge: add outgoing entry for source, add incoming entry for target.

### Anti-Patterns to Avoid
- **Separate graph database:** No Neo4j, no SQLite table. JSON file until >500 edges.
- **Arbitrary edge types:** Fixed enum only. Agents cannot invent edge types.
- **Direct file write from container:** Must use IPC. Container has read-only cortex mount.
- **Eager graph validation against vault:** Do NOT verify both source and target entries exist in the vault at edge creation time inside the container. The container has a read-only mount that may be stale. Validation is best-effort: check format, not existence.
- **Graph traversal deeper than 1-hop:** Only 1-hop neighbors in search results. Deeper traversal adds complexity for marginal value at this scale.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph database | Neo4j/ArangoDB setup | JSON file + in-memory Map | <500 entries, fits in memory, git-tracked |
| Graph query language | Cypher/SPARQL parser | Direct Map lookup | Only need 1-hop traversal, not arbitrary queries |
| Atomic JSON writes | Custom locking mechanism | temp-file + fs.renameSync | Same pattern as writeIpcFile, atomic on POSIX |
| Edge deduplication | Hash-based dedup system | source+target+type triple check | Simple linear scan on <500 edges |

**Key insight:** The entire knowledge graph is a <100KB JSON file with <500 edges. Every operation is trivially fast with the simplest possible data structure. Optimization is premature and harmful at this scale.

## Common Pitfalls

### Pitfall 1: Dangling Edge References
**What goes wrong:** An entry is deleted from the vault, but edges referencing it remain in cortex-graph.json. Agents traverse to a non-existent entry.
**Why it happens:** No cascading delete mechanism. cortex-graph.json is independent of the vault filesystem.
**How to avoid:** In this phase: do NOT try to solve this. Phase 21 Nightshift reconciliation will clean orphan edges. For now, cortex_search neighbor lookup simply skips entries that don't exist in Qdrant results (graceful degradation). If a related entry path has no Qdrant point, omit it from the `related` array.
**Warning signs:** `related` entries in search results that return 404 on cortex_read.

### Pitfall 2: cortex-graph.json Write Contention
**What goes wrong:** Two concurrent agent containers both call cortex_relate. The host-side IPC handler processes both, leading to a read-modify-write race condition on the JSON file.
**Why it happens:** Multiple IPC files arrive in quick succession. The host processes them sequentially (via the existing IPC poll loop), but if processing is interleaved, one write could clobber another.
**How to avoid:** The existing IPC poll loop in ipc.ts processes files sequentially in a single-threaded event loop. As long as the cortex_relate handler is synchronous (readFileSync -> modify -> writeFileSync), Node.js single-threading prevents interleaving. Do NOT use async file operations for graph writes.
**Warning signs:** Edges appearing and disappearing intermittently.

### Pitfall 3: MCP Tool Count Ceiling
**What goes wrong:** Adding cortex_relate as the 15th MCP tool (11 existing + 3 cortex + 1 new) starts to confuse agents on tool selection.
**Why it happens:** More tools = more competition for the model's tool-selection attention.
**How to avoid:** cortex_relate is the only new tool this phase. Total count goes from 14 to 15 (11 original + cortex_search/read/write from Phase 17 + cortex_relate). This is within acceptable limits. The tool description must be clear and distinct from cortex_write: "Declare a relationship between two Cortex entries" vs "Create or update a Cortex entry."
**Warning signs:** Agent calling cortex_write when it means cortex_relate, or vice versa.

### Pitfall 4: Graph File Not Existing on First Run
**What goes wrong:** cortex_search tries to load cortex-graph.json, file doesn't exist, throws ENOENT error and search fails entirely.
**Why it happens:** First deployment has no graph file. Or file is gitignored and not present after clone.
**How to avoid:** Graph load function returns an empty graph `{ version: 1, updated: "", edges: [] }` when the file does not exist. Search continues normally, just with no graph neighbors. The file is created on the first cortex_relate call.
**Warning signs:** Search errors on fresh installations.

### Pitfall 5: Stale In-Memory Graph in Container
**What goes wrong:** Container loads graph at startup. Agent creates new edges via cortex_relate (IPC). The host writes them to disk. But the container's in-memory graph is stale -- it doesn't see the new edges.
**Why it happens:** Container MCP server loads the graph file once at startup. There's no mechanism to reload it during the container's lifetime.
**How to avoid:** Accept this limitation for Phase 19. A container session typically lasts minutes. New edges created by one agent become visible to the next agent session. For the current use case (agents declaring relationships during task work), this is acceptable -- the agent that created the edge knows it exists, and subsequent agents will see it.
**Warning signs:** Agent creates an edge, immediately searches, doesn't see the edge in related results. This is expected behavior, not a bug.

## Code Examples

### cortex-graph.ts -- Schema and Load/Save
```typescript
// src/cortex/cortex-graph.ts
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const EdgeTypeSchema = z.enum([
  'BUILT_FROM',
  'REFERENCES',
  'BLOCKS',
  'CROSS_LINK',
  'SUPERSEDES',
]);

export const EdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  type: EdgeTypeSchema,
  created: z.string(),
});

export const GraphSchema = z.object({
  version: z.literal(1),
  updated: z.string(),
  edges: z.array(EdgeSchema),
});

export type Edge = z.infer<typeof EdgeSchema>;
export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export type CortexGraph = z.infer<typeof GraphSchema>;

const EMPTY_GRAPH: CortexGraph = { version: 1, updated: '', edges: [] };

export function loadGraph(graphPath: string): CortexGraph {
  if (!existsSync(graphPath)) return { ...EMPTY_GRAPH, edges: [] };
  const raw = JSON.parse(readFileSync(graphPath, 'utf-8'));
  const result = GraphSchema.safeParse(raw);
  if (!result.success) return { ...EMPTY_GRAPH, edges: [] };
  return result.data;
}

export function saveGraph(graphPath: string, graph: CortexGraph): void {
  graph.updated = new Date().toISOString();
  const dir = path.dirname(graphPath);
  mkdirSync(dir, { recursive: true });
  const tmp = graphPath + '.tmp';
  writeFileSync(tmp, JSON.stringify(graph, null, 2));
  // Atomic rename
  const fs = require('node:fs');
  fs.renameSync(tmp, graphPath);
}

// In-memory index for fast neighbor lookup
export type NeighborEntry = { path: string; type: string; direction: 'outgoing' | 'incoming' };
export type GraphIndex = Map<string, NeighborEntry[]>;

export function buildIndex(graph: CortexGraph): GraphIndex {
  const idx: GraphIndex = new Map();
  for (const edge of graph.edges) {
    if (!idx.has(edge.source)) idx.set(edge.source, []);
    idx.get(edge.source)!.push({ path: edge.target, type: edge.type, direction: 'outgoing' });

    if (!idx.has(edge.target)) idx.set(edge.target, []);
    idx.get(edge.target)!.push({ path: edge.source, type: edge.type, direction: 'incoming' });
  }
  return idx;
}

export function getNeighbors(index: GraphIndex, entryPath: string): NeighborEntry[] {
  return index.get(entryPath) ?? [];
}

export function hasEdge(graph: CortexGraph, source: string, target: string, type: string): boolean {
  return graph.edges.some(e => e.source === source && e.target === target && e.type === type);
}

export function addEdge(graph: CortexGraph, edge: Edge): boolean {
  if (hasEdge(graph, edge.source, edge.target, edge.type)) return false;
  if (edge.source === edge.target) return false; // no self-edges
  graph.edges.push(edge);
  return true;
}
```

### cortex_relate MCP Tool Registration (container side)
```typescript
// In ipc-mcp-stdio.ts -- follows exact same pattern as cortex_write
server.tool(
  'cortex_relate',
  'Declare a typed relationship between two Cortex entries. Edge types: BUILT_FROM (implementation from spec), REFERENCES (cites/depends), BLOCKS (prerequisite), CROSS_LINK (related across domains), SUPERSEDES (newer replaces older).',
  {
    source: z.string().describe('Source entry vault path (e.g. "Areas/Projects/NanoClaw/ipc-design.md")'),
    target: z.string().describe('Target entry vault path'),
    edge_type: z.enum(['BUILT_FROM', 'REFERENCES', 'BLOCKS', 'CROSS_LINK', 'SUPERSEDES'])
      .describe('Relationship type from source to target'),
  },
  async (args) => {
    // Basic validation
    if (args.source === args.target) {
      return { content: [{ type: 'text' as const, text: 'Error: self-edges not allowed' }], isError: true };
    }

    writeIpcFile(MESSAGES_DIR, {
      type: 'cortex_relate',
      source: args.source,
      target: args.target,
      edge_type: args.edge_type,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    return { content: [{ type: 'text' as const, text: `Edge declared: ${args.source} --${args.edge_type}--> ${args.target}` }] };
  },
);
```

### Host-Side IPC Handler (in ipc.ts)
```typescript
// Inside the IPC processing loop, after cortex_write handler:
} else if (data.type === 'cortex_relate' && data.source && data.target && data.edge_type) {
  const graphPath = path.join(process.cwd(), 'cortex', 'cortex-graph.json');
  const graph = loadGraph(graphPath);
  const added = addEdge(graph, {
    source: data.source as string,
    target: data.target as string,
    type: data.edge_type as string,
    created: new Date().toISOString(),
  });
  if (added) {
    saveGraph(graphPath, graph);
    logger.info({ source: data.source, target: data.target, type: data.edge_type }, 'cortex_relate: edge added');
  } else {
    logger.info({ source: data.source, target: data.target, type: data.edge_type }, 'cortex_relate: edge already exists or self-edge');
  }
}
```

### Search Result Graph Augmentation (container side)
```typescript
// In the cortex_search handler, after Qdrant results are formatted:
// Load graph index (done once at MCP server startup, reused across calls)
const graphIndex = buildIndex(loadGraph('/workspace/cortex/cortex-graph.json'));

// Augment each result with 1-hop neighbors
const formatted = results.map((r) => ({
  path: r.payload?.file_path,
  score: r.score,
  level: r.payload?.cortex_level,
  domain: r.payload?.domain,
  project: r.payload?.project,
  related: getNeighbors(graphIndex, r.payload?.file_path as string),
}));
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (latest, already configured) |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npx vitest run src/cortex/cortex-graph.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPH-01 | cortex-graph.json stores typed edges with validation | unit | `npx vitest run src/cortex/cortex-graph.test.ts -x` | No -- Wave 0 |
| GRAPH-01 | Edge types are a fixed enum (5 types) | unit | `npx vitest run src/cortex/cortex-graph.test.ts -x` | No -- Wave 0 |
| GRAPH-01 | Dedup: same source+target+type not added twice | unit | `npx vitest run src/cortex/cortex-graph.test.ts -x` | No -- Wave 0 |
| GRAPH-01 | Self-edges rejected | unit | `npx vitest run src/cortex/cortex-graph.test.ts -x` | No -- Wave 0 |
| GRAPH-01 | Empty/missing file returns empty graph | unit | `npx vitest run src/cortex/cortex-graph.test.ts -x` | No -- Wave 0 |
| GRAPH-02 | cortex_search results include related array with 1-hop neighbors | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts -x` | No -- new tests in existing file |
| GRAPH-02 | Empty graph produces results without related entries | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts -x` | No -- new tests in existing file |
| MCP-04 | cortex_relate tool validates params and writes IPC | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts -x` | No -- new tests in existing file |
| MCP-04 | cortex_relate rejects self-edges | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts -x` | No -- new tests in existing file |

### Sampling Rate
- **Per task commit:** `npx vitest run src/cortex/cortex-graph.test.ts src/cortex/cortex-mcp-tools.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/cortex/cortex-graph.test.ts` -- covers GRAPH-01 (schema, load/save, dedup, self-edge, empty file)
- [ ] New test cases in `src/cortex/cortex-mcp-tools.test.ts` -- covers GRAPH-02, MCP-04 (relate tool, graph-augmented search)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No relationships between entries | JSON adjacency list | Phase 19 | Agents discover connected context beyond keyword similarity |
| cortex_search returns isolated results | Results include 1-hop graph neighbors | Phase 19 | Agents see what each entry connects to |
| 14 MCP tools in container | 15 MCP tools (adding cortex_relate) | Phase 19 | Still within manageable tool count |

## Open Questions

1. **Should cortex-graph.json be git-tracked or gitignored?**
   - What we know: Research says git-tracked (for version history and transparency). Cortex vault is git-tracked. routing.json is git-tracked.
   - Recommendation: Git-track it. It's a derived artifact but small (<100KB) and valuable to have in version history. Same decision as routing.json.

2. **Should cortex_relate validate that both entries exist?**
   - What we know: Container has read-only mount of cortex/ but may be stale. Qdrant might not have the entry yet (embedding is async).
   - Recommendation: Do NOT validate existence. Accept the edge optimistically. Dangling references are cleaned up by Phase 21 Nightshift. Validation would add latency and fragility for minimal benefit.

3. **How does the container refresh its in-memory graph mid-session?**
   - What we know: Container loads graph at startup. New edges via IPC are written to host disk but container copy is stale.
   - Recommendation: Accept staleness for Phase 19. Container sessions are short-lived. Future improvement: reload graph from disk periodically or on a signal, but not worth the complexity now.

## Sources

### Primary (HIGH confidence)
- `container/agent-runner/src/ipc-mcp-stdio.ts` -- Existing MCP server pattern, 14 tools, writeIpcFile pattern
- `src/cortex/cortex-mcp-tools.ts` -- Existing search/read/write handler factories with DI
- `src/ipc.ts` -- Existing cortex_write IPC handler pattern (lines 126-143)
- `src/webhook-router.ts` -- Existing Zod-validated JSON config pattern (routing.json)
- `.planning/research/ARCHITECTURE.md` -- cortex-graph.json schema design (lines 228-274)
- `.planning/research/PITFALLS.md` -- Graph-specific pitfalls (write contention, growth, dangling refs)
- `.planning/research/FEATURES.md` -- Edge types, graph as differentiator feature

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` lines 181-207 -- Performance traps and migration thresholds

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns established in prior phases
- Architecture: HIGH -- follows exact same IPC + MCP tool + Zod validation patterns from Phase 17
- Pitfalls: HIGH -- well-documented in prior research, specific to this project's scale and patterns

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external dependencies or fast-moving libraries)
