import { describe, it, expect } from 'vitest';
import { buildBugEmbed, buildTaskEmbed, buildProgressEmbed, COLORS } from './discord-embeds.js';

describe('COLORS', () => {
  it('has correct color values', () => {
    expect(COLORS.bug).toBe(0xED4245);
    expect(COLORS.task).toBe(0x5865F2);
    expect(COLORS.progress).toBe(0x57F287);
    expect(COLORS.alert).toBe(0xFEE75C);
  });
});

describe('buildBugEmbed', () => {
  it('builds embed with correct color, title, and fields', () => {
    const embed = buildBugEmbed({
      title: 'crash on login',
      body: 'App crashes when user logs in',
      reporter: 'user1',
      labels: ['p1', 'bug'],
    });
    const data = embed.toJSON();
    expect(data.color).toBe(0xED4245);
    expect(data.title).toBe('Bug: crash on login');
    expect(data.description).toBe('App crashes when user logs in');
    expect(data.timestamp).toBeDefined();
    const reporterField = data.fields?.find((f: any) => f.name === 'Reporter');
    expect(reporterField?.value).toBe('user1');
    expect(reporterField?.inline).toBe(true);
    const labelsField = data.fields?.find((f: any) => f.name === 'Labels');
    expect(labelsField?.value).toBe('p1, bug');
  });

  it('sets URL when provided', () => {
    const embed = buildBugEmbed({ title: 'test', url: 'https://example.com' });
    expect(embed.toJSON().url).toBe('https://example.com');
  });

  it('truncates long title and description', () => {
    const embed = buildBugEmbed({
      title: 'A'.repeat(300),
      body: 'B'.repeat(5000),
    });
    const data = embed.toJSON();
    expect(data.title!.length).toBeLessThanOrEqual(256);
    expect(data.description!.length).toBeLessThanOrEqual(4096);
  });
});

describe('buildTaskEmbed', () => {
  it('builds embed with correct color and fields', () => {
    const embed = buildTaskEmbed({
      title: 'implement feature',
      status: 'in-progress',
      assignee: 'dev1',
    });
    const data = embed.toJSON();
    expect(data.color).toBe(0x5865F2);
    expect(data.title).toBe('Task: implement feature');
    expect(data.timestamp).toBeDefined();
    const statusField = data.fields?.find((f: any) => f.name === 'Status');
    expect(statusField?.value).toBe('in-progress');
    expect(statusField?.inline).toBe(true);
    const assigneeField = data.fields?.find((f: any) => f.name === 'Assignee');
    expect(assigneeField?.value).toBe('dev1');
  });

  it('sets URL when provided', () => {
    const embed = buildTaskEmbed({ title: 'test', url: 'https://example.com' });
    expect(embed.toJSON().url).toBe('https://example.com');
  });
});

describe('buildProgressEmbed', () => {
  it('builds embed with correct color and fields', () => {
    const embed = buildProgressEmbed({
      phase: '03',
      plan: '01',
      percent: 75,
    });
    const data = embed.toJSON();
    expect(data.color).toBe(0x57F287);
    expect(data.title).toBe('Progress Update');
    expect(data.timestamp).toBeDefined();
    const phaseField = data.fields?.find((f: any) => f.name === 'Phase');
    expect(phaseField?.value).toBe('03');
    expect(phaseField?.inline).toBe(true);
    const percentField = data.fields?.find((f: any) => f.name === 'Percent');
    expect(percentField?.value).toBe('75%');
  });

  it('adds details as non-inline field', () => {
    const embed = buildProgressEmbed({
      phase: '03',
      details: 'Some detailed progress info',
    });
    const data = embed.toJSON();
    const detailsField = data.fields?.find((f: any) => f.name === 'Details');
    expect(detailsField?.value).toBe('Some detailed progress info');
    expect(detailsField?.inline).toBe(false);
  });

  it('truncates details field at 1024 chars', () => {
    const embed = buildProgressEmbed({
      details: 'D'.repeat(2000),
    });
    const data = embed.toJSON();
    const detailsField = data.fields?.find((f: any) => f.name === 'Details');
    expect(detailsField?.value.length).toBeLessThanOrEqual(1024);
  });
});
