---
phase: 22
slug: multi-project-bootstrap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 22 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Quick run command** | `npx vitest run src/cortex/multi-project-bootstrap.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/cortex/multi-project-bootstrap.test.ts`
- **After every plan wave:** Run `npm run test`

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | POP-02 | unit | `npx vitest run src/cortex/multi-project-bootstrap.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | POP-02 | unit | `npx vitest run src/cortex/multi-project-bootstrap.test.ts -t "project filter"` | ✅ (extend) | ⬜ pending |

## Wave 0 Requirements

- [ ] `src/cortex/multi-project-bootstrap.test.ts` — stubs for POP-02 (bootstrap extraction + project-scoped search)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| cortex_search project=yourwave returns only YourWave entries | POP-02 | Requires live Qdrant with data | Run bootstrap, then cortex_search with project filter |

**Approval:** pending
