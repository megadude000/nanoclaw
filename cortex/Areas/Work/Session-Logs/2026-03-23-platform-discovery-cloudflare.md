---
type: session
date: 2026-03-23
project: YourWave
topics: [platform-discovery, ywproject-v2, cloudflare, mcp, design-system, bundle-builder]
status: completed
---

# Session: 2026-03-23 12:18 — platform-discovery-cloudflare

## Quick Reference
Topics: platform discovery Q&A (15/15 done), cloudflare MCP setup, yourwave.uk domain
Projects: YourWave
Outcome: Completed full platform discovery (15 Q&A + 5 bonus), installed 9 Cloudflare MCP servers, bought yourwave.uk domain
Pending: restart NanoClaw for CF MCP, structure project spec from discovery, Night Shift research tasks

---

## Зроблено

### Platform Discovery — 20 Questions Answered
Full tracker: `Areas/Work/Projects/YourWave/yw.platform-discovery.md`

Key decisions:
1. **Stack**: Astro + React Islands + Supabase (PostgreSQL + Auth + RLS + Realtime + Storage)
2. **Security-first**: RLS на всіх таблицях, .env не в Git, bot access з read-only views
3. **Bundle Builder**: два режими — готові бандли (по регіону/обробці/обжарці) + кастомний конструктор (3 кроки: пошук → форма+кількість → кошик). Gamification: прогрес-бар, знижка росте, безкоштовна доставка
4. **Subscription**: Phase 2. Repeat bundle + Surprise Wave. Unboxing experience (стикери, шоколадки, міні-журнал)
5. **Guest Wave**: Phase 3, не думати зараз
6. **Multi-tenant SaaS**: візія платформи (кава, квіти, etc), але Phase 2. Phase 1 = гнучка архітектура без хардкоду
7. **RBAC per module**: обжарщик бачить тільки batch roasting, owner — все
8. **Roast Batch**: не MVP, окремий модуль потім
9. **Desktop only CRM**: мобілка → "перейдіть на десктоп". Jarvis = notification layer через Telegram
10. **Payments**: seamless (Apple Pay, Google Pay, збережені карти). Провайдер — дослідити
11. **Shipping**: всі (Zásilkovna, PPL, DPD, FedEx). EU-wide. Integration Hub модуль
12. **Multi-currency**: CZK, EUR, PLN, Nordic. Дослідити best practices
13. **Один сайт**: yourwave.coffee = Atlas + Shop, seamless reader→buyer
14. **AI-driven dashboard**: контекстні модулі, Jarvis вирішує що показати сьогодні
15. **UX**: головний pain point v1. Контекстна навігація, info hierarchy, compact but breathable
16. **Learning focus**: дизайн-системи
17. **NotebookLM**: learning tool + knowledge base, deep link з Telegram
18. **Storybook**: обов'язковий, deep links на конкретні components
19. **Git branching**: platform-dev → feature branches → merge
20. **Knowledge redundancy**: Obsidian (primary) + Notion (backup)

### Cloudflare Setup
- Домен `yourwave.uk` куплений (Free plan)
- Account API Token `Nanoclaw_MCP` створений (expires 2027-04-01)
- 9 MCP серверів додані: api, docs, workers, observability, radar, browser, dns-analytics, graphql, agents-sdk
- Ще 8 доступні при потребі: builds, containers, logs, ai-gateway, autorag, auditlogs, dex, casb
- CLAUDE.md оновлено з Cloudflare секцією

### Night Shift
- Health check 12:00 — all 4 crons active
- Tonight: first v2.1 continuous shift

## Pending / Наступні кроки
- [ ] Restart NanoClaw для активації Cloudflare MCP
- [ ] Структурувати project spec з discovery answers
- [ ] Night Shift research: payments, shipping, multi-currency, CRM UI patterns, design systems
- [ ] NotebookLM setup (user at computer now)
- [ ] Merge nightshift/2026-03-22 branch

## Технічний борг
- Notion MCP `API-update-a-data-source` broken — curl workaround
- nightshift/2026-03-22 branch still unmerged
- OAuth flow for Cloudflare MCP not tested yet (using API token instead)
