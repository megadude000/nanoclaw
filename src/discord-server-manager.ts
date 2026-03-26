import { ChannelType, Guild, PermissionFlagsBits } from 'discord.js';

import { logger } from './logger.js';

export interface ServerManagerDeps {
  getGuild: () => Guild | null;
}

export interface ServerManagerResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

const PERMISSION_MAP: Record<string, bigint> = {
  ViewChannel: PermissionFlagsBits.ViewChannel,
  SendMessages: PermissionFlagsBits.SendMessages,
  ManageChannels: PermissionFlagsBits.ManageChannels,
  ManageMessages: PermissionFlagsBits.ManageMessages,
  ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
  AddReactions: PermissionFlagsBits.AddReactions,
  AttachFiles: PermissionFlagsBits.AttachFiles,
  EmbedLinks: PermissionFlagsBits.EmbedLinks,
  MentionEveryone: PermissionFlagsBits.MentionEveryone,
  Connect: PermissionFlagsBits.Connect,
  Speak: PermissionFlagsBits.Speak,
};

function resolvePermissions(names: string[]): bigint {
  let bits = BigInt(0);
  for (const name of names) {
    const flag = PERMISSION_MAP[name];
    if (flag !== undefined) {
      bits |= flag;
    }
  }
  return bits;
}

export class DiscordServerManager {
  private deps: ServerManagerDeps;

  constructor(deps: ServerManagerDeps) {
    this.deps = deps;
  }

  async handleAction(
    action: string,
    params: Record<string, unknown>,
  ): Promise<ServerManagerResult> {
    const guild = this.deps.getGuild();
    if (!guild) {
      return { success: false, error: 'Discord not connected' };
    }

    try {
      switch (action) {
        case 'create_channel':
          return await this.createChannel(guild, params);
        case 'create_category':
          return await this.createCategory(guild, params);
        case 'delete_channel':
          return await this.deleteChannel(guild, params);
        case 'rename_channel':
          return await this.renameChannel(guild, params);
        case 'set_permissions':
          return await this.setPermissions(guild, params);
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ action, error: message }, 'discord_manage action error');
      return { success: false, error: message };
    }
  }

  private async createChannel(
    guild: Guild,
    params: Record<string, unknown>,
  ): Promise<ServerManagerResult> {
    const name = params.name as string;
    const parentId = params.parentId as string | undefined;

    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      ...(parentId ? { parent: parentId } : {}),
    });

    logger.info({ channelId: channel.id, name }, 'Created Discord text channel');
    return { success: true, channelId: channel.id, name: channel.name };
  }

  private async createCategory(
    guild: Guild,
    params: Record<string, unknown>,
  ): Promise<ServerManagerResult> {
    const name = params.name as string;

    const category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
    });

    logger.info({ categoryId: category.id, name }, 'Created Discord category');
    return { success: true, categoryId: category.id, name: category.name };
  }

  private async deleteChannel(
    guild: Guild,
    params: Record<string, unknown>,
  ): Promise<ServerManagerResult> {
    const channelId = params.channelId as string;
    const channel = await guild.channels.fetch(channelId);

    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    await channel.delete();
    logger.info({ channelId }, 'Deleted Discord channel');
    return { success: true };
  }

  private async renameChannel(
    guild: Guild,
    params: Record<string, unknown>,
  ): Promise<ServerManagerResult> {
    const channelId = params.channelId as string;
    const name = params.name as string;
    const channel = await guild.channels.fetch(channelId);

    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    await channel.edit({ name });
    logger.info({ channelId, name }, 'Renamed Discord channel');
    return { success: true };
  }

  private async setPermissions(
    guild: Guild,
    params: Record<string, unknown>,
  ): Promise<ServerManagerResult> {
    const channelId = params.channelId as string;
    const overwrites = params.overwrites as Array<{
      id: string;
      allow?: string[];
      deny?: string[];
    }>;

    const channel = await guild.channels.fetch(channelId);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    for (const overwrite of overwrites) {
      const perms: { allow?: bigint; deny?: bigint } = {};
      if (overwrite.allow) {
        perms.allow = resolvePermissions(overwrite.allow);
      }
      if (overwrite.deny) {
        perms.deny = resolvePermissions(overwrite.deny);
      }
      await channel.permissionOverwrites.edit(overwrite.id, perms);
    }

    logger.info({ channelId, count: overwrites.length }, 'Updated Discord channel permissions');
    return { success: true };
  }
}
