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

import type OpenAI from 'openai';
import type { QdrantClient } from '@qdrant/js-client-rest';
import type { EmbedResult } from './embedder.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LORE_KEYS = ['Constraint', 'Rejected', 'Directive'] as const;
export type LoreKey = (typeof LORE_KEYS)[number];

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
 * @param repoDir - Path to the git repository
 * @param since - Optional date filter (e.g., '2026-01-01')
 * @returns Array of LoreAtom objects
 */
export function parseLoreFromGit(
  repoDir: string,
  since?: string,
): LoreAtom[] {
  throw new Error('not implemented');
}

// ---------------------------------------------------------------------------
// writeLoreAtom
// ---------------------------------------------------------------------------

/**
 * Write a lore atom as a Cortex vault file in cortex/Lore/.
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
  throw new Error('not implemented');
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
  throw new Error('not implemented');
}
