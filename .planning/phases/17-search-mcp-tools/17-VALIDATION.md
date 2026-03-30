---
phase: 17
slug: search-mcp-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | `vitest.config.ts` — `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npx vitest run src/cortex/` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/cortex/`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 0 | SEARCH-01, MCP-01, MCP-02, MCP-03 | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-02-01 | 02 | 1 | SEARCH-01, SEARCH-02, SEARCH-03, MCP-01, MCP-02, MCP-03 | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-02-02 | 02 | 1 | MCP-05 | integration | Manual | manual | ⬜ pending |
| 17-03-01 | 03 | 1 | MCP-05 | integration | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/cortex/cortex-mcp-tools.test.ts` — stubs for SEARCH-01, SEARCH-02, SEARCH-03, MCP-01, MCP-02, MCP-03

*Existing vitest infrastructure covers the phase — Wave 0 only needs the test file stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tools added to existing McpServer instance, not a new server | MCP-05 | Container integration — cannot unit test McpServer.tool() registration without running the container | Start container, run `claude --mcp-debug`, verify cortex_search/cortex_read/cortex_write appear in tool list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
