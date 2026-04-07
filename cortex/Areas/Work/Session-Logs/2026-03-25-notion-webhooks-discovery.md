---
type: session
date: 2026-03-25T00:00:00.000Z
project: YourWave
topics:
  - notion-webhooks
  - bugreporter
  - webhook-routing
  - notion-integration
status: in-progress
source_hash: 4387fb65cefe6cdf52055e64cb2fc5efcf01708471b03fe39c79c7e5e238c3f4
embedding_model: text-embedding-3-small
---

# Session: 2026-03-25 13:08 — notion-webhooks-discovery

## Quick Reference
Topics: notion-webhooks, bugreporter-verified, webhook-routing, hooks.yourwave.uk
Projects: YourWave, NanoClaw
Outcome: Discovered Notion has native webhooks already configured on Jarvis connection; subscription paused due to errors; need to fix /notion handler
Pending: fix /notion webhook handler for Notion events, unpause subscription, CI a11y fixes

---

## Зроблено
- BugReporter → Notion flow fully verified (2 test cases passed, both cleaned up)
- Discovered Notion native webhooks on "Jarvis connection" integration
- Webhook URL already set: `https://irreproachably-exudative-reyna.ngrok-free.dev/notion`
- Events subscribed: Page 8/8, Database 4/6, Data source 6/6, View 3/3, Comment 3/3, File upload 4/4
- Subscription PAUSED due to high error rate — /notion handler needs fixing

## Технічні зміни
### Notion Webhooks Discovery
- **Стан:** Notion має нативні webhooks (нова фіча, API version 2026-03-11)
- **Проблема:** subscription paused — /notion route не обробляє payloads правильно
- **Наступний крок:** перевірити /notion handler, адаптувати під Notion webhook format

### User Question: hooks.yourwave.uk
- User asked about using hooks.yourwave.uk for Notion webhooks
- Recommended using dev.yourwave.uk/notion (already configured) instead of new subdomain
- But Notion already configured with ngrok URL directly — works for now

## Pending / Наступні кроки
- [ ] Read /notion webhook handler source code
- [ ] Research Notion webhook payload format (API version 2026-03-11)
- [ ] Fix handler to respond correctly and process events
- [ ] Unpause webhook subscription in Notion
- [ ] CI a11y fixes (bg-primary/10 contrast + heading hierarchy)
- [ ] Cloudflared restart (needs sudo)

## Технічний борг
- Webhook URL uses ngrok — should eventually use stable domain (hooks.yourwave.uk or dev.yourwave.uk)
- CI still failing: 16 a11y tests (contrast + heading hierarchy)
