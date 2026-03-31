/**
 * Qdrant Client Factory
 *
 * Creates a QdrantClient for localhost:6333. No singleton caching — callers
 * manage the lifecycle. Provides a health check with retry logic for startup
 * resilience (Pitfall 6: Qdrant may not be ready immediately on process start).
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../logger.js';

/** Name of the Qdrant collection that stores Cortex vectors (Phase 15). */
export const COLLECTION_NAME = 'cortex-entries';

/** Retry configuration for health checks. */
const HEALTH_MAX_ATTEMPTS = 5;
const HEALTH_RETRY_DELAY_MS = 2000;

/**
 * Create a new QdrantClient.
 * Uses QDRANT_URL env var if set, otherwise defaults to localhost:6333.
 * No singleton — callers own the lifecycle.
 */
export function createQdrantClient(): QdrantClient {
  const qdrantUrl = process.env.QDRANT_URL;
  if (qdrantUrl) {
    return new QdrantClient({ url: qdrantUrl });
  }
  return new QdrantClient({ host: 'localhost', port: 6333 });
}

/**
 * Check if Qdrant is reachable by attempting to list collections.
 * Retries up to 5 times with 2-second backoff between attempts.
 *
 * @returns true if Qdrant responds within the retry budget, false otherwise.
 */
export async function checkQdrantHealth(
  client: QdrantClient,
): Promise<boolean> {
  for (let attempt = 1; attempt <= HEALTH_MAX_ATTEMPTS; attempt++) {
    try {
      await client.getCollections();
      logger.info({ attempt }, 'Qdrant health check passed');
      return true;
    } catch (err) {
      if (attempt < HEALTH_MAX_ATTEMPTS) {
        logger.warn(
          { attempt, maxAttempts: HEALTH_MAX_ATTEMPTS, err },
          'Qdrant health check failed, retrying',
        );
        await new Promise((resolve) =>
          setTimeout(resolve, HEALTH_RETRY_DELAY_MS),
        );
      } else {
        logger.warn(
          { attempt, maxAttempts: HEALTH_MAX_ATTEMPTS, err },
          'Qdrant health check failed after all retries',
        );
      }
    }
  }
  return false;
}
