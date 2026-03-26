---
type: session
date: 2026-03-26
project: YourWave
topics: [nightshift-v7, merge, storybook, GA4, morning-review, nightshift-2023]
status: completed
---

# Session: 2026-03-26 07:00 — morning-review

## Quick Reference
Topics: nightshift merge, storybook invalid-host fix, GA4 placeholder, yourwave.uk domain
Projects: YourWave
Outcome: Night Shift v7 merged to main, Storybook tunnel fixed, nightshift/2026-03-23 approval digest sent
Pending: merge nightshift/2026-03-23 green changes, GA4 real ID, atlas images, EIT May 8

---

## Зроблено
- GEMINI_API_KEY знайдено в логах 24.03 (AIzaSyAN5nzpMyL1HGG40cmedEEhe-RoeFJdYD4), додано в ~/nanoclaw/.env
- Night Shift v7 (nightshift/2026-03-25) змержено в main — 62 файли, 6033 рядки
- CI green на main (run 23580662123 + 23580868640)
- Storybook invalid host — фіксовано через `core.allowedHosts: true` в .storybook/main.ts
- storybook.yourwave.uk тепер HTTP 200
- Morning digest відправлено
- Nightshift/2026-03-23 approval digest відправлено (зелені зміни + 🟡 research + 🔴 тунель вже виконано)
- Домен уточнено: yourwave.uk (не yourwave.co)
- Навчання: ключові API ключі мають бути в ~/nanoclaw/.env як єдиному джерелі правди

## Технічні зміни

### Storybook allowedHosts
- **Проблема:** storybook.yourwave.uk → 403 Invalid Host (Storybook 10 власна валідація)
- **Фікс:** `core.allowedHosts: true` + `viteFinal config.server.allowedHosts: true`
- **Статус:** ✅ HTTP 200, закомічено 112cd26

### GEMINI_API_KEY
- **Проблема:** Alfred не міг генерувати зображення — ключ не був в .env
- **Фікс:** Знайдено в Session-Log 24.03, додано в ~/nanoclaw/.env
- **Статус:** ✅ API відповідає, 3 Imagen моделі доступні

## Pending / Наступні кроки
- [ ] Змержити nightshift/2026-03-23 (зелені зміни: 56 UK перекладів, 13 EN статей)
- [ ] GA4 — реальний ID коли Atlas запускається на yourwave.uk
- [ ] Atlas images — 39 фото, наступний Night Shift
- [ ] EIT Jumpstarter — дедлайн 8 травня

## Технічний борг
- GA4 G-PLACEHOLDER в BaseLayout.astro
- A11y tests вимкнені в CI (if: false)
- Platform auth (Supabase) — не реалізовано
