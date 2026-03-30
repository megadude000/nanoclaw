/**
 * Cortex MCP tool logic functions.
 *
 * Testable handler factories for cortex_search, cortex_read, and cortex_write
 * MCP tools. Used both in unit tests and wired into the container MCP server.
 *
 * CRITICAL: This file must ONLY use dependencies available in both host and
 * container: openai, @qdrant/js-client-rest, gray-matter, zod, node:fs, node:path.
 * Do NOT import from src/ipc.ts, src/config.ts, or any other host-only module.
 */

import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import matter from 'gray-matter';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Inlined Cortex validation schema
// (Copy of src/cortex/schema.ts CortexFieldsStrict — do NOT import from schema.ts)
// ---------------------------------------------------------------------------

const CortexFieldsStrict = z.object({
  cortex_level: z.enum(['L10', 'L20', 'L30', 'L40', 'L50']),
  confidence: z.enum(['low', 'medium', 'high']),
  domain: z.string().min(1),
  scope: z.string().min(1),
});

// ---------------------------------------------------------------------------
// MCP result type
// ---------------------------------------------------------------------------

type McpResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

// ---------------------------------------------------------------------------
// isVaultPath — hybrid routing helper
// ---------------------------------------------------------------------------

/**
 * Returns true if the query looks like an exact vault path (route to file read),
 * false if it should be treated as a natural language semantic query.
 *
 * Pattern: ends with '.md' OR starts with known vault root directories.
 */
export function isVaultPath(query: string): boolean {
  return (
    query.endsWith('.md') ||
    query.startsWith('Areas/') ||
    query.startsWith('Calendar/') ||
    query.startsWith('System/')
  );
}

// ---------------------------------------------------------------------------
// checkConfidenceFirewall — SEARCH-02
// ---------------------------------------------------------------------------

/**
 * Checks whether writing a Cortex entry at `level` for `domain` is allowed.
 *
 * For L20+: scrolls Qdrant to verify at least one medium+ confidence L(N-10)
 * entry exists in the same domain. Returns true (blocked) if none exist.
 *
 * L10 is always allowed (no parent level to check).
 *
 * @returns true if blocked, false if allowed
 */
export async function checkConfidenceFirewall(
  level: string,
  domain: string,
  qdrant: QdrantClient,
): Promise<boolean> {
  // L10 has no parent — always allowed (Pitfall 6)
  if (level === 'L10') {
    return false;
  }

  const levelNum = parseInt(level.slice(1), 10);
  const parentLevel = `L${levelNum - 10}`;

  const result = await qdrant.scroll('cortex-entries', {
    filter: {
      must: [
        { key: 'cortex_level', match: { value: parentLevel } },
        { key: 'domain', match: { value: domain } },
        { key: 'confidence', match: { any: ['medium', 'high'] } },
      ],
    },
    limit: 1,
    with_payload: false,
  });

  // If no medium+ confidence parent entries exist, block the write
  return result.points.length === 0;
}

// ---------------------------------------------------------------------------
// buildSearchHandler — MCP-01 / SEARCH-01 / SEARCH-03
// ---------------------------------------------------------------------------

/**
 * Factory for the cortex_search handler.
 *
 * Hybrid routing:
 * - Vault path queries (isVaultPath) → direct file read from vaultRoot
 * - Natural language queries → OpenAI embedding + Qdrant vector search
 */
export function buildSearchHandler({
  qdrant,
  openai,
  vaultRoot,
}: {
  qdrant: QdrantClient;
  openai: OpenAI;
  vaultRoot: string;
}) {
  return async (args: {
    query: string;
    project?: string;
    cortex_level?: 'L10' | 'L20' | 'L30' | 'L40' | 'L50';
    domain?: string;
    limit?: number;
  }): Promise<McpResult> => {
    // Hybrid routing: exact vault path → direct read
    if (isVaultPath(args.query)) {
      const resolved = path.join(vaultRoot, args.query);
      const content = readFileSync(resolved, 'utf-8');
      return { content: [{ type: 'text' as const, text: content }] };
    }

    // Semantic search: embed query + search Qdrant
    const embedResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: args.query,
    });
    const queryVector: number[] = embedResponse.data[0].embedding;

    // Build filter from optional params
    const mustConditions: Array<{ key: string; match: { value: string } }> = [];
    if (args.project) mustConditions.push({ key: 'project', match: { value: args.project } });
    if (args.cortex_level)
      mustConditions.push({ key: 'cortex_level', match: { value: args.cortex_level } });
    if (args.domain) mustConditions.push({ key: 'domain', match: { value: args.domain } });

    const limit = Math.min(args.limit ?? 5, 20);

    const results = await qdrant.search('cortex-entries', {
      vector: queryVector,
      limit,
      with_payload: true,
      filter: mustConditions.length > 0 ? { must: mustConditions } : undefined,
    });

    const formatted = results.map((r) => ({
      path: r.payload?.file_path,
      score: r.score,
      level: r.payload?.cortex_level,
      domain: r.payload?.domain,
      project: r.payload?.project,
    }));

    return { content: [{ type: 'text' as const, text: JSON.stringify(formatted, null, 2) }] };
  };
}

// ---------------------------------------------------------------------------
// buildReadHandler — MCP-02
// ---------------------------------------------------------------------------

/**
 * Factory for the cortex_read handler.
 *
 * Reads full markdown content (including frontmatter) from a vault path.
 * Path traversal is blocked via path.resolve + startsWith guard.
 */
export function buildReadHandler({ vaultRoot }: { vaultRoot: string }) {
  return async (args: { path: string }): Promise<McpResult> => {
    const resolved = path.resolve(vaultRoot, args.path);

    // Path traversal guard (Pitfall 3)
    if (!resolved.startsWith(vaultRoot + '/')) {
      return {
        content: [{ type: 'text' as const, text: 'Error: path traversal not allowed' }],
        isError: true,
      };
    }

    if (!existsSync(resolved)) {
      return {
        content: [{ type: 'text' as const, text: `Not found: ${args.path}` }],
        isError: true,
      };
    }

    const content = readFileSync(resolved, 'utf-8');
    return { content: [{ type: 'text' as const, text: content }] };
  };
}

// ---------------------------------------------------------------------------
// buildWriteHandler — MCP-03
// ---------------------------------------------------------------------------

/**
 * Factory for the cortex_write handler.
 *
 * Validates frontmatter strictly (all 4 Cortex fields required), enforces
 * the confidence firewall for L20+, then writes an IPC file for the host
 * to process.
 */
export function buildWriteHandler({
  qdrant,
  writeIpc,
  vaultRoot: _vaultRoot,
}: {
  qdrant: QdrantClient;
  writeIpc: (data: object) => void;
  vaultRoot: string;
}) {
  return async (args: { path: string; content: string }): Promise<McpResult> => {
    // Parse and validate frontmatter
    const parsed = matter(args.content);
    const validation = CortexFieldsStrict.safeParse(parsed.data);

    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return {
        content: [{ type: 'text' as const, text: `Validation failed: ${errors}` }],
        isError: true,
      };
    }

    const { cortex_level, domain } = validation.data;

    // Confidence firewall for L20+ (SEARCH-02)
    const levelNum = parseInt(cortex_level.slice(1), 10);
    if (levelNum >= 20) {
      const blocked = await checkConfidenceFirewall(cortex_level, domain, qdrant);
      if (blocked) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Firewall: L${levelNum - 10} entries for domain '${domain}' lack medium+ confidence`,
            },
          ],
          isError: true,
        };
      }
    }

    // Queue IPC write for host processing
    writeIpc({
      type: 'cortex_write',
      path: args.path,
      content: args.content,
      timestamp: new Date().toISOString(),
    });

    return {
      content: [{ type: 'text' as const, text: `Entry queued for write: ${args.path}` }],
    };
  };
}
