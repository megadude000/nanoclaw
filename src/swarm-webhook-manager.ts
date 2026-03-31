/**
 * Swarm Webhook Manager.
 *
 * Enables swarm agents (Friday, Alfred) to post in Discord with distinct
 * usernames and avatars via channel webhooks. Creates webhooks on demand,
 * caches them in memory, and falls back gracefully on failure.
 */
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TextChannel, Webhook } from 'discord.js';

import { logger } from './logger.js';
import { chunkMessage } from './discord-chunker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Zod schemas (D-07) ---

export const SwarmIdentitySchema = z.object({
  name: z.string().min(1),
  avatarURL: z.string().url(),
});

export const SwarmIdentitiesConfigSchema = z.array(SwarmIdentitySchema);

export type SwarmIdentity = z.infer<typeof SwarmIdentitySchema>;

// --- Config loader ---

const DEFAULT_CONFIG_PATH = resolve(
  __dirname,
  '..',
  'config',
  'swarm-identities.json',
);

/**
 * Load and validate swarm identity config from JSON file.
 * Returns empty array if file does not exist (graceful degradation).
 * Throws on invalid config (Zod validation error).
 */
export function loadSwarmIdentities(
  configPath: string = DEFAULT_CONFIG_PATH,
): SwarmIdentity[] {
  if (!existsSync(configPath)) {
    logger.info(
      { configPath },
      'Swarm identities config not found, returning empty',
    );
    return [];
  }

  const raw = readFileSync(configPath, 'utf-8');
  const json = JSON.parse(raw);
  return SwarmIdentitiesConfigSchema.parse(json);
}

// --- SwarmWebhookManager class ---

export class SwarmWebhookManager {
  /** Map<lowercaseName, SwarmIdentity> (D-08) */
  private identities: Map<string, SwarmIdentity>;

  /** Map<"{channelId}:{identityName}", Webhook> (D-09) */
  private cache = new Map<string, Webhook>();

  constructor(identities: SwarmIdentity[]) {
    this.identities = new Map(identities.map((i) => [i.name.toLowerCase(), i]));
  }

  /** Check if a sender name matches a configured swarm identity (case-insensitive). */
  hasIdentity(senderName: string): boolean {
    return this.identities.has(senderName.toLowerCase());
  }

  /**
   * Hydrate webhook cache from existing Discord webhooks on startup (D-10).
   * Filters by NanoClaw- prefix and valid token to avoid stale/foreign webhooks.
   */
  async hydrateCache(channels: TextChannel[]): Promise<void> {
    for (const channel of channels) {
      try {
        const webhooks = await channel.fetchWebhooks();
        for (const [, wh] of webhooks) {
          if (!wh.name?.startsWith('NanoClaw-') || !wh.token) continue;

          const identityName = wh.name.slice('NanoClaw-'.length).toLowerCase();
          if (this.identities.has(identityName)) {
            this.cache.set(`${channel.id}:${identityName}`, wh);
          }
        }
      } catch (err) {
        logger.warn(
          { channel: channel.id, err },
          'Failed to fetch webhooks for cache hydration',
        );
      }
    }
  }

  /**
   * Send a message via webhook with swarm identity override (D-04, SWRM-01, SWRM-02).
   *
   * Creates webhook on demand if not cached (D-01).
   * Chunks long messages via chunkMessage (pitfall 5).
   * Falls back gracefully on failure (D-11).
   *
   * @returns true if sent successfully, false on any failure
   */
  async send(
    channel: TextChannel,
    text: string,
    senderName: string,
  ): Promise<boolean> {
    const identity = this.identities.get(senderName.toLowerCase());
    if (!identity) return false;

    const cacheKey = `${channel.id}:${senderName.toLowerCase()}`;

    // Get or create webhook
    let webhook = this.cache.get(cacheKey);
    if (!webhook) {
      try {
        webhook = (await channel.createWebhook({
          name: this.webhookName(senderName),
          avatar: identity.avatarURL,
          reason: `NanoClaw swarm identity: ${senderName}`,
        })) as Webhook;
        this.cache.set(cacheKey, webhook);
      } catch (err) {
        logger.warn(
          { channel: channel.id, sender: senderName, err },
          'Failed to create swarm webhook',
        );
        return false;
      }
    }

    // Chunk and send
    const chunks = chunkMessage(text);
    try {
      for (const chunk of chunks) {
        await webhook.send({
          content: chunk,
          username: identity.name,
          avatarURL: identity.avatarURL,
        });
      }
      return true;
    } catch (err) {
      logger.warn(
        { channel: channel.id, sender: senderName, err },
        'Webhook send failed, removing stale cache entry',
      );
      this.cache.delete(cacheKey);
      return false;
    }
  }

  /** Generate consistent webhook name for a swarm identity (D-03). */
  private webhookName(senderName: string): string {
    return `NanoClaw-${senderName}`;
  }
}
