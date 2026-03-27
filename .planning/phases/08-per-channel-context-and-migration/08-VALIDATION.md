---
phase: 8
slug: per-channel-context-and-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/discord-group-utils.test.ts src/webhook-router.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | CTX-01 thru CTX-05 | unit | `npx vitest run src/discord-group-utils.test.ts` | ✅ | ⬜ pending |
| 08-02-01 | 02 | 2 | MIG-01 thru MIG-04 | unit | `npx vitest run src/webhook-router.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — existing test files cover the modified modules.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent responds in bug-triage mode in #bugs | CTX-02 | Requires live agent + Discord | Write in #bugs, verify agent response references bug context |
| Agent responds in PM mode in #yw-tasks | CTX-03 | Requires live agent + Discord | Write in #yw-tasks, verify agent response references task context |
| Disabling Telegram stops delivery | MIG-03 | Requires live Telegram + Discord | Set Telegram enabled:false, trigger webhook, verify only Discord receives |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
