---
phase: 6
slug: webhook-routing-architecture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/routing.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/routing.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | ROUT-01, ROUT-05 | unit | `npx vitest run src/routing.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | ROUT-02, ROUT-03, ROUT-04, ROUT-06 | unit | `npx vitest run src/routing.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routing.test.ts` — covers resolveTargets(), config loading, dual-send logic, fallback behavior
- [ ] Mock registeredGroups with both Telegram and Discord entries

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub Issue triggers Discord notification | ROUT-02 | Requires live GitHub webhook | Create test issue, verify #bugs channel receives notification |
| Notion update triggers Discord notification | ROUT-03 | Requires live Notion webhook | Update task, verify #yw-tasks channel receives notification |
| Dual-send delivers to both platforms | ROUT-06 | Requires both platforms connected | Trigger webhook, verify both Telegram and Discord receive it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
