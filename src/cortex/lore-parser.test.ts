/**
 * Unit tests for Lore Parser -- Git Trailer Extraction & Vault File Writer
 *
 * Tests cover parseLoreFromGit (git trailer extraction), writeLoreAtom
 * (vault file creation), and indexLoreAtoms (embedding pipeline).
 *
 * All external dependencies (child_process, fs, embedEntry) are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, readFileSync as realReadFileSync, rmSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Hoisted mock vars
// ---------------------------------------------------------------------------

const { mockExecSync, mockEmbedEntry, mockMatterFn, mockMatterStringify } =
  vi.hoisted(() => {
    const mockExecSync = vi.fn();
    const mockEmbedEntry = vi.fn();
    const mockMatterStringify = vi.fn();
    const mockMatterFn = vi.fn();
    (mockMatterFn as unknown as Record<string, unknown>).stringify =
      mockMatterStringify;
    return { mockExecSync, mockEmbedEntry, mockMatterFn, mockMatterStringify };
  });

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
}));

vi.mock('./embedder.js', () => ({
  embedEntry: mockEmbedEntry,
}));

// We do NOT mock gray-matter or node:fs for writeLoreAtom tests --
// we use a real temp directory to verify actual file output.
// gray-matter is only mocked for tests that don't need real FS.

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  parseLoreFromGit,
  writeLoreAtom,
  indexLoreAtoms,
  LORE_KEYS,
} from './lore-parser.js';
import type { LoreAtom } from './lore-parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a git log line in the expected format: hash\x00subject\x00date\x00trailers\x00 */
function gitLogLine(
  hash: string,
  subject: string,
  date: string,
  trailers: string,
): string {
  return `${hash}\x00${subject}\x00${date}\x00${trailers}\x00`;
}

function makeLoreAtom(overrides?: Partial<LoreAtom>): LoreAtom {
  return {
    commitHash: 'abc1234def5678901234567890abcdef12345678',
    commitSubject: 'feat(16-01): create embedder',
    commitDate: '2026-03-30T10:00:00+02:00',
    trailerKey: 'Constraint',
    trailerValue: 'DI for openai/qdrant',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseLoreFromGit
// ---------------------------------------------------------------------------

describe('parseLoreFromGit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts a Constraint trailer from git log output', () => {
    const output = gitLogLine(
      'abc1234def5678901234567890abcdef12345678',
      'feat(16-01): create embedder',
      '2026-03-30T10:00:00+02:00',
      'Constraint: DI for openai/qdrant\nCo-Authored-By: Claude',
    );
    mockExecSync.mockReturnValue(Buffer.from(output));

    const atoms = parseLoreFromGit('/repo');

    expect(atoms).toHaveLength(1);
    expect(atoms[0].trailerKey).toBe('Constraint');
    expect(atoms[0].trailerValue).toBe('DI for openai/qdrant');
    expect(atoms[0].commitHash).toBe(
      'abc1234def5678901234567890abcdef12345678',
    );
    expect(atoms[0].commitSubject).toBe('feat(16-01): create embedder');
    expect(atoms[0].commitDate).toBe('2026-03-30T10:00:00+02:00');
  });

  it('extracts multiple trailers (Constraint + Rejected) from same commit', () => {
    const output = gitLogLine(
      'abc1234def5678901234567890abcdef12345678',
      'feat(16-01): create embedder',
      '2026-03-30T10:00:00+02:00',
      'Constraint: DI for openai/qdrant\nRejected: Chokidar for fs.watch',
    );
    mockExecSync.mockReturnValue(Buffer.from(output));

    const atoms = parseLoreFromGit('/repo');

    expect(atoms).toHaveLength(2);
    expect(atoms[0].trailerKey).toBe('Constraint');
    expect(atoms[0].trailerValue).toBe('DI for openai/qdrant');
    expect(atoms[1].trailerKey).toBe('Rejected');
    expect(atoms[1].trailerValue).toBe('Chokidar for fs.watch');
  });

  it('returns empty array when no lore trailers exist', () => {
    const output = gitLogLine(
      'abc1234def5678901234567890abcdef12345678',
      'chore: update deps',
      '2026-03-30T10:00:00+02:00',
      'Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>',
    );
    mockExecSync.mockReturnValue(Buffer.from(output));

    const atoms = parseLoreFromGit('/repo');

    expect(atoms).toHaveLength(0);
  });

  it('filters commits by since parameter', () => {
    mockExecSync.mockReturnValue(Buffer.from(''));

    parseLoreFromGit('/repo', '2026-03-01');

    const callArgs = mockExecSync.mock.calls[0][0] as string;
    expect(callArgs).toContain('--since=2026-03-01');
  });
});

// ---------------------------------------------------------------------------
// writeLoreAtom
// ---------------------------------------------------------------------------

describe('writeLoreAtom', () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = mkdtempSync(join(tmpdir(), 'lore-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a markdown file in Lore/ with correct frontmatter', () => {
    const atom = makeLoreAtom();

    const filePath = writeLoreAtom(atom, tmpDir);

    expect(filePath).not.toBeNull();
    expect(filePath).toContain('Lore/');
    expect(filePath).toContain('abc1234-constraint.md');

    // Read back and verify frontmatter
    const matter = require('gray-matter');
    const content = realReadFileSync(filePath!, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data.type).toBe('lore-atom');
    expect(parsed.data.cortex_level).toBe('L20');
    expect(parsed.data.confidence).toBe('high');
    expect(parsed.data.domain).toBe('nanoclaw');
    expect(parsed.data.lore_source).toBe(atom.commitHash);
    expect(parsed.data.lore_key).toBe('constraint');
    expect(parsed.data.commit_date).toBe('2026-03-30');
  });

  it('sets confidence to low when mined option is true', () => {
    const atom = makeLoreAtom();

    const filePath = writeLoreAtom(atom, tmpDir, { mined: true });

    expect(filePath).not.toBeNull();

    const matter = require('gray-matter');
    const content = realReadFileSync(filePath!, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data.confidence).toBe('low');
    expect(parsed.data.lore_mined).toBe(true);
  });

  it('skips if vault file already exists (idempotent)', () => {
    const atom = makeLoreAtom();

    // First write
    const firstPath = writeLoreAtom(atom, tmpDir);
    expect(firstPath).not.toBeNull();

    // Second write -- should skip
    const secondPath = writeLoreAtom(atom, tmpDir);
    expect(secondPath).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// indexLoreAtoms
// ---------------------------------------------------------------------------

describe('indexLoreAtoms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls embedEntry for each file path', async () => {
    const paths = [
      '/cortex/Lore/abc1234-constraint.md',
      '/cortex/Lore/def5678-rejected.md',
    ];
    mockEmbedEntry.mockResolvedValue({ status: 'embedded', filePath: '' });

    const mockOpenAI = {} as unknown;
    const mockQdrant = {} as unknown;

    const results = await indexLoreAtoms(
      paths,
      mockOpenAI as never,
      mockQdrant as never,
    );

    expect(mockEmbedEntry).toHaveBeenCalledTimes(2);
    expect(mockEmbedEntry).toHaveBeenCalledWith(
      paths[0],
      mockOpenAI,
      mockQdrant,
      { force: true },
    );
    expect(mockEmbedEntry).toHaveBeenCalledWith(
      paths[1],
      mockOpenAI,
      mockQdrant,
      { force: true },
    );
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('embedded');
  });
});
