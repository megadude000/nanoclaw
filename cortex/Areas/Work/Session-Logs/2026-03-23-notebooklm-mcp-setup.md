---
type: session
date: 2026-03-23
project: NanoClaw
topics: [notebooklm-mcp, browser-auth, docker-mounts, chrome-profile]
status: in-progress
---

# Session: 2026-03-23 20:00 — notebooklm-mcp-setup

## Quick Reference
Topics: NotebookLM MCP auth, Chrome profile mount, headless browser limitations
Projects: NanoClaw, YourWave
Outcome: NotebookLM MCP server added to container, auth passed on host, Chrome profile mount identified but not yet applied
Pending: apply Chrome profile mount in container-runner.ts, restart, test NotebookLM in container

---

## Зроблено

### NotebookLM MCP — підключення
- MCP сервер `notebooklm-mcp@latest` додано в `container/agent-runner/src/index.ts` і `~/.claude/.mcp.json`
- Сервер стартує в контейнері, `get_health` повертає `status: ok`
- Auth на хості пройшла успішно через `host_claude` — Chrome профіль збережено в `~/.local/share/notebooklm-mcp/`

### Проблема: headless auth
- **Проблема:** `setup_auth` в контейнері фейлиться — немає дисплею для Chrome
- **Рішення:** Auth пройшла на хості. Потрібно примонтувати Chrome профіль в контейнер
- **Статус:** mount ще не додано

## Технічні зміни

### Chrome Profile Mount (NOT YET APPLIED)
- **Файл:** `src/container-runner.ts` (~після рядка 224)
- **Що додати:** mount `~/.local/share/notebooklm-mcp/` → `/home/node/.local/share/notebooklm-mcp/`
- **Вже є:** mount для `~/.config/notebooklm-mcp` (конфіг, не профіль)
- **readonly:** false (браузер пише session state)

## Pending / Наступні кроки
- [ ] Додати volume mount для Chrome профілю в container-runner.ts
- [ ] Рестартнути NanoClaw
- [ ] Тестувати NotebookLM MCP з примонтованим профілем
- [ ] Якщо headless Chrome блокується Google — fallback на host_claude проксі

## Рішення
- NotebookLM не має публічного API — тільки browser automation через Patchright
- Playwright (для Storybook) працює headless, але Google детектить headless при логіні
- Якщо cookies валідні — headless може працювати для запитів (не для auth)
