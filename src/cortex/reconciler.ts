/**
 * Cortex Reconciler -- Autonomous Cortex Maintenance Engine
 *
 * Pure function module with DI pattern (deps as params, no singletons).
 * Provides 4 exported functions:
 *   - checkStaleness: flags entries past their cortex_level TTL
 *   - discoverCrossLinks: finds semantically similar entries via Qdrant
 *   - findOrphans: detects unconnected, low-quality entries
 *   - runReconciliation: orchestrates all 3 steps
 *
 * Called by the IPC handler wired in Plan 02.
 *
 * Requirements covered: NIGHT-02, NIGHT-03, NIGHT-04
 */

import { globSync } from 'node:fs';
import type { QdrantClient } from '@qdrant/js-client-rest';
import { parseCortexEntry } from './parser.js';
import { STALENESS_TTLS } from './types.js';
import type { CortexLevel } from './types.js';
import {
  loadGraph, saveGraph, addEdge, hasEdge, buildIndex, getNeighbors,
} from './cortex-graph.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaleEntry {
  filePath: string;
  cortexLevel: string;
  daysSinceUpdate: number;
  ttlDays: number;
}

export interface DiscoveredLink {
  source: string;
  target: string;
  score: number;
}

export interface OrphanEntry {
  filePath: string;
  reason: string;
}

export interface ReconciliationReport {
  staleEntries: StaleEntry[];
  newLinks: DiscoveredLink[];
  orphans: OrphanEntry[];
  runAt: string;
  durationMs: number;
}

export interface ReconciliationOptions {
  stalenessTTLs?: Record<string, number>;
  cosineThreshold?: number;
  maxLinksPerEntry?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION_NAME = 'cortex-entries';
const REQUIRED_FM_FIELDS = ['cortex_level', 'confidence', 'domain', 'scope'];
const MIN_CONTENT_LENGTH = 50;

// ---------------------------------------------------------------------------
// checkStaleness
// ---------------------------------------------------------------------------

/**
 * Find Cortex entries whose updated date exceeds their cortex_level TTL.
 *
 * Uses frontmatter `updated` or `last_updated` or `created` field (NOT file mtime).
 * Entries with no date field are flagged with daysSinceUpdate = Infinity.
 */
export function checkStaleness(
  cortexDir: string,
  ttls?: Record<string, number>,
): StaleEntry[] {
  const effectiveTTLs: Record<string, number> = { ...STALENESS_TTLS, ...ttls };
  const files = globSync('**/*.md', { cwd: cortexDir });

  if (files.length === 0) return [];

  const stale: StaleEntry[] = [];
  const now = Date.now();

  for (const relPath of files) {
    const fullPath = `${cortexDir}/${relPath}`;
    try {
      const entry = parseCortexEntry(fullPath, 'permissive');
      if (!entry.validation.valid) continue;

      const fm = entry.frontmatter;
      const cortexLevel = (fm.cortex_level as string) ?? 'L10';
      const ttlDays = effectiveTTLs[cortexLevel] ?? 14;

      // Read updated date from frontmatter (Pitfall 2: never use file mtime)
      const dateStr = (fm.updated ?? fm.last_updated ?? fm.created) as string | undefined;

      let daysSinceUpdate: number;
      if (!dateStr) {
        daysSinceUpdate = Infinity;
      } else {
        const updatedMs = new Date(dateStr).getTime();
        if (Number.isNaN(updatedMs)) {
          daysSinceUpdate = Infinity;
        } else {
          daysSinceUpdate = Math.floor((now - updatedMs) / (1000 * 60 * 60 * 24));
        }
      }

      if (daysSinceUpdate > ttlDays) {
        stale.push({ filePath: fullPath, cortexLevel, daysSinceUpdate, ttlDays });
      }
    } catch (err) {
      logger.warn({ err, file: fullPath }, 'checkStaleness: failed to parse entry');
    }
  }

  logger.info({ total: files.length, stale: stale.length }, 'checkStaleness complete');
  return stale;
}

// ---------------------------------------------------------------------------
// discoverCrossLinks
// ---------------------------------------------------------------------------

/**
 * Find semantically similar Cortex entries via Qdrant vector search
 * and add CROSS_LINK edges to the knowledge graph.
 *
 * @param qdrant - QdrantClient instance (DI)
 * @param graphPath - Path to cortex-graph.json
 * @param threshold - Minimum cosine similarity (default 0.85)
 * @param maxLinksPerEntry - Maximum new links per entry (default 3)
 */
export async function discoverCrossLinks(
  qdrant: QdrantClient,
  graphPath: string,
  threshold = 0.85,
  maxLinksPerEntry = 3,
): Promise<DiscoveredLink[]> {
  const graph = loadGraph(graphPath);

  // Scroll all points from collection
  const { points } = await qdrant.scroll(COLLECTION_NAME, {
    with_vector: true,
    with_payload: true,
    limit: 1000,
  });

  if (!points || points.length === 0) return [];

  const discovered: DiscoveredLink[] = [];

  for (const point of points) {
    const sourceFilePath = (point.payload as Record<string, unknown>)?.file_path as string;
    if (!sourceFilePath) continue;

    const vector = point.vector as number[];
    if (!vector || !Array.isArray(vector)) continue;

    // Search for similar entries
    const results = await qdrant.search(COLLECTION_NAME, {
      vector,
      score_threshold: threshold,
      limit: maxLinksPerEntry + 1, // +1 to account for self-match
      with_payload: true,
    });

    let linksAdded = 0;
    for (const match of results) {
      if (linksAdded >= maxLinksPerEntry) break;

      const targetFilePath = (match.payload as Record<string, unknown>)?.file_path as string;
      if (!targetFilePath) continue;

      // Skip self-matches
      if (targetFilePath === sourceFilePath) continue;

      // Skip existing edges
      if (hasEdge(graph, sourceFilePath, targetFilePath, 'CROSS_LINK')) continue;

      const edge = {
        source: sourceFilePath,
        target: targetFilePath,
        type: 'CROSS_LINK' as const,
        created: new Date().toISOString(),
      };

      if (addEdge(graph, edge)) {
        discovered.push({ source: sourceFilePath, target: targetFilePath, score: match.score });
        linksAdded++;
      }
    }
  }

  // Save graph only when new edges were discovered
  if (discovered.length > 0) {
    saveGraph(graphPath, graph);
    logger.info({ newLinks: discovered.length }, 'discoverCrossLinks: saved new edges');
  }

  return discovered;
}

// ---------------------------------------------------------------------------
// findOrphans
// ---------------------------------------------------------------------------

/**
 * Identify Cortex entries that are orphaned: no graph edges, missing required
 * frontmatter, AND content shorter than 50 characters. All 3 conditions must
 * be true for an entry to be flagged.
 */
export function findOrphans(
  cortexDir: string,
  graphPath: string,
): OrphanEntry[] {
  const files = globSync('**/*.md', { cwd: cortexDir });
  if (files.length === 0) return [];

  const graph = loadGraph(graphPath);
  const index = buildIndex(graph);

  const orphans: OrphanEntry[] = [];

  for (const relPath of files) {
    const fullPath = `${cortexDir}/${relPath}`;
    try {
      const entry = parseCortexEntry(fullPath, 'permissive');

      // Condition A: no edges in graph
      const neighbors = getNeighbors(index, fullPath);
      if (neighbors.length > 0) continue;

      // Condition B: missing required frontmatter fields
      const fm = entry.frontmatter;
      const missingFields = REQUIRED_FM_FIELDS.filter(
        (f) => fm[f] === undefined || fm[f] === null || fm[f] === '',
      );
      const hasBadFrontmatter = !entry.validation.valid || missingFields.length > 0;
      if (!hasBadFrontmatter) continue;

      // Condition C: short content
      if (entry.content.length >= MIN_CONTENT_LENGTH) continue;

      const reasons: string[] = [];
      reasons.push('no graph edges');
      if (missingFields.length > 0) {
        reasons.push(`missing frontmatter: ${missingFields.join(', ')}`);
      } else {
        reasons.push('invalid frontmatter');
      }
      reasons.push(`content too short (${entry.content.length} chars)`);

      orphans.push({ filePath: fullPath, reason: reasons.join('; ') });
    } catch (err) {
      logger.warn({ err, file: fullPath }, 'findOrphans: failed to parse entry');
    }
  }

  logger.info({ total: files.length, orphans: orphans.length }, 'findOrphans complete');
  return orphans;
}

// ---------------------------------------------------------------------------
// runReconciliation
// ---------------------------------------------------------------------------

/**
 * Orchestrate all reconciliation steps and return a typed report.
 *
 * Handles Qdrant unavailability gracefully: skips CROSS_LINK discovery
 * but still returns staleness and orphan results.
 */
export async function runReconciliation(
  cortexDir: string,
  graphPath: string,
  qdrant: QdrantClient,
  options?: ReconciliationOptions,
): Promise<ReconciliationReport> {
  const start = Date.now();

  // Step 1: Staleness check
  const staleEntries = checkStaleness(cortexDir, options?.stalenessTTLs);

  // Step 2: Cross-link discovery (graceful Qdrant failure)
  let newLinks: DiscoveredLink[] = [];
  try {
    newLinks = await discoverCrossLinks(
      qdrant,
      graphPath,
      options?.cosineThreshold ?? 0.85,
      options?.maxLinksPerEntry ?? 3,
    );
  } catch (err) {
    logger.warn({ err }, 'runReconciliation: Qdrant unavailable, skipping cross-link discovery');
  }

  // Step 3: Orphan detection
  const orphans = findOrphans(cortexDir, graphPath);

  const report: ReconciliationReport = {
    staleEntries,
    newLinks,
    orphans,
    runAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };

  logger.info(
    { stale: staleEntries.length, links: newLinks.length, orphans: orphans.length, durationMs: report.durationMs },
    'runReconciliation complete',
  );

  return report;
}
