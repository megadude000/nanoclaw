/**
 * Cortex Entry Parser
 *
 * Parses Obsidian vault markdown files using gray-matter to extract
 * YAML frontmatter and body content. Computes SHA-256 hash of the
 * markdown body only (frontmatter changes do not trigger re-embedding).
 */

import matter from 'gray-matter';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateFrontmatter } from './schema.js';
import type { ParsedCortexEntry } from './types.js';

/**
 * Parse a Cortex entry from a markdown file.
 *
 * @param filePath - Path to the markdown file
 * @param mode - Validation mode: 'strict' (all fields required) or 'permissive' (defaults inferred)
 * @returns Parsed entry with frontmatter, body, source hash, and validation result
 */
export function parseCortexEntry(
  filePath: string,
  mode: 'strict' | 'permissive' = 'permissive',
): ParsedCortexEntry {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  // Hash body only -- frontmatter changes do NOT trigger re-embedding (Pitfall 4)
  const sourceHash = createHash('sha256').update(content).digest('hex');

  const validation = validateFrontmatter(
    data as Record<string, unknown>,
    filePath,
    mode,
  );

  return { filePath, frontmatter: data, content, sourceHash, validation };
}
