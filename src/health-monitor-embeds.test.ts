import { describe, it, expect } from 'vitest';
import { EmbedBuilder } from 'discord.js';
import {
  buildDownEmbed,
  buildUpEmbed,
  buildHeartbeatEmbed,
  HEALTH_COLORS,
} from './health-monitor-embeds.js';

describe('health-monitor-embeds', () => {
  describe('HEALTH_COLORS', () => {
    it('exports down color 0xed4245', () => {
      expect(HEALTH_COLORS.down).toBe(0xed4245);
    });

    it('exports up color 0x57f287', () => {
      expect(HEALTH_COLORS.up).toBe(0x57f287);
    });

    it('exports heartbeat color 0x95a5a6', () => {
      expect(HEALTH_COLORS.heartbeat).toBe(0x95a5a6);
    });
  });

  describe('buildDownEmbed', () => {
    it('returns an EmbedBuilder', () => {
      const embed = buildDownEmbed('nanoclaw');
      expect(embed).toBeInstanceOf(EmbedBuilder);
    });

    it('has color 0xed4245 (HEALTH_COLORS.down)', () => {
      const embed = buildDownEmbed('nanoclaw');
      expect(embed.data.color).toBe(0xed4245);
    });

    it('title contains service name and DOWN', () => {
      const embed = buildDownEmbed('nanoclaw', 'inactive');
      expect(embed.data.title).toContain('nanoclaw');
      expect(embed.data.title).toContain('DOWN');
    });

    it('title contains down arrow unicode', () => {
      const embed = buildDownEmbed('nanoclaw');
      expect(embed.data.title).toContain('\u2B07');
    });

    it('has a timestamp set', () => {
      const embed = buildDownEmbed('nanoclaw');
      expect(embed.data.timestamp).toBeDefined();
    });

    it('description contains errorSnippet when provided', () => {
      const embed = buildDownEmbed('nanoclaw', 'inactive');
      expect(embed.data.description).toContain('inactive');
    });

    it('works without errorSnippet (no description required)', () => {
      const embed = buildDownEmbed('nanoclaw');
      // description can be undefined or empty — either is acceptable
      expect(embed).toBeInstanceOf(EmbedBuilder);
    });

    it('truncates title to 256 chars', () => {
      const longService = 'S'.repeat(300);
      const embed = buildDownEmbed(longService);
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });

    it('truncates description to 4096 chars', () => {
      const longError = 'E'.repeat(5000);
      const embed = buildDownEmbed('nanoclaw', longError);
      expect(embed.data.description!.length).toBeLessThanOrEqual(4096);
    });
  });

  describe('buildUpEmbed', () => {
    it('returns an EmbedBuilder', () => {
      const embed = buildUpEmbed('cloudflared');
      expect(embed).toBeInstanceOf(EmbedBuilder);
    });

    it('has color 0x57f287 (HEALTH_COLORS.up)', () => {
      const embed = buildUpEmbed('cloudflared');
      expect(embed.data.color).toBe(0x57f287);
    });

    it('title contains service name and UP', () => {
      const embed = buildUpEmbed('cloudflared');
      expect(embed.data.title).toContain('cloudflared');
      expect(embed.data.title).toContain('UP');
    });

    it('title contains up arrow unicode', () => {
      const embed = buildUpEmbed('cloudflared');
      expect(embed.data.title).toContain('\u2B06');
    });

    it('description is "Service recovered"', () => {
      const embed = buildUpEmbed('cloudflared');
      expect(embed.data.description).toBe('Service recovered');
    });

    it('has a timestamp set', () => {
      const embed = buildUpEmbed('cloudflared');
      expect(embed.data.timestamp).toBeDefined();
    });

    it('truncates title to 256 chars', () => {
      const longService = 'S'.repeat(300);
      const embed = buildUpEmbed(longService);
      expect(embed.data.title!.length).toBeLessThanOrEqual(256);
    });
  });

  describe('buildHeartbeatEmbed', () => {
    it('returns an EmbedBuilder', () => {
      const embed = buildHeartbeatEmbed(['nanoclaw', 'yw-dev']);
      expect(embed).toBeInstanceOf(EmbedBuilder);
    });

    it('has color 0x95a5a6 (HEALTH_COLORS.heartbeat)', () => {
      const embed = buildHeartbeatEmbed(['nanoclaw', 'yw-dev']);
      expect(embed.data.color).toBe(0x95a5a6);
    });

    it('title contains "All systems operational"', () => {
      const embed = buildHeartbeatEmbed(['nanoclaw', 'yw-dev']);
      expect(embed.data.title).toContain('All systems operational');
    });

    it('description lists all services with checkmark prefix', () => {
      const embed = buildHeartbeatEmbed(['nanoclaw', 'yw-dev']);
      expect(embed.data.description).toContain('nanoclaw');
      expect(embed.data.description).toContain('yw-dev');
      expect(embed.data.description).toContain('\u2705');
    });

    it('has a timestamp set', () => {
      const embed = buildHeartbeatEmbed(['nanoclaw', 'yw-dev']);
      expect(embed.data.timestamp).toBeDefined();
    });

    it('works with a single service', () => {
      const embed = buildHeartbeatEmbed(['nanoclaw']);
      expect(embed.data.description).toContain('nanoclaw');
    });
  });
});
