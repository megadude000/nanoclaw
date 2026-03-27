import {
  ChannelType,
  GuildChannel,
  Guild,
  PermissionFlagsBits,
  PermissionsBitField,
  type PermissionsString,
  type GuildBasedChannel,
  Collection,
} from 'discord.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ChannelConfigSchema = z.object({
  name: z.string(),
  topic: z.string().optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export const CategoryConfigSchema = z.object({
  name: z.string(),
  channels: z.array(ChannelConfigSchema),
});

export const ServerConfigSchema = z.object({
  categories: z.array(CategoryConfigSchema),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type CategoryConfig = z.infer<typeof CategoryConfigSchema>;
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

export interface ServerManagerDeps {
  getGuild: () => Guild | null;
}

export interface ServerManagerResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * Build a permission overwrite object from string permission names.
 * Each name maps to `true` (allow) or `false` (deny) in the overwrite.
 */
function buildPermissionOverwrite(
  names: string[],
  value: boolean | null,
): Partial<Record<PermissionsString, boolean | null>> {
  const result: Partial<Record<PermissionsString, boolean | null>> = {};
  for (const name of names) {
    // Validate that the name is a valid permission string
    if (name in PermissionFlagsBits) {
      result[name as PermissionsString] = value;
    }
  }
  return result;
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
        case 'bootstrap':
          return await this.bootstrap(guild, params);
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

    logger.info(
      { channelId: channel.id, name },
      'Created Discord text channel',
    );
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

    const fetched = await guild.channels.fetch(channelId);
    if (!fetched) {
      return { success: false, error: 'Channel not found' };
    }

    // Narrow to GuildChannel which has permissionOverwrites
    const channel = fetched as GuildChannel;

    for (const overwrite of overwrites) {
      const perms: Partial<Record<PermissionsString, boolean | null>> = {};
      if (overwrite.allow) {
        Object.assign(perms, buildPermissionOverwrite(overwrite.allow, true));
      }
      if (overwrite.deny) {
        Object.assign(perms, buildPermissionOverwrite(overwrite.deny, false));
      }
      await channel.permissionOverwrites.edit(overwrite.id, perms);
    }

    logger.info(
      { channelId, count: overwrites.length },
      'Updated Discord channel permissions',
    );
    return { success: true };
  }

  private loadConfig(configPath?: string): ServerConfig {
    const path = configPath
      ? resolve(configPath)
      : resolve(__dirname, '..', 'config', 'discord-server.json');
    const raw = readFileSync(path, 'utf-8');
    const json = JSON.parse(raw);
    return ServerConfigSchema.parse(json);
  }

  private async bootstrap(
    guild: Guild,
    params: Record<string, unknown>,
  ): Promise<ServerManagerResult> {
    let config: ServerConfig;
    try {
      config = this.loadConfig(params.configPath as string | undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Invalid config: ${message}` };
    }

    // Fetch ALL guild channels fresh from API (not cache)
    let channelMap: Map<string, GuildBasedChannel | null>;
    try {
      channelMap = await guild.channels.fetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to fetch channels: ${message}` };
    }

    // Convert to array for easy searching (works with both Collection and Map)
    const existingChannels = Array.from(channelMap.values()).filter(
      (ch): ch is GuildBasedChannel => ch !== null,
    );

    const created: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const categoryConfig of config.categories) {
      // Find existing category by name (case-insensitive)
      let category = existingChannels.find(
        (ch) =>
          ch.type === ChannelType.GuildCategory &&
          ch.name.toLowerCase() === categoryConfig.name.toLowerCase(),
      ) as GuildChannel | undefined;

      if (category) {
        skipped.push(`category:${categoryConfig.name}`);
      } else {
        try {
          category = await guild.channels.create({
            name: categoryConfig.name,
            type: ChannelType.GuildCategory,
          });
          created.push(`category:${categoryConfig.name}`);
          logger.info(
            { name: categoryConfig.name, id: category.id },
            'Bootstrap: created category',
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`category:${categoryConfig.name}: ${message}`);
          logger.error(
            { name: categoryConfig.name, error: message },
            'Bootstrap: failed to create category',
          );
          continue; // Skip channels in this category since parent failed
        }
      }

      const categoryId = category.id;

      for (const channelConfig of categoryConfig.channels) {
        // Find existing channel by name + parentId
        const existingChannel = existingChannels.find(
          (ch) =>
            ch.type === ChannelType.GuildText &&
            ch.name.toLowerCase() === channelConfig.name.toLowerCase() &&
            ch.parentId === categoryId,
        );

        if (existingChannel) {
          skipped.push(`channel:${channelConfig.name}`);
        } else {
          try {
            const newChannel = await guild.channels.create({
              name: channelConfig.name,
              type: ChannelType.GuildText,
              parent: categoryId,
              ...(channelConfig.topic ? { topic: channelConfig.topic } : {}),
            });
            created.push(`channel:${channelConfig.name}`);
            logger.info(
              {
                name: channelConfig.name,
                id: newChannel.id,
                parent: categoryId,
              },
              'Bootstrap: created channel',
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`channel:${channelConfig.name}: ${message}`);
            logger.error(
              { name: channelConfig.name, error: message },
              'Bootstrap: failed to create channel',
            );
          }
        }
      }
    }

    return {
      success: errors.length === 0,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      total_created: created.length,
      total_skipped: skipped.length,
    };
  }
}
