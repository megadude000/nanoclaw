/**
 * Multi-Project Bootstrap Entry Generation — Pure Logic Module
 *
 * Exports the generateProjectEntries() function and related types for
 * generating L10/L20 Cortex vault entries from vault markdown documents.
 *
 * This module contains only pure logic (no file I/O) so it can be unit-tested
 * without touching the filesystem. The scripts/bootstrap-multi-project.ts
 * script calls these functions and handles all I/O.
 */

import matter from 'gray-matter';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types (exported for tests and scripts)
// ---------------------------------------------------------------------------

/** A raw vault document read from disk or provided as fixture in tests. */
export interface VaultDoc {
  filename: string;
  content: string;
}

/** A generated Cortex entry ready to be written and embedded. */
export interface GeneratedEntry {
  filename: string;
  vaultPath: string;
  content: string; // full file content with YAML frontmatter + body
  body: string;    // markdown body only (no frontmatter)
  level: 'L10' | 'L20' | 'L40';
  frontmatter: {
    cortex_level: 'L10' | 'L20' | 'L40';
    confidence: 'high';
    domain: string;
    scope: string;
    type: 'bootstrap-extract';
    tags: string[];
    created: string;
    project: string;
  };
}

export type ProjectSlug = 'yourwave' | 'contentfactory' | 'nightshift';

/** Minimum body content length to embed (matches embedder.ts MIN_CONTENT_LENGTH). */
export const MIN_CONTENT_LENGTH = 50;

/**
 * Maximum body character length before truncation.
 * OpenAI text-embedding-3-small has 8192 token limit.
 * ~4 chars/token => ~28,000 chars. Use 24,000 as safe limit with frontmatter overhead.
 */
export const MAX_CONTENT_LENGTH = 24_000;

// ---------------------------------------------------------------------------
// Project metadata
// ---------------------------------------------------------------------------

export const PROJECT_PASCAL: Record<ProjectSlug, string> = {
  yourwave: 'YourWave',
  contentfactory: 'ContentFactory',
  nightshift: 'NightShift',
};

// ---------------------------------------------------------------------------
// inferCategory
// ---------------------------------------------------------------------------

/**
 * Infer a tag category from filename.
 * platform: platform/spec/architecture
 * ops: ops/cron/legal
 * content: atlas/pipeline/content
 * market: market/branding/brand
 * core: everything else
 */
export function inferCategory(filename: string): string {
  const name = filename.toLowerCase().replace(/\.md$/, '');
  if (name.includes('platform') || name.includes('spec') || name.includes('architecture')) {
    return 'platform';
  }
  if (name.includes('ops') || name.includes('cron') || name.includes('legal')) {
    return 'ops';
  }
  if (name.includes('atlas') || name.includes('pipeline') || name.includes('content')) {
    return 'content';
  }
  if (name.includes('market') || name.includes('branding') || name.includes('brand')) {
    return 'market';
  }
  return 'core';
}

// ---------------------------------------------------------------------------
// classifyLevel
// ---------------------------------------------------------------------------

/**
 * Determine L10 or L20 based on filename keywords.
 * architecture/spec/pipeline/cron docs → L20; others → L10.
 */
export function classifyLevel(filename: string): 'L10' | 'L20' {
  const name = filename.toLowerCase().replace(/\.md$/, '');
  const l20Keywords = ['architecture', 'spec', 'pipeline', 'cron'];
  for (const kw of l20Keywords) {
    if (name.includes(kw)) return 'L20';
  }
  return 'L10';
}

// ---------------------------------------------------------------------------
// generateProjectEntries (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Generate Cortex entries for a given project slug and array of vault docs.
 *
 * Pure function — no file I/O. Returns entries ready to write + embed.
 * Skips docs whose body (after stripping frontmatter) is shorter than
 * MIN_CONTENT_LENGTH (50 chars).
 *
 * @param projectSlug - 'yourwave' | 'contentfactory' | 'nightshift'
 * @param vaultDocs - Array of {filename, content} docs to process
 * @param vaultRoot - Absolute path to cortex/Areas/Projects (for vault paths)
 * @param today - Date string YYYY-MM-DD (injectable for tests)
 */
export function generateProjectEntries(
  projectSlug: ProjectSlug,
  vaultDocs: VaultDoc[],
  vaultRoot = path.resolve('cortex', 'Areas', 'Projects'),
  today = new Date().toISOString().slice(0, 10),
): GeneratedEntry[] {
  if (vaultDocs.length === 0) return [];

  const pascalCase = PROJECT_PASCAL[projectSlug] ?? projectSlug;
  const bootstrapBase = path.join(vaultRoot, pascalCase, 'bootstrap');

  const entries: GeneratedEntry[] = [];

  for (const doc of vaultDocs) {
    // Strip existing frontmatter — use body content only
    const parsed = matter(doc.content);
    let body = parsed.content.trim();

    // Skip too-short bodies
    if (body.length < MIN_CONTENT_LENGTH) continue;

    // Truncate oversized bodies to stay within OpenAI 8192 token limit
    if (body.length > MAX_CONTENT_LENGTH) {
      body = body.slice(0, MAX_CONTENT_LENGTH) + '\n\n[truncated — source document exceeds embedding token limit]';
    }

    const level = classifyLevel(doc.filename);
    const category = inferCategory(doc.filename);
    const filenameWithoutExt = doc.filename.replace(/\.md$/, '');
    const scope = `${projectSlug} — ${filenameWithoutExt}`;

    const frontmatter: GeneratedEntry['frontmatter'] = {
      cortex_level: level,
      confidence: 'high',
      domain: projectSlug,
      scope,
      type: 'bootstrap-extract',
      tags: [projectSlug, 'bootstrap', category],
      created: today,
      project: projectSlug,
    };

    // Write content with frontmatter using gray-matter
    const fullContent = matter.stringify(body, frontmatter);

    const vaultPath = path.join(bootstrapBase, doc.filename);

    entries.push({
      filename: doc.filename,
      vaultPath,
      content: fullContent,
      body,
      level,
      frontmatter,
    });
  }

  return entries;
}
