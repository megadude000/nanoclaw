/**
 * Agent status embed builders for #agents Discord channel.
 *
 * Builds color-coded EmbedBuilder instances for took/closed/progress messages.
 * Every embed calls withAgentMeta() to append structured metadata fields,
 * making #agents a queryable activity log (SEARCH-01).
 *
 * Phase 10 — agent-status-reporting
 */

import { EmbedBuilder } from 'discord.js';
import { AGENT_COLORS, withAgentMeta } from './agent-message-schema.js';
import type { AgentMessageType } from './agent-message-schema.js';

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

/**
 * Build an embed for when an agent takes a task.
 * Color: blurple (0x5865f2). Title: "Took: {title}".
 */
export function buildTookEmbed(params: {
  title: string;
  taskId: string;
  agentName: string;
  description?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS.took)
    .setTitle(truncate('Took: ' + params.title, 256))
    .setTimestamp();

  embed.addFields({ name: 'Task ID', value: params.taskId, inline: true });

  if (params.description) {
    embed.addFields({
      name: 'Description',
      value: truncate(params.description, 1024),
      inline: false,
    });
  }

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType: 'took',
    taskId: params.taskId,
  });
}

/**
 * Build an embed for when an agent closes a task.
 * Color: green (0x57f287). Title: "Closed: {title}".
 */
export function buildClosedEmbed(params: {
  title: string;
  taskId: string;
  agentName: string;
  prUrl?: string;
  summary?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS.closed)
    .setTitle(truncate('Closed: ' + params.title, 256))
    .setTimestamp();

  embed.addFields({ name: 'Task ID', value: params.taskId, inline: true });

  if (params.prUrl) {
    embed.addFields({ name: 'PR', value: params.prUrl, inline: true });
  }

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType: 'closed',
    taskId: params.taskId,
    summary: params.summary,
  });
}

/**
 * Build an embed for agent progress updates.
 * Color: orange (0xfeb932). Title: "Progress: {title}".
 */
export function buildProgressEmbed(params: {
  title: string;
  agentName: string;
  description: string;
  taskId?: string;
  summary?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS.progress)
    .setTitle(truncate('Progress: ' + params.title, 256))
    .setDescription(truncate(params.description, 4096))
    .setTimestamp();

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType: 'progress',
    taskId: params.taskId,
    summary: params.summary,
  });
}

/**
 * Build an embed for when an agent is blocked.
 * Color: red (0xed4245). Title: "Blocked: {resource}".
 */
export function buildBlockerEmbed(params: {
  blockerType: 'perm' | 'service' | 'conflict';
  resource: string;
  description: string;
  agentName: string;
  taskId?: string;
}): EmbedBuilder {
  const messageType = `blocker-${params.blockerType}` as AgentMessageType;
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS[messageType])
    .setTitle(truncate('Blocked: ' + params.resource, 256))
    .setDescription(truncate(params.description, 4096))
    .setTimestamp();

  embed.addFields(
    { name: 'Resource', value: truncate(params.resource, 1024), inline: true },
    { name: 'Blocker Type', value: params.blockerType, inline: true },
  );

  if (params.taskId) {
    embed.addFields({ name: 'Task ID', value: params.taskId, inline: true });
  }

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType,
    taskId: params.taskId,
  });
}

/**
 * Build an embed for when an agent hands off work to another agent.
 * Color: purple (0x9b59b6). Title: "Handoff -> {toAgent}".
 */
export function buildHandoffEmbed(params: {
  toAgent: string;
  what: string;
  why: string;
  agentName: string;
  taskId?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AGENT_COLORS.handoff)
    .setTitle(truncate('Handoff \u2192 ' + params.toAgent, 256))
    .setDescription(truncate(params.what + '\n\n**Why:** ' + params.why, 4096))
    .setTimestamp();

  embed.addFields({ name: 'To', value: params.toAgent, inline: true });

  if (params.taskId) {
    embed.addFields({ name: 'Task', value: params.taskId, inline: true });
  }

  return withAgentMeta(embed, {
    agentName: params.agentName,
    messageType: 'handoff',
    taskId: params.taskId,
  });
}
