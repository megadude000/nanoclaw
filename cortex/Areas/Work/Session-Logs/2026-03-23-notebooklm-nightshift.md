---
type: session
date: 2026-03-23
project: YourWave, NanoClaw
topics: [notebooklm-mcp, nightshift-planning, browser-automation, playwright]
status: completed
---

# Session: 2026-03-23 20:00 — notebooklm-nightshift

## Quick Reference
Topics: NotebookLM MCP setup, auth issues, Night Shift planning
Projects: NanoClaw, YourWave
Outcome: NotebookLM MCP connected (host auth OK, container needs proxy), Night Shift plan prepared with wind rose analysis
Pending: Night Shift execution, NotebookLM browser automation via Playwright, project spec

---

## Зроблено
- NotebookLM MCP сервер додано в контейнер (`agent-runner/src/index.ts`) і хост (`~/.claude/.mcp.json`)
- Auth пройшла на хості через `host_claude` — Chrome профіль збережено в `~/.local/share/notebooklm-mcp/`
- Виявлено: контейнер не бачить профіль Chrome (потрібен mount `~/.local/share/notebooklm-mcp/`)
- Знайдено існуючий mount для `~/.config/notebooklm-mcp` але не для browser profile
- Host_claude знайшов де додати mount в `container-runner.ts` (після рядка 224)
- Playwright в контейнері крашиться (SIGTRAP) — проблема з Chromium
- Night Shift план підготовлено: wind rose аналіз, Notion backlog

## Технічні зміни
### NotebookLM MCP Auth
- **Проблема:** Container headless, Google блокує headless логін
- **Фікс:** Auth через host_claude (Chrome з дисплеєм на хості)
- **Статус:** Auth OK на хості, mount в контейнер — запропоновано але не застосовано

### NotebookLM Browser Automation
- **Проблема:** Немає API, тільки веб-інтерфейс
- **Ідея користувача:** Використати Playwright для створення notebooks і upload sources
- **Статус:** Playwright crash в контейнері (SIGTRAP), потрібно фіксити Chromium або використовувати host_claude

### Night Shift Planning
- **Wind Rose:** community 0%, marketing 5%, roasting 10%, legal 10%
- **Unmerged:** nightshift/2026-03-22 branch (23 статті, 5 комітів)
- **Notion Backlog:** домен, Instagram, гранти

## Pending / Наступні кроки
- [ ] Примонтувати Chrome профіль NotebookLM в контейнер (container-runner.ts)
- [ ] Пофіксити Playwright/Chromium crash в контейнері
- [ ] Мержити nightshift/2026-03-22 в main
- [ ] Night Shift виконання: переклади, ресерч, документація
- [ ] Написати YWPlatform project spec з discovery Q&A

## Технічний борг
- Playwright Chromium crash (SIGTRAP) в контейнері — потребує діагностики
- NotebookLM MCP працює тільки через host_claude proxy
- Бранч nightshift/2026-03-22 не замержений вже 2-й день
