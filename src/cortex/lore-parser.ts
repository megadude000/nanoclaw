/**
 * Lore Parser -- Git Trailer Extraction & Vault File Writer
 *
 * Extracts Constraint/Rejected/Directive trailers from git commit history
 * and writes them as Cortex vault files (type: lore-atom) for embedding
 * and search. Core engine of the Lore Protocol (Phase 20).
 *
 * Uses native git parsing via child_process.execSync (D-03: no CLI dependency).
 * Reuses embedEntry() for indexing vault files into Qdrant.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import type OpenAI from 'openai';
import type { QdrantClient } from '@qdrant/js-client-rest';
import { embedEntry } from './embedder.js';
import type { EmbedResult } from './embedder.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LORE_KEYS = ['Constraint', 'Rejected', 'Directive'] as const;
export type LoreKey = (typeof LORE_KEYS)[number];

/** Git log format: hash, subject, author date (ISO), trailers -- null-byte separated. */
const GIT_FORMAT = '%H%x00%s%x00%aI%x00%(trailers)%x00';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoreAtom {
  commitHash: string;
  commitSubject: string;
  commitDate: string;
  trailerKey: LoreKey;
  trailerValue: string;
}

// ---------------------------------------------------------------------------
// parseLoreFromGit
// ---------------------------------------------------------------------------

/**
 * Extract lore atoms (Constraint/Rejected/Directive trailers) from git log.
 *
 * Shells out to `git log` with `%(trailers)` format (D-03: native git, no CLI).
 * Sets maxBuffer to 10MB to handle large histories (Pitfall 2).
 *
 * @param repoDir - Path to the git repository
 * @param since - Optional date filter (e.g., '2026-01-01')
 * @returns Array of LoreAtom objects
 */
export function parseLoreFromGit(repoDir: string, since?: string): LoreAtom[] {
  const args = ['git', 'log', `--format=${GIT_FORMAT}`];
  if (since) args.push(`--since=${since}`);

  const raw = execSync(args.join(' '), {
    cwd: repoDir,
    maxBuffer: 10 * 1024 * 1024, // 10MB for large histories
  });

  const output = raw.toString('utf-8');
  if (!output.trim()) return [];

  const atoms: LoreAtom[] = [];

  // Split on the null byte that terminates each commit block.
  // Each block is: hash\x00subject\x00date\x00trailers\x00
  // Between commits there may be a newline after the trailing \x00.
  for (const block of output.split('\x00\n').filter(Boolean)) {
    const parts = block.split('\x00');
    if (parts.length < 4) continue;

    const [hash, subject, date, ...trailerParts] = parts;
    // Join remaining parts and strip any trailing null bytes from format terminator
    const trailerText = trailerParts.join('\x00').replace(/\x00+$/, '');

    for (const key of LORE_KEYS) {
      const regex = new RegExp(`^${key}:\\s*(.+)$`, 'gm');
      let match;
      while ((match = regex.exec(trailerText)) !== null) {
        atoms.push({
          commitHash: hash,
          commitSubject: subject,
          commitDate: date,
          trailerKey: key,
          trailerValue: match[1].trim(),
        });
      }
    }
  }

  return atoms;
}

// ---------------------------------------------------------------------------
// writeLoreAtom
// ---------------------------------------------------------------------------

/**
 * Write a lore atom as a Cortex vault file in {vaultDir}/Lore/.
 *
 * File naming: {first 7 chars of hash}-{key lowercase}.md
 * Idempotent: returns null if file already exists (Pitfall 3).
 *
 * @param atom - The lore atom to write
 * @param vaultDir - Path to the vault directory (e.g., /path/to/cortex)
 * @param options - Optional: mined=true sets confidence to low
 * @returns File path if written, null if skipped (already exists)
 */
export function writeLoreAtom(
  atom: LoreAtom,
  vaultDir: string,
  options?: { mined?: boolean },
): string | null {
  const loreDir = join(vaultDir, 'Lore');
  mkdirSync(loreDir, { recursive: true });

  const shortHash = atom.commitHash.slice(0, 7);
  const keyLower = atom.trailerKey.toLowerCase();
  const fileName = `${shortHash}-${keyLower}.md`;
  const filePath = join(loreDir, fileName);

  // Idempotent: skip if already exists
  if (existsSync(filePath)) {
    return null;
  }

  // Build frontmatter
  const frontmatter: Record<string, unknown> = {
    type: 'lore-atom',
    cortex_level: 'L20',
    confidence: options?.mined ? 'low' : 'high',
    domain: 'nanoclaw',
    scope: atom.trailerValue.slice(0, 60),
    lore_source: atom.commitHash,
    lore_key: keyLower,
    commit_date: atom.commitDate.split('T')[0],
    created: new Date().toISOString().split('T')[0],
  };

  if (options?.mined) {
    frontmatter.lore_mined = true;
  }

  // Build body
  const body = [
    `# ${atom.trailerKey}: ${atom.trailerValue}`,
    '',
    `**Commit:** ${shortHash} -- ${atom.commitSubject}`,
    `**Date:** ${atom.commitDate}`,
    `**Type:** ${atom.trailerKey}`,
    '',
    atom.trailerValue,
    '',
  ].join('\n');

  const content = matter.stringify(body, frontmatter);
  writeFileSync(filePath, content, 'utf-8');

  return filePath;
}

// ---------------------------------------------------------------------------
// indexLoreAtoms
// ---------------------------------------------------------------------------

/**
 * Embed lore atom vault files into Qdrant via embedEntry().
 *
 * @param filePaths - Array of vault file paths to embed
 * @param openai - OpenAI client (DI)
 * @param qdrant - QdrantClient (DI)
 * @returns Array of EmbedResult
 */
export async function indexLoreAtoms(
  filePaths: string[],
  openai: OpenAI,
  qdrant: QdrantClient,
): Promise<EmbedResult[]> {
  const results: EmbedResult[] = [];
  for (const fp of filePaths) {
    const result = await embedEntry(fp, openai, qdrant, { force: true });
    results.push(result);
  }
  return results;
}
