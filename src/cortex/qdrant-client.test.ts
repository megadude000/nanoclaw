/**
 * Tests for Qdrant client factory and health check.
 * Mocks the @qdrant/js-client-rest module to avoid requiring a live Qdrant instance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createQdrantClient,
  checkQdrantHealth,
  COLLECTION_NAME,
} from './qdrant-client.js';

const mockGetCollections = vi.fn();

vi.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: vi.fn().mockImplementation(function () {
    this.getCollections = mockGetCollections;
  }),
}));

describe('COLLECTION_NAME', () => {
  it('equals cortex-entries', () => {
    expect(COLLECTION_NAME).toBe('cortex-entries');
  });
});

describe('createQdrantClient', () => {
  it('returns a QdrantClient instance configured for localhost:6333', async () => {
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    vi.mocked(QdrantClient).mockClear();
    const client = createQdrantClient();
    expect(vi.mocked(QdrantClient)).toHaveBeenCalledWith({ host: 'localhost', port: 6333 });
    expect(client).toBeDefined();
  });

  it('creates a new instance on each call (no singleton caching)', async () => {
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    vi.mocked(QdrantClient).mockClear();
    createQdrantClient();
    createQdrantClient();
    expect(vi.mocked(QdrantClient)).toHaveBeenCalledTimes(2);
  });
});

describe('checkQdrantHealth', () => {
  let mockClient: { getCollections: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = { getCollections: vi.fn() };
    vi.useFakeTimers();
  });

  it('returns true when Qdrant responds on first attempt', async () => {
    mockClient.getCollections.mockResolvedValueOnce({ collections: [] });

    const result = checkQdrantHealth(mockClient as never);
    await vi.runAllTimersAsync();
    expect(await result).toBe(true);
    expect(mockClient.getCollections).toHaveBeenCalledTimes(1);
  });

  it('returns true after retry when Qdrant recovers', async () => {
    mockClient.getCollections
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce({ collections: [] });

    const result = checkQdrantHealth(mockClient as never);
    await vi.runAllTimersAsync();
    expect(await result).toBe(true);
    expect(mockClient.getCollections).toHaveBeenCalledTimes(2);
  });

  it('returns false when all 5 attempts fail', async () => {
    mockClient.getCollections.mockRejectedValue(new Error('connection refused'));

    const result = checkQdrantHealth(mockClient as never);
    await vi.runAllTimersAsync();
    expect(await result).toBe(false);
    expect(mockClient.getCollections).toHaveBeenCalledTimes(5);
  });
});
