---
type: project
updated: 2026-03-23
status: active
---

# Morning Digest — Ранковий Ритуал

Щоденний ранковий дайджест о 7:27. Цікавий, інформативний, з посиланнями. Не сухий звіт — а кайфовий ранковий ритуал з кавою.

## Формат

```
🌅 *Ранковий дайджест — {день тижня}, {число} {місяць} {рік}*

🤖 *AI — головне*
• [Назва новини](url) — 1 рядок опису
• [Назва](url) — опис
• [Назва](url) — опис
3-5 новин, кожна з посиланням вбудованим у ключову фразу

🌍 *Світ*
• [Подія](url) — контекст
• [Подія](url) — контекст
3-4 новини

☕ *Кава*
• [Новина](url) — що це значить
• [Новина](url) — деталі
2-3 новини (specialty, competitions, Prague)

🛠 *Проєкти*
• Статус проєктів (НЕ Night Shift — він окремо)
• Git branches, pending merges
• 1-2 рядки статусу
Тільки якщо є що сказати — не вигадувати

⚠️ NIGHT SHIFT RESULTS — ОКРЕМИЙ ДАЙДЖЕСТ (7:35), не в цьому!

📧 *Пошта*
• ⚠️ Важливі листи першими
• Решта коротко
```

## Правила

1. *Посилання* — ЗАВЖДИ вбудовані в ключові фрази: `[Nvidia GTC 2026](url)`, не сирі URL
2. *Sender* — від Jarvis (без sender param), НЕ від Friday/Alfred
3. *Тон* — цікавий, не сухий. Як друг розповідає новини за кавою
4. *Розмір* — 25-35 рядків, не стіна тексту
5. *WebSearch* — обов'язковий для AI, World, Coffee секцій
6. *Пошта* — через mcp__gmail__search_emails
7. *Проєкти* — перевірка файлів, git status. Не вигадувати
8. *Fallback* — якщо markdown посилання ламає Telegram — відправити без посилань, не падати
9. *Колапсери* — `<blockquote expandable>` для списків > 5 елементів. Summary зверху, деталі в колапсері. ОБОВ'ЯЗКОВО.

## Cron

- Task ID: `task-...-5jalv0`
- Schedule: `27 7 * * *` (7:27 CET щодня)
- Mode: isolated
- Sender: none (= Jarvis)

## Decisions

| Date | Decision |
|---|---|
| 2026-03-15 | Created digest format: AI + World + Coffee sections |
| 2026-03-16 | Set time: 7:30 → later adjusted to 7:27 |
| 2026-03-17 | Links embedded in key phrases, not raw URLs |
| 2026-03-17 | Isolated mode (no chat history needed) |
| 2026-03-23 | Fixed: no more Friday sender, always Jarvis |
| 2026-03-23 | Night Shift results = ОКРЕМИЙ дайджест (7:35), не частина ранкових новин |
| 2026-03-23 | Fixed: always include news (WebSearch), not just internal reports |
| 2026-03-23 | Documented as "Morning Ritual" in Obsidian |
