import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock chunkMessage before importing the module under test
vi.mock('./discord-chunker.js', () => ({
  chunkMessage: vi.fn((text: string) => [text]),
}));

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  loadSwarmIdentities,
  SwarmWebhookManager,
  SwarmIdentitySchema,
} from './swarm-webhook-manager.js';

import { chunkMessage } from './discord-chunker.js';

// --- Helpers to create mock discord.js objects ---

function mockWebhook(overrides: Partial<{ send: ReturnType<typeof vi.fn> }> = {}) {
  return {
    send: overrides.send ?? vi.fn().mockResolvedValue({}),
    token: 'mock-token',
    name: 'NanoClaw-Friday',
    id: 'wh-123',
  };
}

function mockChannel(
  id = 'ch-001',
  overrides: {
    createWebhook?: ReturnType<typeof vi.fn>;
    fetchWebhooks?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    id,
    createWebhook: overrides.createWebhook ?? vi.fn().mockResolvedValue(mockWebhook()),
    fetchWebhooks: overrides.fetchWebhooks ?? vi.fn().mockResolvedValue(new Map()),
  };
}

// --- Tests ---

describe('loadSwarmIdentities', () => {
  it('returns parsed identities from valid JSON config', () => {
    const configPath = resolve(__dirname, '..', 'config', 'swarm-identities.json');
    const identities = loadSwarmIdentities(configPath);
    expect(identities).toHaveLength(2);
    expect(identities[0].name).toBe('Friday');
    expect(identities[1].name).toBe('Alfred');
    expect(identities[0].avatarURL).toMatch(/^https?:\/\//);
    expect(identities[1].avatarURL).toMatch(/^https?:\/\//);
  });

  it('throws on invalid config (missing name)', async () => {
    const fs = await import('node:fs');
    const tmpPath = resolve(__dirname, '..', 'config', '_test_invalid.json');
    fs.writeFileSync(tmpPath, JSON.stringify([{ avatarURL: 'https://example.com/a.png' }]));
    try {
      expect(() => loadSwarmIdentities(tmpPath)).toThrow();
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('throws on invalid config (bad URL)', async () => {
    const fs = await import('node:fs');
    const tmpPath = resolve(__dirname, '..', 'config', '_test_badurl.json');
    fs.writeFileSync(tmpPath, JSON.stringify([{ name: 'Test', avatarURL: 'not-a-url' }]));
    try {
      expect(() => loadSwarmIdentities(tmpPath)).toThrow();
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('returns empty array when config file missing', () => {
    const identities = loadSwarmIdentities('/nonexistent/path/config.json');
    expect(identities).toEqual([]);
  });
});

describe('SwarmIdentitySchema', () => {
  it('validates a correct identity', () => {
    const result = SwarmIdentitySchema.parse({
      name: 'Friday',
      avatarURL: 'https://example.com/avatar.png',
    });
    expect(result.name).toBe('Friday');
  });

  it('rejects missing name', () => {
    expect(() =>
      SwarmIdentitySchema.parse({ avatarURL: 'https://example.com/a.png' }),
    ).toThrow();
  });
});

describe('SwarmWebhookManager', () => {
  let manager: SwarmWebhookManager;

  beforeEach(() => {
    manager = new SwarmWebhookManager([
      { name: 'Friday', avatarURL: 'https://example.com/friday.png' },
      { name: 'Alfred', avatarURL: 'https://example.com/alfred.png' },
    ]);
    vi.clearAllMocks();
    // Default: chunkMessage returns text as single chunk
    vi.mocked(chunkMessage).mockImplementation((text: string) => [text]);
  });

  describe('hasIdentity', () => {
    it('returns true for configured identity (case-insensitive)', () => {
      expect(manager.hasIdentity('Friday')).toBe(true);
      expect(manager.hasIdentity('friday')).toBe(true);
      expect(manager.hasIdentity('FRIDAY')).toBe(true);
    });

    it('returns false for unknown identity', () => {
      expect(manager.hasIdentity('Unknown')).toBe(false);
      expect(manager.hasIdentity('')).toBe(false);
    });
  });

  describe('send', () => {
    it('calls channel.createWebhook when no cached webhook exists', async () => {
      const wh = mockWebhook();
      const channel = mockChannel('ch-001', {
        createWebhook: vi.fn().mockResolvedValue(wh),
      });

      const result = await manager.send(channel as any, 'Hello!', 'Friday');
      expect(result).toBe(true);
      expect(channel.createWebhook).toHaveBeenCalledWith({
        name: 'NanoClaw-Friday',
        avatar: 'https://example.com/friday.png',
        reason: 'NanoClaw swarm identity: Friday',
      });
    });

    it('uses cached webhook on subsequent calls', async () => {
      const wh = mockWebhook();
      const channel = mockChannel('ch-001', {
        createWebhook: vi.fn().mockResolvedValue(wh),
      });

      await manager.send(channel as any, 'First', 'Friday');
      await manager.send(channel as any, 'Second', 'Friday');

      // createWebhook called only once
      expect(channel.createWebhook).toHaveBeenCalledTimes(1);
      // webhook.send called twice
      expect(wh.send).toHaveBeenCalledTimes(2);
    });

    it('passes username and avatarURL to webhook.send', async () => {
      const wh = mockWebhook();
      const channel = mockChannel('ch-001', {
        createWebhook: vi.fn().mockResolvedValue(wh),
      });

      await manager.send(channel as any, 'Test message', 'Friday');

      expect(wh.send).toHaveBeenCalledWith({
        content: 'Test message',
        username: 'Friday',
        avatarURL: 'https://example.com/friday.png',
      });
    });

    it('chunks long messages using chunkMessage before sending via webhook', async () => {
      vi.mocked(chunkMessage).mockReturnValue(['chunk1', 'chunk2', 'chunk3']);
      const wh = mockWebhook();
      const channel = mockChannel('ch-001', {
        createWebhook: vi.fn().mockResolvedValue(wh),
      });

      await manager.send(channel as any, 'very long text', 'Friday');

      expect(chunkMessage).toHaveBeenCalledWith('very long text');
      expect(wh.send).toHaveBeenCalledTimes(3);
      expect(wh.send).toHaveBeenNthCalledWith(1, {
        content: 'chunk1',
        username: 'Friday',
        avatarURL: 'https://example.com/friday.png',
      });
      expect(wh.send).toHaveBeenNthCalledWith(2, {
        content: 'chunk2',
        username: 'Friday',
        avatarURL: 'https://example.com/friday.png',
      });
    });

    it('returns false when identity not found (unknown sender)', async () => {
      const channel = mockChannel();
      const result = await manager.send(channel as any, 'Hello', 'UnknownBot');
      expect(result).toBe(false);
      expect(channel.createWebhook).not.toHaveBeenCalled();
    });

    it('returns false and logs warning when createWebhook fails', async () => {
      const channel = mockChannel('ch-001', {
        createWebhook: vi.fn().mockRejectedValue(new Error('Permission denied')),
      });

      const result = await manager.send(channel as any, 'Hello', 'Friday');
      expect(result).toBe(false);
    });

    it('returns false when webhook.send fails, removes stale cache entry', async () => {
      const wh = mockWebhook({
        send: vi.fn().mockRejectedValue(new Error('Unknown Webhook')),
      });
      const channel = mockChannel('ch-001', {
        createWebhook: vi.fn().mockResolvedValue(wh),
      });

      // First call: creates webhook, send fails
      const result = await manager.send(channel as any, 'Hello', 'Friday');
      expect(result).toBe(false);

      // Second call should try createWebhook again (cache was cleared)
      const wh2 = mockWebhook();
      channel.createWebhook.mockResolvedValue(wh2);
      const result2 = await manager.send(channel as any, 'Retry', 'Friday');
      expect(result2).toBe(true);
      expect(channel.createWebhook).toHaveBeenCalledTimes(2);
    });
  });

  describe('hydrateCache', () => {
    it('populates cache from fetched webhooks matching NanoClaw- prefix with valid token', async () => {
      const existingWh = {
        name: 'NanoClaw-Friday',
        token: 'valid-token',
        send: vi.fn().mockResolvedValue({}),
        id: 'wh-existing',
      };

      const webhooksMap = new Map([['wh-existing', existingWh]]);
      const channel = mockChannel('ch-hydrate', {
        fetchWebhooks: vi.fn().mockResolvedValue(webhooksMap),
      });

      await manager.hydrateCache([channel as any]);

      // Now send should NOT call createWebhook (cached from hydration)
      const result = await manager.send(channel as any, 'Hydrated!', 'Friday');
      expect(result).toBe(true);
      expect(channel.createWebhook).not.toHaveBeenCalled();
      expect(existingWh.send).toHaveBeenCalled();
    });

    it('skips webhooks without token or non-matching name', async () => {
      const noToken = { name: 'NanoClaw-Friday', token: null, send: vi.fn(), id: 'wh-1' };
      const wrongName = { name: 'OtherBot', token: 'has-token', send: vi.fn(), id: 'wh-2' };

      const webhooksMap = new Map<string, any>([
        ['wh-1', noToken],
        ['wh-2', wrongName],
      ]);
      const channel = mockChannel('ch-skip', {
        fetchWebhooks: vi.fn().mockResolvedValue(webhooksMap),
      });

      await manager.hydrateCache([channel as any]);

      // Send should still call createWebhook (nothing was cached)
      const wh = mockWebhook();
      channel.createWebhook = vi.fn().mockResolvedValue(wh);
      const result = await manager.send(channel as any, 'Not cached', 'Friday');
      expect(result).toBe(true);
      expect(channel.createWebhook).toHaveBeenCalled();
    });
  });
});
