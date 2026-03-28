import { describe, it, expect } from 'vitest';
import { EmbedBuilder } from 'discord.js';
import {
  AgentMessageMetaSchema,
  AgentMessageTypeSchema,
  withAgentMeta,
  AGENT_COLORS,
} from './agent-message-schema.js';

describe('AgentMessageTypeSchema', () => {
  it('validates all 8 enum values', () => {
    const validTypes = [
      'took',
      'closed',
      'progress',
      'blocker-perm',
      'blocker-service',
      'blocker-conflict',
      'handoff',
      'digest',
    ] as const;

    for (const type of validTypes) {
      expect(() => AgentMessageTypeSchema.parse(type)).not.toThrow();
      expect(AgentMessageTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects an invalid value', () => {
    expect(() => AgentMessageTypeSchema.parse('invalid-type')).toThrow();
    expect(() => AgentMessageTypeSchema.parse('')).toThrow();
    expect(() => AgentMessageTypeSchema.parse('blocker')).toThrow();
  });
});

describe('AgentMessageMetaSchema', () => {
  it('parses a valid object with all fields present', () => {
    const result = AgentMessageMetaSchema.parse({
      agentName: 'Friday',
      taskId: '#42',
      messageType: 'took',
    });
    expect(result.agentName).toBe('Friday');
    expect(result.taskId).toBe('#42');
    expect(result.messageType).toBe('took');
  });

  it('parses a valid object with taskId omitted (optional)', () => {
    const result = AgentMessageMetaSchema.parse({
      agentName: 'Friday',
      messageType: 'closed',
    });
    expect(result.agentName).toBe('Friday');
    expect(result.taskId).toBeUndefined();
    expect(result.messageType).toBe('closed');
  });

  it('throws when agentName is missing', () => {
    expect(() =>
      AgentMessageMetaSchema.parse({
        messageType: 'took',
      }),
    ).toThrow();
  });

  it('throws when messageType is missing', () => {
    expect(() =>
      AgentMessageMetaSchema.parse({
        agentName: 'Friday',
      }),
    ).toThrow();
  });
});

describe('withAgentMeta', () => {
  it('appends Agent and Type inline fields', () => {
    const embed = new EmbedBuilder().setTitle('Test');
    const result = withAgentMeta(embed, { agentName: 'Friday', messageType: 'took' });
    const data = result.toJSON();

    const agentField = data.fields?.find((f: any) => f.name === 'Agent');
    expect(agentField?.value).toBe('Friday');
    expect(agentField?.inline).toBe(true);

    const typeField = data.fields?.find((f: any) => f.name === 'Type');
    expect(typeField?.value).toBe('took');
    expect(typeField?.inline).toBe(true);
  });

  it('appends Task field when taskId is present', () => {
    const embed = new EmbedBuilder().setTitle('Test');
    withAgentMeta(embed, { agentName: 'Friday', messageType: 'took', taskId: '#42' });
    const data = embed.toJSON();

    const taskField = data.fields?.find((f: any) => f.name === 'Task');
    expect(taskField?.value).toBe('#42');
    expect(taskField?.inline).toBe(true);
  });

  it('does NOT add Task field when taskId is undefined', () => {
    const embed = new EmbedBuilder().setTitle('Test');
    withAgentMeta(embed, { agentName: 'Friday', messageType: 'took' });
    const data = embed.toJSON();

    const taskField = data.fields?.find((f: any) => f.name === 'Task');
    expect(taskField).toBeUndefined();
  });

  it('appends Summary non-inline field when summary is present', () => {
    const embed = new EmbedBuilder().setTitle('Test');
    withAgentMeta(embed, {
      agentName: 'Friday',
      messageType: 'progress',
      summary: 'ran 3 deploys',
    });
    const data = embed.toJSON();

    const summaryField = data.fields?.find((f: any) => f.name === 'Summary');
    expect(summaryField?.value).toBe('ran 3 deploys');
    expect(summaryField?.inline).toBe(false);
  });

  it('does NOT add Summary field when summary is undefined', () => {
    const embed = new EmbedBuilder().setTitle('Test');
    withAgentMeta(embed, { agentName: 'Friday', messageType: 'took' });
    const data = embed.toJSON();

    const summaryField = data.fields?.find((f: any) => f.name === 'Summary');
    expect(summaryField).toBeUndefined();
  });

  it('returns the same embed instance', () => {
    const embed = new EmbedBuilder().setTitle('Test');
    const result = withAgentMeta(embed, { agentName: 'Friday', messageType: 'took' });
    expect(result).toBe(embed);
  });
});

describe('AGENT_COLORS', () => {
  it('has a numeric color value for every AgentMessageType', () => {
    const expectedKeys = [
      'took',
      'closed',
      'progress',
      'blocker-perm',
      'blocker-service',
      'blocker-conflict',
      'handoff',
      'digest',
    ] as const;

    for (const key of expectedKeys) {
      expect(AGENT_COLORS[key]).toBeDefined();
      expect(typeof AGENT_COLORS[key]).toBe('number');
    }
  });

  it('has exactly 8 entries', () => {
    expect(Object.keys(AGENT_COLORS)).toHaveLength(8);
  });
});
