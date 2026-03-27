# Telegram to Discord Migration Checklist

Gradual migration of webhook notifications from Telegram to Discord, one webhook type at a time. Both platforms run in parallel (dual-send) until you are confident Discord is working correctly.

## Prerequisites

- [ ] Discord bot running and connected (`isConnected()` returns true)
- [ ] Discord channels created (see `config/discord-server.json`)
- [ ] `config/routing.json` has both Telegram and Discord targets per webhook type
- [ ] Dual-send confirmed working (both platforms receive notifications)

## How It Works

Each target in `config/routing.json` has an `enabled` field (defaults to `true`). Setting `enabled: false` stops routing to that target. NanoClaw reads `routing.json` fresh on every webhook call -- no restart needed for config changes.

## Per-Webhook Migration Steps

Repeat these steps for each webhook type you want to migrate:

### Step 1: Verify Dual-Send

Confirm both targets are `"enabled": true` in `config/routing.json` and both platforms are receiving notifications.

### Step 2: Trigger a Test Event

Create a test event (e.g., open a GitHub issue for `github-issues`, create a Notion task for `notion`). Verify Discord receives the notification with correct formatting.

### Step 3: Disable Telegram Target

Edit `config/routing.json` and set the Telegram target to `"enabled": false`:

```json
{
  "github-issues": {
    "targets": [
      { "platform": "telegram", "jid": "tg:TELEGRAM_CHAT_ID", "enabled": false },
      { "platform": "discord", "jid": "dc:DISCORD_BUGS_CHANNEL_ID", "enabled": true }
    ]
  }
}
```

No restart needed -- the change takes effect on the next webhook call.

### Step 4: Verify Discord-Only

Trigger another test event. Confirm:
- Discord receives the notification
- Telegram does NOT receive the notification

### Step 5: Monitor

Watch for 24-48 hours to confirm no issues. Check Discord channel for correct formatting and delivery.

## Rollback Procedure

If Discord has issues, roll back immediately:

1. Edit `config/routing.json`
2. Set Discord target to `"enabled": false`
3. Set Telegram target to `"enabled": true`

```json
{
  "github-issues": {
    "targets": [
      { "platform": "telegram", "jid": "tg:TELEGRAM_CHAT_ID", "enabled": true },
      { "platform": "discord", "jid": "dc:DISCORD_BUGS_CHANNEL_ID", "enabled": false }
    ]
  }
}
```

No restart needed. Notifications immediately route back to Telegram.

## Webhook Type Checklist

Track migration progress for each webhook type:

| Webhook Type   | Telegram Target       | Discord Target             | Status          |
|----------------|-----------------------|----------------------------|-----------------|
| github-issues  | tg:TELEGRAM_CHAT_ID   | dc:DISCORD_BUGS_CHANNEL_ID | dual-send       |
| github-ci      | tg:TELEGRAM_CHAT_ID   | (not configured yet)       | telegram-only   |
| notion         | tg:TELEGRAM_CHAT_ID   | dc:DISCORD_TASKS_CHANNEL_ID| dual-send       |
| progress       | tg:TELEGRAM_CHAT_ID   | (not configured yet)       | telegram-only   |
| bugreport      | (not configured)      | dc:DISCORD_BUGS_CHANNEL_ID | discord-only    |

**Status values:** `telegram-only` | `dual-send` | `discord-only`

## Notes

- The `enabled` field is optional and defaults to `true`. Existing config entries without it continue to work unchanged.
- Each webhook type has independent targets. Disabling Telegram for `github-issues` does not affect `notion` or any other webhook type.
- When all targets for a webhook type are disabled, `resolveTargets()` falls back to the main group (mainJid) as a safety net.
