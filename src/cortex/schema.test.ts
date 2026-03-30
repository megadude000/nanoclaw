import { describe, it, expect } from 'vitest';
import { validateFrontmatter, inferDefaults } from './schema.js';
import { STALENESS_TTLS } from './types.js';

describe('Cortex Schema Validation', () => {
  describe('strict mode', () => {
    it('strict valid: accepts frontmatter with all Cortex fields', () => {
      const result = validateFrontmatter(
        {
          cortex_level: 'L20',
          confidence: 'medium',
          domain: 'nanoclaw',
          scope: 'IPC routing',
        },
        'test.md',
        'strict',
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('strict missing cortex_level: rejects and names the bad field', () => {
      const result = validateFrontmatter(
        { confidence: 'low', domain: 'x', scope: 'y' },
        'test.md',
        'strict',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('cortex_level'))).toBe(true);
    });

    it('invalid confidence: rejects invalid enum value', () => {
      const result = validateFrontmatter(
        { cortex_level: 'L10', confidence: 'maybe', domain: 'x', scope: 'y' },
        'test.md',
        'strict',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('confidence'))).toBe(true);
    });

    it('passthrough: preserves existing fields like type and tags', () => {
      const result = validateFrontmatter(
        {
          type: 'session',
          tags: ['foo'],
          cortex_level: 'L10',
          confidence: 'low',
          domain: 'x',
          scope: 'y',
        },
        'test.md',
        'strict',
      );
      expect(result.valid).toBe(true);
      expect(result.data.type).toBe('session');
      expect(result.data.tags).toEqual(['foo']);
    });

    it('existing domain field not overwritten by inference', () => {
      const result = validateFrontmatter(
        {
          domain: 'branding',
          project: 'YourWave',
          cortex_level: 'L20',
          confidence: 'low',
          scope: 'branding identity',
        },
        'yw.branding.md',
        'strict',
      );
      expect(result.valid).toBe(true);
      expect(result.data.domain).toBe('branding');
    });
  });

  describe('permissive mode', () => {
    it('permissive defaults: infers L50 and low confidence for Session-Logs path', () => {
      const result = validateFrontmatter(
        {},
        'Areas/Work/Session-Logs/2026-03-28.md',
        'permissive',
      );
      expect(result.valid).toBe(true);
      expect(result.data.cortex_level).toBe('L50');
      expect(result.data.confidence).toBe('low');
    });

    it('permissive defaults for daily: infers L40 for Calendar/Daily path', () => {
      const result = validateFrontmatter(
        {},
        'Calendar/Daily/2026-03-28.md',
        'permissive',
      );
      expect(result.valid).toBe(true);
      expect(result.data.cortex_level).toBe('L40');
    });

    it('permissive mode does not overwrite existing domain from raw', () => {
      const result = validateFrontmatter(
        { domain: 'branding', project: 'YourWave' },
        'Areas/Work/Projects/YourWave/yw.branding.md',
        'permissive',
      );
      expect(result.valid).toBe(true);
      expect(result.data.domain).toBe('branding');
    });

    it('permissive mode infers domain from project field when domain is missing', () => {
      const result = validateFrontmatter(
        { project: 'YourWave' },
        'test.md',
        'permissive',
      );
      expect(result.valid).toBe(true);
      expect(result.data.domain).toBe('yourwave');
    });
  });

  describe('inferDefaults', () => {
    it('infer level from path: Session-Logs -> L50', () => {
      expect(
        inferDefaults('Areas/Work/Session-Logs/foo.md', {}).cortex_level,
      ).toBe('L50');
    });

    it('infer level from path: System/Templates -> L10', () => {
      expect(
        inferDefaults('System/Templates/foo.md', {}).cortex_level,
      ).toBe('L10');
    });

    it('infer level from path: Calendar/Daily -> L40', () => {
      expect(
        inferDefaults('Calendar/Daily/foo.md', {}).cortex_level,
      ).toBe('L40');
    });

    it('infer level from path: Research -> L20', () => {
      expect(
        inferDefaults('Areas/Work/Projects/YourWave/Research/design.md', {}).cortex_level,
      ).toBe('L20');
    });

    it('infer level from path: Projects hub file -> L40', () => {
      expect(
        inferDefaults('Areas/Work/Projects/YourWave/YourWave.md', {}).cortex_level,
      ).toBe('L40');
    });

    it('infer level from path: Projects sub file -> L20', () => {
      expect(
        inferDefaults('Areas/Work/Projects/YourWave/yw.branding.md', {}).cortex_level,
      ).toBe('L20');
    });

    it('infer level from path: default -> L20', () => {
      expect(inferDefaults('random/file.md', {}).cortex_level).toBe('L20');
    });

    it('infer domain from project field', () => {
      expect(
        inferDefaults('test.md', { project: 'YourWave' }).domain,
      ).toBe('yourwave');
    });

    it('infer domain from path when no project field', () => {
      expect(
        inferDefaults('Areas/Work/Projects/NightShift/NightShift.md', {}).domain,
      ).toBe('nightshift');
    });

    it('infer scope from type field', () => {
      expect(
        inferDefaults('test.md', { type: 'session' }).scope,
      ).toBe('session');
    });

    it('infer scope from filename when no type', () => {
      expect(
        inferDefaults('Areas/Work/Projects/YourWave/yw.branding.md', {}).scope,
      ).toBe('yw branding');
    });
  });

  describe('staleness TTLs', () => {
    it('staleness TTL lookup: L10 = 14 days', () => {
      expect(STALENESS_TTLS['L10']).toBe(14);
    });

    it('staleness TTL lookup: L50 = 180 days', () => {
      expect(STALENESS_TTLS['L50']).toBe(180);
    });

    it('all levels have TTLs defined', () => {
      expect(Object.keys(STALENESS_TTLS)).toEqual([
        'L10',
        'L20',
        'L30',
        'L40',
        'L50',
      ]);
    });
  });
});
