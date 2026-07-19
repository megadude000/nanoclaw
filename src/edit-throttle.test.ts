import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  EditThrottler,
  getRetryDelayMs,
  handleEditFailure,
  isMessageGoneError,
  isRateLimitError,
  DEFAULT_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
} from './edit-throttle.js';

describe('isRateLimitError', () => {
  it('detects grammY 429 (error_code)', () => {
    expect(isRateLimitError({ error_code: 429 })).toBe(true);
  });

  it('detects discord.js 429 (status)', () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it('rejects other errors', () => {
    expect(isRateLimitError({ error_code: 400 })).toBe(false);
    expect(isRateLimitError({ status: 500 })).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError(new Error('boom'))).toBe(false);
  });
});

describe('isMessageGoneError', () => {
  it('detects discord.js 404 status', () => {
    expect(isMessageGoneError({ status: 404 })).toBe(true);
  });

  it('detects discord.js Unknown Message code 10008', () => {
    expect(isMessageGoneError({ code: 10008, status: 400 })).toBe(true);
  });

  it('detects Telegram "message to edit not found"', () => {
    expect(
      isMessageGoneError({
        error_code: 400,
        description: 'Bad Request: message to edit not found',
      }),
    ).toBe(true);
  });

  it('detects Telegram "message to delete not found"', () => {
    expect(
      isMessageGoneError({
        error_code: 400,
        description: 'Bad Request: message to delete not found',
      }),
    ).toBe(true);
  });

  it('does NOT treat a bare Telegram 400 as gone', () => {
    expect(
      isMessageGoneError({
        error_code: 400,
        description: 'Bad Request: message is not modified',
      }),
    ).toBe(false);
    expect(isMessageGoneError({ error_code: 400 })).toBe(false);
  });
});

describe('getRetryDelayMs', () => {
  it('converts grammY retry_after seconds to ms', () => {
    expect(getRetryDelayMs({ parameters: { retry_after: 7 } })).toBe(7000);
  });

  it('caps the delay at MAX_RETRY_DELAY_MS', () => {
    expect(getRetryDelayMs({ parameters: { retry_after: 600 } })).toBe(
      MAX_RETRY_DELAY_MS,
    );
  });

  it('falls back to the default delay when retry_after is absent', () => {
    expect(getRetryDelayMs({})).toBe(DEFAULT_RETRY_DELAY_MS);
    expect(getRetryDelayMs({ parameters: { retry_after: 0 } })).toBe(
      DEFAULT_RETRY_DELAY_MS,
    );
  });

  it('honors an explicit fallback', () => {
    expect(getRetryDelayMs({}, 1234)).toBe(1234);
  });
});

describe('handleEditFailure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules onRetry after the rate-limit delay on 429', () => {
    const onRetry = vi.fn();
    const onGone = vi.fn();
    handleEditFailure(
      { error_code: 429, parameters: { retry_after: 2 } },
      { context: 'test', onRetry, onGone },
    );
    expect(onRetry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onGone).not.toHaveBeenCalled();
  });

  it('invokes onGone synchronously when the message is gone', () => {
    const onRetry = vi.fn();
    const onGone = vi.fn();
    handleEditFailure(
      { status: 404 },
      { context: 'test', onRetry, onGone },
    );
    expect(onGone).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('ignores unrelated errors (no retry, no gone)', () => {
    const onRetry = vi.fn();
    const onGone = vi.fn();
    handleEditFailure(new Error('network'), {
      context: 'test',
      onRetry,
      onGone,
    });
    vi.advanceTimersByTime(60_000);
    expect(onRetry).not.toHaveBeenCalled();
    expect(onGone).not.toHaveBeenCalled();
  });
});

describe('EditThrottler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces schedules within the window into one flush', () => {
    const throttler = new EditThrottler(3000);
    const flush = vi.fn();
    throttler.schedule('a', flush);
    throttler.schedule('a', flush);
    throttler.schedule('a', flush);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('allows a new flush after the window elapses', () => {
    const throttler = new EditThrottler(3000);
    const flush = vi.fn();
    throttler.schedule('a', flush);
    vi.advanceTimersByTime(3000);
    throttler.schedule('a', flush);
    vi.advanceTimersByTime(3000);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('throttles keys independently', () => {
    const throttler = new EditThrottler(3000);
    const flushA = vi.fn();
    const flushB = vi.fn();
    throttler.schedule('a', flushA);
    throttler.schedule('b', flushB);
    vi.advanceTimersByTime(3000);
    expect(flushA).toHaveBeenCalledTimes(1);
    expect(flushB).toHaveBeenCalledTimes(1);
  });

  it('reports pending state', () => {
    const throttler = new EditThrottler(3000);
    expect(throttler.isPending('a')).toBe(false);
    throttler.schedule('a', () => {});
    expect(throttler.isPending('a')).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(throttler.isPending('a')).toBe(false);
  });
});
