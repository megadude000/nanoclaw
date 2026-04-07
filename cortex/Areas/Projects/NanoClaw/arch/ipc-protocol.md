---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  NanoClaw IPC protocol - all message types, JSON shapes, file-based transport,
  handler mapping
project: nanoclaw
tags:
  - nanoclaw
  - ipc
  - protocol
  - container
  - message-types
created: 2026-03-31T00:00:00.000Z
source_hash: 5df58a38c76b1e80803b68a6d7d86122b4878964a7eecd7b027e334443a7d66b
embedding_model: text-embedding-3-small
---

# NanoClaw — IPC Protocol

## Why File-Based IPC

NanoClaw uses a file-based IPC system rather than sockets, pipes, or HTTP for agent-to-host communication. The reason: agents run inside Docker containers with no network access to the host. File-based IPC works through the mounted volume without requiring any network configuration or port exposure inside the container. The directory `/workspace/group/ipc/messages/` maps to the host at `{DATA_DIR}/ipc/{groupFolder}/messages/`.

Files are written atomically: agent writes to `{filename}.tmp` then `rename()`s to the final name. The host watcher polls for `.json` files, reads, processes, and deletes them. Failed files are moved to `ipc/errors/` for inspection.

## Transport Details

- Poll interval: `IPC_POLL_INTERVAL` (default 200ms) on the host side
- Each group has its own subdirectory: `{DATA_DIR}/ipc/{groupFolder}/`
- Two subdirectories per group: `messages/` (general IPC) and `tasks/` (task management)
- Authorization: non-main groups can only send messages to their own JID; main group can send to any JID

## Message Types

### `message`
Send a chat message via a connected channel.
```json
{
  "type": "message",
  "chatJid": "tg:123456789",
  "text": "Hello",
  "sender": "Friday"
}
```
Handler: `ipc.ts` → `deps.sendMessage(chatJid, text, sender)`. Authorization: non-main groups can only send to their own registered JID. Main group can send to any JID.

### `cortex_write`
Write a new entry to the Cortex vault. Host processes it by writing the file at `cortex/{path}` and the Cortex watcher picks up the change for re-embedding.
```json
{
  "type": "cortex_write",
  "path": "Areas/Projects/Foo/bar.md",
  "content": "---\ncortex_level: L20\n..."
}
```
Handler: `ipc.ts` → path traversal check → `fs.writeFileSync(targetPath, content)`. Security: path is resolved and must stay within the `cortex/` vault root (prevents `../../etc/passwd` style attacks).

### `cortex_relate`
Add a typed edge to `cortex-graph.json`.
```json
{
  "type": "cortex_relate",
  "source": "Areas/Projects/Foo/bar.md",
  "target": "Areas/Projects/Foo/hub.md",
  "edge_type": "REFERENCES"
}
```
Edge types: `BUILT_FROM`, `REFERENCES`, `BLOCKS`, `CROSS_LINK`, `SUPERSEDES`. Handler: `ipc.ts` → `loadGraph()` → `addEdge()` → `saveGraph()`. Idempotent: duplicate edges are silently ignored.

### `cortex_reconcile`
Trigger full Cortex reconciliation on the host (Night Shift maintenance activity).
```json
{ "type": "cortex_reconcile" }
```
Handler: `ipc.ts` → `runReconciliation(cortexDir, graphPath, qdrant, { openai, repoDir })`. Posts summary embed to #agents channel.

### `agent_status`
Report agent status to the #agents Discord channel.
```json
{
  "type": "agent_status",
  "messageType": "took|closed|progress",
  "title": "Task title",
  "taskId": "abc123",
  "agentName": "Friday",
  "description": "optional detail",
  "summary": "optional summary",
  "prUrl": "optional for closed"
}
```
Handler: `ipc.ts` → `buildTookEmbed/buildClosedEmbed/buildProgressEmbed` → `deps.sendToAgents(embed)`.

### `agent_blocker`
Report a blocker to the #agents channel.
```json
{
  "type": "agent_blocker",
  "blockerType": "tool|permission|auth|other",
  "resource": "what is blocked",
  "description": "why it's blocked",
  "agentName": "Friday",
  "taskId": "abc123"
}
```
Handler: `ipc.ts` → `buildBlockerEmbed` → `deps.sendToAgents(embed)`.

### `agent_handoff`
Report a work handoff to the #agents channel.
```json
{
  "type": "agent_handoff",
  "toAgent": "Alfred",
  "what": "research task description",
  "why": "reason for handoff",
  "agentName": "Friday",
  "taskId": "abc123"
}
```

### `register_group`
Register a new group (channel + JID) with NanoClaw.
```json
{
  "type": "register_group",
  "jid": "tg:123456789",
  "name": "MyGroup",
  "folder": "mygroup",
  "isMain": false
}
```
Handler: `ipc.ts` → `deps.registerGroup(jid, group)`.

### `restart`
Restart the NanoClaw process (main group only).
```json
{ "type": "restart", "chatJid": "tg:123456789" }
```
Handler: `ipc.ts` (main only) → `systemctl --user restart nanoclaw`.

## Task IPC (`tasks/` subdirectory)

Task management messages go to a separate `tasks/` subdirectory and are processed by `processTaskIpc()`. Types: `schedule_task`, `update_task`, `cancel_task`, `pause_task`, `resume_task`, `list_tasks`. These map to the MCP tools exposed via `mcp__nanoclaw__schedule_task` etc.
