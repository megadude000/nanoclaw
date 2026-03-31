/**
 * Shared schema and helpers for #agents channel message metadata.
 *
 * Every message sent to #agents by Phases 10-14 must call withAgentMeta()
 * to append structured metadata fields. This makes #agents a queryable
 * activity log (SEARCH-01).
 *
 * Do NOT import from discord-embeds.ts — this module is self-contained.
 */

import { z } from 'zod';
import { EmbedBuilder } from 'discord.js';

/**
 * The 8 message types used in the #agents channel.
 * Each type maps to a color in AGENT_COLORS.
 */
export const AgentMessageTypeSchema = z.enum([
  'took',
  'closed',
  'progress',
  'blocker-perm',
  'blocker-service',
  'blocker-conflict',
  'handoff',
  'digest',
]);
export type AgentMessageType = z.infer<typeof AgentMessageTypeSchema>;

/**
 * Structured metadata for every #agents embed.
 * agentName and messageType are required; taskId and summary are optional.
 *
 * summary — what was actually done. Required for progress/closed message types
 * to avoid opaque "Done in 38s" messages. Optional otherwise.
 */
export const AgentMessageMetaSchema = z.object({
  agentName: z.string(),
  taskId: z.string().optional(),
  messageType: AgentMessageTypeSchema,
  summary: z.string().optional(),
});
export type AgentMessageMeta = z.infer<typeof AgentMessageMetaSchema>;

// Internal truncate helper — mirrors discord-embeds.ts (not exported from that file)
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

/**
 * Appends structured metadata fields to a Discord embed.
 *
 * Adds 2-4 fields: Agent (always), Type (always), Task (if taskId present),
 * Summary (if summary present, non-inline).
 *
 * Call this last before sending to #agents — it appends to whatever fields exist.
 *
 * Note: withAgentMeta() adds 2-4 fields. Caller's embed must have ≤21 fields
 * already to stay within Discord's 25-field limit.
 */
export function withAgentMeta(
  embed: EmbedBuilder,
  meta: AgentMessageMeta,
): EmbedBuilder {
  embed.addFields(
    { name: 'Agent', value: meta.agentName, inline: true },
    { name: 'Type', value: meta.messageType, inline: true },
  );
  if (meta.taskId) {
    embed.addFields({ name: 'Task', value: meta.taskId, inline: true });
  }
  if (meta.summary) {
    embed.addFields({
      name: 'Summary',
      value: truncate(meta.summary, 1024),
      inline: false,
    });
  }
  return embed;
}

/**
 * Color map for each AgentMessageType.
 * Use AGENT_COLORS[meta.messageType] to set embed color without a switch statement.
 */
export const AGENT_COLORS: Record<AgentMessageType, number> = {
  took: 0x5865f2, // Blurple — active/in-progress
  closed: 0x57f287, // Green — success
  progress: 0xfeb932, // Orange — in-flight
  'blocker-perm': 0xed4245, // Red — permission error
  'blocker-service': 0xed4245, // Red — service unavailable
  'blocker-conflict': 0xed4245, // Red — human input needed
  handoff: 0x9b59b6, // Purple — transition
  digest: 0x95a5a6, // Grey — informational
} as const;
