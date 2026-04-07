---
cortex_level: L30
confidence: high
domain: nanoclaw
scope: >-
  Full NanoClaw message lifecycle - inbound channel to container agent to IPC
  response and outbound routing
project: nanoclaw
tags:
  - nanoclaw
  - message-flow
  - architecture
  - container
  - ipc
  - channel
created: 2026-03-31T00:00:00.000Z
source_hash: fa24c4a595156fff72af1b750fbcc239b42ad20a32aa02c04afd348ba8b8ccd3
embedding_model: text-embedding-3-small
---

# NanoClaw — Full Message Flow

This entry captures the complete lifecycle of a message from the moment a user sends it on any channel through to the agent's response being delivered back. Understanding this flow is essential for debugging any step in the pipeline.

## Phase 1: Inbound — Channel Receives Message

Each registered channel (Telegram, Discord, WhatsApp) polls or receives webhooks and calls `onMessage(chatJid, message)`. The channel's `ownsJid()` method determines which JID namespace it handles: `tg:` for Telegram, `dc:` for Discord, `wa:` for WhatsApp. The channel normalizes the message into a `NewMessage` object and stores it via `storeMessage()` in the SQLite database.

Key files: `src/channels/telegram.ts`, `src/channels/discord.ts`, `src/channels/whatsapp.ts`

## Phase 2: Message Loop — index.ts Polling

`index.ts` runs a continuous message loop (interval: `POLL_INTERVAL`, default 2s). On each tick it calls `getNewMessages()` for each registered group JID. New messages are dispatched to the `GroupQueue`, which serializes processing per group (one active container per group at a time) to prevent concurrent agent runs.

The `GroupQueue` ensures that if messages arrive for group A while an agent is already running, they queue and are processed after the current run completes.

Key files: `src/index.ts` (`startMessageLoop`), `src/group-queue.ts`

## Phase 3: Trigger Check and Prompt Building

For non-main groups, the system checks whether the batch contains a trigger message (configurable pattern, default `@claude`). If no trigger is present, the messages are skipped. Main groups process all messages without a trigger requirement.

Once messages pass the trigger check, `formatMessages()` in `router.ts` serializes them into an XML prompt:
```xml
<context timezone="Europe/Prague" />
<messages>
  <message sender="Andrii" time="23:45">text here</message>
</messages>
```

Key files: `src/router.ts`, `src/sender-allowlist.ts`

## Phase 4: Container Spawn — container-runner.ts

`runContainerAgent()` in `container-runner.ts` spawns a Docker container (or Podman, via `CONTAINER_RUNTIME_BIN`) with:
- The formatted prompt injected as `--input-format stream-json` via stdin
- Volume mounts: `/workspace/group` (group folder, writable), `/workspace/project` (read-only project root for main group), `/workspace/cortex` (vault, read-only), `/workspace/host` (home dir for main group only), plus per-group `.claude/` session directory
- Environment: CLAUDE.md loaded from the group folder provides agent identity and instructions
- No raw secrets in the environment — credentials flow through the OneCLI credential proxy

The container runs `claude` (Claude Code CLI) with the session ID for conversation continuity. The `OUTPUT_START_MARKER` / `OUTPUT_END_MARKER` sentinels delimit the agent's response in stdout for robust parsing without relying on exit codes alone.

Key files: `src/container-runner.ts`, `src/container-runtime.ts`

## Phase 5: Agent Execution and IPC

Inside the container, the agent processes the prompt using Claude Code. If the agent needs to trigger NanoClaw host-side actions (send a message to another group, write a cortex entry, register a group), it writes a JSON file to `/workspace/group/ipc/messages/`. The file naming convention: `{timestamp}-{random6}.json`.

The host-side `startIpcWatcher()` in `ipc.ts` polls all group IPC directories every `IPC_POLL_INTERVAL` (default 200ms). When it finds a `.json` file, it processes it, deletes the file, and executes the appropriate action. IPC message types: `message`, `cortex_write`, `cortex_relate`, `cortex_reconcile`, `agent_status`, `register_group`, `schedule_task`, `restart`, and others.

Key files: `src/ipc.ts`

## Phase 6: Outbound — Router Sends Back

When the container produces output (streamed line by line), the `onOutput` callback in `processGroupMessages()` strips `<internal>...</internal>` blocks (agent-private reasoning), then calls `channel.sendMessage(chatJid, text)`. The `routeOutbound()` function in `router.ts` finds the channel that `ownsJid(jid)` and is connected, then delegates to that channel's send implementation.

For Discord, messages exceeding 2000 characters are chunked by `discord-chunker.ts`. For Telegram, messages use MarkdownV2 formatting.

Key files: `src/router.ts`, `src/channels/discord.ts`, `src/discord-chunker.ts`

## Error Handling and Cursor Rollback

If the container returns an error status AND no output was sent to the user yet, the message cursor is rolled back so the messages will be reprocessed on the next loop tick. If output was already sent, the cursor is NOT rolled back (to prevent duplicate responses). This asymmetry prevents both lost messages and duplicate sends.
