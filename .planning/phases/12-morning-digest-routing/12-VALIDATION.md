---
phase: 12
slug: morning-digest-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | npm run build (TypeScript compilation) |
| **Config file** | tsconfig.json |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | DIGEST-01 | build | `npm run build` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | DIGEST-01 | build | `npm run build` | ✅ | ⬜ pending |
| 12-01-03 | 01 | 1 | DIGEST-02 | build | `npm run build` | ✅ | ⬜ pending |
| 12-01-04 | 01 | 2 | DIGEST-01 | manual | see manual section | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SQLite migration guard adds `routing_tag` column to `scheduled_tasks` (ALTER TABLE IF NOT EXISTS pattern)
- [ ] `config/routing.json` updated with `"morning-digest"` entry pointing to Discord #agents JID
- [ ] Morning digest task row backfilled: `UPDATE scheduled_tasks SET routing_tag = 'morning-digest' WHERE name LIKE '%digest%' OR prompt LIKE '%morning%digest%'`

*These are config/data changes, not test stubs. TypeScript build validates code correctness.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Morning Digest appears in Discord #agents | DIGEST-01 | Requires live Discord connection and morning trigger | Run `node dist/index.js` and manually trigger digest task; verify message in #agents channel |
| Morning Digest absent from Telegram | DIGEST-02 | Requires live Telegram session | Run `node dist/index.js` and manually trigger digest task; verify no message in Telegram main chat |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
