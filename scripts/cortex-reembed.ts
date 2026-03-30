/**
 * Cortex Batch Re-Embed Script
 *
 * Processes all .md files in the cortex/ directory, embedding each one into
 * Qdrant. Uses content-hash skipping by default (D-03/EMBED-04) — only
 * re-embeds files whose body content has changed since the last embed.
 *
 * Usage:
 *   npx tsx scripts/cortex-reembed.ts          # Skip unchanged files
 *   npx tsx scripts/cortex-reembed.ts --force  # Re-embed all regardless of hash
 *
 * Per D-02: runs as a standalone CLI command, not part of the main process.
 * Per Pitfall 2: files are processed sequentially to avoid OpenAI rate limits.
 */

import { glob } from 'node:fs/promises';
import path from 'node:path';
import { embedEntry, createOpenAIClient } from '../src/cortex/embedder.js';
import { createQdrantClient, checkQdrantHealth } from '../src/cortex/qdrant-client.js';
import { logger } from '../src/logger.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const force = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info({ force }, 'cortex-reembed starting');

  // Create OpenAI client (reads OPENAI_API_KEY from .env via createOpenAIClient)
  let openai;
  try {
    openai = createOpenAIClient();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'Failed to create OpenAI client');
    console.error(`ERROR: ${reason}`);
    process.exit(1);
  }

  // Create Qdrant client
  const qdrant = createQdrantClient();

  // Check Qdrant health before starting batch
  const healthy = await checkQdrantHealth(qdrant);
  if (!healthy) {
    const msg = 'Qdrant not reachable at localhost:6333 — is the qdrant service running?';
    logger.error(msg);
    console.error(`ERROR: ${msg}`);
    process.exit(1);
  }

  // Find all .md files in cortex/ directory
  const cortexDir = path.join(process.cwd(), 'cortex');
  const pattern = `${cortexDir}/**/*.md`;

  logger.info({ cortexDir, force }, 'Scanning for .md files');

  const files: string[] = [];
  for await (const file of glob(pattern)) {
    files.push(file);
  }

  if (files.length === 0) {
    logger.warn({ cortexDir }, 'No .md files found in cortex directory');
    console.log('No .md files found in cortex/. Nothing to embed.');
    process.exit(0);
  }

  logger.info({ totalFiles: files.length, force }, 'Processing files sequentially');

  // Process files sequentially to avoid OpenAI rate limits (Pitfall 2)
  let embedded = 0;
  let skipped = 0;
  let errors = 0;

  for (const filePath of files) {
    const result = await embedEntry(filePath, openai, qdrant, { force });
    if (result.status === 'embedded') {
      embedded++;
      logger.info({ filePath }, 'embedded');
    } else if (result.status === 'skipped') {
      skipped++;
      logger.debug({ filePath, reason: result.reason }, 'skipped');
    } else {
      errors++;
      logger.error({ filePath, reason: result.reason }, 'error');
    }
  }

  // Final summary
  const summary = {
    total: files.length,
    embedded,
    skipped,
    errors,
    force,
  };
  logger.info(summary, 'cortex-reembed complete');
  console.log(
    `\ncortex-reembed: ${files.length} files processed — ${embedded} embedded, ${skipped} skipped, ${errors} errors`,
  );

  // Exit with code 1 if any errors occurred
  if (errors > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'cortex-reembed failed unexpectedly');
  console.error('FATAL:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
