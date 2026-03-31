---
phase: quick
plan: 260331-irl
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/cortex-mcp-server.ts
  - ~/.claude/settings.json
autonomous: true
requirements: []
must_haves:
  truths:
    - "cortex_search, cortex_read, cortex_write, cortex_relate tools appear in Claude Code globally"
    - "Server starts without crashing when OPENAI_API_KEY or Qdrant is unavailable"
    - "Vault path queries (ending in .md) work without OpenAI key"
  artifacts:
    - path: "scripts/cortex-mcp-server.ts"
      provides: "Stdio MCP server exposing 4 cortex tools"
    - path: "~/.claude/settings.json"
      provides: "mcpServers entry pointing to the script"
      contains: "cortex-mcp-server"
  key_links:
    - from: "scripts/cortex-mcp-server.ts"
      to: "src/cortex/cortex-mcp-tools.ts"
      via: "direct import of build*Handler factories"
    - from: "~/.claude/settings.json mcpServers.nanoclaw-cortex"
      to: "scripts/cortex-mcp-server.ts"
      via: "npx tsx"
---

<objective>
Create a standalone stdio MCP server that exposes cortex_search, cortex_read, cortex_write, and cortex_relate to the global Claude Code CLI. Register it in ~/.claude/settings.json so cortex tools appear in every Claude Code conversation.

Purpose: Agents working in any repo gain direct access to the NanoClaw Cortex knowledge base — architectural decisions, lore, project context — without needing to be inside a NanoClaw container.

Output: scripts/cortex-mcp-server.ts (runnable via npx tsx) + mcpServers entry in ~/.claude/settings.json.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/cortex/cortex-mcp-tools.ts
@src/cortex/cortex-graph.ts
@src/cortex/qdrant-client.ts
</context>

<interfaces>
<!-- Key exports from src/cortex/cortex-mcp-tools.ts that the server imports directly -->

```typescript
// Factory functions — each returns an async handler
export function buildSearchHandler({ qdrant, openai, vaultRoot, graphIndex }): async (args) => McpResult
export function buildReadHandler({ vaultRoot }): async (args) => McpResult
export function buildWriteHandler({ qdrant, writeIpc, vaultRoot }): async (args) => McpResult
export function buildRelateHandler({ writeIpc }): async (args) => McpResult
export function isVaultPath(query: string): boolean
```

```typescript
// From src/cortex/cortex-graph.ts
export type GraphIndex = Map<string, NeighborEntry[]>
export function buildIndex(graph: CortexGraph): GraphIndex
export function loadGraph(graphPath: string): CortexGraph   // check if this exists, else inline
export function getNeighbors(index: GraphIndex, path: string): NeighborEntry[]
```

```typescript
// From src/cortex/qdrant-client.ts
export function createQdrantClient(): QdrantClient  // localhost:6333
export const COLLECTION_NAME = 'cortex-entries'
```

<!-- Paths on host (from src/index.ts and src/config.ts) -->
<!-- vaultRoot = path.join(process.cwd(), 'cortex')  → /home/andrii-panasenko/nanoclaw/cortex -->
<!-- IPC dir = path.resolve(PROJECT_ROOT, 'data') + /ipc — check src/ipc.ts for exact subpath -->
<!-- cortex-graph.json = path.join(vaultRoot, 'cortex-graph.json') -->
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Create scripts/cortex-mcp-server.ts</name>
  <files>scripts/cortex-mcp-server.ts</files>
  <action>
Create a stdio MCP server that imports build*Handler factories from src/cortex/cortex-mcp-tools.ts and registers cortex_search, cortex_read, cortex_write, cortex_relate.

Key implementation details:

1. **Paths (hardcoded absolute, not relative to cwd since Claude Code may run from any directory):**
   - VAULT_ROOT = '/home/andrii-panasenko/nanoclaw/cortex'
   - GRAPH_PATH = '/home/andrii-panasenko/nanoclaw/cortex/cortex-graph.json'
   - IPC_DIR = '/home/andrii-panasenko/nanoclaw/data/ipc' (verify exact path by checking src/ipc.ts writeIpcFile usage)

2. **Graceful degradation on startup:**
   - Try `createQdrantClient()` — catch any error, set `qdrant = null`
   - Try `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` — if key absent, set `openai = null`
   - Load graph via `loadGraph(GRAPH_PATH)` + `buildIndex()`, catching errors (graph = empty Map)
   - Log warnings to stderr (not stdout — stdout is the MCP stdio transport): `process.stderr.write('...\n')`

3. **Tool registration — use the factories directly:**
   ```typescript
   import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
   import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
   import { z } from 'zod';
   import OpenAI from 'openai';
   import { QdrantClient } from '@qdrant/js-client-rest';
   import { buildSearchHandler, buildReadHandler, buildWriteHandler, buildRelateHandler } from '../src/cortex/cortex-mcp-tools.js';
   import { createQdrantClient } from '../src/cortex/qdrant-client.js';
   import { buildIndex, loadGraph } from '../src/cortex/cortex-graph.js';
   import fs from 'node:fs';
   import path from 'node:path';
   ```

4. **writeIpc function** for write/relate handlers:
   ```typescript
   function writeIpc(data: object): void {
     const messagesDir = path.join(IPC_DIR, 'messages');
     fs.mkdirSync(messagesDir, { recursive: true });
     const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
     const filepath = path.join(messagesDir, filename);
     const tmp = `${filepath}.tmp`;
     fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
     fs.renameSync(tmp, filepath);
   }
   ```

5. **Tool schema for cortex_search** (matches what buildSearchHandler expects):
   ```typescript
   server.tool('cortex_search', 'Search the Cortex knowledge base...', {
     query: z.string(),
     project: z.string().optional(),
     cortex_level: z.enum(['L10','L20','L30','L40','L50']).optional(),
     domain: z.string().optional(),
     limit: z.number().optional(),
   }, searchHandler);
   ```

6. **Handle missing qdrant/openai in handlers**: If qdrant or openai is null, return an McpResult error like `{ content: [{ type: 'text', text: 'cortex_search unavailable: OPENAI_API_KEY not set or Qdrant unreachable. Vault path queries still work.' }], isError: true }` — but only for semantic search path. Vault path queries (isVaultPath) use only the filesystem so they should still work even without openai. Handle this by wrapping the handler call or by passing stub objects that throw meaningful errors.

   Simplest approach: pass the real handlers but catch errors at the tool wrapper level with a useful message.

7. **cortex_write and cortex_relate** pass `writeIpc` to the factories. `vaultRoot` is passed but only used for the path traversal guard.

8. **Start server:**
   ```typescript
   const transport = new StdioServerTransport();
   await server.connect(transport);
   ```

9. **File header:** Add `#!/usr/bin/env npx tsx` shebang and `// @ts-check` comment. The file lives in scripts/ so imports use `../src/cortex/...`.

Do NOT import from src/logger.ts, src/config.ts, src/ipc.ts, or any host-only module that pulls in WhatsApp/Telegram dependencies — the server must start cleanly with only cortex dependencies.
  </action>
  <verify>
    <automated>cd /home/andrii-panasenko/nanoclaw && npx tsx scripts/cortex-mcp-server.ts --version 2>&1 | head -5 || npx tsx --tsconfig tsconfig.json scripts/cortex-mcp-server.ts 2>&1 | head -10</automated>
  </verify>
  <done>scripts/cortex-mcp-server.ts exists, `npx tsx scripts/cortex-mcp-server.ts` starts without crashing (may block waiting for stdio — kill after 2s), TypeScript compiles without errors</done>
</task>

<task type="auto">
  <name>Task 2: Register in ~/.claude/settings.json</name>
  <files>~/.claude/settings.json</files>
  <action>
Read the current ~/.claude/settings.json (already confirmed it exists). Add a `mcpServers` top-level key with the cortex server entry. Preserve all existing keys exactly.

Add this entry:
```json
"mcpServers": {
  "nanoclaw-cortex": {
    "type": "stdio",
    "command": "npx",
    "args": ["tsx", "/home/andrii-panasenko/nanoclaw/scripts/cortex-mcp-server.ts"],
    "env": {
      "OPENAI_API_KEY": "${OPENAI_API_KEY}"
    }
  }
}
```

Use absolute path to the script (not relative) so it works from any working directory.

The `"env"` block passes OPENAI_API_KEY from the shell environment — Claude Code will substitute it if set, or the server will start without it and degrade gracefully for semantic search.

Write the updated JSON back with 2-space indentation.
  </action>
  <verify>
    <automated>node -e "const s=require('/home/andrii-panasenko/.claude/settings.json'); console.log(s.mcpServers?.['nanoclaw-cortex']?.command)"</automated>
  </verify>
  <done>~/.claude/settings.json contains mcpServers.nanoclaw-cortex with command "npx" and the correct script path. Existing settings (permissions, hooks, statusLine, etc.) are preserved.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `cd /home/andrii-panasenko/nanoclaw && npx tsc --noEmit 2>&1 | grep -i cortex-mcp-server` — no TypeScript errors in the new file
2. `node -e "const s=require('/home/andrii-panasenko/.claude/settings.json'); console.log(JSON.stringify(s.mcpServers,null,2))"` — shows nanoclaw-cortex entry
3. Start a fresh Claude Code session — cortex_search, cortex_read, cortex_write, cortex_relate appear in the tool list
</verification>

<success_criteria>
- scripts/cortex-mcp-server.ts compiles and starts without errors
- cortex tools are available in every global Claude Code session
- Server starts gracefully even when OPENAI_API_KEY is not set (vault path reads still work)
- ~/.claude/settings.json retains all existing config unchanged except the new mcpServers block
</success_criteria>

<output>
After completion, create `.planning/quick/260331-irl-hook-cortex-into-global-claude-code-mcp/260331-irl-SUMMARY.md`
</output>
