import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _initTestDatabase, createTask, getTaskById } from './db.js';
import {
  _resetSchedulerLoopForTests,
  computeNextRun,
  estimateTaskIntervalMs,
  chooseTaskModelEffort,
  startSchedulerLoop,
} from './task-scheduler.js';
import type { RegisteredGroup, ScheduledTask } from './types.js';

describe('task scheduler', () => {
  beforeEach(() => {
    _initTestDatabase();
    _resetSchedulerLoopForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses due tasks with invalid group folders to prevent retry churn', async () => {
    createTask({
      id: 'task-invalid-folder',
      group_folder: '../../outside',
      chat_jid: 'bad@g.us',
      prompt: 'run',
      schedule_type: 'once',
      schedule_value: '2026-02-22T00:00:00.000Z',
      context_mode: 'isolated',
      next_run: new Date(Date.now() - 60_000).toISOString(),
      status: 'active',
      created_at: '2026-02-22T00:00:00.000Z',
    });

    const enqueueTask = vi.fn(
      (_groupJid: string, _taskId: string, fn: () => Promise<void>) => {
        void fn();
      },
    );

    startSchedulerLoop({
      registeredGroups: () => ({}),
      getSessions: () => ({}),
      queue: { enqueueTask } as any,
      onProcess: () => {},
      sendMessage: async () => {},
    });

    await vi.advanceTimersByTimeAsync(10);

    const task = getTaskById('task-invalid-folder');
    expect(task?.status).toBe('paused');
  });

  it('computeNextRun anchors interval tasks to scheduled time to prevent drift', () => {
    const scheduledTime = new Date(Date.now() - 2000).toISOString(); // 2s ago
    const task = {
      id: 'drift-test',
      group_folder: 'test',
      chat_jid: 'test@g.us',
      prompt: 'test',
      schedule_type: 'interval' as const,
      schedule_value: '60000', // 1 minute
      context_mode: 'isolated' as const,
      next_run: scheduledTime,
      last_run: null,
      last_result: null,
      status: 'active' as const,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    const nextRun = computeNextRun(task);
    expect(nextRun).not.toBeNull();

    // Should be anchored to scheduledTime + 60s, NOT Date.now() + 60s
    const expected = new Date(scheduledTime).getTime() + 60000;
    expect(new Date(nextRun!).getTime()).toBe(expected);
  });

  it('computeNextRun returns null for once-tasks', () => {
    const task = {
      id: 'once-test',
      group_folder: 'test',
      chat_jid: 'test@g.us',
      prompt: 'test',
      schedule_type: 'once' as const,
      schedule_value: '2026-01-01T00:00:00.000Z',
      context_mode: 'isolated' as const,
      next_run: new Date(Date.now() - 1000).toISOString(),
      last_run: null,
      last_result: null,
      status: 'active' as const,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    expect(computeNextRun(task)).toBeNull();
  });

  it('computeNextRun skips missed intervals without infinite loop', () => {
    // Task was due 10 intervals ago (missed)
    const ms = 60000;
    const missedBy = ms * 10;
    const scheduledTime = new Date(Date.now() - missedBy).toISOString();

    const task = {
      id: 'skip-test',
      group_folder: 'test',
      chat_jid: 'test@g.us',
      prompt: 'test',
      schedule_type: 'interval' as const,
      schedule_value: String(ms),
      context_mode: 'isolated' as const,
      next_run: scheduledTime,
      last_run: null,
      last_result: null,
      status: 'active' as const,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    const nextRun = computeNextRun(task);
    expect(nextRun).not.toBeNull();
    // Must be in the future
    expect(new Date(nextRun!).getTime()).toBeGreaterThan(Date.now());
    // Must be aligned to the original schedule grid
    const offset =
      (new Date(nextRun!).getTime() - new Date(scheduledTime).getTime()) % ms;
    expect(offset).toBe(0);
  });
});

describe('task model/effort selection', () => {
  const baseTask = (over: Partial<ScheduledTask>): ScheduledTask =>
    ({
      id: 't',
      group_folder: 'main',
      chat_jid: 'tg:1',
      prompt: 'x',
      schedule_type: 'cron',
      schedule_value: '0 0 * * *',
      context_mode: 'isolated',
      next_run: new Date().toISOString(),
      status: 'active',
      created_at: new Date().toISOString(),
      ...over,
    }) as ScheduledTask;
  const group = { folder: 'main' } as RegisteredGroup;

  it('estimates a short interval for a frequent cron', () => {
    const ms = estimateTaskIntervalMs(
      baseTask({ schedule_value: '0 */2 10-18 * * *' }),
    );
    expect(ms).toBe(2 * 60_000);
  });

  it('estimates ~24h for a daily cron', () => {
    const ms = estimateTaskIntervalMs(
      baseTask({ schedule_value: '27 23 * * *' }),
    );
    expect(ms).toBe(24 * 60 * 60_000);
  });

  it('uses the min gap so a windowed cron is not misclassified by time of day', () => {
    // */30 9-20 fires every 30m within the window; the overnight gap must not
    // inflate the estimate (that flipped the tier depending on eval time).
    const ms = estimateTaskIntervalMs(
      baseTask({ schedule_value: '*/30 9-20 * * *' }),
    );
    expect(ms).toBe(30 * 60_000);
    // and therefore runs on fast Sonnet, not Opus/max
    expect(
      chooseTaskModelEffort(
        baseTask({ schedule_value: '*/30 9-20 * * *' }),
        group,
      ).model,
    ).toBe('claude-sonnet-4-6');
  });

  it('runs frequent housekeeping on fast Sonnet', () => {
    const { model, effort } = chooseTaskModelEffort(
      baseTask({ schedule_value: '0 */2 10-18 * * *' }),
      group,
    );
    expect(model).toBe('claude-sonnet-4-6');
    expect(effort).toBe('high');
  });

  it('runs infrequent heavy tasks on Opus/max', () => {
    const { model, effort } = chooseTaskModelEffort(
      baseTask({ schedule_value: '27 23 * * *' }),
      group,
    );
    expect(model).toBe('claude-opus-4-8');
    expect(effort).toBe('max');
  });

  it('honors an explicit per-task model at max effort', () => {
    const { model, effort } = chooseTaskModelEffort(
      baseTask({
        schedule_value: '0 */2 10-18 * * *',
        model: 'claude-haiku-4-5',
      }),
      group,
    );
    expect(model).toBe('claude-haiku-4-5');
    expect(effort).toBe('max');
  });
});
