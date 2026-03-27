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
    const stub = createGroupStub('unknown-channel', false);
    expect(stub).toContain('# unknown-channel');
    expect(stub).not.toContain('This is the main channel.');
  });

  it('creates stub with main channel text when isMain=true', () => {
    const stub = createGroupStub('unknown-main', true);
    expect(stub).toContain('# unknown-main');
    expect(stub).toContain('This is the main channel.');
  });

  it('includes instructions section in fallback', () => {
    const stub = createGroupStub('no-template-here', false);
    expect(stub).toContain('## Instructions');
    expect(stub).toContain('Respond helpfully');
  });
});

describe('createGroupStub template selection', () => {
  it('loads bugs template containing triage instructions', () => {
    const content = createGroupStub('bugs', false);
    expect(content).toContain('triage');
    expect(content).toContain('# bugs');
  });

  it('loads yw-tasks template containing project management instructions', () => {
    const content = createGroupStub('yw-tasks', false);
    expect(content).toContain('project management');
    expect(content).toContain('# yw-tasks');
  });

  it('loads main template containing Cortex reference', () => {
    const content = createGroupStub('main', true);
    expect(content).toContain('cortex/');
    expect(content).toContain('# main');
  });

  it('loads agents template containing swarm references', () => {
    const content = createGroupStub('agents', false);
    expect(content).toMatch(/swarm|Friday|Alfred/i);
  });

  it('returns generic fallback for unknown channel names', () => {
    const content = createGroupStub('unknown-channel', false);
    expect(content).toContain('Respond helpfully');
    expect(content).not.toContain('cortex/');
  });

  it('Cortex references use directory paths not specific file paths', () => {
    const bugsContent = createGroupStub('bugs', false);
    const ywContent = createGroupStub('yw-tasks', false);
    const mainContent = createGroupStub('main', true);

    // Should contain directory-level cortex references
    expect(bugsContent).toContain('cortex/Areas/Work/');
    expect(ywContent).toContain('cortex/Areas/Work/');
    expect(mainContent).toContain('cortex/');

    // Should NOT contain specific .md file references within cortex
    expect(bugsContent).not.toMatch(/cortex\/[^\s]*\.md/);
    expect(ywContent).not.toMatch(/cortex\/[^\s]*\.md/);
  });

  it('all 8 channel templates are loadable', () => {
    const channels = ['main', 'agents', 'yw-tasks', 'bugs', 'progress', 'dev-alerts', 'logs', 'bot-control'];
    for (const ch of channels) {
      const content = createGroupStub(ch, ch === 'main');
      expect(content.length).toBeGreaterThan(50);
      expect(content).toContain(`# ${ch}`);
    }
  });
});
