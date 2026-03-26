---
phase: 4
slug: group-registration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/discord-group-utils.test.ts src/channels/discord.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/discord-group-utils.test.ts src/channels/discord.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | GRP-01 | unit | `npx vitest run src/channels/discord.test.ts` | Partial | ⬜ pending |
| 04-01-02 | 01 | 1 | GRP-02 | unit | `npx vitest run src/discord-group-utils.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | GRP-03 | unit | `npx vitest run src/ipc-auth.test.ts` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 1 | GRP-04 | unit | `npx vitest run src/ipc-auth.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/discord-group-utils.test.ts` — stubs for GRP-02: sanitization, collision handling, stub creation
- [ ] Update `src/channels/discord.test.ts` — auto-registration on first message, isMain detection for GRP-01
- [ ] Update `src/ipc-auth.test.ts` — Discord-specific JID tests for GRP-03/GRP-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Group folder appears on disk | GRP-02 | Filesystem creation in live environment | Send a message in a new Discord channel, verify groups/dc-{name}/ exists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
