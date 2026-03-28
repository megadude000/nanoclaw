/**
 * Discord embed builder helpers for health monitor notifications.
 *
 * Produces color-coded EmbedBuilder instances for service down/up alerts
 * and periodic heartbeat status. Health monitor is not an agent — these
 * embeds do NOT use withAgentMeta or agent-message-schema.ts.
 */

import { EmbedBuilder } from 'discord.js';

export const HEALTH_COLORS = {
  down: 0xed4245, // Red — service is down
  up: 0x57f287, // Green — service recovered
  heartbeat: 0x95a5a6, // Grey — all systems nominal
} as const;

function truncate(str: string | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

/**
 * Build a RED embed for when a service goes down.
 * Title: \u2B07 {service} DOWN
 * Description: errorSnippet (if provided)
 */
export function buildDownEmbed(
  service: string,
  errorSnippet?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(HEALTH_COLORS.down)
    .setTitle(truncate(`\u2B07 ${service} DOWN`, 256))
    .setTimestamp();

  if (errorSnippet) {
    embed.setDescription(truncate(errorSnippet, 4096));
  }

  return embed;
}

/**
 * Build a GREEN embed for when a service recovers.
 * Title: \u2B06 {service} UP
 * Description: 'Service recovered'
 */
export function buildUpEmbed(service: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(HEALTH_COLORS.up)
    .setTitle(truncate(`\u2B06 ${service} UP`, 256))
    .setDescription('Service recovered')
    .setTimestamp();
}

/**
 * Build a GREY heartbeat embed listing all services as operational.
 * Title: \uD83D\uDC9A All systems operational
 * Description: checkmark-prefixed lines for each service
 */
export function buildHeartbeatEmbed(services: string[]): EmbedBuilder {
  const description = services.map((s) => `\u2705 ${s}`).join('\n');

  return new EmbedBuilder()
    .setColor(HEALTH_COLORS.heartbeat)
    .setTitle('\uD83D\uDC9A All systems operational')
    .setDescription(description)
    .setTimestamp();
}
