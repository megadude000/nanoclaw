---
phase: 3
slug: outbound-formatting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/channels/discord.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/channels/discord.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | OUT-02 | unit | `npx vitest run src/channels/discord.test.ts` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | OUT-04 | unit | `npx vitest run src/channels/discord.test.ts` | ✅ | ⬜ pending |
| 03-01-03 | 01 | 1 | OUT-06 | unit | `npx vitest run src/channels/discord.test.ts` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 1 | OUT-03 | unit | `npx vitest run src/channels/discord.test.ts` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 1 | OUT-01 | unit | `npx vitest run src/channels/discord.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. vitest already configured, discord.test.ts has 42 tests from phases 1-2.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Embed renders with color | OUT-03 | Visual rendering is Discord client-side | Send a test embed, verify color bar appears in Discord |
| Buttons are clickable | OUT-06 | Click interaction requires Discord client | Send buttons, click one, verify callback received |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
