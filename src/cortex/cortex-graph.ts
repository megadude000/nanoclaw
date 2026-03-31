/**
 * Cortex Knowledge Graph — schema, load/save, in-memory index, edge operations.
 *
 * Requirements covered: GRAPH-01
 *
 * JSON adjacency list stored at cortex/cortex-graph.json.
 * Entries are referenced by vault-relative path (same ID used in Qdrant).
 * Graph loads into memory for O(1) neighbor lookup via buildIndex().
 *
 * CRITICAL: This file must ONLY use dependencies available in both host and
 * container: zod, node:fs, node:path. Do NOT import from any src/ module.
 */

import { z } from 'zod';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Five canonical edge types for Cortex knowledge graph */
export const EdgeTypeSchema = z.enum([
  'BUILT_FROM',
  'REFERENCES',
  'BLOCKS',
  'CROSS_LINK',
  'SUPERSEDES',
]);

/** A single directed edge between two Cortex entries */
export const EdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  type: EdgeTypeSchema,
  created: z.string(),
});

/** Top-level graph document schema */
export const GraphSchema = z.object({
  version: z.literal(1),
  updated: z.string(),
  edges: z.array(EdgeSchema),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type CortexGraph = z.infer<typeof GraphSchema>;

/** A neighbor entry returned by index lookup */
export interface NeighborEntry {
  path: string;
  type: string;
  direction: 'outgoing' | 'incoming';
}

/** In-memory bidirectional neighbor index */
export type GraphIndex = Map<string, NeighborEntry[]>;

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

const EMPTY_GRAPH: CortexGraph = { version: 1, updated: '', edges: [] };

/**
 * Load graph from disk. Returns empty graph on ENOENT or parse/validation failure.
 */
export function loadGraph(graphPath: string): CortexGraph {
  if (!existsSync(graphPath)) {
    return { ...EMPTY_GRAPH, edges: [] };
  }
  try {
    const raw = readFileSync(graphPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return GraphSchema.parse(parsed);
  } catch {
    return { ...EMPTY_GRAPH, edges: [] };
  }
}

/**
 * Save graph to disk with atomic rename (write to .tmp, then renameSync).
 * Sets graph.updated to current ISO timestamp.
 */
export function saveGraph(graphPath: string, graph: CortexGraph): void {
  graph.updated = new Date().toISOString();
  const dir = path.dirname(graphPath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = graphPath + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(graph, null, 2), 'utf-8');
  renameSync(tmpPath, graphPath);
}

// ---------------------------------------------------------------------------
// In-memory index
// ---------------------------------------------------------------------------

/**
 * Build bidirectional neighbor index from graph edges.
 * For each edge: source gets outgoing entry, target gets incoming entry.
 */
export function buildIndex(graph: CortexGraph): GraphIndex {
  const index: GraphIndex = new Map();

  for (const edge of graph.edges) {
    // Outgoing from source
    if (!index.has(edge.source)) index.set(edge.source, []);
    index.get(edge.source)!.push({
      path: edge.target,
      type: edge.type,
      direction: 'outgoing',
    });

    // Incoming to target
    if (!index.has(edge.target)) index.set(edge.target, []);
    index.get(edge.target)!.push({
      path: edge.source,
      type: edge.type,
      direction: 'incoming',
    });
  }

  return index;
}

/**
 * Get all neighbors for an entry path. Returns empty array if not in index.
 */
export function getNeighbors(
  index: GraphIndex,
  entryPath: string,
): NeighborEntry[] {
  return index.get(entryPath) ?? [];
}

// ---------------------------------------------------------------------------
// Edge operations
// ---------------------------------------------------------------------------

/**
 * Check if an edge with given source+target+type exists in the graph.
 */
export function hasEdge(
  graph: CortexGraph,
  source: string,
  target: string,
  type: string,
): boolean {
  return graph.edges.some(
    (e) => e.source === source && e.target === target && e.type === type,
  );
}

/**
 * Add an edge to the graph. Returns false if:
 * - source === target (self-edge)
 * - duplicate edge (same source+target+type) already exists
 * Returns true and appends edge on success.
 */
export function addEdge(graph: CortexGraph, edge: Edge): boolean {
  if (edge.source === edge.target) return false;
  if (hasEdge(graph, edge.source, edge.target, edge.type)) return false;
  graph.edges.push(edge);
  return true;
}
