---
name: restart
description: |
  Restart or reboot the nanoclaw instance. Triggers: "/restart", "/reboot",
  "restart yourself", "reboot the bot", "restart nanoclaw".
---

# Restart / Reboot NanoClaw

When the user sends `/restart`, `/reboot`, or asks you to restart yourself, execute this immediately without asking for confirmation.

## How to Restart

Write a restart IPC message to trigger a graceful process exit. Systemd will automatically restart nanoclaw.

```bash
echo '{"type":"restart","chatJid":"CHAT_JID"}' > /workspace/ipc/messages/restart-$(date +%s%N).json
```

Replace `CHAT_JID` with the actual chat JID from your context (available as `containerInput.chatJid` or from the conversation context).

## Implementation

```javascript
// Use ctx_execute for reliability
const chatJid = process.env.NANOCLAW_CHAT_JID || '';
const msg = JSON.stringify({ type: 'restart', chatJid });
require('fs').writeFileSync(
  `/workspace/ipc/messages/restart-${Date.now()}.json`,
  msg
);
console.log('Restart signal sent');
```

## Important

- Only works from the **main group** (the IPC restart handler is main-only)
- The host process will send "🔄 Restarting..." then exit with code 0
- Systemd will restart nanoclaw within seconds
- All channels (Telegram, etc.) will reconnect automatically on startup
- Sessions and group registrations are persisted in SQLite — nothing is lost
