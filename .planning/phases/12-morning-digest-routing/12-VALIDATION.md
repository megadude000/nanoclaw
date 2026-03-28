---
phase: 12
slug: morning-digest-routing
status: finalized
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit tests) + TypeScript compilation |
| **Config file** | vitest.config.ts, tsconfig.json |
| **Quick run command** | `npm run build && npm test -- src/db.test.ts src/task-scheduler.test.ts` |
| **Full suite command** | `npm run build && npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build && npm test -- {task_test_files}`
- **After every plan wave:** Run `npm run build && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-00 | 01 | 0 | DIGEST-01, DIGEST-02 | unit (TDD RED) | `npm run build && npm test -- src/db.test.ts src/task-scheduler.test.ts 2>&1 \| tail -20` | src/db.test.ts, src/task-scheduler.test.ts | ⬜ pending |
| 12-01-01 | 01 | 1 | DIGEST-01 | unit + build | `npm run build && npm test -- src/db.test.ts` | src/types.ts, src/db.ts, config/routing.json | ⬜ pending |
| 12-01-02 | 01 | 1 | DIGEST-01, DIGEST-02 | unit + build | `npm run build && npm test -- src/task-scheduler.test.ts src/db.test.ts` | src/task-scheduler.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 (Task 0) creates TDD test stubs that define the RED phase:

- [x] `src/db.test.ts` contains `routing_tag schema` describe block with two assertions: round-trip create/get and null default
- [x] `src/task-scheduler.test.ts` contains `routing_tag routing (DIGEST-01 / DIGEST-02)` describe block with:
  - DIGEST-01 test: asserts `sendMessage` called with routing target JID
  - DIGEST-02 test: asserts `sendMessage` NOT called with `task.chat_jid` (uncommented, with full setup code — actively fails RED)
- [x] Tests are expected to FAIL (RED) after Task 0 — this is correct TDD behavior
- [x] Tests go GREEN after Tasks 1 (schema) and 2 (routing logic) are implemented

*Wave 0 creates test stubs, not config-only changes. The Nyquist rule is satisfied: every production task has a corresponding automated test written before implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Morning Digest appears in Discord #agents | DIGEST-01 | Requires live Discord connection and morning trigger | Run `node dist/index.js` and manually trigger digest task; verify message in #agents channel |
| Morning Digest absent from Telegram | DIGEST-02 | Requires live Telegram session | Run `node dist/index.js` and manually trigger digest task; verify no message in Telegram main chat |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (`npm run build && npm test -- {files}`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers test stubs for DIGEST-01 and DIGEST-02 (TDD RED phase)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** finalized
