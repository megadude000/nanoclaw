---
phase: 11
slug: blocker-handoff-reporting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/agent-status-embeds.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/agent-status-embeds.test.ts`
- **After wave merge:** Run `npm run test`
- **Phase gate:** Full suite green before verification

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| BLOCK-01 | buildBlockerEmbed with blockerType='perm' produces correct color, title, fields, withAgentMeta | unit | `npx vitest run src/agent-status-embeds.test.ts` |
| BLOCK-02 | buildBlockerEmbed with blockerType='service' produces correct color | unit | `npx vitest run src/agent-status-embeds.test.ts` |
| BLOCK-03 | buildBlockerEmbed with blockerType='conflict' produces correct color | unit | `npx vitest run src/agent-status-embeds.test.ts` |
| HAND-01 | buildHandoffEmbed produces correct color, title, fields, withAgentMeta | unit | `npx vitest run src/agent-status-embeds.test.ts` |

---

## Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. Tests add to existing `src/agent-status-embeds.test.ts`.
