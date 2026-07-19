import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---

// Mock registry (registerChannel runs at import time)
vi.mock('./registry.js', () => ({ registerChannel: vi.fn() }));

// Mock env reader (used by the factory, not needed in unit tests)
vi.mock('../env.js', () => ({ readEnvFile: vi.fn(() => ({})) }));

// Mock config
vi.mock('../config.js', () => ({
  ASSISTANT_NAME: 'Andy',
  TRIGGER_PATTERN: /^@Andy\b/i,
  GROUPS_DIR: '/tmp/test-groups',
}));

// Mock transcription (imports OpenAI client at module level)
vi.mock('../transcription.js', () => ({ transcribeAudio: vi.fn() }));

// Mock logger
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { callWithFloodRetry } from './telegram.js';

// grammY-shaped flood-wait error
function floodError(retryAfterSec: number) {
  return Object.assign(new Error('Too Many Requests: retry after'), {
    error_code: 429,
    parameters: { retry_after: retryAfterSec },
  });
}

describe('callWithFloodRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result when the call succeeds first try', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(callWithFloodRetry(fn, 'test')).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after retry_after seconds on 429 and then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(floodError(3))
      .mockResolvedValueOnce('ok');

    const promise = callWithFloodRetry(fn, 'test');
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses a 5s fallback delay when retry_after is missing', async () => {
    const err = Object.assign(new Error('flood'), { error_code: 429 });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce('ok');

    const promise = callWithFloodRetry(fn, 'test');
    // Not yet retried before the fallback delay elapses
    await vi.advanceTimersByTimeAsync(4999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
  });

  it('caps the flood wait at 60s', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(floodError(600))
      .mockResolvedValueOnce('ok');

    const promise = callWithFloodRetry(fn, 'test');
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after max retries and rethrows the 429', async () => {
    const fn = vi.fn().mockRejectedValue(floodError(1));

    const promise = callWithFloodRetry(fn, 'test');
    const assertion = expect(promise).rejects.toMatchObject({
      error_code: 429,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    // 1 initial call + 2 retries
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-429 errors immediately without retrying', async () => {
    const err = Object.assign(new Error('Bad Request'), { error_code: 400 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(callWithFloodRetry(fn, 'test')).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
