---
phase: 10
slug: agent-status-reporting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --run src/agent-status-embeds.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/agent-status-embeds.test.ts`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | ASTATUS-01,02,03 | unit | `npm test -- --run src/agent-status-embeds.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | ASTATUS-01,02,03 | unit | `npm test -- --run src/agent-status-embeds.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | ASTATUS-01,02 | integration | `npm test -- --run src/task-scheduler.test.ts` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 2 | ASTATUS-03 | unit | `npm test -- --run src/ipc.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent-status-embeds.test.ts` — unit tests for took/closed/progress embed builders
- [ ] `src/ipc.test.ts` — stub for agent_status IPC message handler (if not already covered)

*Existing vitest infrastructure covers all test needs — no framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Embed appears in real Discord #agents channel | ASTATUS-01 | Requires live Discord bot | Schedule a test task, confirm embed appears in #agents within 5s |
| progress embed shows meaningful content | ASTATUS-03 | Requires agent running live | Run a long task, confirm at least 1 progress embed in #agents |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
