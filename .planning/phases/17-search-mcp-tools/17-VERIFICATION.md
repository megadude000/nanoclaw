---
phase: 17-search-mcp-tools
verified: 2026-03-30T23:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 17: Search MCP Tools Verification Report

**Phase Goal:** Container agents can search, read, and write Cortex entries using MCP tools — the primary agent interface to the knowledge layer
**Verified:** 2026-03-30T23:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | cortex_search embeds query via OpenAI and queries Qdrant with optional filters | VERIFIED | `buildSearchHandler` in `src/cortex/cortex-mcp-tools.ts` lines 113-169; 27 tests GREEN |
| 2 | cortex_search detects vault path queries and routes to direct file read (no OpenAI call) | VERIFIED | `isVaultPath()` exported at line 50; hybrid routing at line 130; test confirms OpenAI NOT called |
| 3 | cortex_read returns full file content with path traversal protection | VERIFIED | `buildReadHandler` lines 181-204; `startsWith(vaultRoot + '/')` guard present |
| 4 | cortex_write validates all 4 frontmatter fields, enforces confidence firewall for L20+, writes IPC file | VERIFIED | `buildWriteHandler` lines 216-261; `CortexFieldsStrict` Zod schema; `checkConfidenceFirewall`; `writeIpc()` call |
| 5 | All three tools registered on the existing McpServer in ipc-mcp-stdio.ts | VERIFIED | `cortex_search` line 478, `cortex_read` line 538, `cortex_write` line 562; single `new McpServer` at line 41 |
| 6 | All 27 tests in cortex-mcp-tools.test.ts pass (GREEN) | VERIFIED | `npx vitest run` output: 27/27 passed in 24ms |
| 7 | cortex_write IPC files processed in the host messages loop | VERIFIED | `src/ipc.ts` line 126: `else if (data.type === 'cortex_write' && data.path && data.content)` |
| 8 | All containers have read-only access to cortex/ vault at /workspace/cortex | VERIFIED | `src/container-runner.ts` lines 142-148: `existsSync(cortexDir)` + `readonly: true` mount |
| 9 | Containers receive OPENAI_API_KEY and QDRANT_URL env vars | VERIFIED | `src/container-runner.ts` line 377: `readEnvFile(['OPENAI_API_KEY'])`, line 382: `QDRANT_URL=http://host.docker.internal:6333` |
| 10 | cortex_write path traversal blocked on host side (defense in depth) | VERIFIED | `src/ipc.ts` line 130: `!targetPath.startsWith(vaultRoot + path.sep)` → `logger.warn` + skip write |
| 11 | Container package.json has openai, @qdrant/js-client-rest, gray-matter | VERIFIED | All 3 deps present in `container/agent-runner/package.json` |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/cortex/cortex-mcp-tools.ts` | 5 exported handler factories + helpers | VERIFIED | 269 lines; exports: `isVaultPath`, `checkConfidenceFirewall`, `buildSearchHandler`, `buildReadHandler`, `buildWriteHandler`; inlined `CortexFieldsStrict` Zod schema; no host-only imports |
| `src/cortex/cortex-mcp-tools.test.ts` | 27-test scaffold, all GREEN | VERIFIED | 517 lines; 27/27 pass; all 6 requirement IDs covered |
| `container/agent-runner/src/ipc-mcp-stdio.ts` | 3 server.tool() registrations | VERIFIED | `cortex_search` line 478, `cortex_read` line 538, `cortex_write` line 562; all before `StdioServerTransport` line 611; QDRANT_URL env var used |
| `container/agent-runner/package.json` | openai, @qdrant/js-client-rest, gray-matter | VERIFIED | All 3 deps present with pinned versions |
| `src/ipc.ts` | cortex_write handler in messages loop | VERIFIED | Lines 126-143; path traversal guard + `mkdirSync` + `writeFileSync` |
| `src/container-runner.ts` | Cortex vault mount + OPENAI_API_KEY + QDRANT_URL | VERIFIED | Line 142 (cortex mount), line 377 (OPENAI_API_KEY), line 382 (QDRANT_URL) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `cortex-mcp-tools.test.ts` | `cortex-mcp-tools.ts` | `import` | WIRED | Import present; 27 tests exercise all 5 exports |
| `ipc-mcp-stdio.ts` cortex tools | `cortex-mcp-tools.ts` logic | inline | WIRED | Logic inlined (not cross-package import); correct per plan design |
| `cortex_write` tool | MESSAGES_DIR IPC file | `writeIpcFile(MESSAGES_DIR, { type: 'cortex_write', ... })` | WIRED | `ipc-mcp-stdio.ts` line 599: `type: 'cortex_write'` |
| `cortex_search` | `host.docker.internal:6333` | `QdrantClient({ url: process.env.QDRANT_URL })` | WIRED | `ipc-mcp-stdio.ts` line 501: `process.env.QDRANT_URL \|\| 'http://host.docker.internal:6333'` |
| `container agent cortex_write` | `src/ipc.ts messages loop` | IPC file `type: 'cortex_write'` | WIRED | `src/ipc.ts` line 126 matches on `data.type === 'cortex_write'` |
| `src/ipc.ts cortex_write handler` | `cortex/ vault filesystem` | `fs.writeFileSync(targetPath, data.content)` | WIRED | `src/ipc.ts` line 137 |
| `src/container-runner.ts` | `/workspace/cortex` | read-only bind mount | WIRED | Line 145-148: `hostPath: cortexDir, containerPath: '/workspace/cortex', readonly: true` |
| `src/container-runner.ts` | `OPENAI_API_KEY` in container | `readEnvFile(['OPENAI_API_KEY'])` | WIRED | Line 377 |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase produces tool logic (library functions + MCP server registrations), not UI components or pages that render dynamic data. The data flow is verified via unit tests (27/27 GREEN) which confirm real Qdrant/OpenAI mock interactions produce correct output shapes.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 27 unit tests pass | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | 27/27 passed, 24ms | PASS |
| `isVaultPath` export present | `grep "export function isVaultPath" src/cortex/cortex-mcp-tools.ts` | line 50 found | PASS |
| `checkConfidenceFirewall` export present | `grep "export async function checkConfidenceFirewall" src/cortex/cortex-mcp-tools.ts` | line 73 found | PASS |
| 3 tools before StdioServerTransport | lines 478/538/562 < line 611 | cortex tools registered first | PASS |
| Single McpServer instantiation | `grep "new McpServer" ipc-mcp-stdio.ts` | 1 match (line 41) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEARCH-01 | 17-01, 17-02 | Hybrid search routing — exact vault path vs semantic Qdrant | SATISFIED | `isVaultPath()` + `buildSearchHandler` hybrid routing; test case verifies OpenAI NOT called for vault paths |
| SEARCH-02 | 17-01, 17-02 | Confidence firewall: L(N) write blocked when L(N-1) lacks medium+ confidence | SATISFIED | `checkConfidenceFirewall()` scrolls Qdrant for parent level; L10 always allowed; 3 test cases cover blocked/allowed/L10 |
| SEARCH-03 | 17-01, 17-02 | Search results filterable by project, cortex_level, domain | SATISFIED | `buildSearchHandler` builds `mustConditions` array from optional `args.project`, `args.cortex_level`, `args.domain`; test verifies filter shape |
| MCP-01 | 17-01, 17-02 | cortex_search tool in container agents | SATISFIED | `server.tool('cortex_search', ...)` registered in `ipc-mcp-stdio.ts` line 478 |
| MCP-02 | 17-01, 17-02 | cortex_read tool in container agents | SATISFIED | `server.tool('cortex_read', ...)` registered in `ipc-mcp-stdio.ts` line 538; path traversal guard present |
| MCP-03 | 17-01, 17-02, 17-03 | cortex_write tool in container agents + host IPC handler | SATISFIED | `server.tool('cortex_write', ...)` line 562 writes IPC; `src/ipc.ts` line 126 handles it; `fs.writeFileSync` to vault |
| MCP-05 | 17-02, 17-03 | All tools on existing McpServer (no new server process) | SATISFIED | Single `new McpServer` at line 41; all 3 tools added to same `server` instance |

**Orphaned requirements check:** MCP-04 (`cortex_relate`) is assigned to Phase 19 in REQUIREMENTS.md — not orphaned for this phase. No requirements mapped to Phase 17 are unaccounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No stubs, placeholders, or empty implementations found. All handler factories produce real logic. The inline approach in `ipc-mcp-stdio.ts` (instead of cross-package import) is intentional per plan design — the container build cannot import from host `src/cortex/`.

---

### Human Verification Required

#### 1. End-to-end cortex_search with live Qdrant

**Test:** Start a container agent and call `cortex_search` with a natural language query (e.g., "how does the IPC watcher work"). Confirm results are returned with scores and payload fields.
**Expected:** Array of `{ path, score, level, domain, project }` objects; no error.
**Why human:** Requires live Qdrant instance at `host.docker.internal:6333` and embedded entries in `cortex-entries` collection.

#### 2. End-to-end cortex_write persistence

**Test:** Call `cortex_write` with a valid markdown entry from inside a running container. Verify the file appears in the host `cortex/` directory.
**Expected:** File written at the specified vault path; `src/ipc.ts` log shows `cortex_write: vault file written`.
**Why human:** Requires a running NanoClaw service, live container, and IPC file processing loop active.

#### 3. Container build with new deps

**Test:** Run `./container/build.sh` to rebuild the Docker image. Confirm the image includes `openai`, `@qdrant/js-client-rest`, and `gray-matter`.
**Expected:** Build exits 0; `docker run` of the image can `require('openai')` without error.
**Why human:** Requires Docker daemon; cannot run container build in this environment.

---

### Gaps Summary

No gaps. All must-haves verified:

- `src/cortex/cortex-mcp-tools.ts` exists (269 lines), exports all 5 functions, contains inlined `CortexFieldsStrict` schema, has no host-only imports.
- `src/cortex/cortex-mcp-tools.test.ts` has 27 tests, all passing GREEN.
- `container/agent-runner/src/ipc-mcp-stdio.ts` registers all 3 tools on the single existing `McpServer` before transport initialization.
- `container/agent-runner/package.json` has all 3 new dependencies.
- `src/ipc.ts` handles `type: 'cortex_write'` with path traversal guard and vault write.
- `src/container-runner.ts` mounts cortex vault read-only, injects `OPENAI_API_KEY` and `QDRANT_URL`.
- All 7 requirement IDs (SEARCH-01, SEARCH-02, SEARCH-03, MCP-01, MCP-02, MCP-03, MCP-05) fully satisfied.

---

_Verified: 2026-03-30T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
