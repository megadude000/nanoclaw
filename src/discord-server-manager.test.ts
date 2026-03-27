import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DiscordServerManager,
  ServerManagerDeps,
  ServerConfigSchema,
} from './discord-server-manager.js';
import { ChannelType } from 'discord.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createMockChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: '123456789',
    name: 'test-channel',
    delete: vi.fn().mockResolvedValue(undefined),
    edit: vi.fn().mockResolvedValue(undefined),
    permissionOverwrites: {
      edit: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

function createMockGuild() {
  const mockChannel = createMockChannel();
  return {
    channels: {
      create: vi.fn().mockResolvedValue({ id: '999', name: 'new-channel' }),
      fetch: vi.fn().mockResolvedValue(mockChannel),
    },
    _mockChannel: mockChannel,
  };
}

describe('DiscordServerManager', () => {
  let guild: ReturnType<typeof createMockGuild>;
  let deps: ServerManagerDeps;
  let manager: DiscordServerManager;

  beforeEach(() => {
    guild = createMockGuild();
    deps = { getGuild: () => guild as any };
    manager = new DiscordServerManager(deps);
  });

  describe('create_channel', () => {
    it('creates a text channel and returns channelId', async () => {
      const result = await manager.handleAction('create_channel', {
        name: 'general',
      });
      expect(result.success).toBe(true);
      expect(result.channelId).toBe('999');
      expect(guild.channels.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'general' }),
      );
    });

    it('passes parentId when provided', async () => {
      await manager.handleAction('create_channel', {
        name: 'sub',
        parentId: '888',
      });
      expect(guild.channels.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'sub', parent: '888' }),
      );
    });
  });

  describe('create_category', () => {
    it('creates a category and returns categoryId', async () => {
      guild.channels.create.mockResolvedValue({ id: '777', name: 'ops' });
      const result = await manager.handleAction('create_category', {
        name: 'ops',
      });
      expect(result.success).toBe(true);
      expect(result.categoryId).toBe('777');
    });
  });

  describe('delete_channel', () => {
    it('deletes an existing channel', async () => {
      const result = await manager.handleAction('delete_channel', {
        channelId: '123456789',
      });
      expect(result.success).toBe(true);
      expect(guild._mockChannel.delete).toHaveBeenCalled();
    });

    it('returns error for non-existent channel', async () => {
      guild.channels.fetch.mockResolvedValue(null);
      const result = await manager.handleAction('delete_channel', {
        channelId: 'bad',
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe('rename_channel', () => {
    it('renames an existing channel', async () => {
      const result = await manager.handleAction('rename_channel', {
        channelId: '123456789',
        name: 'new-name',
      });
      expect(result.success).toBe(true);
      expect(guild._mockChannel.edit).toHaveBeenCalledWith({
        name: 'new-name',
      });
    });
  });

  describe('set_permissions', () => {
    it('sets permission overwrites on a channel', async () => {
      const result = await manager.handleAction('set_permissions', {
        channelId: '123456789',
        overwrites: [
          { id: 'role1', allow: ['ViewChannel'], deny: ['SendMessages'] },
          { id: 'role2', allow: ['SendMessages'] },
        ],
      });
      expect(result.success).toBe(true);
      expect(
        guild._mockChannel.permissionOverwrites.edit,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('unknown action', () => {
    it('returns error for unknown action', async () => {
      const result = await manager.handleAction('explode', {});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/unknown action/i);
    });
  });

  describe('guild not connected', () => {
    it('returns error when guild is null', async () => {
      const disconnectedManager = new DiscordServerManager({
        getGuild: () => null,
      });
      const result = await disconnectedManager.handleAction('create_channel', {
        name: 'test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not connected/i);
    });
  });

  describe('error handling', () => {
    it('catches discord.js errors and returns them', async () => {
      guild.channels.create.mockRejectedValue(new Error('Missing Permissions'));
      const result = await manager.handleAction('create_channel', {
        name: 'test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing Permissions');
    });
  });

  describe('bootstrap', () => {
    const configPath = resolve(
      __dirname,
      '..',
      'config',
      'discord-server.json',
    );
    let channelIdCounter: number;

    function makeChannelEntry(
      id: string,
      name: string,
      type: number,
      parentId: string | null = null,
    ) {
      return [
        id,
        {
          id,
          name,
          type,
          parentId,
          delete: vi.fn(),
          edit: vi.fn(),
          permissionOverwrites: { edit: vi.fn() },
        },
      ] as const;
    }

    beforeEach(() => {
      channelIdCounter = 1000;
      // Reset guild.channels.fetch to return empty collection by default
      guild.channels.fetch = vi.fn().mockResolvedValue(new Map());
      guild.channels.create = vi.fn().mockImplementation(async (opts: any) => {
        const id = String(channelIdCounter++);
        return {
          id,
          name: opts.name,
          type: opts.type,
          parentId: opts.parent ?? null,
        };
      });
    });

    it('creates all 4 categories and 8 channels on empty guild', async () => {
      const result = await manager.handleAction('bootstrap', { configPath });

      expect(result.success).toBe(true);
      expect(result.total_created).toBe(12); // 4 categories + 8 channels
      expect(result.total_skipped).toBe(0);
      expect(guild.channels.create).toHaveBeenCalledTimes(12);

      // Verify categories were created
      const createCalls = guild.channels.create.mock.calls;
      const categoryCalls = createCalls.filter(
        (c: any) => c[0].type === ChannelType.GuildCategory,
      );
      expect(categoryCalls).toHaveLength(4);
      const catNames = categoryCalls.map((c: any) => c[0].name);
      expect(catNames).toEqual(
        expect.arrayContaining(['General', 'YourWave', 'Dev', 'Admin']),
      );
    });

    it('creates nothing when structure already exists (idempotent)', async () => {
      // Mock existing channels that match the full config
      const existingChannels = new Map([
        makeChannelEntry('c1', 'General', ChannelType.GuildCategory),
        makeChannelEntry('c2', 'YourWave', ChannelType.GuildCategory),
        makeChannelEntry('c3', 'Dev', ChannelType.GuildCategory),
        makeChannelEntry('c4', 'Admin', ChannelType.GuildCategory),
        makeChannelEntry('ch1', 'main', ChannelType.GuildText, 'c1'),
        makeChannelEntry('ch2', 'agents', ChannelType.GuildText, 'c1'),
        makeChannelEntry('ch3', 'yw-tasks', ChannelType.GuildText, 'c2'),
        makeChannelEntry('ch4', 'bugs', ChannelType.GuildText, 'c2'),
        makeChannelEntry('ch5', 'progress', ChannelType.GuildText, 'c2'),
        makeChannelEntry('ch6', 'dev-alerts', ChannelType.GuildText, 'c3'),
        makeChannelEntry('ch7', 'logs', ChannelType.GuildText, 'c3'),
        makeChannelEntry('ch8', 'bot-control', ChannelType.GuildText, 'c4'),
      ]);
      guild.channels.fetch.mockResolvedValue(existingChannels);

      const result = await manager.handleAction('bootstrap', { configPath });

      expect(result.success).toBe(true);
      expect(result.total_created).toBe(0);
      expect(result.total_skipped).toBe(12);
      expect(guild.channels.create).not.toHaveBeenCalled();
    });

    it('creates only missing items with partial structure', async () => {
      // Only General category with main channel exists
      const existingChannels = new Map([
        makeChannelEntry('c1', 'General', ChannelType.GuildCategory),
        makeChannelEntry('ch1', 'main', ChannelType.GuildText, 'c1'),
      ]);
      guild.channels.fetch.mockResolvedValue(existingChannels);

      const result = await manager.handleAction('bootstrap', { configPath });

      expect(result.success).toBe(true);
      // Skipped: General category + main channel = 2
      expect(result.total_skipped).toBe(2);
      // Created: agents + 3 categories + 7 channels = 10
      expect(result.total_created).toBe(10);
    });

    it('returns error for invalid config', async () => {
      const tmpConfig = resolve(
        __dirname,
        '..',
        'config',
        '_test_invalid.json',
      );
      writeFileSync(tmpConfig, '{"bad": true}');

      try {
        const result = await manager.handleAction('bootstrap', {
          configPath: tmpConfig,
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Invalid config/);
      } finally {
        rmSync(tmpConfig, { force: true });
      }
    });

    it('continues creating other channels when one fails (partial failure)', async () => {
      let callCount = 0;
      guild.channels.create.mockImplementation(async (opts: any) => {
        callCount++;
        // Fail on the 2nd create call (first text channel "main")
        if (callCount === 2) {
          throw new Error('Rate limited');
        }
        const id = String(channelIdCounter++);
        return {
          id,
          name: opts.name,
          type: opts.type,
          parentId: opts.parent ?? null,
        };
      });

      const result = await manager.handleAction('bootstrap', { configPath });

      // Should not be fully successful due to the error
      expect(result.success).toBe(false);
      const resultErrors = result.errors as string[] | undefined;
      expect(resultErrors).toBeDefined();
      expect(resultErrors!.length).toBeGreaterThan(0);
      expect(resultErrors![0]).toMatch(/Rate limited/);
      // But should have created other items (not stopped at first error)
      const resultCreated = result.created as string[];
      expect(resultCreated.length).toBeGreaterThan(0);
      // All 12 creates attempted (one threw but others continued)
      expect(guild.channels.create).toHaveBeenCalledTimes(12);
    });
  });
});
