import { describe, it, expect, beforeEach } from 'vitest';
import { _initTestDatabase } from './db.js';
import {
  recordRateLimit,
  getWeeklyUsage,
  isAutopilotTask,
  shouldSkipAutopilot,
} from './usage-guard.js';

const NOW = 1_000_000_000_000;
const WEEK = 7 * 24 * 60 * 60_000;

describe('usage-guard', () => {
  beforeEach(() => {
    _initTestDatabase();
  });

  it('ignores non-weekly (five_hour) limits', () => {
    recordRateLimit(
      { rateLimitType: 'five_hour', utilization: 0.99, resetsAt: NOW + WEEK },
      NOW,
    );
    expect(getWeeklyUsage(NOW)).toBeNull();
  });

  it('records and returns weekly (seven_day) utilization', () => {
    recordRateLimit(
      { rateLimitType: 'seven_day', utilization: 0.42, resetsAt: NOW + WEEK },
      NOW,
    );
    const u = getWeeklyUsage(NOW);
    expect(u?.utilization).toBe(0.42);
    expect(u?.rateLimitType).toBe('seven_day');
  });

  it('returns the most-constraining weekly limit across types', () => {
    recordRateLimit(
      { rateLimitType: 'seven_day_sonnet', utilization: 0.5, resetsAt: NOW + WEEK },
      NOW,
    );
    recordRateLimit(
      { rateLimitType: 'seven_day_opus', utilization: 0.88, resetsAt: NOW + WEEK },
      NOW,
    );
    expect(getWeeklyUsage(NOW)?.utilization).toBe(0.88);
  });

  it('drops entries whose reset window has passed', () => {
    recordRateLimit(
      { rateLimitType: 'seven_day', utilization: 0.9, resetsAt: NOW + 1000 },
      NOW,
    );
    expect(getWeeklyUsage(NOW + 2000)).toBeNull();
  });

  it('detects Autopilot (nightshift/kairos) tasks', () => {
    expect(isAutopilotTask({ prompt: 'NIGHTSHIFT EXECUTION v9' })).toBe(true);
    expect(isAutopilotTask({ prompt: 'You are KAIROS-night supervisor' })).toBe(
      true,
    );
    expect(isAutopilotTask({ prompt: 'morning digest' })).toBe(false);
  });

  it('skips an Autopilot task at/above the weekly threshold', () => {
    recordRateLimit(
      { rateLimitType: 'seven_day', utilization: 0.85, resetsAt: NOW + WEEK },
      NOW,
    );
    const d = shouldSkipAutopilot({ prompt: 'NIGHTSHIFT EXECUTION' }, NOW);
    expect(d.skip).toBe(true);
    expect(d.usage?.utilization).toBe(0.85);
  });

  it('does not skip below threshold', () => {
    recordRateLimit(
      { rateLimitType: 'seven_day', utilization: 0.5, resetsAt: NOW + WEEK },
      NOW,
    );
    expect(shouldSkipAutopilot({ prompt: 'NIGHTSHIFT' }, NOW).skip).toBe(false);
  });

  it('never skips non-Autopilot tasks even at high usage', () => {
    recordRateLimit(
      { rateLimitType: 'seven_day', utilization: 0.99, resetsAt: NOW + WEEK },
      NOW,
    );
    expect(shouldSkipAutopilot({ prompt: 'morning digest' }, NOW).skip).toBe(
      false,
    );
  });
});
