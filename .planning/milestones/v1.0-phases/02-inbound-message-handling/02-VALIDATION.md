---
phase: 02
slug: inbound-message-handling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/channels/discord.test.ts` |
| **Full suite command** | `npx vitest run src/channels/discord.test.ts` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/channels/discord.test.ts`
- **After every plan wave:** Run `npx vitest run src/channels/discord.test.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | IN-03 | unit | `npx vitest run src/channels/discord.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The discord.test.ts file already has comprehensive mocking patterns. Only 3 new test cases needed for IN-03 reply preview.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bot responds to @mention in Discord | IN-01 | Requires live Discord server | Send message mentioning bot, verify response |
| Attachment metadata displayed | IN-04 | Requires real file upload | Send image in Discord, verify metadata in response |
| Main channel skips trigger pattern | IN-05 | Requires live registered group | Send plain message in main channel, verify response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
