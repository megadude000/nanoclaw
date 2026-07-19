import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProgressTracker } from './progress-tracker.js';

/**
 * Build a tracker with inert async deps and a synchronous activity spy.
 * We drive the private _parseLine directly so the tests stay independent of
 * the fs poller and timers.
 */
function makeTracker() {
  const activity: Array<{ jid: string; activity: string }> = [];
  const tracker = new ProgressTracker({
    sendMsg: async () => ({ message_id: 'm1' }),
    editMsg: async () => {},
    deleteMsg: async () => {},
    setTyping: async () => {},
    onActivity: (jid, a) => activity.push({ jid, activity: a }),
  });
  return { tracker, activity };
}

function seedState(tracker: ProgressTracker, jid: string) {
  // Create state without starting the fs poll / typing timers.
  (tracker as any).states.set(jid, {
    chatJid: jid,
    groupFolder: 'main',
    startTime: Date.now(),
    lastActivityTime: Date.now(),
    lastTool: null,
    stepCount: 0,
    subagents: new Map<string, string>(),
    progressMsgId: null,
    logsMsgId: null,
    sendPending: false,
    typingTimer: null,
    silenceTimer: null,
    pollTimer: null,
    discoverTimeout: null,
    jsonlPath: null,
    jsonlSize: 0,
    discoverAfter: 0,
    loggedDiscoverWarn: false,
  });
  return (tracker as any).states.get(jid);
}

function assistantToolLine(name: string, input: any, opts: any = {}) {
  return JSON.stringify({
    type: 'assistant',
    parent_tool_use_id: opts.parent ?? null,
    message: { content: [{ type: 'tool_use', id: opts.id, name, input }] },
  });
}

const JID = 'dc:123';

describe('ProgressTracker _parseLine', () => {
  afterEach(() => vi.restoreAllMocks());

  it('counts top-level tool calls as steps', () => {
    const { tracker } = makeTracker();
    const state = seedState(tracker, JID);
    (tracker as any)._parseLine(
      JID,
      assistantToolLine('Bash', { command: 'ls' }),
    );
    (tracker as any)._parseLine(
      JID,
      assistantToolLine('Read', { file_path: '/a/b/foo.ts' }),
    );
    expect(state.stepCount).toBe(2);
    expect(state.lastTool).toContain('Read');
    expect(state.lastTool).toContain('foo.ts');
  });

  it('does not count subagent-turn tools as main steps', () => {
    const { tracker } = makeTracker();
    const state = seedState(tracker, JID);
    (tracker as any)._parseLine(
      JID,
      assistantToolLine('Bash', { command: 'pytest' }, { parent: 'task_1' }),
    );
    expect(state.stepCount).toBe(0);
  });

  it('tracks a spawned subagent and clears it on tool_result', () => {
    const { tracker, activity } = makeTracker();
    const state = seedState(tracker, JID);

    (tracker as any)._parseLine(
      JID,
      assistantToolLine(
        'Task',
        { subagent_type: 'reviewer', description: 'review the diff' },
        { id: 'task_1' },
      ),
    );
    expect(state.subagents.size).toBe(1);
    expect(state.subagents.get('task_1')).toBe('reviewer');
    expect(state.lastTool).toContain('delegating');

    // Its tool_result (in a user message) means the subagent finished.
    (tracker as any)._parseLine(
      JID,
      JSON.stringify({
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'task_1' }],
        },
      }),
    );
    expect(state.subagents.size).toBe(0);
    // Activity spy fired for both the spawn and the completion.
    expect(activity.length).toBeGreaterThanOrEqual(2);
  });

  it('formats the progress line with steps and active subagents', () => {
    const { tracker } = makeTracker();
    const state = seedState(tracker, JID);
    state.stepCount = 5;
    state.lastTool = '🔧 Bash → npm test';
    state.subagents.set('t1', 'reviewer');
    state.subagents.set('t2', 'tester');
    const text = (tracker as any)._formatProgress(state);
    expect(text).toContain('5 steps');
    expect(text).toContain('reviewer');
    expect(text).toContain('tester');
    expect(text).toContain('working');
  });

  it('done summary includes elapsed and steps', () => {
    const { tracker } = makeTracker();
    const state = seedState(tracker, JID);
    state.stepCount = 3;
    const done = (tracker as any)._formatDone(state, 75);
    expect(done).toContain('Done in 1m 15s');
    expect(done).toContain('3 steps');
  });
});

describe('ProgressTracker initial-show timing', () => {
  afterEach(() => vi.useRealTimers());

  function trackerWithSends() {
    const sends: string[] = [];
    const tracker = new ProgressTracker({
      sendMsg: async (_jid: string, text: string) => {
        sends.push(text);
        return { message_id: 'm1' };
      },
      editMsg: async () => {},
      deleteMsg: async () => {},
      setTyping: async () => {},
    });
    return { tracker, sends };
  }

  it('posts NO progress message for a reply that finishes quickly', () => {
    vi.useFakeTimers();
    const { tracker, sends } = trackerWithSends();
    tracker.onMessageSent(JID, 'main');
    vi.advanceTimersByTime(3_000); // faster than the initial-show delay
    tracker.onResponseReceived(JID);
    vi.advanceTimersByTime(20_000);
    expect(sends).toHaveLength(0);
  });

  it('posts a progress message once a run exceeds the initial-show delay', () => {
    vi.useFakeTimers();
    const { tracker, sends } = trackerWithSends();
    tracker.onMessageSent(JID, 'main');
    vi.advanceTimersByTime(7_100); // past INITIAL_SHOW_MS
    expect(sends.length).toBeGreaterThan(0);
    expect(sends[0]).toContain('⏳');
    tracker.onResponseReceived(JID);
  });
});
