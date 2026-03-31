/**
 * Unit tests for cortex-graph.ts — Cortex Knowledge Graph module.
 *
 * Requirements covered: GRAPH-01
 *
 * Tests cover: Zod schema validation, load/save with atomic rename,
 * in-memory index for neighbor lookup, edge manipulation (add, dedup, self-edge rejection).
 *
 * Mock pattern follows cortex-mcp-tools.test.ts: vi.hoisted() + vi.mock('node:fs').
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock vars
// ---------------------------------------------------------------------------

const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockMkdirSync,
  mockRenameSync,
} = vi.hoisted(() => {
  const mockExistsSync = vi.fn();
  const mockReadFileSync = vi.fn();
  const mockWriteFileSync = vi.fn();
  const mockMkdirSync = vi.fn();
  const mockRenameSync = vi.fn();
  return {
    mockExistsSync,
    mockReadFileSync,
    mockWriteFileSync,
    mockMkdirSync,
    mockRenameSync,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  renameSync: mockRenameSync,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  EdgeTypeSchema,
  EdgeSchema,
  GraphSchema,
  loadGraph,
  saveGraph,
  buildIndex,
  getNeighbors,
  hasEdge,
  addEdge,
} from './cortex-graph.js';
import type { CortexGraph, Edge } from './cortex-graph.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    source: 'Areas/Projects/A.md',
    target: 'Areas/Projects/B.md',
    type: 'REFERENCES',
    created: '2026-03-31T00:00:00Z',
    ...overrides,
  };
}

function makeGraph(edges: Edge[] = []): CortexGraph {
  return { version: 1, updated: '2026-03-31T00:00:00Z', edges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EdgeTypeSchema', () => {
  it('validates all 5 edge types', () => {
    const types = [
      'BUILT_FROM',
      'REFERENCES',
      'BLOCKS',
      'CROSS_LINK',
      'SUPERSEDES',
    ];
    for (const t of types) {
      expect(EdgeTypeSchema.parse(t)).toBe(t);
    }
  });

  it('rejects arbitrary strings like INSPIRED_BY', () => {
    expect(() => EdgeTypeSchema.parse('INSPIRED_BY')).toThrow();
  });
});

describe('GraphSchema', () => {
  it('requires version: 1 literal', () => {
    expect(() =>
      GraphSchema.parse({ version: 2, updated: '', edges: [] }),
    ).toThrow();
  });

  it('accepts valid graph with edges', () => {
    const graph = {
      version: 1,
      updated: '2026-03-31T00:00:00Z',
      edges: [makeEdge()],
    };
    expect(() => GraphSchema.parse(graph)).not.toThrow();
  });
});

describe('loadGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty graph when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const graph = loadGraph('/cortex/cortex-graph.json');
    expect(graph).toEqual({ version: 1, updated: '', edges: [] });
  });

  it('returns empty graph when file contains invalid JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not valid json {{{');
    const graph = loadGraph('/cortex/cortex-graph.json');
    expect(graph).toEqual({ version: 1, updated: '', edges: [] });
  });

  it('returns parsed graph when file contains valid cortex-graph.json', () => {
    const validGraph = makeGraph([makeEdge()]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(validGraph));
    const graph = loadGraph('/cortex/cortex-graph.json');
    expect(graph.version).toBe(1);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe('Areas/Projects/A.md');
  });
});

describe('saveGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes JSON with updated timestamp via temp file + renameSync (atomic)', () => {
    const graph = makeGraph([makeEdge()]);
    saveGraph('/cortex/cortex-graph.json', graph);

    // mkdirSync called for parent dir
    expect(mockMkdirSync).toHaveBeenCalledWith('/cortex', { recursive: true });

    // writeFileSync called with .tmp path
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [tmpPath, content] = mockWriteFileSync.mock.calls[0];
    expect(tmpPath).toBe('/cortex/cortex-graph.json.tmp');

    // Content should be valid JSON with updated timestamp
    const parsed = JSON.parse(content as string);
    expect(parsed.version).toBe(1);
    expect(parsed.updated).toBeTruthy();
    expect(parsed.edges).toHaveLength(1);

    // renameSync for atomic write
    expect(mockRenameSync).toHaveBeenCalledWith(
      '/cortex/cortex-graph.json.tmp',
      '/cortex/cortex-graph.json',
    );
  });
});

describe('addEdge', () => {
  it('returns true and appends for new source+target+type triple', () => {
    const graph = makeGraph();
    const edge = makeEdge();
    const result = addEdge(graph, edge);
    expect(result).toBe(true);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toEqual(edge);
  });

  it('returns false for duplicate source+target+type triple (no append)', () => {
    const edge = makeEdge();
    const graph = makeGraph([edge]);
    const result = addEdge(graph, makeEdge());
    expect(result).toBe(false);
    expect(graph.edges).toHaveLength(1);
  });

  it('returns false for self-edge (source === target)', () => {
    const graph = makeGraph();
    const edge = makeEdge({ source: 'same.md', target: 'same.md' });
    const result = addEdge(graph, edge);
    expect(result).toBe(false);
    expect(graph.edges).toHaveLength(0);
  });
});

describe('hasEdge', () => {
  it('returns true for existing edge', () => {
    const edge = makeEdge();
    const graph = makeGraph([edge]);
    expect(hasEdge(graph, edge.source, edge.target, edge.type)).toBe(true);
  });

  it('returns false for non-existing edge', () => {
    const graph = makeGraph();
    expect(hasEdge(graph, 'a.md', 'b.md', 'REFERENCES')).toBe(false);
  });
});

describe('buildIndex + getNeighbors', () => {
  it('creates Map entries for both outgoing and incoming directions', () => {
    const edge = makeEdge({
      source: 'src.md',
      target: 'tgt.md',
      type: 'BUILT_FROM',
    });
    const graph = makeGraph([edge]);
    const index = buildIndex(graph);

    // Source has outgoing neighbor
    const srcNeighbors = index.get('src.md');
    expect(srcNeighbors).toBeDefined();
    expect(srcNeighbors).toContainEqual({
      path: 'tgt.md',
      type: 'BUILT_FROM',
      direction: 'outgoing',
    });

    // Target has incoming neighbor
    const tgtNeighbors = index.get('tgt.md');
    expect(tgtNeighbors).toBeDefined();
    expect(tgtNeighbors).toContainEqual({
      path: 'src.md',
      type: 'BUILT_FROM',
      direction: 'incoming',
    });
  });

  it('getNeighbors returns empty array for entry not in graph', () => {
    const graph = makeGraph();
    const index = buildIndex(graph);
    expect(getNeighbors(index, 'nonexistent.md')).toEqual([]);
  });

  it('getNeighbors returns correct neighbors with direction for connected entry', () => {
    const edges = [
      makeEdge({ source: 'hub.md', target: 'spoke1.md', type: 'REFERENCES' }),
      makeEdge({ source: 'hub.md', target: 'spoke2.md', type: 'BLOCKS' }),
      makeEdge({ source: 'other.md', target: 'hub.md', type: 'CROSS_LINK' }),
    ];
    const graph = makeGraph(edges);
    const index = buildIndex(graph);
    const neighbors = getNeighbors(index, 'hub.md');

    expect(neighbors).toHaveLength(3);
    expect(neighbors).toContainEqual({
      path: 'spoke1.md',
      type: 'REFERENCES',
      direction: 'outgoing',
    });
    expect(neighbors).toContainEqual({
      path: 'spoke2.md',
      type: 'BLOCKS',
      direction: 'outgoing',
    });
    expect(neighbors).toContainEqual({
      path: 'other.md',
      type: 'CROSS_LINK',
      direction: 'incoming',
    });
  });
});
