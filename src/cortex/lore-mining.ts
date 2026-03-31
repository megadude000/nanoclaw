/**
 * Lore Mining -- Night Shift Script for Extracting Implicit Decisions
 *
 * Heuristically scans existing git commit history for decision-indicating
 * patterns in commit bodies. Extracts candidate decisions, classifies them
 * as Constraint/Rejected/Directive, and writes them as lore-atom vault
 * files with confidence: low and lore_mined: true (D-02).
 *
 * Quality threshold: caps at 40 entries to avoid over-extraction (Pitfall 4).
 *
 * Designed to be called from a Night Shift task prompt or standalone.
 * Does NOT wire into task-scheduler.ts -- Phase 21 handles that.
 */

import { execSync } from 'node:child_process';
import type OpenAI from 'openai';
import type { QdrantClient } from '@qdrant/js-client-rest';
import { writeLoreAtom, indexLoreAtoms } from './lore-parser.js';
import type { LoreAtom, LoreKey } from './lore-parser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MiningSummary {
  total_commits_scanned: number;
  decisions_extracted: number;
  files_written: number;
  files_skipped: number;
}

// ---------------------------------------------------------------------------
// Decision-indicating patterns
// ---------------------------------------------------------------------------

/** Words/phrases that suggest a line contains a decision rationale. */
const DECISION_PATTERNS = [
  'because',
  'instead of',
  'not using',
  'to avoid',
  'must',
  'never',
  'chose',
  'rather than',
  "won't",
  "can't use",
  'requires',
  'going forward',
  'from now on',
  'mandate',
  'directive',
  'always',
  "can't",
] as const;

const DECISION_REGEX = new RegExp(
  DECISION_PATTERNS.map((p) => p.replace(/'/g, "'")).join('|'),
  'i',
);

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Patterns that indicate a Rejected decision. */
const REJECTED_PATTERNS = /\b(not using|instead of|rather than|won't|rejected)\b/i;

/** Patterns that indicate a Directive (forward-looking mandate). */
const DIRECTIVE_PATTERNS = /\b(going forward|from now on|mandate|directive)\b/i;

/** Patterns that indicate a Constraint. */
const CONSTRAINT_PATTERNS = /\b(must|requires|always|never|can't)\b/i;

function classifyDecision(text: string): LoreKey {
  if (REJECTED_PATTERNS.test(text)) return 'Rejected';
  if (DIRECTIVE_PATTERNS.test(text)) return 'Directive';
  if (CONSTRAINT_PATTERNS.test(text)) return 'Constraint';
  // Default: Constraint (most common category)
  return 'Constraint';
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

interface CandidateDecision {
  commitHash: string;
  commitSubject: string;
  commitDate: string;
  text: string;
  trailerKey: LoreKey;
}

/**
 * Git log format: hash, subject, date, body -- null-byte separated.
 * Uses %B (full body) instead of %(trailers) since we're mining body text.
 */
const GIT_FORMAT = '%H%x00%s%x00%aI%x00%B%x00';

/** Maximum mined entries to prevent over-extraction (Pitfall 4). */
const MAX_MINED_ENTRIES = 40;

/** Threshold above which we apply the quality filter. */
const OVER_EXTRACTION_THRESHOLD = 50;

/**
 * Extract implicit decisions from git commit history.
 *
 * Scans commit bodies for bullet points with decision-indicating language,
 * classifies each as Constraint/Rejected/Directive, writes vault files
 * with mined=true, and embeds them.
 *
 * @param repoDir - Path to the git repository
 * @param vaultDir - Path to the vault directory (e.g., /path/to/cortex)
 * @param openai - OpenAI client (DI)
 * @param qdrant - QdrantClient (DI)
 * @returns Mining summary with counts
 */
export async function mineLoreFromHistory(
  repoDir: string,
  vaultDir: string,
  openai: OpenAI,
  qdrant: QdrantClient,
): Promise<MiningSummary> {
  // 1. Run git log with full body, no merges
  const raw = execSync(
    `git log --format='${GIT_FORMAT}' --all --no-merges`,
    {
      cwd: repoDir,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    },
  );

  const output = raw.toString('utf-8');
  if (!output.trim()) {
    return {
      total_commits_scanned: 0,
      decisions_extracted: 0,
      files_written: 0,
      files_skipped: 0,
    };
  }

  // 2. Parse commits and extract candidate decisions
  const candidates: CandidateDecision[] = [];
  let totalCommits = 0;

  for (const block of output.split('\x00\n').filter(Boolean)) {
    const parts = block.split('\x00');
    if (parts.length < 4) continue;

    const [hash, subject, date, ...bodyParts] = parts;
    const body = bodyParts.join('\x00').replace(/\x00+$/, '').trim();

    totalCommits++;

    // Skip commits with no body (single-line messages)
    if (!body || body === subject) continue;

    // Scan body for decision-indicating bullet points
    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Only consider lines starting with "- " (bullet points)
      if (!trimmed.startsWith('- ')) continue;

      const bulletText = trimmed.slice(2).trim();

      // Must contain decision-indicating language
      if (!DECISION_REGEX.test(bulletText)) continue;

      // Skip very short bullets (likely not meaningful decisions)
      if (bulletText.length < 15) continue;

      candidates.push({
        commitHash: hash,
        commitSubject: subject,
        commitDate: date,
        text: bulletText,
        trailerKey: classifyDecision(bulletText),
      });
    }
  }

  // 3. Apply over-extraction guard (Pitfall 4)
  let selected = candidates;
  if (candidates.length > OVER_EXTRACTION_THRESHOLD) {
    // Take the longest/most specific entries (more text = more decision context)
    selected = candidates
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, MAX_MINED_ENTRIES);
  }

  // 4. Write vault files and collect paths
  const writtenPaths: string[] = [];
  let skipped = 0;

  for (const candidate of selected) {
    const atom: LoreAtom = {
      commitHash: candidate.commitHash,
      commitSubject: candidate.commitSubject,
      commitDate: candidate.commitDate,
      trailerKey: candidate.trailerKey,
      trailerValue: candidate.text,
    };

    const path = writeLoreAtom(atom, vaultDir, { mined: true });
    if (path) {
      writtenPaths.push(path);
    } else {
      skipped++;
    }
  }

  // 5. Embed all written files
  if (writtenPaths.length > 0) {
    await indexLoreAtoms(writtenPaths, openai, qdrant);
  }

  // 6. Return summary
  return {
    total_commits_scanned: totalCommits,
    decisions_extracted: selected.length,
    files_written: writtenPaths.length,
    files_skipped: skipped,
  };
}
