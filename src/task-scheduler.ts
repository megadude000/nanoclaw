import { ChildProcess } from 'child_process';
import { CronExpressionParser } from 'cron-parser';
import fs from 'fs';

import { EmbedBuilder } from 'discord.js';

import { ASSISTANT_NAME, SCHEDULER_POLL_INTERVAL, TIMEZONE } from './config.js';
import {
  buildTookEmbed,
  buildClosedEmbed,
  buildFailedEmbed,
} from './agent-status-embeds.js';
import { BotStatusPanel } from './bot-status-panel.js';
import {
  ContainerOutput,
  runContainerAgent,
  writeTasksSnapshot,
} from './container-runner.js';
import {
  getAllTasks,
  getDueTasks,
  getTaskById,
  logTaskRun,
  updateTask,
  updateTaskAfterRun,
} from './db.js';
import { GroupQueue } from './group-queue.js';
import {
  recordRateLimit,
  shouldSkipAutopilot,
  formatReset,
  AUTOPILOT_WEEKLY_THRESHOLD,
} from './usage-guard.js';
import { resolveGroupFolderPath } from './group-folder.js';
import { logger } from './logger.js';
import { ProgressTracker } from './progress-tracker.js';
import { RegisteredGroup, ScheduledTask } from './types.js';
import { resolveTargets } from './webhook-router.js';

/**
 * Compute the next run time for a recurring task, anchored to the
 * task's scheduled time rather than Date.now() to prevent cumulative
 * drift on interval-based tasks.
 *
 * Co-authored-by: @community-pr-601
 */
export function computeNextRun(task: ScheduledTask): string | null {
  if (task.schedule_type === 'once') return null;

  const now = Date.now();

  if (task.schedule_type === 'cron') {
    const interval = CronExpressionParser.parse(task.schedule_value, {
      tz: TIMEZONE,
    });
    return interval.next().toISOString();
  }

  if (task.schedule_type === 'interval') {
    const ms = parseInt(task.schedule_value, 10);
    if (!ms || ms <= 0) {
      // Guard against malformed interval that would cause an infinite loop
      logger.warn(
        { taskId: task.id, value: task.schedule_value },
        'Invalid interval value',
      );
      return new Date(now + 60_000).toISOString();
    }
    // Anchor to the scheduled time, not now, to prevent drift.
    // Skip past any missed intervals so we always land in the future.
    let next = new Date(task.next_run!).getTime() + ms;
    while (next <= now) {
      next += ms;
    }
    return new Date(next).toISOString();
  }

  return null;
}

// Scheduled tasks that fire at least this far apart are treated as "heavy"
// and run on Opus at max effort; anything more frequent (memory-housekeeping
// pulses, monitors) stays on fast Sonnet so a high-frequency loop can't burn
// the subscription quota. Empirically necessary: a 2-minute autoDream task on
// Opus/max exhausted the daily limit.
const HEAVY_TASK_MIN_INTERVAL_MS = 60 * 60_000; // 1 hour
// When a run hits the provider quota, push the next fire out by this much so a
// frequent task doesn't hammer the limit every couple of minutes.
const RATE_LIMIT_COOLDOWN_MS = 30 * 60_000; // 30 minutes

type Effort = 'low' | 'medium' | 'high' | 'max';

/** Estimate how often a task fires, in ms (Infinity for one-off tasks). */
export function estimateTaskIntervalMs(task: ScheduledTask): number {
  if (task.schedule_type === 'once') return Infinity;
  if (task.schedule_type === 'interval') {
    const ms = parseInt(task.schedule_value, 10);
    return ms > 0 ? ms : Infinity;
  }
  if (task.schedule_type === 'cron') {
    try {
      const it = CronExpressionParser.parse(task.schedule_value, {
        tz: TIMEZONE,
      });
      const a = it.next().getTime();
      const b = it.next().getTime();
      return Math.max(0, b - a);
    } catch {
      return Infinity;
    }
  }
  return Infinity;
}

/**
 * Choose model + reasoning effort for a scheduled task. An explicit per-task or
 * per-group model always wins (with max effort). Otherwise: infrequent heavy
 * work (Night Shift, digests, weekly reviews) runs Opus at max effort; frequent
 * housekeeping runs Sonnet at high effort to stay within quota.
 */
export function chooseTaskModelEffort(
  task: ScheduledTask,
  group: RegisteredGroup,
): { model: string | undefined; effort: Effort } {
  const explicit = task.model || group.containerConfig?.model;
  if (explicit) return { model: explicit, effort: 'max' };
  const heavy = estimateTaskIntervalMs(task) >= HEAVY_TASK_MIN_INTERVAL_MS;
  return heavy
    ? { model: 'claude-opus-4-8', effort: 'max' }
    : { model: 'claude-sonnet-4-6', effort: 'high' };
}

export interface SchedulerDependencies {
  registeredGroups: () => Record<string, RegisteredGroup>;
  getSessions: () => Record<string, string>;
  queue: GroupQueue;
  onProcess: (
    groupJid: string,
    proc: ChildProcess,
    containerName: string,
    groupFolder: string,
  ) => void;
  // Returns false (or resolves void on legacy impls) when delivery failed —
  // task runs record the failure instead of logging success for lost output.
  sendMessage: (jid: string, text: string) => Promise<boolean | void>;
  progressTracker?: ProgressTracker;
  botStatusPanel?: BotStatusPanel;
  sendToAgents?: (embed: EmbedBuilder) => Promise<void>;
}

async function runTask(
  task: ScheduledTask,
  deps: SchedulerDependencies,
): Promise<void> {
  const startTime = Date.now();
  let groupDir: string;
  try {
    groupDir = resolveGroupFolderPath(task.group_folder);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // Stop retry churn for malformed legacy rows.
    updateTask(task.id, { status: 'paused' });
    logger.error(
      { taskId: task.id, groupFolder: task.group_folder, error },
      'Task has invalid group folder',
    );
    logTaskRun({
      task_id: task.id,
      run_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      status: 'error',
      result: null,
      error,
    });
    return;
  }
  fs.mkdirSync(groupDir, { recursive: true });

  logger.info(
    { taskId: task.id, group: task.group_folder },
    'Running scheduled task',
  );

  const groups = deps.registeredGroups();
  const group = Object.values(groups).find(
    (g) => g.folder === task.group_folder,
  );

  if (!group) {
    logger.error(
      { taskId: task.id, groupFolder: task.group_folder },
      'Group not found for task',
    );
    logTaskRun({
      task_id: task.id,
      run_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      status: 'error',
      result: null,
      error: `Group not found: ${task.group_folder}`,
    });
    return;
  }

  // DIGEST-01/02: Resolve routing targets for tasks with routing_tag
  const routingTargets = task.routing_tag
    ? resolveTargets(task.routing_tag, groups).filter(
        (t) => t.jid !== task.chat_jid, // exclude original chatJid to avoid double-send
      )
    : [];
  const isRouted = routingTargets.length > 0;

  if (task.routing_tag && !isRouted) {
    logger.warn(
      { taskId: task.id, routingTag: task.routing_tag },
      'Task has routing_tag but no targets resolved (fallback to original chatJid)',
    );
  }

  // Weekly-usage gate: skip autonomous (Autopilot) work when the subscription's
  // weekly quota is nearly spent, and tell the user why. Interactive chat and
  // non-Autopilot tasks are never gated.
  const skipDecision = shouldSkipAutopilot(task);
  if (skipDecision.skip) {
    const u = skipDecision.usage;
    const resetStr = u ? formatReset(u.resetsAt) : 'unknown';
    const pct = u ? Math.round(u.utilization * 100) : 0;
    const msg =
      `🛑 Skipping Autopilot (\`${task.prompt.slice(0, 40).replace(/\n/g, ' ')}…\`) — ` +
      `weekly usage at **${pct}%** (≥ ${Math.round(AUTOPILOT_WEEKLY_THRESHOLD * 100)}%). ` +
      `Preserving quota for your interactive use. Weekly limit resets ${resetStr}.`;
    logger.warn(
      { taskId: task.id, utilization: u?.utilization, resetsAt: u?.resetsAt },
      'Autopilot skipped: weekly usage over threshold',
    );
    const targets = isRouted
      ? routingTargets.map((t) => t.jid)
      : [task.chat_jid];
    for (const jid of targets) {
      await deps.sendMessage(jid, msg).catch(() => {});
    }
    logTaskRun({
      task_id: task.id,
      run_at: new Date().toISOString(),
      duration_ms: 0,
      status: 'skipped',
      result: `Skipped: ${skipDecision.reason}`,
      error: null,
    });
    const skipNext = computeNextRun(task);
    updateTaskAfterRun(task.id, skipNext, `Skipped (weekly usage ${pct}%)`);
    return;
  }

  // Update tasks snapshot for container to read (filtered by group)
  const isMain = group.isMain === true;
  const tasks = getAllTasks();
  writeTasksSnapshot(
    task.group_folder,
    isMain,
    tasks.map((t) => ({
      id: t.id,
      groupFolder: t.group_folder,
      prompt: t.prompt,
      script: t.script,
      schedule_type: t.schedule_type,
      schedule_value: t.schedule_value,
      status: t.status,
      next_run: t.next_run,
    })),
  );

  let result: string | null = null;
  let error: string | null = null;
  let rateLimited = false;
  const { model: taskModel, effort: taskEffort } = chooseTaskModelEffort(
    task,
    group,
  );

  // For group context mode, use the group's current session
  const sessions = deps.getSessions();
  const sessionId =
    task.context_mode === 'group' ? sessions[task.group_folder] : undefined;

  // After the task produces a result, close the container promptly.
  // Tasks are single-turn — no need to wait IDLE_TIMEOUT (30 min) for the
  // query loop to time out. A short delay handles any final MCP calls.
  const TASK_CLOSE_DELAY_MS = 10000;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleClose = () => {
    if (closeTimer) return; // already scheduled
    closeTimer = setTimeout(() => {
      logger.debug({ taskId: task.id }, 'Closing task container after result');
      deps.queue.closeStdin(task.chat_jid);
    }, TASK_CLOSE_DELAY_MS);
  };

  // Start progress tracking for this task (skip for silent tasks)
  if (!task.silent) {
    deps.progressTracker?.onMessageSent(task.chat_jid, task.group_folder);
  }
  deps.botStatusPanel?.onGroupStarted(task.chat_jid, task.group_folder);

  // ASTATUS-01: Report task picked up to #agents
  deps.sendToAgents?.(
    buildTookEmbed({
      title: task.prompt.slice(0, 80),
      taskId: task.id,
      agentName: ASSISTANT_NAME,
    }),
  );

  try {
    const output = await runContainerAgent(
      group,
      {
        prompt: task.prompt,
        sessionId,
        groupFolder: task.group_folder,
        chatJid: task.chat_jid,
        isMain,
        isScheduledTask: true,
        silent: task.silent ?? false,
        assistantName: ASSISTANT_NAME,
        script: task.script || undefined,
        // Frequency-aware: heavy infrequent tasks → Opus/max, frequent
        // housekeeping → Sonnet/high (see chooseTaskModelEffort).
        model: taskModel,
        effort: taskEffort,
      },
      (proc, containerName) =>
        deps.onProcess(task.chat_jid, proc, containerName, task.group_folder),
      async (streamedOutput: ContainerOutput) => {
        // Persist weekly-usage telemetry from every streamed output.
        if (streamedOutput.rateLimit) recordRateLimit(streamedOutput.rateLimit);
        // SDK-native activity update (not a result) → progress UI only.
        if (streamedOutput.status === 'progress') {
          if (streamedOutput.activity && !task.silent) {
            deps.progressTracker?.setActivity(
              task.chat_jid,
              streamedOutput.activity,
            );
          }
          return;
        }
        if (streamedOutput.result) {
          result = streamedOutput.result;
          // Suppress rate limit errors — don't spam user with API quota messages
          const isRateLimit =
            result.includes('hit your limit') || result.includes('rate_limit');
          if (isRateLimit) rateLimited = true;
          if (!isRateLimit) {
            // DIGEST-01/02: Route to configured targets, or fall back to original chatJid
            if (isRouted) {
              for (const target of routingTargets) {
                const delivered = await deps.sendMessage(
                  target.jid,
                  streamedOutput.result,
                );
                if (delivered === false) {
                  error = `Failed to deliver task output to ${target.jid}`;
                  logger.error(
                    { taskId: task.id, jid: target.jid },
                    'Task output delivery failed (routed target)',
                  );
                }
              }
            } else {
              const delivered = await deps.sendMessage(
                task.chat_jid,
                streamedOutput.result,
              );
              if (delivered === false) {
                error = `Failed to deliver task output to ${task.chat_jid}`;
                logger.error(
                  { taskId: task.id, jid: task.chat_jid },
                  'Task output delivery failed',
                );
              }
            }
          } else {
            logger.warn(
              { taskId: task.id },
              'Suppressed rate limit message from being sent to user',
            );
          }
          scheduleClose();
        }
        if (streamedOutput.status === 'success') {
          deps.queue.notifyIdle(task.chat_jid);
          scheduleClose(); // Close promptly even when result is null (e.g. IPC-only tasks)
        }
        if (streamedOutput.status === 'error') {
          error = streamedOutput.error || 'Unknown error';
        }
      },
    );

    if (closeTimer) clearTimeout(closeTimer);
    if (output.rateLimit) recordRateLimit(output.rateLimit);

    if (output.status === 'error') {
      error = output.error || 'Unknown error';
    } else if (output.result) {
      // Result was already forwarded to the user via the streaming callback above
      result = output.result;
    }

    logger.info(
      { taskId: task.id, durationMs: Date.now() - startTime },
      'Task completed',
    );
    if (!task.silent) {
      deps.progressTracker?.onResponseReceived(task.chat_jid);
    }
    deps.botStatusPanel?.onGroupDone(task.chat_jid);
  } catch (err) {
    if (closeTimer) clearTimeout(closeTimer);
    error = err instanceof Error ? err.message : String(err);
    logger.error({ taskId: task.id, error }, 'Task failed');
    if (!task.silent) {
      deps.progressTracker?.onContainerStopped(task.chat_jid, 1);
    }
    deps.botStatusPanel?.onGroupError(task.chat_jid);
  }

  // ASTATUS-02: Report a terminal state to #agents so every "Took" gets a
  // matching close — green "Closed" on success, red "Failed" on error.
  // A quota hit is not a real failure and would spam #agents, so it's skipped.
  if (!error) {
    deps.sendToAgents?.(
      buildClosedEmbed({
        title: task.prompt.slice(0, 80),
        taskId: task.id,
        agentName: ASSISTANT_NAME,
        summary: result?.slice(0, 200) ?? undefined,
      }),
    );
  } else if (!rateLimited) {
    deps.sendToAgents?.(
      buildFailedEmbed({
        title: task.prompt.slice(0, 80),
        taskId: task.id,
        agentName: ASSISTANT_NAME,
        error,
      }),
    );
  }

  const durationMs = Date.now() - startTime;

  logTaskRun({
    task_id: task.id,
    run_at: new Date().toISOString(),
    duration_ms: durationMs,
    status: error ? 'error' : 'success',
    result,
    error,
  });

  let nextRun = computeNextRun(task);
  // If the provider quota was hit, back the next fire off so a frequent task
  // stops hammering the limit until it likely resets.
  if (rateLimited && nextRun) {
    const cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    if (new Date(nextRun).getTime() < cooldownUntil) {
      nextRun = new Date(cooldownUntil).toISOString();
      logger.warn(
        { taskId: task.id, nextRun },
        'Task rate-limited; backing off next run by 30m',
      );
    }
  }
  const resultSummary = error
    ? `Error: ${error}`
    : result
      ? result.slice(0, 200)
      : 'Completed';
  updateTaskAfterRun(task.id, nextRun, resultSummary);
}

let schedulerRunning = false;

export function startSchedulerLoop(deps: SchedulerDependencies): void {
  if (schedulerRunning) {
    logger.debug('Scheduler loop already running, skipping duplicate start');
    return;
  }
  schedulerRunning = true;
  logger.info('Scheduler loop started');

  const loop = async () => {
    try {
      const dueTasks = getDueTasks();
      if (dueTasks.length > 0) {
        logger.info({ count: dueTasks.length }, 'Found due tasks');
      }

      for (const task of dueTasks) {
        // Re-check task status in case it was paused/cancelled
        const currentTask = getTaskById(task.id);
        if (!currentTask || currentTask.status !== 'active') {
          continue;
        }

        deps.queue.enqueueTask(currentTask.chat_jid, currentTask.id, () =>
          runTask(currentTask, deps),
        );
      }
    } catch (err) {
      logger.error({ err }, 'Error in scheduler loop');
    }

    setTimeout(loop, SCHEDULER_POLL_INTERVAL);
  };

  loop();
}

/** @internal - for tests only. */
export function _resetSchedulerLoopForTests(): void {
  schedulerRunning = false;
}
