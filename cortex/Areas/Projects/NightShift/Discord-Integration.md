---
source_hash: 88f45eeda7fd2c2917f8373e55d761121ab735671beb1defa222600e2296901a
embedding_model: text-embedding-3-small
---
# Discord Integration — NanoClaw

## Overview
Discord serves as the operational dashboard for NanoClaw. Automated notifications (GitHub Issues, CI/CD, Notion, bug reports, progress tracking) route to categorized Discord channels. Telegram remains the primary conversational interface.

## Server Structure
| Category | Channel | JID | Purpose |
|----------|---------|-----|---------|
| YourWave | #notion | `dc:1486972001892438176` | Notion webhook comments → context-aware agent (Alfred) |
| YourWave | #issues | `dc:1486972003167764520` | GitHub Issues + Bug reports |
| Dev | #alerts | `dc:1486972006279807066` | CI pass/fail + deploy notifications |
| Dev | #bot-management | TBD | Persistent per-bot status panel (one message per bot) |

## Bot Status Panel
Env var: `DISCORD_BOT_MANAGEMENT_CHANNEL_ID=<channel_id>`

One persistent message per bot (Jarvis + swarm identities from `config/swarm-identities.json`) is created on startup in `#bot-management`. Messages show:
- Bot name + status icon (🟢 Idle / 🟡 Working / 🔴 Error)
- Current group folder being processed
- Current tool in use (from JSONL polling)
- Elapsed time + last seen timestamp

Message IDs are stored in `router_state` (keys: `bsp:{botName}`) and reclaimed after restart. Group→bot mapping is learned dynamically from IPC `sender` field.

To activate: create a `#bot-management` Discord channel, get its ID with `/chatid`, add to `.env`.

## Routing (`config/routing.json`)
- `github-issues` → Discord #issues only
- `github-ci` → Discord #alerts only
- `notion` → Discord #notion only
- `bugreport` → Discord #issues only
- Telegram routing disabled for all webhook sources

## Webhook Flows

### Bug Report Flow
1. YourWave BugReporter widget → `/webhook/bugreport`
2. Creates GitHub Issue with labels `[bug, immediate|nightshift]`
3. GitHub sends `issues.opened` → Friday agent investigates/fixes
4. If `immediate` label added later to existing issue → triggers separate fix task
5. Dedup: `labeled` events within 30s of issue creation are skipped (already handled by `opened`)

### GitHub CI Flow
1. Push to main → CI runs → `workflow_run.completed` event
2. If conclusion=success on main → auto-deploy (git pull + npm install + restart services)
3. Friday posts CI result + deploy status to #alerts

### Notion Flow
1. Comment on Notion page → webhook → `/webhook/notion`
2. Agent (Alfred) reads full page, classifies comment intent, acts accordingly
3. Bot-authored comments are skipped to prevent infinite loops (`created_by.type === 'bot'`)

## Progress Tracking
- Dual-channel: progress shows in source channel AND #logs
- Immediate start (no 30s delay)
- Message IDs are `string | number` to support both Discord (snowflake strings) and Telegram (numbers)
- Tracks JSONL session files for real-time tool activity display

## Key Technical Details
- Discord message IDs are strings (snowflakes), Telegram IDs are numbers
- Discord message limit: 2000 chars (vs Telegram 4096) — needs chunking
- `sendMessageRaw` returns `{ message_id: string }` on Discord
- `editMessage` accepts `messageId: string` on Discord
- Bot requires Administrator permission on the Discord server
- Gateway intents: Guilds, GuildMessages, MessageContent, GuildMessageReactions

## Agents
| Sender | Role | Triggers |
|--------|------|----------|
| Friday | CI monitor + bug fixer | GitHub CI events, bug reports, issues |
| Alfred | Notion assistant | Notion comment webhooks |

## Known Issues
- Rate limit resilience needed when multiple containers launch simultaneously (GitHub Issue #5)
- Container agents need staggered launches or backoff
