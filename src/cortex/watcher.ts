/**
 * Cortex File System Watcher
 *
 * Watches the cortex/ directory for .md file changes and triggers embedding
 * after 10 minutes of inactivity (DEBOUNCE_MS). This implements the automatic
 * embedding trigger from EMBED-02/D-01.
 *
 * Key behaviors:
 * - Only .md files are tracked (other extensions ignored)
 * - Changes are collected in a Set (deduplicates same-file changes)
 * - Embedding runs after DEBOUNCE_MS of no new changes
 * - inFlightFiles prevents self-trigger loops (embedder writes frontmatter back
 *   to the file, which would re-trigger the watcher — Pitfall 1)
 * - Gracefully skips startup if OPENAI_API_KEY is missing or Qdrant unreachable
 */

import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import path from 'node:path';
import { embedEntry, createOpenAIClient } from './embedder.js';
import { createQdrantClient, checkQdrantHealth } from './qdrant-client.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import type OpenAI from 'openai';
import type { QdrantClient } from '@qdrant/js-client-rest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Debounce interval in milliseconds (10 minutes per D-01).
 * Embedding only runs after this many ms of no new file changes.
 */
export const DEBOUNCE_MS = 600000;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let watcher: FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const changedFiles = new Set<string>();

/**
 * Files currently being written by the embedder (frontmatter update).
 * The watcher ignores changes to these files to prevent infinite re-embed loops.
 * Exported as getInFlightFiles() for testing only.
 */
const inFlightFiles = new Set<string>();

/** @internal - exported for testing only */
export function getInFlightFiles(): Set<string> {
  return inFlightFiles;
}

// ---------------------------------------------------------------------------
// processBatch
// ---------------------------------------------------------------------------

/**
 * Process a batch of changed files by calling embedEntry for each one.
 * Files are added to inFlightFiles before embedding and removed after
 * to prevent the watcher from picking up the frontmatter write-back.
 */
async function processBatch(
  files: string[],
  openai: OpenAI,
  qdrant: QdrantClient,
): Promise<void> {
  logger.info({ fileCount: files.length }, 'Cortex watcher: processing batch');

  let embedded = 0;
  let skipped = 0;
  let errors = 0;

  for (const filePath of files) {
    inFlightFiles.add(filePath);
    try {
      const result = await embedEntry(filePath, openai, qdrant);
      if (result.status === 'embedded') embedded++;
      else if (result.status === 'skipped') skipped++;
      else errors++;
    } finally {
      inFlightFiles.delete(filePath);
    }
  }

  logger.info({ embedded, skipped, errors }, 'Cortex watcher: batch complete');
}

// ---------------------------------------------------------------------------
// startCortexWatcher
// ---------------------------------------------------------------------------

/**
 * Start the cortex file system watcher (per D-04, called from main() in index.ts).
 *
 * Startup guard: checks for OPENAI_API_KEY in .env and Qdrant reachability.
 * If either fails, logs a warning and returns without starting the watcher.
 *
 * @param cortexDir - Absolute path to the cortex/ directory to watch
 */
export async function startCortexWatcher(cortexDir: string): Promise<void> {
  // Guard: check OPENAI_API_KEY via readEnvFile
  const env = readEnvFile(['OPENAI_API_KEY']);
  if (!env.OPENAI_API_KEY) {
    logger.warn('Cortex watcher disabled: OPENAI_API_KEY not found in .env');
    return;
  }

  // Create clients
  const openai = createOpenAIClient();
  const qdrant = createQdrantClient();

  // Guard: Qdrant health check
  const healthy = await checkQdrantHealth(qdrant);
  if (!healthy) {
    logger.warn(
      'Cortex watcher disabled: Qdrant not reachable at localhost:6333',
    );
    return;
  }

  // Start fs.watch with recursive:true to watch all subdirectories
  watcher = watch(cortexDir, { recursive: true }, (event, filename) => {
    // Filter 1: ignore events with no filename
    if (!filename) return;

    // Filter 2: only process .md files
    if (!filename.endsWith('.md')) return;

    const fullPath = path.join(cortexDir, filename);

    // Filter 3: ignore files currently being written by the embedder
    if (inFlightFiles.has(fullPath)) return;

    // Add to changed set (Set deduplicates same-file changes)
    changedFiles.add(fullPath);

    // Reset debounce timer — restarts the countdown on each new change
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      // Copy to array and clear the set before processing
      const batch = Array.from(changedFiles);
      changedFiles.clear();
      processBatch(batch, openai, qdrant).catch((err) =>
        logger.error({ err }, 'Cortex watcher: batch processing error'),
      );
    }, DEBOUNCE_MS);
  });

  logger.info({ cortexDir, debounceMs: DEBOUNCE_MS }, 'Cortex watcher started');
}

// ---------------------------------------------------------------------------
// stopCortexWatcher
// ---------------------------------------------------------------------------

/**
 * Stop the cortex watcher and clean up all state.
 * Called from the shutdown handler in index.ts to ensure graceful teardown.
 */
export function stopCortexWatcher(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (watcher !== null) {
    watcher.close();
    watcher = null;
  }
  changedFiles.clear();
  inFlightFiles.clear();
}
