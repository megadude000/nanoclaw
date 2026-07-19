/**
 * Shared throttle + edit-error handling for message-editing subsystems.
 *
 * ProgressTracker and BotStatusPanel both edit persistent messages in place
 * and previously carried divergent copies of the same logic (throttle flags,
 * 429 retry, dead-message detection). This module is the single source of
 * truth for that behavior across both grammY (Telegram) and discord.js
 * error shapes.
 */
import { logger } from './logger.js';

export const DEFAULT_RETRY_DELAY_MS = 5_000;
export const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Rate-limit detection across both channel libraries:
 * grammY (Telegram) surfaces `error_code`; discord.js surfaces HTTP `status`.
 */
export function isRateLimitError(err: unknown): boolean {
  const e = err as { error_code?: number; status?: number };
  return e?.error_code === 429 || e?.status === 429;
}

/**
 * "Message no longer exists" — deleted or unknown message.
 * Discord: HTTP 404 or API code 10008 (Unknown Message).
 * Telegram: 400 with a "message to edit/delete not found" description.
 * A bare Telegram 400 is NOT treated as gone — grammY also uses 400 for
 * benign cases like "message is not modified".
 */
export function isMessageGoneError(err: unknown): boolean {
  const e = err as {
    error_code?: number;
    status?: number;
    code?: number;
    description?: string;
  };
  if (e?.status === 404 || e?.code === 10008) return true;
  if (
    e?.error_code === 400 &&
    /message to (edit|delete) not found|message_id_invalid|message can't be edited/i.test(
      String(e?.description ?? ''),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Delay before retrying a rate-limited edit. grammY exposes the
 * server-suggested wait as `parameters.retry_after` (seconds); discord.js
 * queues rate limits internally, so its errors rarely carry one — fall back
 * to a fixed delay, capped to avoid pathological server values.
 */
export function getRetryDelayMs(
  err: unknown,
  fallbackMs: number = DEFAULT_RETRY_DELAY_MS,
): number {
  const retryAfterSec = (err as { parameters?: { retry_after?: number } })
    ?.parameters?.retry_after;
  if (typeof retryAfterSec === 'number' && retryAfterSec > 0) {
    return Math.min(retryAfterSec * 1000, MAX_RETRY_DELAY_MS);
  }
  return fallbackMs;
}

/**
 * Uniform reaction to a failed message edit:
 * - rate limit → schedule a single retry after the server-suggested delay
 * - message gone → invoke onGone so the caller can drop/recreate its handle
 * - anything else → debug-log and move on (edits are best-effort)
 */
export function handleEditFailure(
  err: unknown,
  opts: {
    context: string;
    onRetry?: () => void;
    onGone?: () => void;
  },
): void {
  if (isRateLimitError(err)) {
    if (opts.onRetry) setTimeout(opts.onRetry, getRetryDelayMs(err));
  } else if (isMessageGoneError(err)) {
    opts.onGone?.();
  } else {
    logger.debug({ err, context: opts.context }, 'Message edit failed');
  }
}

/**
 * Per-key trailing-edge throttle: the first schedule() for a key arms a
 * timer; further schedules within the window are coalesced into that one
 * flush. The flush callback is captured at scheduling time — callers should
 * re-read current state inside it.
 */
export class EditThrottler {
  private pending = new Set<string>();

  constructor(private delayMs: number) {}

  schedule(key: string, flush: () => void): void {
    if (this.pending.has(key)) return;
    this.pending.add(key);
    setTimeout(() => {
      this.pending.delete(key);
      flush();
    }, this.delayMs);
  }

  isPending(key: string): boolean {
    return this.pending.has(key);
  }
}
