import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordServerManager, ServerManagerDeps } from './discord-server-manager.js';

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
      const result = await manager.handleAction('create_channel', { name: 'general' });
      expect(result.success).toBe(true);
      expect(result.channelId).toBe('999');
      expect(guild.channels.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'general' }),
      );
    });

    it('passes parentId when provided', async () => {
      await manager.handleAction('create_channel', { name: 'sub', parentId: '888' });
      expect(guild.channels.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'sub', parent: '888' }),
      );
    });
  });

  describe('create_category', () => {
    it('creates a category and returns categoryId', async () => {
      guild.channels.create.mockResolvedValue({ id: '777', name: 'ops' });
      const result = await manager.handleAction('create_category', { name: 'ops' });
      expect(result.success).toBe(true);
      expect(result.categoryId).toBe('777');
    });
  });

  describe('delete_channel', () => {
    it('deletes an existing channel', async () => {
      const result = await manager.handleAction('delete_channel', { channelId: '123456789' });
      expect(result.success).toBe(true);
      expect(guild._mockChannel.delete).toHaveBeenCalled();
    });

    it('returns error for non-existent channel', async () => {
      guild.channels.fetch.mockResolvedValue(null);
      const result = await manager.handleAction('delete_channel', { channelId: 'bad' });
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
      expect(guild._mockChannel.edit).toHaveBeenCalledWith({ name: 'new-name' });
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
      expect(guild._mockChannel.permissionOverwrites.edit).toHaveBeenCalledTimes(2);
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
      const disconnectedManager = new DiscordServerManager({ getGuild: () => null });
      const result = await disconnectedManager.handleAction('create_channel', { name: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not connected/i);
    });
  });

  describe('error handling', () => {
    it('catches discord.js errors and returns them', async () => {
      guild.channels.create.mockRejectedValue(new Error('Missing Permissions'));
      const result = await manager.handleAction('create_channel', { name: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing Permissions');
    });
  });
});
