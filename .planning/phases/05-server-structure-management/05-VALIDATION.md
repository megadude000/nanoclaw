---
phase: 5
slug: server-structure-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/discord-server-manager.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/discord-server-manager.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SRV-01, SRV-02, SRV-03, SRV-04 | unit | `npx vitest run src/discord-server-manager.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | SRV-05 | unit | `npx vitest run src/ipc-auth.test.ts` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | SRV-06 | unit | `npx vitest run src/discord-server-manager.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/discord-server-manager.test.ts` — covers SRV-01 through SRV-04, SRV-06 with mocked guild
- [ ] New tests in `src/ipc-auth.test.ts` — covers SRV-05 (discord_manage authorization)
- [ ] Mock guild/channel objects for discord.js

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Channel appears in Discord | SRV-01 | Discord server-side rendering | Send IPC create_channel command, verify channel appears in Discord |
| Bootstrap creates full structure | SRV-06 | Server state verification | Run bootstrap, verify all categories and channels exist in Discord |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
