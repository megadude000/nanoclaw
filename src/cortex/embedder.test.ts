/**
 * Unit tests for Cortex embedder.
 *
 * All external dependencies (OpenAI, Qdrant, parseCortexEntry, fs) are mocked
 * so tests run offline without a live OpenAI key or Qdrant instance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock vars (must be declared with vi.hoisted before vi.mock calls)
// ---------------------------------------------------------------------------

const { mockMatterFn, mockMatterStringify } = vi.hoisted(() => {
  const mockMatterStringify = vi.fn();
  const mockMatterFn = vi.fn();
  // Attach stringify as a static method on the mock function
  (mockMatterFn as unknown as Record<string, unknown>).stringify = mockMatterStringify;
  return { mockMatterFn, mockMatterStringify };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('./parser.js', () => ({
  parseCortexEntry: vi.fn(),
}));

vi.mock('./qdrant-client.js', () => ({
  COLLECTION_NAME: 'cortex-entries',
}));

vi.mock('../env.js', () => ({
  readEnvFile: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function (this: Record<string, unknown>, opts: { apiKey: string }) {
    this.apiKey = opts.apiKey;
    this.embeddings = {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
        usage: { total_tokens: 10 },
      }),
    };
  }),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('gray-matter', () => ({ default: mockMatterFn }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  embedEntry,
  deterministicId,
  updateFrontmatter,
  createOpenAIClient,
} from './embedder.js';
import type { EmbedResult } from './embedder.js';
import { parseCortexEntry } from './parser.js';
import { readEnvFile } from '../env.js';
import { readFileSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockEntry(overrides?: { frontmatter?: Record<string, unknown>; content?: string; validation?: Record<string, unknown> }) {
  const base = {
    filePath: '/home/user/cortex/Areas/Projects/NanoClaw/arch.md',
    frontmatter: {
      cortex_level: 'L20',
      confidence: 'medium',
      domain: 'nanoclaw',
      scope: 'architecture',
      project: 'nanoclaw',
      status: 'active',
      ...(overrides?.frontmatter ?? {}),
    },
    content: 'This is the body content of the Cortex entry for testing purposes.',
    sourceHash: 'abc123deadbeef',
    validation: {
      valid: true,
      data: {
        cortex_level: 'L20',
        confidence: 'medium',
        domain: 'nanoclaw',
        scope: 'architecture',
      },
      warnings: [],
      errors: [],
      ...(overrides?.validation ?? {}),
    },
  };
  if (overrides?.content !== undefined) {
    base.content = overrides.content;
  }
  return base;
}

function makeMockQdrant() {
  return { upsert: vi.fn().mockResolvedValue({ status: 'ok' }) };
}

function makeMockOpenAI() {
  return {
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }],
        usage: { total_tokens: 10 },
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// deterministicId
// ---------------------------------------------------------------------------

describe('deterministicId', () => {
  it('produces a UUID-formatted string', () => {
    const id = deterministicId('/home/user/cortex/Areas/Projects/NanoClaw/arch.md');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('produces the same ID for the same path (stable)', () => {
    const path = '/home/user/cortex/Areas/Projects/NanoClaw/arch.md';
    expect(deterministicId(path)).toBe(deterministicId(path));
  });

  it('strips prefix before cortex/ so relative path drives the ID', () => {
    const id1 = deterministicId('/home/user/cortex/Areas/Projects/NanoClaw/arch.md');
    const id2 = deterministicId('/different/prefix/cortex/Areas/Projects/NanoClaw/arch.md');
    expect(id1).toBe(id2);
  });

  it('produces different IDs for different paths', () => {
    const id1 = deterministicId('/cortex/Areas/Projects/NanoClaw/arch.md');
    const id2 = deterministicId('/cortex/Areas/Projects/OtherProject/other.md');
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// updateFrontmatter
// ---------------------------------------------------------------------------

describe('updateFrontmatter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes source_hash and embedding_model into frontmatter', () => {
    vi.mocked(readFileSync).mockReturnValue('---\nkey: value\n---\nBody content.');
    mockMatterFn.mockReturnValue({ data: { key: 'value' }, content: '\nBody content.' });
    mockMatterStringify.mockReturnValue(
      '---\nkey: value\nsource_hash: abc123\nembedding_model: text-embedding-3-small\n---\nBody content.',
    );

    updateFrontmatter('/path/to/file.md', {
      source_hash: 'abc123',
      embedding_model: 'text-embedding-3-small',
    });

    expect(readFileSync).toHaveBeenCalledWith('/path/to/file.md', 'utf-8');
    expect(writeFileSync).toHaveBeenCalledWith(
      '/path/to/file.md',
      expect.any(String),
      'utf-8',
    );
  });

  it('preserves body content when writing frontmatter', () => {
    const body = '\nThis is important body content that must be preserved.';
    vi.mocked(readFileSync).mockReturnValue(`---\nkey: value\n---${body}`);
    mockMatterFn.mockReturnValue({ data: { key: 'value' }, content: body });
    const updatedFile = `---\nkey: value\nsource_hash: hash\n---${body}`;
    mockMatterStringify.mockReturnValue(updatedFile);

    updateFrontmatter('/path/to/file.md', { source_hash: 'hash' });

    expect(writeFileSync).toHaveBeenCalledWith('/path/to/file.md', updatedFile, 'utf-8');
  });
});

// ---------------------------------------------------------------------------
// createOpenAIClient
// ---------------------------------------------------------------------------

describe('createOpenAIClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads OPENAI_API_KEY from .env via readEnvFile', () => {
    vi.mocked(readEnvFile).mockReturnValue({ OPENAI_API_KEY: 'sk-test-key' });
    const client = createOpenAIClient();
    expect(readEnvFile).toHaveBeenCalledWith(['OPENAI_API_KEY']);
    expect(client).toBeDefined();
  });

  it('throws an error when OPENAI_API_KEY is missing', () => {
    vi.mocked(readEnvFile).mockReturnValue({});
    expect(() => createOpenAIClient()).toThrow(/OPENAI_API_KEY/);
  });
});

// ---------------------------------------------------------------------------
// embedEntry
// ---------------------------------------------------------------------------

describe('embedEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default matter mock for updateFrontmatter calls in embedEntry
    vi.mocked(readFileSync).mockReturnValue('---\nkey: value\n---\nBody content.');
    mockMatterFn.mockReturnValue({ data: { key: 'value' }, content: '\nBody content.' });
    mockMatterStringify.mockReturnValue('---\nkey: value\n---\nBody content.');
  });

  it('returns embedded status after successful OpenAI call + Qdrant upsert', async () => {
    const entry = makeMockEntry();
    vi.mocked(parseCortexEntry).mockReturnValue(entry as ReturnType<typeof parseCortexEntry>);
    const openai = makeMockOpenAI();
    const qdrant = makeMockQdrant();

    const result: EmbedResult = await embedEntry(
      entry.filePath,
      openai as never,
      qdrant as never,
    );

    expect(result.status).toBe('embedded');
    expect(result.filePath).toBe(entry.filePath);
    expect(openai.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: entry.content,
    });
    expect(qdrant.upsert).toHaveBeenCalledWith(
      'cortex-entries',
      expect.objectContaining({
        wait: true,
        points: expect.arrayContaining([
          expect.objectContaining({
            vector: expect.any(Array),
            payload: expect.objectContaining({
              file_path: entry.filePath,
              cortex_level: 'L20',
              embedding_model: 'text-embedding-3-small',
              source_hash: entry.sourceHash,
            }),
          }),
        ]),
      }),
    );
  });

  it('returns skipped when source_hash matches (content unchanged)', async () => {
    const entry = makeMockEntry({ frontmatter: { source_hash: 'abc123deadbeef' } });
    vi.mocked(parseCortexEntry).mockReturnValue(entry as ReturnType<typeof parseCortexEntry>);
    const openai = makeMockOpenAI();
    const qdrant = makeMockQdrant();

    const result = await embedEntry(entry.filePath, openai as never, qdrant as never);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('content unchanged');
    expect(openai.embeddings.create).not.toHaveBeenCalled();
    expect(qdrant.upsert).not.toHaveBeenCalled();
  });

  it('embeds even when hash matches when force:true is passed', async () => {
    const entry = makeMockEntry({ frontmatter: { source_hash: 'abc123deadbeef' } });
    vi.mocked(parseCortexEntry).mockReturnValue(entry as ReturnType<typeof parseCortexEntry>);
    const openai = makeMockOpenAI();
    const qdrant = makeMockQdrant();

    const result = await embedEntry(
      entry.filePath,
      openai as never,
      qdrant as never,
      { force: true },
    );

    expect(result.status).toBe('embedded');
    expect(openai.embeddings.create).toHaveBeenCalled();
  });

  it('returns skipped when content body is shorter than 50 chars', async () => {
    const entry = makeMockEntry({ content: 'Short.' });
    vi.mocked(parseCortexEntry).mockReturnValue(entry as ReturnType<typeof parseCortexEntry>);
    const openai = makeMockOpenAI();
    const qdrant = makeMockQdrant();

    const result = await embedEntry(entry.filePath, openai as never, qdrant as never);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('content too short');
    expect(openai.embeddings.create).not.toHaveBeenCalled();
  });

  it('returns error when frontmatter validation fails', async () => {
    const entry = makeMockEntry({
      validation: {
        valid: false,
        data: { cortex_level: 'L20', confidence: 'medium', domain: 'nanoclaw', scope: 'architecture' },
        warnings: [],
        errors: ['cortex_level: Required'],
      },
    });
    vi.mocked(parseCortexEntry).mockReturnValue(entry as ReturnType<typeof parseCortexEntry>);
    const openai = makeMockOpenAI();
    const qdrant = makeMockQdrant();

    const result = await embedEntry(entry.filePath, openai as never, qdrant as never);

    expect(result.status).toBe('error');
    expect(result.reason).toContain('cortex_level');
  });

  it('returns error status when OpenAI call throws', async () => {
    const entry = makeMockEntry();
    vi.mocked(parseCortexEntry).mockReturnValue(entry as ReturnType<typeof parseCortexEntry>);
    const openai = makeMockOpenAI();
    openai.embeddings.create.mockRejectedValue(new Error('OpenAI API error'));
    const qdrant = makeMockQdrant();

    const result = await embedEntry(entry.filePath, openai as never, qdrant as never);

    expect(result.status).toBe('error');
    expect(result.reason).toContain('OpenAI API error');
  });

  it('writes source_hash and embedding_model back to frontmatter after successful embed', async () => {
    const entry = makeMockEntry();
    vi.mocked(parseCortexEntry).mockReturnValue(entry as ReturnType<typeof parseCortexEntry>);
    const openai = makeMockOpenAI();
    const qdrant = makeMockQdrant();

    await embedEntry(entry.filePath, openai as never, qdrant as never);

    expect(writeFileSync).toHaveBeenCalled();
    // Verify that matter.stringify was called with source_hash and embedding_model updates
    expect(mockMatterStringify).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        source_hash: entry.sourceHash,
        embedding_model: 'text-embedding-3-small',
      }),
    );
  });
});
