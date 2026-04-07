---
cortex_level: L20
confidence: high
domain: nanoclaw
scope: >-
  Cortex MCP tool interface - 4 tools, input/output schemas, container vs host
  paths, IPC integration
project: nanoclaw
tags:
  - nanoclaw
  - cortex
  - mcp
  - tools
  - ipc
  - search
  - write
  - relate
  - read
created: 2026-03-31T00:00:00.000Z
source_hash: 2dced10b5bb82ff639c639d9709f8921b17811715e011b33697423f6b4c94aee
embedding_model: text-embedding-3-small
---

# Cortex — MCP Tool Interface

## Two Paths: Container MCP Server vs Host IPC

The same four Cortex tools (`cortex_search`, `cortex_read`, `cortex_write`, `cortex_relate`) are accessible via two paths:

**Path A: Container stdio MCP server** (`scripts/cortex-mcp-server.ts`)
The host-side Claude Code CLI registers this as an MCP server. It handles direct vault reads natively (no OpenAI needed), but semantic search and write operations require OPENAI_API_KEY in `.env` and Qdrant running at `http://localhost:6333`. Degrades gracefully when dependencies are absent — reads still work.

**Path B: IPC from inside containers** (`src/ipc.ts`)
Agents running inside containers write IPC JSON files to `/workspace/group/ipc/messages/`. The host IPC watcher processes `cortex_write` and `cortex_relate` messages directly (writes the vault file, updates the graph JSON). Semantic search from inside containers goes through the container's MCP server instance (which connects to the host's Qdrant via the network).

The key difference: MCP server runs on the host and is used by the operator's Claude Code session. IPC is used by container agents during task execution.

## Tool 1: cortex_search

Natural language semantic search over embedded vault entries. For queries that look like vault paths (ending in `.md` or starting with `Areas/`, `Calendar/`, `System/`), routes to a direct file read instead of vector search — no OpenAI call needed.

Input:
```json
{
  "query": "nanoclaw message flow IPC",
  "project": "nanoclaw",
  "cortex_level": "L20",
  "domain": "nanoclaw",
  "limit": 5
}
```

Output: array of entries sorted by semantic similarity score (0.0–1.0), each with path, score, frontmatter, and excerpt. Filters by `cortex_level`, `domain`, `project` are applied as Qdrant payload filters before search.

## Tool 2: cortex_read

Direct vault file read by vault-relative path. No OpenAI or Qdrant required.

Input: `{ "path": "Areas/Projects/NanoClaw/NanoClaw.md" }`

Output: full file content as string. Returns error if file not found.

## Tool 3: cortex_write

Write a new or updated Cortex entry. Validates frontmatter strictly (all 4 fields required), applies the confidence firewall for L20+ entries, then either:
- (Container MCP path) Queues an IPC write for the host to process
- (Host IPC path) Writes the file directly to the vault

Confidence firewall (L20+): before writing a new L20 entry in domain `X`, verifies that at least one medium+ confidence L10 entry exists in domain `X` in Qdrant. If none exist, the write is blocked with: `"Firewall: L10 entries for domain 'X' lack medium+ confidence"`. This prevents the knowledge pyramid from having L20 decisions without any L10 grounding. L10 entries are always allowed (no parent level to check).

Input:
```json
{
  "path": "Areas/Projects/Foo/bar.md",
  "content": "---\ncortex_level: L20\nconfidence: high\ndomain: nanoclaw\nscope: ...\n---\n# Content"
}
```

Output: `"Entry queued for write: Areas/Projects/Foo/bar.md"` on success, or validation/firewall error message.

## Tool 4: cortex_relate

Declare a typed edge between two vault entries. Edges are stored in `cortex-graph.json`.

Edge types: `BUILT_FROM` (implementation from spec), `REFERENCES` (cites/depends), `BLOCKS` (prerequisite), `CROSS_LINK` (related across domains), `SUPERSEDES` (newer replaces older).

Input:
```json
{
  "source": "Areas/Projects/Foo/bar.md",
  "target": "Areas/Projects/Foo/hub.md",
  "edge_type": "REFERENCES"
}
```

Self-edges are rejected. Duplicate edges (same source+target+type) are silently ignored (idempotent). Output confirms edge addition or notes it already existed.

## IPC Tool Variants (mcp__nanoclaw__ prefix)

The `mcp__nanoclaw__` tools (via `src/ipc-mcp-stdio.js`) provide the same interface but route through the NanoClaw host IPC rather than the standalone MCP server. These are used by container agents. The difference is primarily in transport: the nanoclaw IPC tools write to the group's IPC directory; the nanoclaw-cortex tools communicate via stdio MCP protocol directly to the cortex-mcp-server process.
