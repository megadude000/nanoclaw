---
cortex_level: L10
confidence: high
domain: nanoclaw
scope: src/db.ts exports
type: bootstrap-extract
tags:
  - nanoclaw
  - bootstrap
  - core
created: '2026-03-31'
project: nanoclaw
source_hash: 38601ed43d11a2098613efe5e5ae57030ced60b1669472f70fa38a13e64f1d88
embedding_model: text-embedding-3-small
---
# db.ts

> Exports from db.ts

## Exports

### Functions

- `initDatabase()`
- `_initTestDatabase()` -- @internal - for tests only. Creates a fresh in-memory database.
- `_closeDatabase()` -- @internal - for tests only.
- `storeChatMetadata(chatJid: string, timestamp: string, name?: string, channel?: string, isGroup?: boolean,)` -- Store chat metadata only (no message content).
- `updateChatName(chatJid: string, name: string)` -- Update chat name without changing timestamp for existing chats.
- `getAllChats()` -- Get all known chats, ordered by most recent activity.
- `getLastGroupSync()` -- Get timestamp of last group metadata sync.
- `setLastGroupSync()` -- Record that group metadata was synced.
- `storeMessage(msg: NewMessage)` -- Store a message with full content.
- `storeMessageDirect(msg: { id: string; chat_jid: string; sender: string; sender_name: string; content: string; timestamp: string; is_from_me: boolean; is_bot_message?: boolean; })` -- Store a message directly.
- `getNewMessages(jids: string[], lastTimestamp: string, botPrefix: string, limit: number = 200,)`
- `getMessagesSince(chatJid: string, sinceTimestamp: string, botPrefix: string, limit: number = 200,)`
- `getLastBotMessageTimestamp(chatJid: string, botPrefix: string,)`
- `createTask(task: Omit<ScheduledTask, 'last_run' | 'last_result'>,)`
- `getTaskById(id: string)`
- `getTasksForGroup(groupFolder: string)`
- `getAllTasks()`
- `updateTask(id: string, updates: Partial< Pick< ScheduledTask, | 'prompt' | 'script' | 'schedule_type' | 'schedule_value' | 'next_run')`
- `deleteTask(id: string)`
- `getDueTasks()`
- `updateTaskAfterRun(id: string, nextRun: string | null, lastResult: string,)`
- `logTaskRun(log: TaskRunLog)`
- `getRouterState(key: string)`
- `setRouterState(key: string, value: string)`
- `getSession(groupFolder: string)`
- `setSession(groupFolder: string, sessionId: string)`
- `getAllSessions()`
- `getRegisteredGroup(jid: string,)`
- `setRegisteredGroup(jid: string, group: RegisteredGroup)`
- `getAllRegisteredGroups()`
- `getLatestUserMessageId(chatJid: string)` -- Return the most recent non-bot message ID for a chat, or null.

### Interfaces

- `ChatInfo`
