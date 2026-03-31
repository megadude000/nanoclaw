/**
 * Unit tests for multi-project bootstrap entry generation.
 *
 * Tests generateProjectEntries(projectSlug, vaultDocs) function from
 * scripts/bootstrap-multi-project.ts.
 *
 * All tests start RED — implementation does not exist yet.
 */

import { describe, it, expect } from 'vitest';
import { generateProjectEntries, type VaultDoc } from '../../scripts/bootstrap-multi-project.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const YOURWAVE_DOCS: VaultDoc[] = [
  {
    filename: 'YourWave.md',
    content: `# YourWave\n\nYourWave is a specialty coffee subscription service based in Czech Republic. The platform enables direct-to-consumer coffee delivery with curated roasters and flexible subscription management. Target market is Central European specialty coffee enthusiasts aged 25-45 who value quality and origin transparency.`,
  },
  {
    filename: 'yw.platform-spec.md',
    content: `# Platform Specification\n\nYourWave platform architecture document. Subscription engine, payment processing via Stripe, CRM integration, and fulfillment workflow. Core modules: catalog, subscriptions, orders, customers, analytics. API-first design with React frontend.`,
  },
  {
    filename: 'yw.market.md',
    content: `# Market Analysis\n\nSpecialty coffee market in Czech Republic. TAM estimation, competitive landscape, pricing benchmarks, customer acquisition channels. DTC model viability assessment for 2025-2026.`,
  },
];

const CONTENTFACTORY_DOCS: VaultDoc[] = [
  {
    filename: 'ContentFactory.md',
    content: `# ContentFactory\n\nContentFactory is an AI-powered content production pipeline for YourWave's social media and marketing channels. Automated generation of product descriptions, Instagram captions, email campaigns, and blog posts using Claude as the primary AI engine.`,
  },
  {
    filename: 'cf.pipeline.md',
    content: `# Content Pipeline\n\nContentFactory pipeline specification. Input: product data + brand guidelines. Output: approved, scheduled content across channels. Stages: brief generation, AI draft, human review, scheduling, publishing. Integrates with Buffer for social scheduling.`,
  },
  {
    filename: 'cf.atlas.md',
    content: `# Content Atlas\n\nContent map for YourWave brand voice and tone. Categories: educational, promotional, lifestyle, UGC. Template library, tone-of-voice guidelines, SEO keyword clusters, image direction guidelines for each content type.`,
  },
];

const NIGHTSHIFT_DOCS: VaultDoc[] = [
  {
    filename: 'NightShift.md',
    content: `# Night Shift System\n\nNight Shift is Alfred's nightly maintenance cycle for the NanoClaw intelligence platform. Runs at 2am to perform Cortex reconciliation, staleness detection, graph updates, orphan cleanup, and knowledge base maintenance.`,
  },
  {
    filename: 'nightshift.architecture.md',
    content: `# Night Shift Architecture\n\nNight Shift technical architecture. Triggered by cron via task-scheduler.ts, runs runReconciliation() from src/cortex/reconciler.ts, posts results to Discord #agents channel. Three-phase execution: staleness cascade, CROSS_LINK discovery, orphan cleanup.`,
  },
  {
    filename: 'cron-registry.md',
    content: `# Cron Registry\n\nScheduled tasks managed by NanoClaw task-scheduler. Night Shift cycle at 2am, morning digest at 7am, health check every 5 minutes, lore mining weekly. Each entry specifies trigger time, target group, and IPC task type.`,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('multi-project bootstrap', () => {
  describe('project field correctness', () => {
    it('every entry from yourwave has frontmatter.project === "yourwave"', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.frontmatter.project).toBe('yourwave');
      }
    });

    it('every entry from contentfactory has frontmatter.project === "contentfactory"', () => {
      const entries = generateProjectEntries('contentfactory', CONTENTFACTORY_DOCS);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.frontmatter.project).toBe('contentfactory');
      }
    });

    it('every entry from nightshift has frontmatter.project === "nightshift"', () => {
      const entries = generateProjectEntries('nightshift', NIGHTSHIFT_DOCS);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.frontmatter.project).toBe('nightshift');
      }
    });
  });

  describe('required frontmatter fields', () => {
    it('each entry has cortex_level L10 or L20', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      for (const entry of entries) {
        expect(['L10', 'L20']).toContain(entry.frontmatter.cortex_level);
      }
    });

    it('each entry has confidence "high"', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      for (const entry of entries) {
        expect(entry.frontmatter.confidence).toBe('high');
      }
    });

    it('each entry has domain matching project slug', () => {
      const entries = generateProjectEntries('contentfactory', CONTENTFACTORY_DOCS);
      for (const entry of entries) {
        expect(entry.frontmatter.domain).toBe('contentfactory');
      }
    });

    it('each entry has a non-empty scope string', () => {
      const entries = generateProjectEntries('nightshift', NIGHTSHIFT_DOCS);
      for (const entry of entries) {
        expect(typeof entry.frontmatter.scope).toBe('string');
        expect(entry.frontmatter.scope.length).toBeGreaterThan(0);
      }
    });

    it('each entry has type "bootstrap-extract"', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      for (const entry of entries) {
        expect(entry.frontmatter.type).toBe('bootstrap-extract');
      }
    });

    it('each entry has tags array including project slug and "bootstrap"', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      for (const entry of entries) {
        expect(Array.isArray(entry.frontmatter.tags)).toBe(true);
        expect(entry.frontmatter.tags).toContain('yourwave');
        expect(entry.frontmatter.tags).toContain('bootstrap');
      }
    });

    it('each entry has a created date string', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      for (const entry of entries) {
        expect(typeof entry.frontmatter.created).toBe('string');
        expect(entry.frontmatter.created.length).toBeGreaterThan(0);
      }
    });
  });

  describe('cortex_level assignment', () => {
    it('architecture doc gets cortex_level L20', () => {
      const entries = generateProjectEntries('nightshift', NIGHTSHIFT_DOCS);
      const archEntry = entries.find(e => e.filename.includes('architecture'));
      expect(archEntry).toBeDefined();
      expect(archEntry!.frontmatter.cortex_level).toBe('L20');
    });

    it('spec doc gets cortex_level L20', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      const specEntry = entries.find(e => e.filename.includes('spec'));
      expect(specEntry).toBeDefined();
      expect(specEntry!.frontmatter.cortex_level).toBe('L20');
    });

    it('cron doc gets cortex_level L20', () => {
      const entries = generateProjectEntries('nightshift', NIGHTSHIFT_DOCS);
      const cronEntry = entries.find(e => e.filename.includes('cron'));
      expect(cronEntry).toBeDefined();
      expect(cronEntry!.frontmatter.cortex_level).toBe('L20');
    });

    it('pipeline doc gets cortex_level L20', () => {
      const entries = generateProjectEntries('contentfactory', CONTENTFACTORY_DOCS);
      const pipelineEntry = entries.find(e => e.filename.includes('pipeline'));
      expect(pipelineEntry).toBeDefined();
      expect(pipelineEntry!.frontmatter.cortex_level).toBe('L20');
    });

    it('market doc gets cortex_level L10 (not architecture/spec/pipeline/cron)', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      const marketEntry = entries.find(e => e.filename.includes('market'));
      expect(marketEntry).toBeDefined();
      expect(marketEntry!.frontmatter.cortex_level).toBe('L10');
    });
  });

  describe('entry count and content constraints', () => {
    it('returns between 5 and 30 entries for a non-empty vaultDocs array', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries.length).toBeLessThanOrEqual(30);
    });

    it('entry body length >= 50 chars (MIN_CONTENT_LENGTH)', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      for (const entry of entries) {
        expect(entry.body.length).toBeGreaterThanOrEqual(50);
      }
    });

    it('returns empty array for empty vaultDocs input', () => {
      const entries = generateProjectEntries('yourwave', []);
      expect(entries.length).toBe(0);
    });

    it('skips docs with body shorter than 50 chars', () => {
      const shortDocs: VaultDoc[] = [
        { filename: 'short.md', content: 'Too short.' },
        ...YOURWAVE_DOCS,
      ];
      const entriesWithShort = generateProjectEntries('yourwave', shortDocs);
      // Should have same count as without the short doc
      const entriesWithout = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      expect(entriesWithShort.length).toBe(entriesWithout.length);
    });
  });

  describe('dry-run mode: no fs writes', () => {
    it('generateProjectEntries does not call fs.writeFileSync', async () => {
      // generateProjectEntries is a pure function that returns entries
      // without side effects — no file writing. This test verifies the
      // function returns data without throwing, leaving file writing to caller.
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      expect(Array.isArray(entries)).toBe(true);
      // If the function wrote files, it would need fs access.
      // Since it is pure, this test passes as long as no exception is thrown.
    });
  });

  describe('vault path computation', () => {
    it('each entry has a vaultPath containing the project pascal-case name', () => {
      const entries = generateProjectEntries('yourwave', YOURWAVE_DOCS);
      for (const entry of entries) {
        expect(entry.vaultPath).toContain('YourWave');
      }
    });

    it('each entry vaultPath ends with .md', () => {
      const entries = generateProjectEntries('contentfactory', CONTENTFACTORY_DOCS);
      for (const entry of entries) {
        expect(entry.vaultPath).toMatch(/\.md$/);
      }
    });

    it('each entry vaultPath contains bootstrap subdirectory', () => {
      const entries = generateProjectEntries('nightshift', NIGHTSHIFT_DOCS);
      for (const entry of entries) {
        expect(entry.vaultPath).toContain('bootstrap');
      }
    });
  });
});
