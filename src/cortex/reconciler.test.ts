/**
 * Unit tests for cortex reconciler -- staleness, cross-linking, orphan detection.
 *
 * All external dependencies (fs, parser, cortex-graph, Qdrant) are mocked
 * so tests run offline without live services.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  globSync: vi.fn(),
}));

vi.mock('./parser.js', () => ({
  parseCortexEntry: vi.fn(),
}));

vi.mock('./cortex-graph.js', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  addEdge: vi.fn(),
  hasEdge: vi.fn(),
  buildIndex: vi.fn(),
  getNeighbors: vi.fn(),
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./lore-mining.js', () => ({
  mineLoreFromHistory: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { globSync } from 'node:fs';
import { parseCortexEntry } from './parser.js';
import {
  loadGraph,
  saveGraph,
  addEdge,
  hasEdge,
  buildIndex,
  getNeighbors,
} from './cortex-graph.js';
import {
  checkStaleness,
  discoverCrossLinks,
  findOrphans,
  runReconciliation,
} from './reconciler.js';
import { mineLoreFromHistory } from './lore-mining.js';
import type { QdrantClient } from '@qdrant/js-client-rest';
import type OpenAI from 'openai';

const mockGlobSync = vi.mocked(globSync);
const mockMineLoreFromHistory = vi.mocked(mineLoreFromHistory);
const mockParseCortexEntry = vi.mocked(parseCortexEntry);
const mockLoadGraph = vi.mocked(loadGraph);
const mockSaveGraph = vi.mocked(saveGraph);
const mockAddEdge = vi.mocked(addEdge);
const mockHasEdge = vi.mocked(hasEdge);
const mockBuildIndex = vi.mocked(buildIndex);
const mockGetNeighbors = vi.mocked(getNeighbors);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  filePath: string,
  fm: Record<string, unknown>,
  content = 'Some body content here that is long enough to pass checks.',
  valid = true,
) {
  return {
    filePath,
    frontmatter: fm,
    content,
    sourceHash: 'abc123',
    validation: {
      valid,
      data: {
        cortex_level: fm.cortex_level ?? 'L10',
        confidence: fm.confidence ?? 'medium',
        domain: fm.domain ?? 'general',
        scope: fm.scope ?? 'project',
      },
      warnings: [],
      errors: valid ? [] : ['missing required fields'],
    },
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const emptyGraph = { version: 1 as const, updated: '', edges: [] };

// ---------------------------------------------------------------------------
// checkStaleness
// ---------------------------------------------------------------------------

describe('checkStaleness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when no .md files exist', () => {
    mockGlobSync.mockReturnValue([] as any);
    const result = checkStaleness('/cortex');
    expect(result).toEqual([]);
  });

  it('returns entry when updated date exceeds L10 TTL (14 days)', () => {
    mockGlobSync.mockReturnValue(['stale.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry('/cortex/stale.md', {
        cortex_level: 'L10',
        updated: daysAgo(20),
      }) as any,
    );

    const result = checkStaleness('/cortex');
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('/cortex/stale.md');
    expect(result[0].daysSinceUpdate).toBeGreaterThanOrEqual(20);
    expect(result[0].ttlDays).toBe(14);
  });

  it('skips entries whose updated date is within TTL', () => {
    mockGlobSync.mockReturnValue(['fresh.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry('/cortex/fresh.md', {
        cortex_level: 'L30',
        updated: daysAgo(5),
      }) as any,
    );

    const result = checkStaleness('/cortex');
    expect(result).toEqual([]);
  });

  it('flags entries with no updated/created field as stale (Infinity)', () => {
    mockGlobSync.mockReturnValue(['nodate.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry('/cortex/nodate.md', {
        cortex_level: 'L20',
      }) as any,
    );

    const result = checkStaleness('/cortex');
    expect(result).toHaveLength(1);
    expect(result[0].daysSinceUpdate).toBe(Infinity);
  });

  it('uses frontmatter updated field, not file mtime', () => {
    mockGlobSync.mockReturnValue(['fm.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry('/cortex/fm.md', {
        cortex_level: 'L10',
        updated: daysAgo(2),
      }) as any,
    );

    const result = checkStaleness('/cortex');
    // Within L10 TTL of 14 days
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// discoverCrossLinks
// ---------------------------------------------------------------------------

describe('discoverCrossLinks', () => {
  beforeEach(() => vi.clearAllMocks());

  const fakeQdrant = {
    scroll: vi.fn(),
    search: vi.fn(),
  } as any;

  it('returns empty array when Qdrant has no points', async () => {
    fakeQdrant.scroll.mockResolvedValue({ points: [], next_page_offset: null });
    mockLoadGraph.mockReturnValue(emptyGraph);

    const result = await discoverCrossLinks(fakeQdrant, '/graph.json');
    expect(result).toEqual([]);
  });

  it('creates CROSS_LINK edge when cosine score >= 0.85', async () => {
    fakeQdrant.scroll.mockResolvedValue({
      points: [
        { id: 'id1', vector: [0.1, 0.2], payload: { file_path: 'a.md' } },
      ],
      next_page_offset: null,
    });
    fakeQdrant.search.mockResolvedValue([
      { id: 'id2', score: 0.9, payload: { file_path: 'b.md' } },
    ]);
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockHasEdge.mockReturnValue(false);
    mockAddEdge.mockReturnValue(true);

    const result = await discoverCrossLinks(fakeQdrant, '/graph.json');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ source: 'a.md', target: 'b.md', score: 0.9 });
    expect(mockAddEdge).toHaveBeenCalled();
    expect(mockSaveGraph).toHaveBeenCalled();
  });

  it('skips self-matches (same file_path)', async () => {
    fakeQdrant.scroll.mockResolvedValue({
      points: [{ id: 'id1', vector: [0.1], payload: { file_path: 'a.md' } }],
      next_page_offset: null,
    });
    fakeQdrant.search.mockResolvedValue([
      { id: 'id1', score: 1.0, payload: { file_path: 'a.md' } },
    ]);
    mockLoadGraph.mockReturnValue(emptyGraph);

    const result = await discoverCrossLinks(fakeQdrant, '/graph.json');
    expect(result).toEqual([]);
    expect(mockAddEdge).not.toHaveBeenCalled();
  });

  it('skips entries that already have a CROSS_LINK edge', async () => {
    fakeQdrant.scroll.mockResolvedValue({
      points: [{ id: 'id1', vector: [0.1], payload: { file_path: 'a.md' } }],
      next_page_offset: null,
    });
    fakeQdrant.search.mockResolvedValue([
      { id: 'id2', score: 0.9, payload: { file_path: 'b.md' } },
    ]);
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockHasEdge.mockReturnValue(true);

    const result = await discoverCrossLinks(fakeQdrant, '/graph.json');
    expect(result).toEqual([]);
    expect(mockAddEdge).not.toHaveBeenCalled();
  });

  it('does not save graph when no new edges discovered', async () => {
    fakeQdrant.scroll.mockResolvedValue({
      points: [{ id: 'id1', vector: [0.1], payload: { file_path: 'a.md' } }],
      next_page_offset: null,
    });
    fakeQdrant.search.mockResolvedValue([
      { id: 'id2', score: 0.9, payload: { file_path: 'b.md' } },
    ]);
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockHasEdge.mockReturnValue(true); // already linked

    await discoverCrossLinks(fakeQdrant, '/graph.json');
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('respects MAX_LINKS_PER_ENTRY = 3', async () => {
    fakeQdrant.scroll.mockResolvedValue({
      points: [{ id: 'id1', vector: [0.1], payload: { file_path: 'a.md' } }],
      next_page_offset: null,
    });
    // Return 5 matches above threshold
    fakeQdrant.search.mockResolvedValue([
      { id: 'id2', score: 0.95, payload: { file_path: 'b.md' } },
      { id: 'id3', score: 0.93, payload: { file_path: 'c.md' } },
      { id: 'id4', score: 0.91, payload: { file_path: 'd.md' } },
      { id: 'id5', score: 0.89, payload: { file_path: 'e.md' } },
    ]);
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockHasEdge.mockReturnValue(false);
    mockAddEdge.mockReturnValue(true);

    const result = await discoverCrossLinks(fakeQdrant, '/graph.json', 0.85, 3);
    // Should only add 3 links max
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// findOrphans
// ---------------------------------------------------------------------------

describe('findOrphans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when all entries have graph edges', () => {
    mockGlobSync.mockReturnValue(['linked.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry('/cortex/linked.md', { cortex_level: 'L10' }, 'short') as any,
    );
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockBuildIndex.mockReturnValue(
      new Map([
        [
          '/cortex/linked.md',
          [
            {
              path: 'other.md',
              type: 'REFERENCES',
              direction: 'outgoing' as const,
            },
          ],
        ],
      ]),
    );
    mockGetNeighbors.mockReturnValue([
      { path: 'other.md', type: 'REFERENCES', direction: 'outgoing' as const },
    ]);

    const result = findOrphans('/cortex', '/graph.json');
    expect(result).toEqual([]);
  });

  it('returns entry with no edges, bad frontmatter, and short content', () => {
    mockGlobSync.mockReturnValue(['orphan.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry('/cortex/orphan.md', {}, 'tiny', false) as any,
    );
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockBuildIndex.mockReturnValue(new Map());
    mockGetNeighbors.mockReturnValue([]);

    const result = findOrphans('/cortex', '/graph.json');
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('/cortex/orphan.md');
    expect(result[0].reason).toBeTruthy();
  });

  it('does NOT flag entries that have edges even if frontmatter is incomplete', () => {
    mockGlobSync.mockReturnValue(['linked-bad-fm.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry('/cortex/linked-bad-fm.md', {}, 'tiny', false) as any,
    );
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockBuildIndex.mockReturnValue(new Map());
    mockGetNeighbors.mockReturnValue([
      { path: 'other.md', type: 'BUILT_FROM', direction: 'incoming' as const },
    ]);

    const result = findOrphans('/cortex', '/graph.json');
    expect(result).toEqual([]);
  });

  it('does NOT flag entries with valid frontmatter even if no edges', () => {
    mockGlobSync.mockReturnValue(['valid-fm.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry(
        '/cortex/valid-fm.md',
        {
          cortex_level: 'L20',
          confidence: 'high',
          domain: 'nanoclaw',
          scope: 'project',
        },
        'short',
        true,
      ) as any,
    );
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockBuildIndex.mockReturnValue(new Map());
    mockGetNeighbors.mockReturnValue([]);

    const result = findOrphans('/cortex', '/graph.json');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// runReconciliation
// ---------------------------------------------------------------------------

describe('runReconciliation', () => {
  beforeEach(() => vi.clearAllMocks());

  const fakeQdrant = {
    scroll: vi.fn(),
    search: vi.fn(),
  } as any;

  it('calls all 3 steps and returns ReconciliationReport', async () => {
    // checkStaleness mocks
    mockGlobSync.mockReturnValue(['stale.md'] as any);
    mockParseCortexEntry.mockReturnValue(
      makeEntry('/cortex/stale.md', {
        cortex_level: 'L10',
        updated: daysAgo(20),
      }) as any,
    );

    // discoverCrossLinks mocks
    fakeQdrant.scroll.mockResolvedValue({ points: [], next_page_offset: null });
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockBuildIndex.mockReturnValue(new Map());
    mockGetNeighbors.mockReturnValue([]);

    const report = await runReconciliation(
      '/cortex',
      '/graph.json',
      fakeQdrant,
    );
    expect(report.staleEntries).toHaveLength(1);
    expect(report.newLinks).toEqual([]);
    expect(report.orphans).toBeDefined();
    expect(report.runAt).toBeTruthy();
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles Qdrant unavailability gracefully', async () => {
    mockGlobSync.mockReturnValue([] as any);
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockBuildIndex.mockReturnValue(new Map());

    const brokenQdrant = {
      scroll: vi.fn().mockRejectedValue(new Error('Connection refused')),
      search: vi.fn(),
    } as any;

    const report = await runReconciliation(
      '/cortex',
      '/graph.json',
      brokenQdrant,
    );
    // Should still return partial report without crashing
    expect(report.newLinks).toEqual([]);
    expect(report.runAt).toBeTruthy();
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// runReconciliation — lore mining step
// ---------------------------------------------------------------------------

describe('runReconciliation — lore mining step', () => {
  const fakeQdrant = {
    scroll: vi.fn().mockResolvedValue({ points: [] }),
    search: vi.fn().mockResolvedValue([]),
  } as unknown as QdrantClient;

  const fakeOpenAI = {} as unknown as OpenAI;

  const miningSummary = {
    total_commits_scanned: 10,
    decisions_extracted: 3,
    files_written: 2,
    files_skipped: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGlobSync.mockReturnValue([]);
    mockLoadGraph.mockReturnValue(emptyGraph);
    mockBuildIndex.mockReturnValue(new Map());
    mockMineLoreFromHistory.mockResolvedValue(miningSummary);
  });

  it('calls mineLoreFromHistory when openai and repoDir are provided', async () => {
    const report = await runReconciliation('/cortex', '/graph.json', fakeQdrant, {
      openai: fakeOpenAI,
      repoDir: '/repo',
    });
    expect(mockMineLoreFromHistory).toHaveBeenCalledWith(
      '/repo',
      '/cortex',
      fakeOpenAI,
      fakeQdrant,
    );
    expect(report.loreSummary).toEqual(miningSummary);
  });

  it('sets loreSummary undefined when options have no openai', async () => {
    const report = await runReconciliation('/cortex', '/graph.json', fakeQdrant, {
      repoDir: '/repo',
    });
    expect(mockMineLoreFromHistory).not.toHaveBeenCalled();
    expect(report.loreSummary).toBeUndefined();
  });

  it('handles mineLoreFromHistory failure gracefully — returns report with loreSummary undefined', async () => {
    mockMineLoreFromHistory.mockRejectedValue(new Error('git failure'));
    const report = await runReconciliation('/cortex', '/graph.json', fakeQdrant, {
      openai: fakeOpenAI,
      repoDir: '/repo',
    });
    expect(report.loreSummary).toBeUndefined();
    expect(report.staleEntries).toBeDefined();
  });

  it('does not call mineLoreFromHistory when no options provided (backward compat)', async () => {
    const report = await runReconciliation('/cortex', '/graph.json', fakeQdrant);
    expect(mockMineLoreFromHistory).not.toHaveBeenCalled();
    expect(report.loreSummary).toBeUndefined();
  });
});
