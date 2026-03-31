---
wave: 2
plan_id: "18-03"
phase: 18
title: "E2E smoke test -- agent searches Cortex and gets a bootstrapped entry"
objective: "Verify the full pipeline works end-to-end: a container agent calls cortex_search for a NanoClaw concept and receives a relevant bootstrapped entry"
depends_on: ["18-01", "18-02"]
files_modified: []
requirements_addressed: ["POP-01", "POP-03"]
autonomous: false
must_haves:
  - "An agent in a container calls cortex_search and receives results from bootstrapped entries"
  - "The cortex_search results include entries with domain=nanoclaw and cortex_level in [L10, L20]"
  - "The CLAUDE.md auto-query instruction is visible to agents (loaded from global CLAUDE.md mount)"
---

<objective>
Run an end-to-end smoke test proving the full knowledge bootstrap pipeline works: a real container agent invocation queries Cortex for a NanoClaw concept and gets back relevant bootstrapped entries. This validates both POP-01 (entries exist and are searchable) and POP-03 (agents know to query Cortex).

Purpose: Final validation that the knowledge layer delivers real value -- agents can discover NanoClaw context before starting work.
Output: Confirmed smoke test result documented in summary.
</objective>

<context>
@.planning/phases/18-knowledge-bootstrap/18-02-SUMMARY.md (bootstrap results: entry count, embedding status)
@.planning/phases/18-knowledge-bootstrap/18-01-SUMMARY.md (CLAUDE.md update confirmation)
@groups/global/CLAUDE.md (now contains Cortex auto-query instruction)
@container/agent-runner/src/ipc-mcp-stdio.ts (cortex_search tool definition, lines 477-534)
</context>

<tasks>

<task id="T01" title="Verify Qdrant contains bootstrapped entries with correct metadata">
<read_first>
- src/cortex/qdrant-client.ts -- COLLECTION_NAME = 'cortex-entries', port 6333
- .planning/phases/18-knowledge-bootstrap/18-02-SUMMARY.md -- how many entries were embedded
</read_first>
<action>
Run these verification commands to confirm bootstrapped entries are in Qdrant with correct metadata:

1. Check total point count in the cortex-entries collection:
```bash
curl -s http://localhost:6333/collections/cortex-entries | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Total points: {d[\"result\"][\"points_count\"]}')"
```
Expect >= 50 points.

2. Verify NanoClaw-domain entries exist by scrolling with filter:
```bash
curl -s -X POST http://localhost:6333/collections/cortex-entries/points/scroll \
  -H 'Content-Type: application/json' \
  -d '{"filter":{"must":[{"key":"project","match":{"value":"nanoclaw"}}]},"limit":5,"with_payload":true}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); pts=d['result']['points']; print(f'NanoClaw entries found: {len(pts)}'); [print(f'  - {p[\"payload\"].get(\"file_path\",\"?\")[:80]} [{p[\"payload\"].get(\"cortex_level\",\"?\")}]') for p in pts]"
```
Expect >= 5 entries with project=nanoclaw, cortex_level in [L10, L20].

3. Verify a specific entry (config.md) has correct payload fields:
```bash
curl -s -X POST http://localhost:6333/collections/cortex-entries/points/scroll \
  -H 'Content-Type: application/json' \
  -d '{"filter":{"must":[{"key":"file_path","match":{"value":"'"$(realpath cortex/Areas/Projects/NanoClaw/src/config.md)"'"}}]},"limit":1,"with_payload":true}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); p=d['result']['points'][0]['payload']; print(f'Level: {p[\"cortex_level\"]}, Domain: {p[\"domain\"]}, Project: {p[\"project\"]}')"
```
Expect: Level: L10, Domain: nanoclaw, Project: nanoclaw.

If Qdrant is not running, this task cannot proceed -- document as a blocker. The bootstrap must have been run with embedding (not just dry-run) for these checks to pass.
</action>
<acceptance_criteria>
- Qdrant scroll with project=nanoclaw filter returns >= 5 points
- At least one entry has cortex_level=L10 and at least one has cortex_level=L20
- config.md entry payload has domain=nanoclaw and project=nanoclaw
</acceptance_criteria>
</task>

<task id="T02" title="E2E smoke test: send agent a task and verify it queries Cortex">
<read_first>
- groups/global/CLAUDE.md -- confirm "## Cortex Knowledge Base" section is present
- src/container-runner.ts -- understand how groups/global/CLAUDE.md is mounted (line 130-138: /workspace/global for non-main groups, readonly)
</read_first>
<action>
This is a manual verification checkpoint. Send a message to a registered NanoClaw agent (any group) with a task that should trigger Cortex lookup:

**Test message:**
> "Look up how the IPC message handler works in NanoClaw and tell me what message types are supported."

**Expected agent behavior (per the CLAUDE.md instruction):**
1. Agent reads the "Cortex Knowledge Base" section from its mounted CLAUDE.md
2. Agent extracts key concepts: "IPC", "message handler", "message types"
3. Agent calls `cortex_search("IPC message handler message types")`
4. Agent receives results including `ipc-contracts.md` (L20) and/or `ipc.md` (L20) entries
5. Agent calls `cortex_read` on the top result path
6. Agent responds with information about IPC message types informed by the Cortex entry

**What to verify:**
- Check the agent's container logs for evidence of `cortex_search` being called:
  ```bash
  # Find the most recent container log
  ls -t groups/*/logs/container-*.log | head -1
  # Search for cortex_search in the log
  grep -i "cortex_search\|cortex_read" $(ls -t groups/*/logs/container-*.log | head -1)
  ```
- The agent's response should reference IPC message types (message, cortex_write, agent_status, agent_blocker, agent_handoff, schedule_task, etc.) -- information that comes from the bootstrapped entries, not from the agent reading source code directly.

**Alternative verification (if no live agent available):**
Run a direct Qdrant search simulating what the agent would do:
```bash
# This simulates cortex_search("IPC message handler") from the container
curl -s -X POST http://localhost:6333/collections/cortex-entries/points/scroll \
  -H 'Content-Type: application/json' \
  -d '{"filter":{"must":[{"key":"project","match":{"value":"nanoclaw"}}]},"limit":10,"with_payload":true}' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
pts=d['result']['points']
ipc = [p for p in pts if 'ipc' in str(p['payload'].get('file_path','')).lower()]
print(f'IPC-related entries: {len(ipc)}')
for p in ipc:
    print(f'  - {p[\"payload\"][\"file_path\"][-60:]} [{p[\"payload\"][\"cortex_level\"]}]')
"
```
Expect at least 1 IPC-related entry (ipc.md or ipc-contracts.md).

**Document result** in the summary: whether the agent successfully used Cortex, or if the alternative verification passed.
</action>
<acceptance_criteria>
- Either: agent container log shows cortex_search was called and returned results
- Or: direct Qdrant query confirms IPC-related NanoClaw entries are searchable (at least 1 entry with "ipc" in file_path)
- The bootstrapped entries contain actionable information about IPC message types (not empty stubs)
- `grep "## Exports" cortex/Areas/Projects/NanoClaw/src/ipc-contracts.md || grep "## IPC" cortex/Areas/Projects/NanoClaw/src/ipc-contracts.md` returns at least one match
</acceptance_criteria>
</task>

</tasks>

<verification>
```bash
# Quick verification sequence
echo "=== Qdrant entry count ==="
curl -s http://localhost:6333/collections/cortex-entries | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])"

echo "=== NanoClaw entries ==="
curl -s -X POST http://localhost:6333/collections/cortex-entries/points/scroll \
  -H 'Content-Type: application/json' \
  -d '{"filter":{"must":[{"key":"project","match":{"value":"nanoclaw"}}]},"limit":3,"with_payload":true}' \
  | python3 -c "import sys,json; [print(p['payload'].get('file_path','?')[-50:]) for p in json.load(sys.stdin)['result']['points']]"

echo "=== CLAUDE.md has Cortex section ==="
grep "## Cortex Knowledge Base" groups/global/CLAUDE.md && echo "OK" || echo "MISSING"
```
</verification>

<success_criteria>
- Qdrant contains >= 50 bootstrapped NanoClaw entries searchable by project filter
- At least one IPC-related entry is searchable and contains meaningful content
- The CLAUDE.md auto-query instruction is in place
- Either a live agent demonstrated Cortex usage, or direct Qdrant verification confirms searchability
</success_criteria>

<output>
After completion, create `.planning/phases/18-knowledge-bootstrap/18-03-SUMMARY.md`
</output>
