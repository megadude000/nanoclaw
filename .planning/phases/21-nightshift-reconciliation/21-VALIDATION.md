---
phase: 21
slug: nightshift-reconciliation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | vitest.config.ts (project root) |
| **Quick run command** | `npx vitest run src/cortex/reconciler.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/cortex/reconciler.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 0 | NIGHT-01 to NIGHT-04 | unit | `npx vitest run src/cortex/reconciler.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | NIGHT-01, NIGHT-02, NIGHT-03, NIGHT-04 | unit | `npx vitest run src/cortex/reconciler.test.ts -x` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 2 | NIGHT-01 | unit | `npx vitest run src/cortex/reconciler.test.ts -t "runReconciliation"` | ✅ (extend) | ⬜ pending |
| 21-02-02 | 02 | 2 | NIGHT-01 | manual | Verify Night Shift planner prompt includes Cortex maintenance | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/cortex/reconciler.test.ts` — TDD stubs for NIGHT-01 (runReconciliation), NIGHT-02 (checkStaleness), NIGHT-03 (discoverCrossLinks), NIGHT-04 (findOrphans)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Night Shift planner prompt includes Cortex maintenance fallback | NIGHT-01 | DB-stored prompt not in source code | Check task_configs DB table or Night Shift planner task config for Cortex maintenance mention |
| Summary report posts to #agents after reconciliation | NIGHT-01 | Requires live Discord + Qdrant | Run reconciler manually, verify embed appears in #agents channel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
