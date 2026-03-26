# Phase 7: Swarm Bot Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 07-swarm-bot-identity
**Mode:** Auto (recommended defaults selected)
**Areas discussed:** Webhook creation strategy, Avatar source, Identity registry, Webhook caching

---

## Webhook Creation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| On demand at first send (Recommended) | Create webhook when swarm bot first posts, cache for reuse | ✓ |
| At bootstrap time | Pre-create webhooks in all channels — wasteful for unused channels | |
| Manual setup | Require user to create webhooks — defeats automation goal | |

**User's choice:** [auto] On demand at first send (Recommended)

---

## Avatar Source

| Option | Description | Selected |
|--------|-------------|----------|
| Hosted URL (Recommended) | Store avatar URLs in config, pass to WebhookClient per-message | ✓ |
| Local file upload | Upload local image files — adds file management complexity | |

**User's choice:** [auto] Hosted URL (Recommended)

---

## Identity Registry

| Option | Description | Selected |
|--------|-------------|----------|
| JSON config file (Recommended) | config/swarm-identities.json with name + avatarURL per bot | ✓ |
| Hardcoded in code | Define identities in TypeScript — less flexible | |
| Database table | SQLite storage — overkill for 2-3 identities | |

**User's choice:** [auto] JSON config file (Recommended)

---

## Webhook Caching

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory Map (Recommended) | Map<channelId:name, Webhook>, fetch existing on startup | ✓ |
| Database-backed cache | Persist webhook IDs across restarts — unnecessary, Discord keeps webhooks | |

**User's choice:** [auto] In-memory Map (Recommended)

---

## Claude's Discretion

- Webhook naming convention
- Class structure (SwarmManager vs DiscordChannel extension)
- Default avatar URLs
- Webhook cleanup strategy
