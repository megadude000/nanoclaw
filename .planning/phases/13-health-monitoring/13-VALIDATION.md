---
phase: 13
slug: health-monitoring
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/health-monitor` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/health-monitor`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | HEALTH-01, HEALTH-02 | unit (TDD in-task) | `npx vitest run src/health-monitor-embeds.test.ts 2>&1 \| tail -20` | src/health-monitor-embeds.ts, src/health-monitor-embeds.test.ts | ⬜ pending |
| 13-01-02 | 01 | 1 | HEALTH-01, HEALTH-02, HEALTH-03 | unit + build (TDD in-task) | `npm run build && npx vitest run src/health-monitor.test.ts src/health-monitor-embeds.test.ts 2>&1 \| tail -30` | src/health-monitor.ts, src/health-monitor.test.ts | ⬜ pending |
| 13-02-01 | 02 | 2 | HEALTH-01, HEALTH-02, HEALTH-03 | build + full suite | `npm run build && npm run test 2>&1 \| tail -30` | src/index.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## TDD Approach

Plan 01 tasks use `tdd="true"` with `<behavior>` blocks. Tests are written RED-first within
each task before implementation (inline TDD), not in a separate Wave 0 plan. This is appropriate
because the test files and implementation files are co-located in the same task, and the executor
follows the RED-GREEN cycle within a single task execution.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Health embed appears in Discord #logs channel | HEALTH-01, HEALTH-02 | Requires live Discord connection and real systemctl/cloudflared | Run `node dist/index.js`, bring down a service, verify embed in #logs within one check interval |
| Heartbeat embed appears in Discord #logs | HEALTH-03 | Requires live Discord and 30min wait | Wait for heartbeat interval to fire, verify embed in #logs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] TDD coverage: Plan 01 tasks use tdd="true" with behavior blocks for HEALTH-01, HEALTH-02, HEALTH-03
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed-off (revision pass — Wave 0 consolidated into in-task TDD)
