/**
 * Webhook routing abstraction layer.
 *
 * Replaces hardcoded mainJid lookup in webhook handlers with a configurable
 * routing system. Each webhook type maps to one or more targets (Telegram,
 * Discord, or both) via config/routing.json.
 */
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from './logger.js';
import type { RegisteredGroup } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Zod schemas ---

const TargetSchema = z.object({
  platform: z.enum(['telegram', 'discord']),
  jid: z.string(),
});

const WebhookRouteSchema = z.object({
  targets: z.array(TargetSchema).min(1),
});

export const RoutingConfigSchema = z.record(z.string(), WebhookRouteSchema);

export type RoutingConfig = z.infer<typeof RoutingConfigSchema>;

// --- Types ---

export interface RouteTarget {
  jid: string;
  group: RegisteredGroup;
}

// --- Config path ---

const CONFIG_PATH = resolve(__dirname, '..', 'config', 'routing.json');

// --- Internal helpers ---

function mainFallback(groups: Record<string, RegisteredGroup>): RouteTarget[] {
  const entry = Object.entries(groups).find(([, g]) => g.isMain === true);
  if (!entry) return [];
  return [{ jid: entry[0], group: entry[1] }];
}

// --- Public API ---

/**
 * Resolve routing targets for a webhook type.
 *
 * Reads config/routing.json on every call (no caching — webhooks are infrequent).
 * Falls back to mainJid when config is missing, webhook type is not configured,
 * or all configured JIDs are unregistered.
 */
export function resolveTargets(
  webhookType: string,
  groups: Record<string, RegisteredGroup>,
): RouteTarget[] {
  // No groups at all — nothing to route to
  if (Object.keys(groups).length === 0) {
    logger.warn({ webhookType }, 'resolveTargets: no groups registered');
    return [];
  }

  // Check if config file exists
  if (!existsSync(CONFIG_PATH)) {
    logger.info(
      { webhookType },
      'resolveTargets: no routing config, using mainJid fallback',
    );
    return mainFallback(groups);
  }

  // Read and parse config
  let config: RoutingConfig;
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const json = JSON.parse(raw);
    config = RoutingConfigSchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(
      { webhookType, error: message },
      'resolveTargets: invalid routing config, using mainJid fallback',
    );
    return mainFallback(groups);
  }

  // Check if webhook type is configured
  const route = config[webhookType];
  if (!route) {
    logger.info(
      { webhookType },
      'resolveTargets: webhook type not in config, using mainJid fallback',
    );
    return mainFallback(groups);
  }

  // Resolve each target JID against registered groups
  const resolved: RouteTarget[] = [];
  for (const target of route.targets) {
    const group = groups[target.jid];
    if (!group) {
      logger.warn(
        { jid: target.jid, webhookType },
        'resolveTargets: JID not registered, skipping',
      );
      continue;
    }
    resolved.push({ jid: target.jid, group });
  }

  // If no targets resolved, fall back to mainJid
  if (resolved.length === 0) {
    logger.warn(
      { webhookType },
      'resolveTargets: no targets resolved, using mainJid fallback',
    );
    return mainFallback(groups);
  }

  logger.info(
    { webhookType, targets: resolved.map((r) => r.jid) },
    'resolveTargets: routing resolved',
  );
  return resolved;
}
