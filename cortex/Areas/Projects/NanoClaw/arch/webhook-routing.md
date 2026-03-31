---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: NanoClaw webhook routing - webhook-server to per-type handlers, routing_tag config, Discord vs Telegram targets
project: nanoclaw
tags: [nanoclaw, webhooks, routing, github, notion, bugreport, discord]
created: 2026-03-31
---

# NanoClaw — Webhook Routing

## Architecture Overview

Webhooks enter through `src/webhook-server.ts`, which runs an HTTP server on the configured port. The server dispatches to per-type handler modules:
- `src/github-webhook.ts` — GitHub PR/issue/push events
- `src/github-issues-webhook.ts` — GitHub issue-specific events
- `src/notion-webhook.ts` — Notion page update events
- `src/bugreport-webhook.ts` — bug reports from apps

Each handler extracts the relevant content from the webhook payload and calls `resolveTargets(webhookType, groups)` from `src/webhook-router.ts` to determine which group JID(s) to send to.

## routing_tag and config/routing.json

The routing resolution is configurable via `config/routing.json`, which maps webhook types to target JIDs:
```json
{
  "github": {
    "targets": [
      { "platform": "discord", "jid": "dc:1234567890", "enabled": true }
    ]
  },
  "bugreport": {
    "targets": [
      { "platform": "telegram", "jid": "tg:-100123456789", "enabled": true }
    ]
  }
}
```

The router reads this file on every call (no caching — webhooks are infrequent and re-reading ensures config updates are picked up without restart). If the file is missing, a webhook type is not configured, or all configured JIDs are unregistered, the router falls back to the main group JID.

## Why Webhooks Go to Discord Channels Not Telegram

Technical notification webhooks (GitHub CI failures, Notion page updates, bug reports) are routed to Discord channels rather than Telegram by default. The reason is contextual: Discord has structured channels (e.g., `#bugs`, `#yw-tasks`) that organize notifications by domain, persistent message history suitable for async review, and EmbedBuilder support for rich structured messages (title, description, fields, color, URL). Telegram is the conversational interface — mixing operational alerts with conversation creates noise. Discord channels are the monitoring interface.

The routing config allows overriding this per webhook type. A webhook with no config falls back to the main Telegram group.

## Fallback Behavior

Three fallback cases, all handled gracefully:
1. **No routing config file** → mainJid fallback
2. **Webhook type not in config** → mainJid fallback (logged at info level)
3. **Configured JID not registered** → warned, skipped; if none resolve, mainJid fallback

This fallback chain ensures webhooks always have somewhere to go, even in a partially configured system.

## Integration with Task Scheduler

The same `resolveTargets()` function is used by the task scheduler for tasks with a `routing_tag`. This unifies routing for both inbound webhooks and outbound scheduled tasks: both use `config/routing.json` as the single routing truth. The distinction: webhooks push data in, scheduled tasks push generated content out, but both use the same routing abstraction.

## Webhook Security

Webhook endpoints validate signatures where the provider supports it (GitHub HMAC-SHA256, Notion secret). Requests with invalid signatures are rejected with 401. The webhook server port is not exposed publicly by default — it receives traffic via a Cloudflare Tunnel or reverse proxy.
