import { describe, it, expect } from 'vitest';
import { EmbedBuilder } from 'discord.js';
import {
  buildTookEmbed,
  buildClosedEmbed,
  buildProgressEmbed,
} from './agent-status-embeds.js';

describe('agent-status-embeds', () => {
  describe('buildTookEmbed', () => {
    it('returns an EmbedBuilder with correct color (AGENT_COLORS.took = 0x5865f2)', () => {
      const embed = buildTookEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0x5865f2);
    });

    it('sets title starting with "Took:"', () => {
      const embed = buildTookEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      expect(embed.data.title).toBe('Took: Fix login bug');
    });

    it('includes Task ID field inline', () => {
      const embed = buildTookEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task ID');
      expect(taskField).toBeDefined();
      expect(taskField?.value).toBe('task-123');
      expect(taskField?.inline).toBe(true);
    });

    it('includes Agent and Type metadata fields from withAgentMeta', () => {
      const embed = buildTookEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      const fields = embed.data.fields ?? [];
      const agentField = fields.find((f) => f.name === 'Agent');
      const typeField = fields.find((f) => f.name === 'Type');
      expect(agentField?.value).toBe('Friday');
      expect(typeField?.value).toBe('took');
    });

    it('adds Description field when description is provided', () => {
      const embed = buildTookEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
        description: 'Fixing the auth flow',
      });
      const fields = embed.data.fields ?? [];
      const descField = fields.find((f) => f.name === 'Description');
      expect(descField).toBeDefined();
      expect(descField?.value).toBe('Fixing the auth flow');
    });

    it('omits Description field when description is not provided', () => {
      const embed = buildTookEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      const fields = embed.data.fields ?? [];
      const descField = fields.find((f) => f.name === 'Description');
      expect(descField).toBeUndefined();
    });

    it('has a timestamp set', () => {
      const embed = buildTookEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title at 256 chars', () => {
      const longTitle = 'A'.repeat(300);
      const embed = buildTookEmbed({ title: longTitle, taskId: 'task-123', agentName: 'Friday' });
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });
  });

  describe('buildClosedEmbed', () => {
    it('returns an EmbedBuilder with correct color (AGENT_COLORS.closed = 0x57f287)', () => {
      const embed = buildClosedEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0x57f287);
    });

    it('sets title starting with "Closed:"', () => {
      const embed = buildClosedEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      expect(embed.data.title).toBe('Closed: Fix login bug');
    });

    it('includes Task ID field inline', () => {
      const embed = buildClosedEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task ID');
      expect(taskField?.value).toBe('task-123');
      expect(taskField?.inline).toBe(true);
    });

    it('includes PR field when prUrl is provided', () => {
      const embed = buildClosedEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
        prUrl: 'https://github.com/org/repo/pull/42',
      });
      const fields = embed.data.fields ?? [];
      const prField = fields.find((f) => f.name === 'PR');
      expect(prField).toBeDefined();
      expect(prField?.value).toBe('https://github.com/org/repo/pull/42');
      expect(prField?.inline).toBe(true);
    });

    it('omits PR field when prUrl is not provided', () => {
      const embed = buildClosedEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      const fields = embed.data.fields ?? [];
      const prField = fields.find((f) => f.name === 'PR');
      expect(prField).toBeUndefined();
    });

    it('includes Agent and Type metadata fields from withAgentMeta', () => {
      const embed = buildClosedEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday', summary: 'Fixed auth flow' });
      const fields = embed.data.fields ?? [];
      const agentField = fields.find((f) => f.name === 'Agent');
      const typeField = fields.find((f) => f.name === 'Type');
      expect(agentField?.value).toBe('Friday');
      expect(typeField?.value).toBe('closed');
    });

    it('includes Summary field when summary is provided', () => {
      const embed = buildClosedEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
        summary: 'Fixed auth flow',
      });
      const fields = embed.data.fields ?? [];
      const summaryField = fields.find((f) => f.name === 'Summary');
      expect(summaryField).toBeDefined();
      expect(summaryField?.value).toBe('Fixed auth flow');
    });

    it('has a timestamp set', () => {
      const embed = buildClosedEmbed({ title: 'Fix login bug', taskId: 'task-123', agentName: 'Friday' });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title at 256 chars', () => {
      const longTitle = 'A'.repeat(300);
      const embed = buildClosedEmbed({ title: longTitle, taskId: 'task-123', agentName: 'Friday' });
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });
  });

  describe('buildProgressEmbed', () => {
    it('returns an EmbedBuilder with correct color (AGENT_COLORS.progress = 0xfeb932)', () => {
      const embed = buildProgressEmbed({ title: 'Fix login bug', agentName: 'Friday', description: 'Analyzing auth module' });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0xfeb932);
    });

    it('sets title starting with "Progress:"', () => {
      const embed = buildProgressEmbed({ title: 'Fix login bug', agentName: 'Friday', description: 'Analyzing auth module' });
      expect(embed.data.title).toBe('Progress: Fix login bug');
    });

    it('sets description', () => {
      const embed = buildProgressEmbed({ title: 'Fix login bug', agentName: 'Friday', description: 'Analyzing auth module' });
      expect(embed.data.description).toBe('Analyzing auth module');
    });

    it('includes Agent and Type metadata fields from withAgentMeta', () => {
      const embed = buildProgressEmbed({ title: 'Fix login bug', agentName: 'Friday', description: 'Analyzing auth module', taskId: 'task-123' });
      const fields = embed.data.fields ?? [];
      const agentField = fields.find((f) => f.name === 'Agent');
      const typeField = fields.find((f) => f.name === 'Type');
      expect(agentField?.value).toBe('Friday');
      expect(typeField?.value).toBe('progress');
    });

    it('includes Task field when taskId is provided', () => {
      const embed = buildProgressEmbed({ title: 'Fix login bug', agentName: 'Friday', description: 'Analyzing auth module', taskId: 'task-123' });
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task');
      expect(taskField?.value).toBe('task-123');
    });

    it('has a timestamp set', () => {
      const embed = buildProgressEmbed({ title: 'Fix login bug', agentName: 'Friday', description: 'Analyzing auth module' });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title at 256 chars', () => {
      const longTitle = 'A'.repeat(300);
      const embed = buildProgressEmbed({ title: longTitle, agentName: 'Friday', description: 'test' });
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });
  });
});
