---
phase: 20
slug: lore-protocol
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | vitest.config.ts (project root) |
| **Quick run command** | `npx vitest run src/cortex/lore-parser.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/cortex/lore-parser.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 0 | LORE-02 | unit | `npx vitest run src/cortex/lore-parser.test.ts -x` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | LORE-02, LORE-03 | unit | `npx vitest run src/cortex/lore-parser.test.ts -x` | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 2 | LORE-01 | manual | Visual inspection of CLAUDE.md | N/A | ⬜ pending |
| 20-02-02 | 02 | 2 | LORE-03 | unit | `npx vitest run src/cortex/lore-parser.test.ts -x` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/cortex/lore-parser.test.ts` — TDD stubs for LORE-02 (parseLoreFromGit) and LORE-03 (writeLoreAtom)
- [ ] `src/cortex/lore-parser.ts` — module to be created (implement after tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Convention documented in CLAUDE.md with examples | LORE-01 | Documentation quality check | Read CLAUDE.md — verify Constraint/Rejected/Directive trailer examples present |
| Night Shift mining task scheduled correctly | LORE-03 | DB state verification | Check task scheduler DB or logs for one-off lore-mining task |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
