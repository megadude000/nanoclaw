---
phase: 13
slug: health-monitoring
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 13-01-00 | 01 | 0 | HEALTH-01, HEALTH-02, HEALTH-03 | unit (TDD RED) | `npx vitest run src/health-monitor.test.ts src/health-monitor-embeds.test.ts 2>&1 \| tail -20` | Wave 0 gap | ⬜ pending |
| 13-01-01 | 01 | 1 | HEALTH-01, HEALTH-02 | unit + build | `npm run build && npx vitest run src/health-monitor.test.ts src/health-monitor-embeds.test.ts` | src/health-monitor.ts, src/health-monitor-embeds.ts | ⬜ pending |
| 13-01-02 | 01 | 2 | HEALTH-03 | unit + build | `npm run build && npx vitest run src/health-monitor.test.ts` | src/health-monitor.ts | ⬜ pending |
| 13-01-03 | 01 | 2 | HEALTH-01, HEALTH-02, HEALTH-03 | unit + build | `npm run build && npx vitest run src/health-monitor.test.ts` | src/index.ts or src/task-scheduler.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/health-monitor.test.ts` — covers HEALTH-01 (tunnel state transitions), HEALTH-02 (service state transitions), HEALTH-03 (heartbeat when all up). Tests are RED until implementation.
- [ ] `src/health-monitor-embeds.test.ts` — covers embed builder output (colors, titles, fields for DOWN/UP/HEARTBEAT embeds). Tests are RED until implementation.

*Wave 0 creates TDD test stubs that define expected behavior before implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Health embed appears in Discord #logs channel | HEALTH-01, HEALTH-02 | Requires live Discord connection and real systemctl/cloudflared | Run `node dist/index.js`, bring down a service, verify embed in #logs within one check interval |
| Heartbeat embed appears in Discord #logs | HEALTH-03 | Requires live Discord and 30min wait | Wait for heartbeat interval to fire, verify embed in #logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify commands
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers test stubs for HEALTH-01, HEALTH-02, HEALTH-03
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
