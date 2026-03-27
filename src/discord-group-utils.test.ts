import { describe, it, expect } from 'vitest';
import { isValidGroupFolder } from './group-folder.js';
import {
  sanitizeDiscordChannelName,
  sanitizeWithCollisionCheck,
  createGroupStub,
} from './discord-group-utils.js';

describe('sanitizeDiscordChannelName', () => {
  it('converts simple name to dc- prefix', () => {
    expect(sanitizeDiscordChannelName('general')).toBe('dc-general');
  });

  it('lowercases and replaces spaces with hyphens', () => {
    expect(sanitizeDiscordChannelName('My Channel')).toBe('dc-my-channel');
  });

  it('preserves already-valid names', () => {
    expect(sanitizeDiscordChannelName('bugs')).toBe('dc-bugs');
  });

  it('preserves hyphens in names', () => {
    expect(sanitizeDiscordChannelName('yw-tasks')).toBe('dc-yw-tasks');
  });

  it('falls back to dc-channel for empty string', () => {
    expect(sanitizeDiscordChannelName('')).toBe('dc-channel');
  });

  it('falls back to dc-channel for all-emoji string', () => {
    expect(sanitizeDiscordChannelName('\u{1F600}\u{1F601}\u{1F602}')).toBe(
      'dc-channel',
    );
  });

  it('truncates very long names to 64 chars total', () => {
    const longName = 'a'.repeat(100);
    const result = sanitizeDiscordChannelName(longName);
    expect(result.length).toBeLessThanOrEqual(64);
    expect(result.startsWith('dc-')).toBe(true);
  });

  it('collapses multiple hyphens', () => {
    expect(sanitizeDiscordChannelName('foo   bar')).toBe('dc-foo-bar');
  });

  it('trims leading/trailing hyphens from base', () => {
    expect(sanitizeDiscordChannelName('-hello-')).toBe('dc-hello');
  });

  it('all outputs pass isValidGroupFolder', () => {
    const inputs = [
      'general',
      'My Channel',
      'bugs',
      'yw-tasks',
      '',
      '\u{1F600}',
      'a'.repeat(100),
      'foo   bar',
      '-hello-',
    ];
    for (const input of inputs) {
      const result = sanitizeDiscordChannelName(input);
      expect(
        isValidGroupFolder(result),
        `"${input}" -> "${result}" should be valid`,
      ).toBe(true);
    }
  });
});

describe('sanitizeWithCollisionCheck', () => {
  it('returns base name when no collision', () => {
    const result = sanitizeWithCollisionCheck(
      'general',
      '123456789012345678',
      new Set(),
    );
    expect(result).toBe('dc-general');
  });

  it('appends last 6 chars of channelId on collision', () => {
    const existing = new Set(['dc-general']);
    const result = sanitizeWithCollisionCheck(
      'general',
      '123456789012345678',
      existing,
    );
    expect(result).toBe('dc-general-345678');
  });

  it('truncates base to fit suffix within 64 chars', () => {
    const longName = 'a'.repeat(100);
    const existing = new Set([sanitizeDiscordChannelName(longName)]);
    const result = sanitizeWithCollisionCheck(
      longName,
      '123456789012345678',
      existing,
    );
    expect(result.length).toBeLessThanOrEqual(64);
    expect(isValidGroupFolder(result)).toBe(true);
  });

  it('collision result passes isValidGroupFolder', () => {
    const existing = new Set(['dc-general']);
    const result = sanitizeWithCollisionCheck(
      'general',
      '123456789012345678',
      existing,
    );
    expect(isValidGroupFolder(result)).toBe(true);
  });
});

describe('createGroupStub', () => {
  it('creates stub without main channel text when isMain=false', () => {
    const stub = createGroupStub('general', false);
    expect(stub).toContain('# general');
    expect(stub).not.toContain('This is the main channel.');
  });

  it('creates stub with main channel text when isMain=true', () => {
    const stub = createGroupStub('main', true);
    expect(stub).toContain('# main');
    expect(stub).toContain('This is the main channel.');
  });

  it('includes instructions section', () => {
    const stub = createGroupStub('test', false);
    expect(stub).toContain('## Instructions');
    expect(stub).toContain('Respond helpfully');
  });
});
