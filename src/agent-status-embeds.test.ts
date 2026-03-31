import { describe, it, expect } from 'vitest';
import { EmbedBuilder } from 'discord.js';
import {
  buildTookEmbed,
  buildClosedEmbed,
  buildProgressEmbed,
  buildBlockerEmbed,
  buildHandoffEmbed,
  buildReconciliationEmbed,
} from './agent-status-embeds.js';

describe('agent-status-embeds', () => {
  describe('buildTookEmbed', () => {
    it('returns an EmbedBuilder with correct color (AGENT_COLORS.took = 0x5865f2)', () => {
      const embed = buildTookEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0x5865f2);
    });

    it('sets title starting with "Took:"', () => {
      const embed = buildTookEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      expect(embed.data.title).toBe('Took: Fix login bug');
    });

    it('includes Task ID field inline', () => {
      const embed = buildTookEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task ID');
      expect(taskField).toBeDefined();
      expect(taskField?.value).toBe('task-123');
      expect(taskField?.inline).toBe(true);
    });

    it('includes Agent and Type metadata fields from withAgentMeta', () => {
      const embed = buildTookEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
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
      const embed = buildTookEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const descField = fields.find((f) => f.name === 'Description');
      expect(descField).toBeUndefined();
    });

    it('has a timestamp set', () => {
      const embed = buildTookEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title at 256 chars', () => {
      const longTitle = 'A'.repeat(300);
      const embed = buildTookEmbed({
        title: longTitle,
        taskId: 'task-123',
        agentName: 'Friday',
      });
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });
  });

  describe('buildClosedEmbed', () => {
    it('returns an EmbedBuilder with correct color (AGENT_COLORS.closed = 0x57f287)', () => {
      const embed = buildClosedEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0x57f287);
    });

    it('sets title starting with "Closed:"', () => {
      const embed = buildClosedEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      expect(embed.data.title).toBe('Closed: Fix login bug');
    });

    it('includes Task ID field inline', () => {
      const embed = buildClosedEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
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
      const embed = buildClosedEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const prField = fields.find((f) => f.name === 'PR');
      expect(prField).toBeUndefined();
    });

    it('includes Agent and Type metadata fields from withAgentMeta', () => {
      const embed = buildClosedEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
        summary: 'Fixed auth flow',
      });
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
      const embed = buildClosedEmbed({
        title: 'Fix login bug',
        taskId: 'task-123',
        agentName: 'Friday',
      });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title at 256 chars', () => {
      const longTitle = 'A'.repeat(300);
      const embed = buildClosedEmbed({
        title: longTitle,
        taskId: 'task-123',
        agentName: 'Friday',
      });
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });
  });

  describe('buildProgressEmbed', () => {
    it('returns an EmbedBuilder with correct color (AGENT_COLORS.progress = 0xfeb932)', () => {
      const embed = buildProgressEmbed({
        title: 'Fix login bug',
        agentName: 'Friday',
        description: 'Analyzing auth module',
      });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0xfeb932);
    });

    it('sets title starting with "Progress:"', () => {
      const embed = buildProgressEmbed({
        title: 'Fix login bug',
        agentName: 'Friday',
        description: 'Analyzing auth module',
      });
      expect(embed.data.title).toBe('Progress: Fix login bug');
    });

    it('sets description', () => {
      const embed = buildProgressEmbed({
        title: 'Fix login bug',
        agentName: 'Friday',
        description: 'Analyzing auth module',
      });
      expect(embed.data.description).toBe('Analyzing auth module');
    });

    it('includes Agent and Type metadata fields from withAgentMeta', () => {
      const embed = buildProgressEmbed({
        title: 'Fix login bug',
        agentName: 'Friday',
        description: 'Analyzing auth module',
        taskId: 'task-123',
      });
      const fields = embed.data.fields ?? [];
      const agentField = fields.find((f) => f.name === 'Agent');
      const typeField = fields.find((f) => f.name === 'Type');
      expect(agentField?.value).toBe('Friday');
      expect(typeField?.value).toBe('progress');
    });

    it('includes Task field when taskId is provided', () => {
      const embed = buildProgressEmbed({
        title: 'Fix login bug',
        agentName: 'Friday',
        description: 'Analyzing auth module',
        taskId: 'task-123',
      });
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task');
      expect(taskField?.value).toBe('task-123');
    });

    it('has a timestamp set', () => {
      const embed = buildProgressEmbed({
        title: 'Fix login bug',
        agentName: 'Friday',
        description: 'Analyzing auth module',
      });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title at 256 chars', () => {
      const longTitle = 'A'.repeat(300);
      const embed = buildProgressEmbed({
        title: longTitle,
        agentName: 'Friday',
        description: 'test',
      });
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });
  });

  describe('buildBlockerEmbed', () => {
    it('returns EmbedBuilder with color 0xed4245 for blockerType perm', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission',
        agentName: 'Friday',
      });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0xed4245);
    });

    it('returns EmbedBuilder with color 0xed4245 for blockerType service', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'service',
        resource: 'redis',
        description: 'Redis is down',
        agentName: 'Friday',
      });
      expect(embed.data.color).toBe(0xed4245);
    });

    it('returns EmbedBuilder with color 0xed4245 for blockerType conflict', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'conflict',
        resource: 'branch main',
        description: 'Merge conflict detected',
        agentName: 'Friday',
      });
      expect(embed.data.color).toBe(0xed4245);
    });

    it('sets title starting with "Blocked:" followed by resource name', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission',
        agentName: 'Friday',
      });
      expect(embed.data.title).toBe('Blocked: /etc/secrets');
    });

    it('sets description to params.description', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission on the file',
        agentName: 'Friday',
      });
      expect(embed.data.description).toBe('No read permission on the file');
    });

    it('includes Resource field (inline: true) with params.resource value', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const resourceField = fields.find((f) => f.name === 'Resource');
      expect(resourceField).toBeDefined();
      expect(resourceField?.value).toBe('/etc/secrets');
      expect(resourceField?.inline).toBe(true);
    });

    it('includes "Blocker Type" field (inline: true) with params.blockerType value', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'service',
        resource: 'redis',
        description: 'Redis is down',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const blockerTypeField = fields.find((f) => f.name === 'Blocker Type');
      expect(blockerTypeField).toBeDefined();
      expect(blockerTypeField?.value).toBe('service');
      expect(blockerTypeField?.inline).toBe(true);
    });

    it('includes Task ID field (inline: true) when taskId is provided', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission',
        agentName: 'Friday',
        taskId: 'task-42',
      });
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task ID');
      expect(taskField).toBeDefined();
      expect(taskField?.value).toBe('task-42');
      expect(taskField?.inline).toBe(true);
    });

    it('omits Task ID field when taskId is not provided', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task ID');
      expect(taskField).toBeUndefined();
    });

    it('includes Agent metadata field from withAgentMeta with params.agentName value', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission',
        agentName: 'Alfred',
      });
      const fields = embed.data.fields ?? [];
      const agentField = fields.find((f) => f.name === 'Agent');
      expect(agentField?.value).toBe('Alfred');
    });

    it('includes Type metadata field from withAgentMeta with value "blocker-perm"', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const typeField = fields.find((f) => f.name === 'Type');
      expect(typeField?.value).toBe('blocker-perm');
    });

    it('includes Type metadata field with value "blocker-service" for service type', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'service',
        resource: 'redis',
        description: 'Redis is down',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const typeField = fields.find((f) => f.name === 'Type');
      expect(typeField?.value).toBe('blocker-service');
    });

    it('includes Type metadata field with value "blocker-conflict" for conflict type', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'conflict',
        resource: 'branch main',
        description: 'Merge conflict',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const typeField = fields.find((f) => f.name === 'Type');
      expect(typeField?.value).toBe('blocker-conflict');
    });

    it('has a timestamp set', () => {
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: 'No read permission',
        agentName: 'Friday',
      });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title at 256 chars', () => {
      const longResource = 'R'.repeat(300);
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: longResource,
        description: 'desc',
        agentName: 'Friday',
      });
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });

    it('truncates description at 4096 chars', () => {
      const longDesc = 'D'.repeat(5000);
      const embed = buildBlockerEmbed({
        blockerType: 'perm',
        resource: '/etc/secrets',
        description: longDesc,
        agentName: 'Friday',
      });
      expect(embed.data.description!.length).toBeLessThanOrEqual(4096);
    });
  });

  describe('buildReconciliationEmbed', () => {
    it('returns an EmbedBuilder with title "Cortex Reconciliation"', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 3,
        newLinksCount: 5,
        orphanCount: 2,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 12000,
      });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.title).toBe('Cortex Reconciliation');
    });

    it('description contains stale count formatted as bold', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 3,
        newLinksCount: 5,
        orphanCount: 2,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 12000,
      });
      expect(embed.data.description).toContain('Stale entries flagged: **3**');
    });

    it('description contains new links count formatted as bold', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 3,
        newLinksCount: 5,
        orphanCount: 2,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 12000,
      });
      expect(embed.data.description).toContain('New CROSS_LINKs: **5**');
    });

    it('description contains orphan count formatted as bold', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 3,
        newLinksCount: 5,
        orphanCount: 2,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 12000,
      });
      expect(embed.data.description).toContain('Orphans found: **2**');
    });

    it('embed color is 0x9b59b6 (purple)', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 0,
        newLinksCount: 0,
        orphanCount: 0,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 5000,
      });
      expect(embed.data.color).toBe(0x9b59b6);
    });

    it('has a timestamp set from report.runAt', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 0,
        newLinksCount: 0,
        orphanCount: 0,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 5000,
      });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('includes Agent metadata field with value "Cortex"', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 0,
        newLinksCount: 0,
        orphanCount: 0,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 5000,
      });
      const fields = embed.data.fields ?? [];
      const agentField = fields.find((f) => f.name === 'Agent');
      expect(agentField?.value).toBe('Cortex');
    });

    it('includes Type metadata field with value "progress"', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 0,
        newLinksCount: 0,
        orphanCount: 0,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 5000,
      });
      const fields = embed.data.fields ?? [];
      const typeField = fields.find((f) => f.name === 'Type');
      expect(typeField?.value).toBe('progress');
    });

    it('description contains duration in seconds', () => {
      const embed = buildReconciliationEmbed({
        staleCount: 0,
        newLinksCount: 0,
        orphanCount: 0,
        runAt: '2026-03-31T04:00:00Z',
        durationMs: 12000,
      });
      expect(embed.data.description).toContain('Duration: 12s');
    });
  });

  describe('buildHandoffEmbed', () => {
    it('returns EmbedBuilder with color 0x9b59b6 (AGENT_COLORS.handoff)', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0x9b59b6);
    });

    it('sets title starting with "Handoff" followed by arrow and toAgent name', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      expect(embed.data.title).toContain('Handoff');
      expect(embed.data.title).toContain('Alfred');
    });

    it('includes To field (inline: true) with params.toAgent value', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const toField = fields.find((f) => f.name === 'To');
      expect(toField).toBeDefined();
      expect(toField?.value).toBe('Alfred');
      expect(toField?.inline).toBe(true);
    });

    it('includes Task field (inline: true) when taskId is provided', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
        taskId: 'task-99',
      });
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task');
      // Note: 'Task' may conflict with withAgentMeta Task field, using Task ID for handoff
      expect(taskField).toBeDefined();
    });

    it('omits Task field when taskId is not provided (beyond withAgentMeta fields)', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      // withAgentMeta adds 'Task' field only if taskId present — none here
      const fields = embed.data.fields ?? [];
      const taskField = fields.find((f) => f.name === 'Task');
      expect(taskField).toBeUndefined();
    });

    it('description contains params.what and params.why', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      expect(embed.data.description).toContain('Fix the auth bug');
      expect(embed.data.description).toContain('Service needs restart');
    });

    it('includes Agent metadata field from withAgentMeta with params.agentName value', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const agentField = fields.find((f) => f.name === 'Agent');
      expect(agentField?.value).toBe('Friday');
    });

    it('includes Type metadata field from withAgentMeta with value "handoff"', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      const fields = embed.data.fields ?? [];
      const typeField = fields.find((f) => f.name === 'Type');
      expect(typeField?.value).toBe('handoff');
    });

    it('has a timestamp set', () => {
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title at 256 chars', () => {
      const longAgent = 'A'.repeat(300);
      const embed = buildHandoffEmbed({
        toAgent: longAgent,
        what: 'Fix the auth bug',
        why: 'Service needs restart',
        agentName: 'Friday',
      });
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });

    it('truncates description at 4096 chars', () => {
      const longWhat = 'W'.repeat(3000);
      const longWhy = 'Y'.repeat(2000);
      const embed = buildHandoffEmbed({
        toAgent: 'Alfred',
        what: longWhat,
        why: longWhy,
        agentName: 'Friday',
      });
      expect(embed.data.description!.length).toBeLessThanOrEqual(4096);
    });
  });
});
