---
phase: 1
slug: discord-channel-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run src/channels/discord.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/channels/discord.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CHAN-01 | unit | `npx vitest run src/channels/discord.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CHAN-02 | unit | `npx vitest run src/channels/discord.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CHAN-03 | unit | `npx vitest run src/channels/discord.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | CHAN-04 | unit | `npx vitest run src/channels/discord.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | CHAN-01 | integration | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/channels/discord.test.ts` — tests for DiscordChannel (comes from nanoclaw-discord remote merge)
- [ ] discord.js mock setup — shared test fixtures for discord.js Client

*Note: The nanoclaw-discord remote includes 776 lines of tests. Wave 0 is satisfied by the merge.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bot appears online in Discord server | CHAN-01 | Requires real Discord server + bot token | Start NanoClaw, check Discord server for bot online status |
| Bot reconnects after network interruption | CHAN-03 | Requires simulating network failure | Disconnect network briefly, verify bot reconnects within 30s |
| Clean disconnect on shutdown | CHAN-04 | Requires observing Discord gateway session | Stop NanoClaw, verify no orphaned sessions in Discord Developer Portal |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
