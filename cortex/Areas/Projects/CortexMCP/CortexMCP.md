---
cortex_level: L10
confidence: high
domain: cortex-mcp
scope: standalone Cortex MCP server extracted from NanoClaw
project: cortex-mcp
status: active
created: '2026-05-09'
tags:
  - cortex-mcp
  - mcp
  - infrastructure
  - bootstrap
source_hash: ef83c8701fc92611fc710bdfd4cf4b0f4d81abf2932e675945c165e3d84dd147
embedding_model: text-embedding-3-small
---
# Cortex MCP (standalone)

> Personal long-term memory exposed as an MCP server. Extracted from the NanoClaw `agent-a2174466` worktree on 2026-05-09 into a standalone project so any Claude Code session — not just NanoClaw containers — can read and write the Cortex vault.

## Where it lives

- **Repo:** `/home/andrii-panasenko/cortex-mcp/`
- **Built artifact:** `dist/server.js` (TypeScript ESM, Node >= 20)
- **systemd user unit:** `~/.config/systemd/user/cortex-mcp.service` (`enabled`, `WantedBy=default.target`, lingering on, `Wants=qdrant.service`)
- **Override env:** `~/.config/cortex-mcp/.env` (optional; falls through to `~/nanoclaw/.env` for `OPENAI_API_KEY`)

## Wire format

- **Transport:** Streamable HTTP via `@modelcontextprotocol/sdk` 1.29
- **Bind:** `127.0.0.1:8765` (loopback only — never expose)
- **Endpoints:** `POST /mcp` (JSON-RPC + SSE responses), `GET /health` (liveness)
- **Server name/version:** `cortex-mcp` / `0.1.0`

## Tools exposed

- `cortex_search { query, project?, cortex_level?, domain?, limit? }` — hybrid: paths ending in `.md` or under `Areas/`/`Calendar/`/`System/` route to direct file read; everything else is OpenAI `text-embedding-3-small` → Qdrant vector search.
- `cortex_read { path }` — reads a vault-relative path; rejects path traversal.
- `cortex_write { path, content }` — validates Cortex frontmatter via Zod, enforces the L20+ confidence firewall (parent level must have medium-or-high confidence entry in same domain), writes the file, fires off `embedEntry` immediately so the new entry is searchable within seconds.
- `cortex_relate` was intentionally **not** ported in v1; it was IPC-coupled to NanoClaw. Re-add as a direct `addEdge`/`saveGraph` mutation against `cortex-graph.json` if needed.

## Backing services (reused, not duplicated)

- **Qdrant:** existing `qdrant.service` user unit, `localhost:6333`, collection `cortex-entries`. Same data NanoClaw was indexing.
- **OpenAI:** `OPENAI_API_KEY` from `~/nanoclaw/.env` via the `readEnvFile` fallback chain (`process.env` → `./.env` → `~/nanoclaw/.env`, or override via `CORTEX_ENV_FILES`).
- **Vault:** `/home/andrii-panasenko/nanoclaw/cortex` (`CORTEX_VAULT_ROOT` overrides).

## Watcher

- `fs.watch` recursive on the vault, 10-minute debounce (`DEBOUNCE_MS = 600000`). Skips re-embed when `source_hash` matches body SHA-256. Self-trigger guard via `inFlightFiles`.

## Source extraction notes

Verbatim copy from `nanoclaw/.claude/worktrees/agent-a2174466/src/cortex/`: `cortex-mcp-tools.ts`, `cortex-graph.ts`, `embedder.ts`, `parser.ts`, `qdrant-client.ts`, `schema.ts`, `types.ts`, `watcher.ts`. Two outside-cortex deps were inlined as siblings: `src/env.ts` (configurable `readEnvFile` fallback chain) and `src/logger.ts` (stderr-based shim). Three small edits: `qdrant-client.ts` host/port/collection now read `process.env`; `cortex-mcp-tools.ts` swapped two `'cortex-entries'` literals for `COLLECTION_NAME`.

## Known issues / future work

- Existing Qdrant payloads carry NanoClaw container paths (`/workspace/host/nanoclaw/cortex/…`). `cortex_search` returns those; `cortex_read` expects vault-relative. Edits will rewrite payloads to host paths over time. A one-shot `force: true` re-embed pass over the vault would fix all stale rows.
- `cortex_write` is honest about being async-embed: file is on disk before the response, vector lands shortly after. If a downstream search races the embed, retry once.
- No tests ported in v1. Tests live in the NanoClaw worktree alongside the originals.

## Wiring it into a project

```json
{ "mcpServers": { "cortex": { "type": "http", "url": "http://127.0.0.1:8765/mcp" } } }
```

Add to that project's `.mcp.json`, restart Claude Code, done.
