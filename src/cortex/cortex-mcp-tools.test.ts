/**
 * Unit tests for Cortex MCP tool logic functions.
 *
 * Requirements covered: SEARCH-01, SEARCH-02, SEARCH-03, MCP-01, MCP-02, MCP-03
 *
 * Tests are in RED state — they import from ./cortex-mcp-tools.ts which does not yet exist.
 * Plan 02 implements the module to turn these GREEN.
 *
 * Mock pattern follows embedder.test.ts: vi.hoisted() + vi.mock() for all external deps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock vars (must be declared with vi.hoisted before vi.mock calls)
// ---------------------------------------------------------------------------

const { mockQdrantSearch, mockQdrantScroll, mockEmbeddingsCreate, mockFsExistsSync, mockFsReadFileSync, mockWriteIpcFn } =
  vi.hoisted(() => {
    const mockQdrantSearch = vi.fn();
    const mockQdrantScroll = vi.fn();
    const mockEmbeddingsCreate = vi.fn().mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });
    const mockFsExistsSync = vi.fn().mockReturnValue(true);
    const mockFsReadFileSync = vi.fn().mockReturnValue('---\ncortex_level: L10\nconfidence: medium\ndomain: nanoclaw\nscope: architecture\n---\ntest content');
    const mockWriteIpcFn = vi.fn();
    return {
      mockQdrantSearch,
      mockQdrantScroll,
      mockEmbeddingsCreate,
      mockFsExistsSync,
      mockFsReadFileSync,
      mockWriteIpcFn,
    };
  });

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: vi.fn().mockImplementation(() => ({
    search: mockQdrantSearch,
    scroll: mockQdrantScroll,
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: mockEmbeddingsCreate,
    },
  })),
}));

vi.mock('node:fs', () => ({
  existsSync: mockFsExistsSync,
  readFileSync: mockFsReadFileSync,
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  buildSearchHandler,
  buildReadHandler,
  buildWriteHandler,
  isVaultPath,
  checkConfidenceFirewall,
} from './cortex-mcp-tools.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockQdrant() {
  return {
    search: mockQdrantSearch,
    scroll: mockQdrantScroll,
  };
}

function makeMockOpenAI() {
  return {
    embeddings: {
      create: mockEmbeddingsCreate,
    },
  };
}

const VAULT_ROOT = '/workspace/cortex';

// ---------------------------------------------------------------------------
// isVaultPath (pure helper)
// ---------------------------------------------------------------------------

describe('isVaultPath', () => {
  it('returns true for .md extension', () => {
    expect(isVaultPath('Areas/Projects/NanoClaw/architecture.md')).toBe(true);
  });

  it('returns true for Areas/ prefix', () => {
    expect(isVaultPath('Areas/Projects/NanoClaw/decisions.md')).toBe(true);
  });

  it('returns true for Calendar/ prefix', () => {
    expect(isVaultPath('Calendar/Daily/2026-03-30.md')).toBe(true);
  });

  it('returns true for System/ prefix', () => {
    expect(isVaultPath('System/config.md')).toBe(true);
  });

  it('returns false for natural language query', () => {
    expect(isVaultPath('how does the IPC watcher work')).toBe(false);
  });

  it('returns false for short query without special patterns', () => {
    expect(isVaultPath('ipc design')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MCP-01 / SEARCH-01: cortex_search — hybrid routing (semantic path)
// ---------------------------------------------------------------------------

describe('buildSearchHandler — MCP-01/SEARCH-01: semantic query routes to Qdrant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQdrantSearch.mockResolvedValue([
      {
        id: 'abc123',
        score: 0.92,
        payload: { file_path: 'Areas/Projects/NanoClaw/ipc.md', cortex_level: 'L20', domain: 'nanoclaw', project: 'nanoclaw' },
      },
    ]);
  });

  it('calls openai.embeddings.create once for natural language query', async () => {
    const handler = buildSearchHandler({
      qdrant: makeMockQdrant() as never,
      openai: makeMockOpenAI() as never,
      vaultRoot: VAULT_ROOT,
    });

    await handler({ query: 'how does the IPC watcher work' });

    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'how does the IPC watcher work',
    });
  });

  it('calls qdrant.search with vector and filter for semantic query', async () => {
    const handler = buildSearchHandler({
      qdrant: makeMockQdrant() as never,
      openai: makeMockOpenAI() as never,
      vaultRoot: VAULT_ROOT,
    });

    await handler({ query: 'how does the IPC watcher work' });

    expect(mockQdrantSearch).toHaveBeenCalledTimes(1);
    expect(mockQdrantSearch).toHaveBeenCalledWith(
      'cortex-entries',
      expect.objectContaining({
        vector: expect.any(Array),
        with_payload: true,
      }),
    );
  });

  it('returns array of objects with { path, score, level, domain, project }', async () => {
    const handler = buildSearchHandler({
      qdrant: makeMockQdrant() as never,
      openai: makeMockOpenAI() as never,
      vaultRoot: VAULT_ROOT,
    });

    const result = await handler({ query: 'how does the IPC watcher work' });

    expect(result).toEqual(
      expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({ type: 'text' }),
        ]),
      }),
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed[0]).toMatchObject({ path: expect.any(String), score: expect.any(Number) });
  });
});

// ---------------------------------------------------------------------------
// MCP-01 / SEARCH-01: cortex_search — hybrid routing (exact vault path)
// ---------------------------------------------------------------------------

describe('buildSearchHandler — MCP-01/SEARCH-01: vault path query routes to direct file read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFsExistsSync.mockReturnValue(true);
    mockFsReadFileSync.mockReturnValue('---\ncortex_level: L10\n---\narcitecture content');
  });

  it('does NOT call openai.embeddings.create for vault path query', async () => {
    const handler = buildSearchHandler({
      qdrant: makeMockQdrant() as never,
      openai: makeMockOpenAI() as never,
      vaultRoot: VAULT_ROOT,
    });

    await handler({ query: 'Areas/Projects/NanoClaw/architecture.md' });

    expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
  });

  it('calls fs.readFileSync with the resolved vault path for vault path query', async () => {
    const handler = buildSearchHandler({
      qdrant: makeMockQdrant() as never,
      openai: makeMockOpenAI() as never,
      vaultRoot: VAULT_ROOT,
    });

    await handler({ query: 'Areas/Projects/NanoClaw/architecture.md' });

    expect(mockFsReadFileSync).toHaveBeenCalledWith(
      `${VAULT_ROOT}/Areas/Projects/NanoClaw/architecture.md`,
      'utf-8',
    );
  });

  it('returns file content string for vault path query', async () => {
    const handler = buildSearchHandler({
      qdrant: makeMockQdrant() as never,
      openai: makeMockOpenAI() as never,
      vaultRoot: VAULT_ROOT,
    });

    const result = await handler({ query: 'Areas/Projects/NanoClaw/architecture.md' });

    expect(result.content[0].text).toContain('architecture content');
  });
});

// ---------------------------------------------------------------------------
// SEARCH-03: cortex_search — filter params
// ---------------------------------------------------------------------------

describe('buildSearchHandler — SEARCH-03: filter params build correct Qdrant filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQdrantSearch.mockResolvedValue([]);
  });

  it('builds Qdrant filter.must with project and cortex_level conditions', async () => {
    const handler = buildSearchHandler({
      qdrant: makeMockQdrant() as never,
      openai: makeMockOpenAI() as never,
      vaultRoot: VAULT_ROOT,
    });

    await handler({ query: 'ipc design', project: 'nanoclaw', cortex_level: 'L10' });

    expect(mockQdrantSearch).toHaveBeenCalledWith(
      'cortex-entries',
      expect.objectContaining({
        filter: {
          must: expect.arrayContaining([
            { key: 'project', match: { value: 'nanoclaw' } },
            { key: 'cortex_level', match: { value: 'L10' } },
          ]),
        },
      }),
    );
  });

  it('omits filter when no optional params provided', async () => {
    const handler = buildSearchHandler({
      qdrant: makeMockQdrant() as never,
      openai: makeMockOpenAI() as never,
      vaultRoot: VAULT_ROOT,
    });

    await handler({ query: 'ipc design' });

    expect(mockQdrantSearch).toHaveBeenCalledWith(
      'cortex-entries',
      expect.not.objectContaining({
        filter: expect.objectContaining({ must: expect.any(Array) }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// MCP-02: cortex_read — valid path
// ---------------------------------------------------------------------------

describe('buildReadHandler — MCP-02: valid path returns file content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFsExistsSync.mockReturnValue(true);
    mockFsReadFileSync.mockReturnValue('---\ncortex_level: L20\n---\ndecisions content');
  });

  it('calls fs.readFileSync with the correct resolved path', async () => {
    const handler = buildReadHandler({ vaultRoot: VAULT_ROOT });

    await handler({ path: 'Areas/Projects/NanoClaw/decisions.md' });

    expect(mockFsReadFileSync).toHaveBeenCalledWith(
      `${VAULT_ROOT}/Areas/Projects/NanoClaw/decisions.md`,
      'utf-8',
    );
  });

  it('returns { content: [{ type: "text", text: <file content> }] }', async () => {
    const handler = buildReadHandler({ vaultRoot: VAULT_ROOT });

    const result = await handler({ path: 'Areas/Projects/NanoClaw/decisions.md' });

    expect(result).toEqual({
      content: [{ type: 'text', text: '---\ncortex_level: L20\n---\ndecisions content' }],
    });
  });
});

// ---------------------------------------------------------------------------
// MCP-02: cortex_read — path traversal blocked
// ---------------------------------------------------------------------------

describe('buildReadHandler — MCP-02: path traversal is blocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isError: true for path traversal attempt', async () => {
    const handler = buildReadHandler({ vaultRoot: VAULT_ROOT });

    const result = await handler({ path: '../../src/config.ts' });

    expect(result.isError).toBe(true);
  });

  it('does NOT call fs.readFileSync for path traversal attempt', async () => {
    const handler = buildReadHandler({ vaultRoot: VAULT_ROOT });

    await handler({ path: '../../src/config.ts' });

    expect(mockFsReadFileSync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SEARCH-02: checkConfidenceFirewall
// ---------------------------------------------------------------------------

describe('checkConfidenceFirewall — SEARCH-02', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true (blocked) when qdrant.scroll returns empty points for L20', async () => {
    mockQdrantScroll.mockResolvedValue({ points: [] });

    const blocked = await checkConfidenceFirewall('L20', 'nanoclaw', makeMockQdrant() as never);

    expect(blocked).toBe(true);
  });

  it('returns false (allowed) when qdrant.scroll returns L10 medium+ points for L20', async () => {
    mockQdrantScroll.mockResolvedValue({ points: [{ id: 'abc' }] });

    const blocked = await checkConfidenceFirewall('L20', 'nanoclaw', makeMockQdrant() as never);

    expect(blocked).toBe(false);
  });

  it('calls qdrant.scroll with correct filter for parent level and domain', async () => {
    mockQdrantScroll.mockResolvedValue({ points: [{ id: 'abc' }] });

    await checkConfidenceFirewall('L20', 'nanoclaw', makeMockQdrant() as never);

    expect(mockQdrantScroll).toHaveBeenCalledWith(
      'cortex-entries',
      expect.objectContaining({
        filter: {
          must: expect.arrayContaining([
            { key: 'cortex_level', match: { value: 'L10' } },
            { key: 'domain', match: { value: 'nanoclaw' } },
            { key: 'confidence', match: { any: ['medium', 'high'] } },
          ]),
        },
        limit: 1,
        with_payload: false,
      }),
    );
  });

  it('returns false (allowed) for L10 without calling qdrant.scroll', async () => {
    const blocked = await checkConfidenceFirewall('L10', 'any', makeMockQdrant() as never);

    expect(blocked).toBe(false);
    expect(mockQdrantScroll).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// MCP-03: cortex_write — valid frontmatter
// ---------------------------------------------------------------------------

describe('buildWriteHandler — MCP-03: valid frontmatter queues IPC write', () => {
  const VALID_CONTENT = `---
cortex_level: L10
confidence: medium
domain: nanoclaw
scope: architecture
---
This is the body content of the Cortex test entry.`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQdrantScroll.mockResolvedValue({ points: [{ id: 'abc' }] });
  });

  it('calls writeIpc with { type: "cortex_write", path } for valid content', async () => {
    const handler = buildWriteHandler({
      qdrant: makeMockQdrant() as never,
      writeIpc: mockWriteIpcFn,
      vaultRoot: VAULT_ROOT,
    });

    await handler({ path: 'Areas/test.md', content: VALID_CONTENT });

    expect(mockWriteIpcFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cortex_write',
        path: 'Areas/test.md',
      }),
    );
  });

  it('returns success message (not isError) for valid frontmatter', async () => {
    const handler = buildWriteHandler({
      qdrant: makeMockQdrant() as never,
      writeIpc: mockWriteIpcFn,
      vaultRoot: VAULT_ROOT,
    });

    const result = await handler({ path: 'Areas/test.md', content: VALID_CONTENT });

    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain('Areas/test.md');
  });
});

// ---------------------------------------------------------------------------
// MCP-03: cortex_write — missing frontmatter fields
// ---------------------------------------------------------------------------

describe('buildWriteHandler — MCP-03: missing frontmatter fields returns error', () => {
  const MISSING_CONFIDENCE = `---
cortex_level: L10
domain: nanoclaw
scope: architecture
---
Content without confidence field.`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isError: true when confidence field is missing', async () => {
    const handler = buildWriteHandler({
      qdrant: makeMockQdrant() as never,
      writeIpc: mockWriteIpcFn,
      vaultRoot: VAULT_ROOT,
    });

    const result = await handler({ path: 'Areas/test.md', content: MISSING_CONFIDENCE });

    expect(result.isError).toBe(true);
  });

  it('does NOT call writeIpc when frontmatter validation fails', async () => {
    const handler = buildWriteHandler({
      qdrant: makeMockQdrant() as never,
      writeIpc: mockWriteIpcFn,
      vaultRoot: VAULT_ROOT,
    });

    await handler({ path: 'Areas/test.md', content: MISSING_CONFIDENCE });

    expect(mockWriteIpcFn).not.toHaveBeenCalled();
  });

  it('returns isError: true when all 4 required fields are missing', async () => {
    const handler = buildWriteHandler({
      qdrant: makeMockQdrant() as never,
      writeIpc: mockWriteIpcFn,
      vaultRoot: VAULT_ROOT,
    });

    const result = await handler({
      path: 'Areas/test.md',
      content: '---\ntitle: no cortex fields\n---\nbody',
    });

    expect(result.isError).toBe(true);
  });
});
