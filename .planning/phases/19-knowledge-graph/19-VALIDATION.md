---
phase: 19
slug: knowledge-graph
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already configured) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run src/cortex/cortex-graph.test.ts src/cortex/cortex-mcp-tools.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/cortex/cortex-graph.test.ts src/cortex/cortex-mcp-tools.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 0 | GRAPH-01 | unit | `npx vitest run src/cortex/cortex-graph.test.ts -x` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | GRAPH-01 | unit | `npx vitest run src/cortex/cortex-graph.test.ts -x` | ❌ W0 | ⬜ pending |
| 19-01-03 | 01 | 2 | GRAPH-02 | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts -x` | ✅ (extend) | ⬜ pending |
| 19-01-04 | 01 | 2 | MCP-04 | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts -x` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/cortex/cortex-graph.test.ts` — stubs for GRAPH-01 (schema, load/save, dedup, self-edge, empty file)
- [ ] New test cases in `src/cortex/cortex-mcp-tools.test.ts` — covers GRAPH-02 (graph-augmented search) and MCP-04 (cortex_relate tool)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| cortex-graph.json survives container restart | GRAPH-01 | File persistence on host | Check file exists after container stop/start |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
