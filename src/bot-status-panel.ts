/**
 * BotStatusPanel — persistent per-bot status messages in #bot-management.
 *
 * One Discord message per bot (Jarvis, Friday, Alfred…) is created on
 * startup and edited in-place whenever a bot starts/stops/uses a tool.
 * Message IDs are persisted via getState/setState so they survive restarts.
 *
 * Hook points (called from index.ts / task-scheduler.ts):
 *   onBotSeen(botName, chatJid)            – IPC message arrived with sender
 *   onGroupStarted(chatJid, groupFolder)   – container started for a group
 *   onGroupTool(chatJid, tool)             – tool used inside a container
 *   onGroupDone(chatJid)                   – container finished successfully
 *   onGroupError(chatJid)                  – container exited with error
 */

import { logger } from './logger.js';

const EDIT_THROTTLE_MS = 4_000;
const WORKING_REFRESH_MS = 30_000;  // update elapsed every 30s while Working
const WORKING_TIMEOUT_MS = 20 * 60_000; // auto-reset after 20min stuck in Working
const DB_KEY_PREFIX = 'bsp:';

interface HistoryEntry {
  groupFolder: string;
  durationSec: number;
  outcome: 'done' | 'error';
  finishedAt: Date;
}

interface BotState {
  status: 'idle' | 'working' | 'error';
  groupFolder: string | null;
  tool: string | null;
  startedAt: number | null;
  lastSeen: Date;
  history: HistoryEntry[]; // last 3 completed tasks
}

type MsgId = string;
type SendFn = (
  jid: string,
  text: string,
) => Promise<{ message_id: MsgId } | void | undefined>;
type EditFn = (jid: string, msgId: MsgId, text: string) => Promise<void>;
type GetStateFn = (key: string) => string | null | undefined;
type SetStateFn = (key: string, value: string) => void;

export interface BotStatusPanelDeps {
  channelJid: string;
  botNames: string[];
  defaultBot: string;
  sendMsg: SendFn;
  editMsg: EditFn;
  getState: GetStateFn;
  setState: SetStateFn;
}

export class BotStatusPanel {
  private channelJid: string;
  private botNames: string[];
  private defaultBot: string;
  private states = new Map<string, BotState>();
  private messageIds = new Map<string, string>(); // botName → Discord msgId
  private chatToBotMap = new Map<string, string>(); // chatJid → botName
  private editThrottle = new Map<string, boolean>(); // botName → throttled
  private workingTimers = new Map<string, ReturnType<typeof setInterval>>(); // botName → live refresh timer
  private sendMsg: SendFn;
  private editMsg: EditFn;
  private getState: GetStateFn;
  private setState: SetStateFn;

  constructor(deps: BotStatusPanelDeps) {
    this.channelJid = deps.channelJid;
    this.botNames = deps.botNames;
    this.defaultBot = deps.defaultBot;
    this.sendMsg = deps.sendMsg;
    this.editMsg = deps.editMsg;
    this.getState = deps.getState;
    this.setState = deps.setState;

    for (const name of deps.botNames) {
      this.states.set(name, {
        status: 'idle',
        groupFolder: null,
        tool: null,
        startedAt: null,
        lastSeen: new Date(),
        history: [],
      });
    }
  }

  /**
   * On startup: ensure one persistent message per bot exists in the panel channel.
   * If a stored message ID is found, try to edit it (reclaim). Otherwise create new.
   * Always resets all bots to Idle on startup (containers stopped on restart).
   */
  async initialize(): Promise<void> {
    // Reset all bots to Idle on startup — containers were stopped during restart
    for (const name of this.botNames) {
      const state = this.states.get(name)!;
      state.status = 'idle';
      state.groupFolder = null;
      state.tool = null;
      state.startedAt = null;
      this._clearWorkingTimer(name);
    }

    for (const botName of this.botNames) {
      const storedId = this.getState(`${DB_KEY_PREFIX}${botName}`) ?? null;
      if (storedId) {
        try {
          await this.editMsg(this.channelJid, storedId, this._format(botName));
          this.messageIds.set(botName, storedId);
          logger.info(
            { botName, msgId: storedId },
            'BotStatusPanel: reclaimed existing message',
          );
          continue;
        } catch {
          logger.info(
            { botName },
            'BotStatusPanel: stored message gone, creating new',
          );
        }
      }
      await this._createMessage(botName);
    }
  }

  /** Called when IPC delivers a message with a known bot sender. */
  onBotSeen(botName: string, chatJid: string): void {
    const name = this._normalizeName(botName);
    if (!name) return;
    this.chatToBotMap.set(chatJid, name);
    const state = this.states.get(name)!;
    state.lastSeen = new Date();
    this._scheduleEdit(name);
  }

  /** Called when a container starts processing a group. */
  onGroupStarted(chatJid: string, groupFolder: string): void {
    const botName = this.chatToBotMap.get(chatJid) ?? this.defaultBot;
    const state = this.states.get(botName);
    if (!state) return;
    state.status = 'working';
    state.groupFolder = groupFolder;
    state.tool = null;
    state.startedAt = Date.now();
    state.lastSeen = new Date();
    this.chatToBotMap.set(chatJid, botName);
    this._forceEdit(botName);
    // Start live refresh timer so elapsed time updates every 30s
    this._startWorkingTimer(botName);
  }

  /** Called when a tool is used inside a container (from ProgressTracker). */
  onGroupTool(chatJid: string, tool: string): void {
    const botName = this.chatToBotMap.get(chatJid) ?? this.defaultBot;
    const state = this.states.get(botName);
    if (!state) return;
    state.tool = tool;
    state.lastSeen = new Date();
    this._scheduleEdit(botName);
  }

  /** Called when a container finishes successfully. */
  onGroupDone(chatJid: string): void {
    const botName = this.chatToBotMap.get(chatJid) ?? this.defaultBot;
    const state = this.states.get(botName);
    if (!state) return;
    this._clearWorkingTimer(botName);
    if (state.groupFolder && state.startedAt) {
      const durationSec = Math.round((Date.now() - state.startedAt) / 1000);
      state.history.unshift({ groupFolder: state.groupFolder, durationSec, outcome: 'done', finishedAt: new Date() });
      if (state.history.length > 3) state.history.pop();
    }
    state.status = 'idle';
    state.groupFolder = null;
    state.tool = null;
    state.startedAt = null;
    state.lastSeen = new Date();
    this._forceEdit(botName);
  }

  /** Called when a container exits with an error. */
  onGroupError(chatJid: string): void {
    const botName = this.chatToBotMap.get(chatJid) ?? this.defaultBot;
    const state = this.states.get(botName);
    if (!state) return;
    this._clearWorkingTimer(botName);
    if (state.groupFolder && state.startedAt) {
      const durationSec = Math.round((Date.now() - state.startedAt) / 1000);
      state.history.unshift({ groupFolder: state.groupFolder, durationSec, outcome: 'error', finishedAt: new Date() });
      if (state.history.length > 3) state.history.pop();
    }
    state.status = 'error';
    state.startedAt = null;
    state.lastSeen = new Date();
    this._forceEdit(botName);
  }

  private _startWorkingTimer(botName: string): void {
    this._clearWorkingTimer(botName);
    const timer = setInterval(() => {
      const state = this.states.get(botName);
      if (!state || state.status !== 'working') {
        this._clearWorkingTimer(botName);
        return;
      }
      // Auto-reset if stuck working for too long
      if (state.startedAt && Date.now() - state.startedAt > WORKING_TIMEOUT_MS) {
        logger.warn({ botName }, 'BotStatusPanel: auto-reset stuck Working state');
        this._clearWorkingTimer(botName);
        state.status = 'idle';
        state.groupFolder = null;
        state.tool = null;
        state.startedAt = null;
      }
      this._forceEdit(botName);
    }, WORKING_REFRESH_MS);
    this.workingTimers.set(botName, timer);
  }

  private _clearWorkingTimer(botName: string): void {
    const t = this.workingTimers.get(botName);
    if (t) { clearInterval(t); this.workingTimers.delete(botName); }
  }

  private async _createMessage(botName: string): Promise<void> {
    try {
      const res = await this.sendMsg(this.channelJid, this._format(botName));
      if (res && 'message_id' in res && res.message_id) {
        const msgId = String(res.message_id);
        this.messageIds.set(botName, msgId);
        this.setState(`${DB_KEY_PREFIX}${botName}`, msgId);
        logger.info({ botName, msgId }, 'BotStatusPanel: message created');
      }
    } catch (err) {
      logger.error(
        { botName, err },
        'BotStatusPanel: failed to create message',
      );
    }
  }

  private _normalizeName(name: string): string | null {
    const lower = name.toLowerCase();
    for (const n of this.botNames) {
      if (n.toLowerCase() === lower) return n;
    }
    return null;
  }

  private _scheduleEdit(botName: string): void {
    if (this.editThrottle.get(botName)) return;
    this.editThrottle.set(botName, true);
    setTimeout(() => {
      this.editThrottle.delete(botName);
      this._forceEdit(botName);
    }, EDIT_THROTTLE_MS);
  }

  private _forceEdit(botName: string): void {
    const msgId = this.messageIds.get(botName);
    if (!msgId) return;
    this.editMsg(this.channelJid, msgId, this._format(botName)).catch((err) => {
      logger.debug({ botName, err }, 'BotStatusPanel: edit failed');
    });
  }

  private _format(botName: string): string {
    const state = this.states.get(botName);
    if (!state) return `🤖 **${botName}** — unknown`;

    const statusIcon =
      state.status === 'working'
        ? '🟡'
        : state.status === 'error'
          ? '🔴'
          : '🟢';
    const statusText =
      state.status === 'working'
        ? 'Working'
        : state.status === 'error'
          ? 'Error'
          : 'Idle';

    const elapsedSec = state.startedAt
      ? Math.round((Date.now() - state.startedAt) / 1000)
      : null;
    const elapsedStr =
      elapsedSec !== null
        ? elapsedSec < 60
          ? `${elapsedSec}s`
          : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
        : null;

    const group = state.groupFolder ? ` | \`${state.groupFolder}\`` : '';
    const elapsed = elapsedStr ? ` | ${elapsedStr}` : '';
    const tool = state.tool ? `\n└ 🔧 ${state.tool}` : '';
    const lastSeen =
      state.lastSeen.toISOString().replace('T', ' ').slice(11, 19) + ' UTC';

    const historyLines = state.history.map(h => {
      const dur = h.durationSec < 60
        ? `${h.durationSec}s`
        : `${Math.floor(h.durationSec / 60)}m ${h.durationSec % 60}s`;
      const icon = h.outcome === 'done' ? '✓' : '✗';
      const t = h.finishedAt.toISOString().slice(11, 16) + ' UTC';
      return `└ ${icon} \`${h.groupFolder}\` (${dur}) at ${t}`;
    }).join('\n');

    const history = historyLines ? `\n${historyLines}` : '';

    return `🤖 **${botName}** — ${statusIcon} ${statusText}${group}${elapsed}${tool}${history}\n_Last seen: ${lastSeen}_`;
  }
}
