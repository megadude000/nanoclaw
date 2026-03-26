---
type: session
date: 2026-03-20
project: NanoClaw
topics: [webhooks, github, notion, ngrok, file-logging, ci-notifications]
status: completed
---

# Session: 2026-03-20 10:30 — webhooks-setup

## Quick Reference
Topics: GitHub webhook, Notion webhook fix, unified webhook server, file logging, CI notifications
Projects: NanoClaw, YourWave
Outcome: Set up unified webhook server on port 3456 with /notion and /github routes, both verified working, CI auto-notifications live
Pending: Update buildAgentPrompt in notion-webhook.ts for YourWave context

---

## Зроблено
- Cancelled CI polling task — user wants webhooks instead
- Built unified webhook server (`webhook-server.ts`) routing by path: `/notion`, `/github`, `/health`
- Fixed Notion webhook 401: verification_token check was AFTER HMAC signature validation — moved it before
- Notion webhook verified: token `REDACTED_NOTION_TOKEN` received and user pasted into Notion UI
- GitHub webhook configured on YW_Core repo: ping received, signature validated ✅
- Added file logging to nanoclaw (pino dual transport: stdout pretty + `logs/nanoclaw.log` JSON)
- Tested full CI notification pipeline: push → GitHub Actions → webhook → scheduled task → Telegram notification
- CI notification format: "✅ CI passed: `commit message` (branch)"

## Технічні зміни
### Unified Webhook Server
- **Проблема:** Потрібно два webhook receivers (Notion + GitHub) на одному ngrok тунелі
- **Фікс:** `webhook-server.ts` — один HTTP server, роутинг по pathname `/notion` vs `/github`
- **Статус:** ✅ Працює

### Notion Verification Fix
- **Проблема:** 401 при verification — HMAC check блокує verification_token обробку
- **Фікс:** Парсимо JSON body ПЕРШИМ, перевіряємо verification_token ДО HMAC
- **Статус:** ✅ Працює

### File Logging
- **Проблема:** Контейнер не має доступу до journald хоста
- **Фікс:** pino dual transport — stdout + `logs/nanoclaw.log`, читаємо через mount
- **Статус:** ✅ Працює

## Pending / Наступні кроки
- [ ] Update `buildAgentPrompt` in notion-webhook.ts (still has old Prague Roastery context)
- [ ] Rewrite Atlas frontend with shadcn components (after Figma design)
- [ ] Register yourwave.coffee domain

## Технічний борг
- `buildAgentPrompt` in notion-webhook.ts references "Prague Micro-Roastery Business Plan" — needs YourWave context
- Telegram markdown parsing error on messages with mixed formatting (GrammyError at byte offset 33)
- Log file rotation not configured — nanoclaw.log will grow unbounded
