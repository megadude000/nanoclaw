import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RegisteredGroup } from './types.js';

// Mock fs before importing the module under test
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { readFileSync, existsSync } from 'node:fs';
import { resolveTargets, type RouteTarget } from './webhook-router.js';
import { logger } from './logger.js';

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

const mockGroups: Record<string, RegisteredGroup> = {
  'tg:-100123': {
    name: 'Main TG',
    folder: 'tg-main',
    trigger: '/claw',
    added_at: '2026-01-01',
    isMain: true,
  },
  'dc:456': {
    name: 'DC Bugs',
    folder: 'dc-bugs',
    trigger: '/claw',
    added_at: '2026-01-01',
    isMain: false,
  },
};

const validConfig = JSON.stringify({
  'github-issues': {
    targets: [
      { platform: 'telegram', jid: 'tg:-100123' },
      { platform: 'discord', jid: 'dc:456' },
    ],
  },
  notion: {
    targets: [{ platform: 'telegram', jid: 'tg:-100123' }],
  },
});

describe('resolveTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns matching RouteTarget[] from valid config', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(validConfig);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      jid: 'tg:-100123',
      group: mockGroups['tg:-100123'],
    });
    expect(result[1]).toEqual({ jid: 'dc:456', group: mockGroups['dc:456'] });
  });

  it('falls back to mainJid when webhook type is not configured', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(validConfig);

    const result = resolveTargets('unknown-type', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('tg:-100123');
    expect(result[0].group.isMain).toBe(true);
  });

  it('falls back to mainJid when config file is missing', () => {
    mockExistsSync.mockReturnValue(false);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('tg:-100123');
    expect(result[0].group.isMain).toBe(true);
  });

  it('falls back to mainJid with warning on invalid JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ invalid json !!!');

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('tg:-100123');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('skips unregistered JIDs with warning', () => {
    const configWithUnknown = JSON.stringify({
      'github-issues': {
        targets: [
          { platform: 'telegram', jid: 'tg:-100123' },
          { platform: 'discord', jid: 'dc:999999' },
        ],
      },
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(configWithUnknown);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('tg:-100123');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ jid: 'dc:999999' }),
      expect.any(String),
    );
  });

  it('falls back to mainJid when all JIDs are unregistered', () => {
    const configAllUnknown = JSON.stringify({
      'github-issues': {
        targets: [{ platform: 'discord', jid: 'dc:999999' }],
      },
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(configAllUnknown);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('tg:-100123');
    expect(result[0].group.isMain).toBe(true);
  });

  it('returns 2 RouteTarget entries for dual-send config', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(validConfig);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.jid)).toEqual(['tg:-100123', 'dc:456']);
  });

  it('returns empty array for empty groups object', () => {
    mockExistsSync.mockReturnValue(false);

    const result = resolveTargets('github-issues', {});

    expect(result).toEqual([]);
  });

  // --- enabled toggle tests ---

  it('skips disabled target (enabled: false)', () => {
    const config = JSON.stringify({
      'github-issues': {
        targets: [
          { platform: 'telegram', jid: 'tg:-100123', enabled: true },
          { platform: 'discord', jid: 'dc:456', enabled: false },
        ],
      },
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(config);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('tg:-100123');
  });

  it('includes target when enabled is explicitly true', () => {
    const config = JSON.stringify({
      'github-issues': {
        targets: [
          { platform: 'discord', jid: 'dc:456', enabled: true },
        ],
      },
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(config);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('dc:456');
  });

  it('defaults to enabled when enabled field is missing', () => {
    // validConfig has no enabled field — should still route
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(validConfig);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.jid)).toEqual(['tg:-100123', 'dc:456']);
  });

  it('falls back to mainJid when all targets are disabled', () => {
    const config = JSON.stringify({
      'github-issues': {
        targets: [
          { platform: 'telegram', jid: 'tg:-100123', enabled: false },
          { platform: 'discord', jid: 'dc:456', enabled: false },
        ],
      },
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(config);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('tg:-100123');
    expect(result[0].group.isMain).toBe(true);
  });

  it('has independent enabled flags per webhook type', () => {
    const config = JSON.stringify({
      'github-issues': {
        targets: [
          { platform: 'discord', jid: 'dc:456', enabled: false },
        ],
      },
      notion: {
        targets: [
          { platform: 'discord', jid: 'dc:456', enabled: true },
        ],
      },
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(config);

    const githubResult = resolveTargets('github-issues', mockGroups);
    const notionResult = resolveTargets('notion', mockGroups);

    // github-issues Discord disabled — falls back to main
    expect(githubResult).toHaveLength(1);
    expect(githubResult[0].group.isMain).toBe(true);

    // notion Discord enabled — routes to dc:456
    expect(notionResult).toHaveLength(1);
    expect(notionResult[0].jid).toBe('dc:456');
  });

  it('rollback scenario: Discord disabled, Telegram enabled', () => {
    const config = JSON.stringify({
      'github-issues': {
        targets: [
          { platform: 'telegram', jid: 'tg:-100123', enabled: true },
          { platform: 'discord', jid: 'dc:456', enabled: false },
        ],
      },
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(config);

    const result = resolveTargets('github-issues', mockGroups);

    expect(result).toHaveLength(1);
    expect(result[0].jid).toBe('tg:-100123');
  });
});
