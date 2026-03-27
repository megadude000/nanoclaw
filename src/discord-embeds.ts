/**
 * Discord embed builder helpers for NanoClaw notifications.
 *
 * Produces color-coded EmbedBuilder instances for bug reports, tasks,
 * and progress updates. All builders truncate fields to Discord limits.
 */

import { EmbedBuilder } from 'discord.js';

export const COLORS = {
  bug: 0xed4245, // Red
  task: 0x5865f2, // Blurple
  progress: 0x57f287, // Green
  alert: 0xfee75c, // Yellow
} as const;

function truncate(str: string | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

export function buildBugEmbed(issue: {
  title: string;
  body?: string;
  reporter?: string;
  priority?: string;
  labels?: string[];
  url?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.bug)
    .setTitle(truncate('Bug: ' + issue.title, 256))
    .setTimestamp();

  if (issue.body) embed.setDescription(truncate(issue.body, 4096));
  if (issue.url) embed.setURL(issue.url);

  if (issue.reporter) {
    embed.addFields({ name: 'Reporter', value: issue.reporter, inline: true });
  }
  if (issue.priority) {
    embed.addFields({ name: 'Priority', value: issue.priority, inline: true });
  }
  if (issue.labels && issue.labels.length > 0) {
    embed.addFields({
      name: 'Labels',
      value: issue.labels.join(', '),
      inline: true,
    });
  }

  return embed;
}

export function buildTaskEmbed(task: {
  title: string;
  description?: string;
  status?: string;
  assignee?: string;
  dueDate?: string;
  url?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.task)
    .setTitle(truncate('Task: ' + task.title, 256))
    .setTimestamp();

  if (task.description) embed.setDescription(truncate(task.description, 4096));
  if (task.url) embed.setURL(task.url);

  if (task.status) {
    embed.addFields({ name: 'Status', value: task.status, inline: true });
  }
  if (task.assignee) {
    embed.addFields({ name: 'Assignee', value: task.assignee, inline: true });
  }
  if (task.dueDate) {
    embed.addFields({ name: 'Due Date', value: task.dueDate, inline: true });
  }

  return embed;
}

export function buildProgressEmbed(data: {
  phase?: string;
  plan?: string;
  percent?: number;
  description?: string;
  details?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.progress)
    .setTitle('Progress Update')
    .setTimestamp();

  if (data.description) embed.setDescription(truncate(data.description, 4096));

  if (data.phase) {
    embed.addFields({ name: 'Phase', value: data.phase, inline: true });
  }
  if (data.plan) {
    embed.addFields({ name: 'Plan', value: data.plan, inline: true });
  }
  if (data.percent !== undefined) {
    embed.addFields({
      name: 'Percent',
      value: `${data.percent}%`,
      inline: true,
    });
  }
  if (data.details) {
    embed.addFields({
      name: 'Details',
      value: truncate(data.details, 1024),
      inline: false,
    });
  }

  return embed;
}
