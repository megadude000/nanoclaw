/**
 * Weekly-usage guard for autonomous (Autopilot) work.
 *
 * The agent-runner surfaces the claude.ai subscription rate-limit info the SDK
 * emits (`rate_limit_event`). We persist the latest weekly (`seven_day*`)
 * utilization, and gate heavy autonomous tasks when the week is nearly spent so
 * the user keeps quota for interactive use. Authoritative signal from Anthropic
 * — no self-accounting.
 */
import { getRouterState, setRouterState } from './db.js';
import { logger } from './logger.js';
import type { RateLimitSnapshot } from './container-runner.js';
import type { ScheduledTask } from './types.js';

const WEEKLY_STATE_KEY = 'usage:weekly';
/** Skip autonomous work at or above this weekly utilization (0..1). */
export const AUTOPILOT_WEEKLY_THRESHOLD = 0.8;

interface WeeklyEntry {
  utilization: number;
  status?: string;
  resetsAt?: number; // epoch ms
  at: number; // when recorded, epoch ms
}

type WeeklyState = Record<string, WeeklyEntry>; // rateLimitType -> entry

function readState(): WeeklyState {
  try {
    const raw = getRouterState(WEEKLY_STATE_KEY);
    return raw ? (JSON.parse(raw) as WeeklyState) : {};
  } catch {
    return {};
  }
}

/**
 * Persist a rate-limit snapshot. Only weekly (`seven_day*`) types are tracked;
 * five-hour/overage windows are ignored here.
 */
export function recordRateLimit(
  rl: RateLimitSnapshot | undefined,
  now = Date.now(),
): void {
  if (!rl || !rl.rateLimitType || typeof rl.utilization !== 'number') return;
  if (!rl.rateLimitType.startsWith('seven_day')) return;
  const state = readState();
  state[rl.rateLimitType] = {
    utilization: rl.utilization,
    status: rl.status,
    resetsAt: rl.resetsAt,
    at: now,
  };
  try {
    setRouterState(WEEKLY_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    logger.debug({ err }, 'usage-guard: failed to persist weekly state');
  }
}

export interface WeeklyUsage {
  utilization: number;
  rateLimitType: string;
  status?: string;
  resetsAt?: number;
  at: number;
}

/**
 * Most-constraining fresh weekly utilization across seven_day* limits, or null
 * if nothing recent is known. An entry is stale once its reset time has passed.
 */
export function getWeeklyUsage(now = Date.now()): WeeklyUsage | null {
  const state = readState();
  let worst: WeeklyUsage | null = null;
  for (const [rateLimitType, e] of Object.entries(state)) {
    // Drop entries whose window has reset (utilization no longer valid).
    const expiry = e.resetsAt ?? e.at + 7 * 24 * 60 * 60_000;
    if (now >= expiry) continue;
    if (!worst || e.utilization > worst.utilization) {
      worst = { utilization: e.utilization, rateLimitType, status: e.status, resetsAt: e.resetsAt, at: e.at };
    }
  }
  return worst;
}

/** Detect the autonomous "Autopilot" tasks the weekly gate applies to. */
export function isAutopilotTask(task: Pick<ScheduledTask, 'prompt'>): boolean {
  return /night\s?shift|nightshift|kairos|autopilot/i.test(task.prompt || '');
}

export interface SkipDecision {
  skip: boolean;
  usage?: WeeklyUsage;
  reason?: string;
}

/**
 * Decide whether to skip an autonomous run because the weekly quota is nearly
 * spent. Only applies to Autopilot tasks; other tasks always proceed.
 */
export function shouldSkipAutopilot(
  task: Pick<ScheduledTask, 'prompt'>,
  now = Date.now(),
  threshold = AUTOPILOT_WEEKLY_THRESHOLD,
): SkipDecision {
  if (!isAutopilotTask(task)) return { skip: false };
  const usage = getWeeklyUsage(now);
  if (!usage) return { skip: false };
  if (usage.utilization >= threshold) {
    return { skip: true, usage, reason: `weekly usage ${Math.round(usage.utilization * 100)}%` };
  }
  return { skip: false, usage };
}

/** Human-friendly reset time, e.g. "Tue 14:00" or "in 2d". */
export function formatReset(resetsAt: number | undefined, now = Date.now()): string {
  if (!resetsAt) return 'unknown';
  const diffMs = resetsAt - now;
  if (diffMs <= 0) return 'now';
  const days = Math.floor(diffMs / (24 * 60 * 60_000));
  const hours = Math.round((diffMs % (24 * 60 * 60_000)) / (60 * 60_000));
  if (days > 0) return `in ~${days}d ${hours}h`;
  return `in ~${hours}h`;
}
