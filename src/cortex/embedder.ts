/**
 * Cortex Embedder — Shared Embedding Pipeline
 *
 * Converts a Cortex markdown file into a 1536-dimensional vector and upserts
 * it into the Qdrant 'cortex-entries' collection. This is the central function
 * called from the fs watcher (Phase 16), batch re-embed command (Phase 16),
 * and the cortex_write MCP tool (Phase 17).
 *
 * Pipeline per D-01/D-03/D-05:
 *   parse -> validate -> content-hash check -> embed via OpenAI -> upsert to Qdrant -> update frontmatter
 */

import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import matter from 'gray-matter';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCortexEntry } from './parser.js';
import { COLLECTION_NAME } from './qdrant-client.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** OpenAI embedding model — locked from Phase 15 (1536 dims, $0.02/1M tokens). */
export const EMBEDDING_MODEL = 'text-embedding-3-small';

/** Minimum body content length to consider for embedding (Pitfall 3). */
export const MIN_CONTENT_LENGTH = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned by embedEntry() for each file processed. */
export interface EmbedResult {
  status: 'embedded' | 'skipped' | 'error';
  filePath: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// createOpenAIClient
// ---------------------------------------------------------------------------

/**
 * Create an OpenAI client by reading OPENAI_API_KEY from .env (D-05).
 * Does NOT use process.env — follows NanoClaw's readEnvFile pattern.
 *
 * @throws Error if OPENAI_API_KEY is not found in .env
 */
export function createOpenAIClient(): OpenAI {
  const env = readEnvFile(['OPENAI_API_KEY']);
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY not found in .env -- required for embedding pipeline',
    );
  }
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

// ---------------------------------------------------------------------------
// deterministicId
// ---------------------------------------------------------------------------

/**
 * Produce a stable UUID-formatted point ID from a Cortex file path.
 *
 * Strips everything before 'cortex/' so the ID is based on the relative path
 * within the vault — the same file gets the same ID regardless of the absolute
 * prefix (e.g. different machines, different home directories).
 *
 * Uses MD5 formatted as UUID (deterministic, not cryptographic — uniqueness
 * within a vault is sufficient, no external security requirement).
 */
export function deterministicId(filePath: string): string {
  const relative = filePath.replace(/^.*cortex\//, '');
  const hash = createHash('md5').update(relative).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

// ---------------------------------------------------------------------------
// updateFrontmatter
// ---------------------------------------------------------------------------

/**
 * Write key-value pairs into a file's YAML frontmatter without disturbing body
 * content or other frontmatter fields.
 *
 * After a successful embed, writes source_hash and embedding_model back to
 * the file so subsequent runs can skip unchanged entries (D-03).
 *
 * Note: gray-matter.stringify may reformat YAML key order/quoting style.
 * This is acceptable — Obsidian handles it fine (Pitfall 5).
 */
export function updateFrontmatter(
  filePath: string,
  updates: Record<string, string>,
): void {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  Object.assign(data, updates);
  const updated = matter.stringify(content, data);
  writeFileSync(filePath, updated, 'utf-8');
}

// ---------------------------------------------------------------------------
// embedEntry (core pipeline)
// ---------------------------------------------------------------------------

/**
 * Embed a single Cortex entry into the Qdrant vector collection.
 *
 * Full pipeline:
 * 1. Parse file with parseCortexEntry (gray-matter + SHA-256 of body only)
 * 2. Validate frontmatter — return error if invalid
 * 3. Skip if content is too short (< 50 chars)
 * 4. Skip if source_hash matches and force is not set (content unchanged)
 * 5. Call OpenAI embeddings.create() with text-embedding-3-small
 * 6. Upsert vector + payload to Qdrant cortex-entries collection
 * 7. Update frontmatter with source_hash + embedding_model
 * 8. Return { status: 'embedded', filePath }
 *
 * @param filePath - Absolute path to the Cortex markdown file
 * @param openai - OpenAI client (inject for testability)
 * @param qdrant - QdrantClient (inject for testability)
 * @param options - Optional: force re-embed even when hash matches
 */
export async function embedEntry(
  filePath: string,
  openai: OpenAI,
  qdrant: QdrantClient,
  options?: { force?: boolean },
): Promise<EmbedResult> {
  try {
    // Step 1: Parse
    const entry = parseCortexEntry(filePath, 'permissive');

    // Step 2: Validate
    if (!entry.validation.valid) {
      return {
        status: 'error',
        filePath,
        reason: entry.validation.errors.join(', '),
      };
    }

    // Step 3: Content length guard (Pitfall 3)
    if (entry.content.trim().length < MIN_CONTENT_LENGTH) {
      logger.warn({ filePath }, 'Skipping embed: content too short');
      return { status: 'skipped', filePath, reason: 'content too short' };
    }

    // Step 4: Content-hash skip (D-03/EMBED-04)
    if (!options?.force && entry.frontmatter.source_hash === entry.sourceHash) {
      logger.debug({ filePath }, 'Skipping embed: content unchanged');
      return { status: 'skipped', filePath, reason: 'content unchanged' };
    }

    // Step 5: Embed via OpenAI — truncate to ~6000 chars to stay under 8192 token limit
    const MAX_EMBED_CHARS = 24_000; // ~6000 tokens at ~4 chars/token, safe margin
    const inputText = entry.content.length > MAX_EMBED_CHARS
      ? entry.content.slice(0, MAX_EMBED_CHARS)
      : entry.content;
    logger.debug({ filePath, chars: inputText.length }, 'Embedding entry');
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: inputText,
    });
    const vector: number[] = response.data[0].embedding;

    // Step 6: Build payload and upsert to Qdrant
    const payload: Record<string, unknown> = {
      file_path: filePath,
      cortex_level: entry.validation.data.cortex_level,
      confidence: entry.validation.data.confidence,
      domain: entry.validation.data.domain,
      scope: entry.validation.data.scope,
      project:
        typeof entry.frontmatter.project === 'string'
          ? entry.frontmatter.project
          : entry.validation.data.domain,
      status:
        typeof entry.frontmatter.status === 'string'
          ? entry.frontmatter.status
          : 'active',
      source_hash: entry.sourceHash,
      embedding_model: EMBEDDING_MODEL,
    };

    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: deterministicId(filePath),
          vector,
          payload,
        },
      ],
    });

    // Step 7: Write source_hash and embedding_model back to frontmatter
    updateFrontmatter(filePath, {
      source_hash: entry.sourceHash,
      embedding_model: EMBEDDING_MODEL,
    });

    logger.info({ filePath }, 'Embedded entry successfully');
    return { status: 'embedded', filePath };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error({ filePath, err }, 'Failed to embed entry');
    return { status: 'error', filePath, reason };
  }
}
