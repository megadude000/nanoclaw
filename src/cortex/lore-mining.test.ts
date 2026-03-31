/**
 * Unit tests for lore-mining.ts -- Night Shift mining script
 * Extracts implicit decisions from existing commit history heuristically.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process.execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Mock lore-parser.ts writeLoreAtom and indexLoreAtoms
vi.mock('./lore-parser.js', () => ({
  writeLoreAtom: vi.fn(),
  indexLoreAtoms: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { writeLoreAtom, indexLoreAtoms } from './lore-parser.js';
import { mineLoreFromHistory } from './lore-mining.js';

const mockExecSync = vi.mocked(execSync);
const mockWriteLoreAtom = vi.mocked(writeLoreAtom);
const mockIndexLoreAtoms = vi.mocked(indexLoreAtoms);

// Fake OpenAI and Qdrant clients (DI)
const fakeOpenAI = {} as any;
const fakeQdrant = {} as any;

/**
 * Helper to build git log output in the format:
 * hash\x00subject\x00date\x00body\x00
 */
function gitLogEntry(
  hash: string,
  subject: string,
  date: string,
  body: string,
): string {
  return `${hash}\x00${subject}\x00${date}\x00${body}\x00`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteLoreAtom.mockReturnValue('/fake/path.md');
  mockIndexLoreAtoms.mockResolvedValue([]);
});

describe('mineLoreFromHistory', () => {
  it('extracts decision-indicating bullets from commit bodies', async () => {
    const log = gitLogEntry(
      'abc1234567890',
      'feat: add auth system',
      '2026-03-01T10:00:00+00:00',
      '- JWT tokens because session cookies are stateless\n- Added middleware',
    );
    mockExecSync.mockReturnValue(Buffer.from(log));

    const result = await mineLoreFromHistory('/repo', '/vault', fakeOpenAI, fakeQdrant);

    expect(result.decisions_extracted).toBeGreaterThan(0);
    expect(mockWriteLoreAtom).toHaveBeenCalled();
  });

  it('classifies extracted decisions as constraint/rejected/directive', async () => {
    const log = [
      gitLogEntry(
        'aaa1111111111',
        'feat: use DI pattern',
        '2026-03-01T10:00:00+00:00',
        '- Used factory pattern instead of singletons\n- Must always use DI for testability',
      ),
      gitLogEntry(
        'bbb2222222222',
        'feat: add directive',
        '2026-03-02T10:00:00+00:00',
        '- Going forward all handlers use factory pattern',
      ),
    ].join('\n');
    mockExecSync.mockReturnValue(Buffer.from(log));

    await mineLoreFromHistory('/repo', '/vault', fakeOpenAI, fakeQdrant);

    // Check that writeLoreAtom was called with different trailer keys
    const calls = mockWriteLoreAtom.mock.calls;
    const keys = calls.map((c) => c[0].trailerKey);
    // "instead of" => Rejected, "Must always" => Constraint, "Going forward" => Directive
    expect(keys).toContain('Rejected');
    expect(keys).toContain('Constraint');
    expect(keys).toContain('Directive');
  });

  it('skips merge commits and trivial single-line messages', async () => {
    // Single-line message (no body) should be skipped
    const log = gitLogEntry(
      'ccc3333333333',
      'Merge branch main into feature',
      '2026-03-01T10:00:00+00:00',
      '',
    );
    mockExecSync.mockReturnValue(Buffer.from(log));

    const result = await mineLoreFromHistory('/repo', '/vault', fakeOpenAI, fakeQdrant);

    expect(result.decisions_extracted).toBe(0);
    expect(mockWriteLoreAtom).not.toHaveBeenCalled();
  });

  it('sets mined=true on all extracted atoms (confidence: low)', async () => {
    const log = gitLogEntry(
      'ddd4444444444',
      'feat: add caching',
      '2026-03-01T10:00:00+00:00',
      '- Redis chosen because memcached requires separate process',
    );
    mockExecSync.mockReturnValue(Buffer.from(log));

    await mineLoreFromHistory('/repo', '/vault', fakeOpenAI, fakeQdrant);

    // All writeLoreAtom calls must have mined: true
    for (const call of mockWriteLoreAtom.mock.calls) {
      expect(call[2]).toEqual({ mined: true });
    }
  });

  it('limits output to avoid over-extraction (Pitfall 4)', async () => {
    // Generate 60 commits with decision-indicating bullets
    const entries = Array.from({ length: 60 }, (_, i) =>
      gitLogEntry(
        `${String(i).padStart(12, 'e')}`,
        `feat: feature ${i}`,
        '2026-03-01T10:00:00+00:00',
        `- Must use pattern ${i} because of requirement ${i}`,
      ),
    ).join('\n');
    mockExecSync.mockReturnValue(Buffer.from(entries));

    const result = await mineLoreFromHistory('/repo', '/vault', fakeOpenAI, fakeQdrant);

    // Should cap at 40 per Pitfall 4
    expect(result.decisions_extracted).toBeLessThanOrEqual(40);
    expect(mockWriteLoreAtom).toHaveBeenCalledTimes(result.decisions_extracted);
  });
});
