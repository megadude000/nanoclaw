import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock container-runner BEFORE importing task-scheduler (hoisted by vitest)
vi.mock('./container-runner.js', () => ({
  runContainerAgent: vi.fn(),
  writeTasksSnapshot: vi.fn(),
}));

// Mock webhook-router BEFORE importing task-scheduler
vi.mock('./webhook-router.js', () => ({
  resolveTargets: vi.fn(() => []),
}));

import { _initTestDatabase, createTask, getTaskById } from './db.js';
import {
  _resetSchedulerLoopForTests,
  computeNextRun,
  startSchedulerLoop,
} from './task-scheduler.js';
import { runContainerAgent } from './container-runner.js';
import { resolveTargets } from './webhook-router.js';

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

  describe('routing_tag routing (DIGEST-01 / DIGEST-02)', () => {
    it('DIGEST-01: routes output to routing target JID when routing_tag is set', async () => {
      createTask({
        id: 'digest-route-test',
        group_folder: 'main',
        chat_jid: 'tg:main@g.us',
        prompt: 'Morning Digest',
        schedule_type: 'once',
        schedule_value: '2026-02-22T00:00:00.000Z',
        context_mode: 'isolated',
        next_run: new Date(Date.now() - 60_000).toISOString(),
        status: 'active',
        created_at: '2026-02-22T00:00:00.000Z',
        routing_tag: 'morning-digest',
      });

      const sendMessage = vi.fn(async () => {});
      const enqueueTask = vi.fn(
        (_groupJid: string, _taskId: string, fn: () => Promise<void>) => {
          void fn();
        },
      );

      // Mock resolveTargets to return a Discord target
      vi.mocked(resolveTargets).mockReturnValue([
        {
          jid: 'dc:agents-channel',
          group: { folder: 'discord_agents', jid: 'dc:agents-channel', isMain: false } as any,
        },
      ]);

      // Mock runContainerAgent to simulate streamed output
      vi.mocked(runContainerAgent).mockImplementation(
        async (_group, _input, _onProcess, onOutput) => {
          if (onOutput) {
            await onOutput({ status: 'success', result: 'Digest output' });
          }
          return { status: 'success' as const, result: 'Digest output' };
        },
      );

      startSchedulerLoop({
        registeredGroups: () => ({
          'tg:main@g.us': { folder: 'main', jid: 'tg:main@g.us', isMain: true } as any,
        }),
        getSessions: () => ({}),
        queue: { enqueueTask } as any,
        onProcess: () => {},
        sendMessage,
      });

      await vi.advanceTimersByTimeAsync(10);

      // DIGEST-01: sendMessage must have been called with the routing target JID
      expect(sendMessage).toHaveBeenCalledWith('dc:agents-channel', expect.any(String));
    });

    it('DIGEST-02: does NOT send to task.chat_jid when routing targets resolve', async () => {
      createTask({
        id: 'digest-suppress-test',
        group_folder: 'main',
        chat_jid: 'tg:main@g.us',
        prompt: 'Morning Digest',
        schedule_type: 'once',
        schedule_value: '2026-02-22T00:00:00.000Z',
        context_mode: 'isolated',
        next_run: new Date(Date.now() - 60_000).toISOString(),
        status: 'active',
        created_at: '2026-02-22T00:00:00.000Z',
        routing_tag: 'morning-digest',
      });

      const sendMessage = vi.fn(async () => {});
      const enqueueTask = vi.fn(
        (_groupJid: string, _taskId: string, fn: () => Promise<void>) => {
          void fn();
        },
      );

      // Mock resolveTargets to return a Discord target
      vi.mocked(resolveTargets).mockReturnValue([
        {
          jid: 'dc:agents-channel',
          group: { folder: 'discord_agents', jid: 'dc:agents-channel', isMain: false } as any,
        },
      ]);

      // Mock runContainerAgent to simulate streamed output
      vi.mocked(runContainerAgent).mockImplementation(
        async (_group, _input, _onProcess, onOutput) => {
          if (onOutput) {
            await onOutput({ status: 'success', result: 'Digest output' });
          }
          return { status: 'success' as const, result: 'Digest output' };
        },
      );

      startSchedulerLoop({
        registeredGroups: () => ({
          'tg:main@g.us': { folder: 'main', jid: 'tg:main@g.us', isMain: true } as any,
        }),
        getSessions: () => ({}),
        queue: { enqueueTask } as any,
        onProcess: () => {},
        sendMessage,
      });

      await vi.advanceTimersByTimeAsync(10);

      // DIGEST-02: sendMessage must NEVER have been called with task.chat_jid
      // This covers ALL send sites -- streaming callback AND post-run block
      expect(sendMessage).not.toHaveBeenCalledWith('tg:main@g.us', expect.any(String));
    });
  });
});
