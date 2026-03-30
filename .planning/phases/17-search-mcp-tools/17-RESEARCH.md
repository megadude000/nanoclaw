# Phase 17: Search & MCP Tools - Research

**Researched:** 2026-03-30
**Domain:** Cortex MCP tools — `cortex_search`, `cortex_read`, `cortex_write` — added to the existing container MCP server
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — user designated all gray areas as coding decisions for Claude.

### Claude's Discretion
All implementation details are at Claude's discretion:

**Tool architecture:**
- How cortex_search/read work from containers (direct Qdrant + filesystem calls vs IPC)
- How cortex_write handles the host-write + embed trigger pattern (IPC like send_message)
- Where query embedding happens (container-side OpenAI call, per Phase 16 D-06)
- Tool count management (existing server already has 11 tools, adding 3 Cortex tools)

**Search behavior:**
- Result format and metadata returned to agents
- Number of results per search query
- Hybrid routing logic: how to decide exact path lookup vs Qdrant semantic search
- Search result ranking and relevance scoring

**Confidence firewall:**
- Strictness of L(N) gates L(N-1) enforcement
- Behavior when agent tries to write high-level entry with gaps below (hard block vs warning)
- Completeness threshold for "L(N-1) has medium+ confidence"

### Deferred Ideas (OUT OF SCOPE)
- cortex_relate tool (declaring graph edges) — Phase 19
- Nightshift reconciliation integration — Phase 21
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEARCH-01 | Hybrid search routing — exact (vault path/ID) vs semantic (Qdrant) based on query shape | Hybrid routing logic documented in §Architecture Patterns. Path detection heuristic (starts with `/`, `Areas/`, `Calendar/`, etc.) routes to cortex_read fast path. |
| SEARCH-02 | Confidence firewall enforces L(N) population only when L(N-1) has medium+ confidence | Firewall query pattern documented. Uses Qdrant scroll with payload filter on cortex_level + confidence fields. Implemented as a pre-write check in cortex_write. |
| SEARCH-03 | Search results filterable by project, cortex_level, and domain | Qdrant payload indexes on `project`, `cortex_level`, `domain`, `status` are ALREADY created (verified against live collection). Filter maps directly to Qdrant `must` conditions. |
| MCP-01 | cortex_search tool available in container agents | Tool added to ipc-mcp-stdio.ts. Container calls OpenAI for query embed (D-06), then queries Qdrant at host.docker.internal:6333. |
| MCP-02 | cortex_read tool available in container agents | Tool reads from read-only vault mount at `/workspace/cortex/`. No Qdrant needed. Returns full markdown + frontmatter. |
| MCP-03 | cortex_write tool available in container agents | Tool writes IPC file. Host ipc.ts gains `cortex_write` case that writes vault file and triggers embedder. |
| MCP-05 | All tools added to existing ipc-mcp-stdio.ts (no new MCP server process) | All 3 tools added to the existing McpServer instance. File is 424 lines today; adding ~200 lines is acceptable. |
</phase_requirements>

---

## Summary

Phase 17 adds three MCP tools (`cortex_search`, `cortex_read`, `cortex_write`) to the existing container MCP server at `container/agent-runner/src/ipc-mcp-stdio.ts`. This is primarily an integration task connecting three already-built subsystems: the Qdrant collection (Phase 15, confirmed running with `cortex-entries` collection at 1536-dim cosine), the embedder (Phase 16, `embedEntry()` in `src/cortex/embedder.ts`), and the IPC watcher (in `src/ipc.ts`).

The three tools follow distinct data paths. `cortex_search` embeds the query inside the container via OpenAI, then queries Qdrant at `host.docker.internal:6333` — fully container-side, no IPC. `cortex_read` reads directly from the read-only vault mount at `/workspace/cortex/` — also fully container-side. `cortex_write` follows the IPC pattern: write a file to `/workspace/ipc/messages/`, host picks it up, writes the vault file, and the existing watcher triggers re-embedding. The host side gains a new `cortex_write` case in `src/ipc.ts` and needs the cortex vault path resolved.

Two infrastructure changes support the tools: (1) `container-runner.ts` gains a cortex vault mount so containers can read vault files, and (2) `OPENAI_API_KEY` must be injected into containers for query embedding. The `host.docker.internal` gateway is already working on Linux via `--add-host=host.docker.internal:host-gateway` in `hostGatewayArgs()`. The Qdrant payload indexes on `project`, `cortex_level`, `domain`, and `status` are already created on the live collection — no schema changes needed.

**Primary recommendation:** Add 3 tools to `ipc-mcp-stdio.ts`, add 1 IPC case to `src/ipc.ts`, add 1 vault mount to `src/container-runner.ts`, and inject `OPENAI_API_KEY` into containers.

---

## Standard Stack

### Core (all already in project or confirmed needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@qdrant/js-client-rest` | ^1.17.0 | Vector search from containers | Already installed in host. Needs to be added to container agent-runner too. |
| `openai` | ^6.33.0 | Query embedding in containers | Per D-06, containers call OpenAI directly. Needs to be added to container agent-runner. |
| `@modelcontextprotocol/sdk` | ^1.12.1 | MCP server (already in container) | Existing McpServer instance in ipc-mcp-stdio.ts. No version bump needed for this phase. |
| `zod` | ^4.0.0 | Parameter validation | Already in container agent-runner. Used by all existing tools. |
| `gray-matter` | ^4.0.3 | Read vault file frontmatter in containers | Already in host. Needs to be added to container agent-runner for cortex_read. |
| `fs` (node built-in) | — | Read vault files from mount | cortex_read uses fs.readFileSync on `/workspace/cortex/` |

### Container agent-runner — new dependencies

```bash
cd container/agent-runner
npm install openai @qdrant/js-client-rest gray-matter
```

### Version verification (confirmed from package.json and npm registry)

| Package | Current host version | Container needs |
|---------|---------------------|-----------------|
| `openai` | ^6.33.0 (host) | ^6.33.0 |
| `@qdrant/js-client-rest` | ^1.17.0 (host) | ^1.17.0 |
| `gray-matter` | ^4.0.3 (host) | ^4.0.3 |

---

## Architecture Patterns

### Recommended Project Structure

```
container/agent-runner/src/
├── ipc-mcp-stdio.ts        # ADD: cortex_search, cortex_read, cortex_write tools (3 additions)
└── index.ts                # NO CHANGE (tools self-register in ipc-mcp-stdio.ts)

src/
├── ipc.ts                  # ADD: case 'cortex_write' in processTaskIpc (messages dir, not tasks)
├── container-runner.ts     # ADD: cortex vault readonly mount, OPENAI_API_KEY env injection
└── cortex/
    ├── embedder.ts         # NO CHANGE (embedEntry() already reusable)
    ├── qdrant-client.ts    # NO CHANGE (createQdrantClient() works for both host and container)
    └── schema.ts           # NO CHANGE (CortexFieldsStrict used for cortex_write validation)
```

### Pattern 1: cortex_search — Container-Side Qdrant Query

**What:** Container embeds query via OpenAI, queries Qdrant at `host.docker.internal:6333`, returns ranked results.
**When to use:** Natural language queries and filtered searches.

```typescript
// Source: ipc-mcp-stdio.ts pattern + @qdrant/js-client-rest API
server.tool(
  'cortex_search',
  'Search Cortex knowledge base semantically. Returns ranked entries matching the query.',
  {
    query: z.string().describe('Natural language search query'),
    project: z.string().optional().describe('Filter by project name (e.g. "nanoclaw")'),
    cortex_level: z.enum(['L10','L20','L30','L40','L50']).optional().describe('Filter by knowledge level'),
    domain: z.string().optional().describe('Filter by domain'),
    limit: z.number().default(5).describe('Number of results to return (1-20)'),
  },
  async (args) => {
    const qdrantUrl = process.env.QDRANT_URL || 'http://host.docker.internal:6333';
    const openaiKey = process.env.OPENAI_API_KEY!;

    // 1. Embed query
    const openai = new OpenAI({ apiKey: openaiKey });
    const embedResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: args.query,
    });
    const queryVector = embedResponse.data[0].embedding;

    // 2. Build Qdrant filter
    const mustConditions: object[] = [];
    if (args.project) mustConditions.push({ key: 'project', match: { value: args.project } });
    if (args.cortex_level) mustConditions.push({ key: 'cortex_level', match: { value: args.cortex_level } });
    if (args.domain) mustConditions.push({ key: 'domain', match: { value: args.domain } });

    // 3. Search Qdrant
    const qdrant = new QdrantClient({ url: qdrantUrl });
    const results = await qdrant.search('cortex-entries', {
      vector: queryVector,
      limit: Math.min(args.limit ?? 5, 20),
      with_payload: true,
      filter: mustConditions.length > 0 ? { must: mustConditions } : undefined,
    });

    // 4. Format results
    const formatted = results.map(r => ({
      path: r.payload?.file_path,
      score: r.score,
      level: r.payload?.cortex_level,
      domain: r.payload?.domain,
      project: r.payload?.project,
    }));

    return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
  }
);
```

### Pattern 2: cortex_read — Direct Vault Filesystem Read

**What:** Read full markdown content of a vault entry from the read-only mount.
**When to use:** After cortex_search returns a path, or when the agent knows the exact path.

```typescript
// Source: established fs.readFileSync pattern in ipc-mcp-stdio.ts + vault mount
server.tool(
  'cortex_read',
  'Read a Cortex entry by its vault path. Returns full content including frontmatter.',
  {
    path: z.string().describe('Relative vault path, e.g. "Areas/Projects/YourWave/YourWave.md"'),
  },
  async (args) => {
    const vaultRoot = '/workspace/cortex';
    // Prevent path traversal: resolve and verify path stays within vaultRoot
    const resolved = path.resolve(vaultRoot, args.path);
    if (!resolved.startsWith(vaultRoot)) {
      return { content: [{ type: 'text', text: 'Error: path traversal not allowed' }], isError: true };
    }
    if (!fs.existsSync(resolved)) {
      return { content: [{ type: 'text', text: `Not found: ${args.path}` }], isError: true };
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    return { content: [{ type: 'text', text: content }] };
  }
);
```

### Pattern 3: cortex_write — IPC Write-Through Pattern

**What:** Container writes IPC file, host processes it, writes vault file, fs.watch triggers re-embed.
**When to use:** Creating or updating Cortex entries from container agents.

```typescript
// Source: established writeIpcFile() pattern in ipc-mcp-stdio.ts
server.tool(
  'cortex_write',
  'Create or update a Cortex entry. Content must include YAML frontmatter with cortex_level, confidence, domain, scope.',
  {
    path: z.string().describe('Relative vault path, e.g. "Areas/Projects/NanoClaw/api-design.md"'),
    content: z.string().describe('Full markdown content including YAML frontmatter block'),
  },
  async (args) => {
    // Validate frontmatter before sending to host
    const parsed = matter(args.content);
    const validation = validateFrontmatterStrict(parsed.data);
    if (!validation.valid) {
      return { content: [{ type: 'text', text: `Validation failed: ${validation.errors.join(', ')}` }], isError: true };
    }

    // Confidence firewall check (SEARCH-02)
    const levelNum = parseInt(validation.data.cortex_level.replace('L', ''));
    if (levelNum >= 20) {
      const firewallBlocked = await checkConfidenceFirewall(validation.data.cortex_level, validation.data.domain);
      if (firewallBlocked) {
        return { content: [{ type: 'text', text: `Firewall: L${levelNum-10} entries for domain "${validation.data.domain}" lack medium+ confidence. Build foundational knowledge first.` }], isError: true };
      }
    }

    writeIpcFile(MESSAGES_DIR, {
      type: 'cortex_write',
      path: args.path,
      content: args.content,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    return { content: [{ type: 'text', text: `Entry queued for write: ${args.path}` }] };
  }
);
```

### Pattern 4: Hybrid Routing Logic

**What:** cortex_search detects whether the query is an exact vault path (route to cortex_read) or natural language (route to Qdrant).
**When to use:** Every cortex_search call.

```typescript
// Path detection heuristic — HIGH confidence
function isVaultPath(query: string): boolean {
  // Exact path patterns from vault structure
  return (
    query.endsWith('.md') ||
    query.startsWith('Areas/') ||
    query.startsWith('Calendar/') ||
    query.startsWith('System/')
  );
}
// If isVaultPath(query) → read file directly from /workspace/cortex/
// Else → embed query + search Qdrant
```

### Pattern 5: Confidence Firewall (SEARCH-02)

**What:** Before writing L20+, verify L(N-1) entries in the same domain have at least one medium+ confidence entry.
**Implementation:** Qdrant scroll with payload filter.

```typescript
async function checkConfidenceFirewall(
  targetLevel: string, // e.g. 'L20'
  domain: string,
  qdrant: QdrantClient,
): Promise<boolean> {
  const levelNum = parseInt(targetLevel.replace('L', ''));
  const parentLevel = `L${levelNum - 10}`;

  const { points } = await qdrant.scroll('cortex-entries', {
    filter: {
      must: [
        { key: 'cortex_level', match: { value: parentLevel } },
        { key: 'domain', match: { value: domain } },
        { key: 'confidence', match: { any: ['medium', 'high'] } },
      ],
    },
    limit: 1,
    with_payload: false,
  });

  // If no medium+ confidence L(N-1) entries exist, block the write
  return points.length === 0; // true = blocked
}
```

### Pattern 6: Host-Side IPC Handler for cortex_write

**What:** New case in `processTaskIpc()` in `src/ipc.ts` for `type: 'cortex_write'`.
**Note:** cortex_write IPC goes to the MESSAGES_DIR (not TASKS_DIR) — it's a message-type operation, not a task.

```typescript
// In src/ipc.ts processIpcFiles() — messages handling block
// Add after the existing agent_handoff handler:
} else if (data.type === 'cortex_write' && data.path && data.content) {
  // Security: only allow writes from registered groups
  const vaultRoot = path.join(process.cwd(), 'cortex');
  const targetPath = path.resolve(vaultRoot, data.path as string);
  if (!targetPath.startsWith(vaultRoot)) {
    logger.warn({ path: data.path, sourceGroup }, 'cortex_write path traversal blocked');
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, data.content as string, 'utf-8');
    logger.info({ path: data.path, sourceGroup }, 'cortex_write: vault file written');
    // fs.watch in watcher.ts picks up the change and triggers re-embedding
  }
}
```

### Pattern 7: Vault Mount in container-runner.ts

**What:** Add cortex vault as read-only bind mount for all containers.
**Where:** In `buildVolumeMounts()` after the existing mounts.

```typescript
// In buildVolumeMounts() — applies to ALL groups (main and non-main)
const cortexDir = path.join(projectRoot, 'cortex');
if (fs.existsSync(cortexDir)) {
  mounts.push({
    hostPath: cortexDir,
    containerPath: '/workspace/cortex',
    readonly: true,
  });
}
```

### Pattern 8: OPENAI_API_KEY Injection into Containers

**What:** Inject `OPENAI_API_KEY` in `buildContainerArgs()` alongside existing third-party keys.
**Where:** In the `thirdPartyKeys` block in `buildContainerArgs()`.

```typescript
// Add OPENAI_API_KEY to the existing readEnvFile() call in buildContainerArgs():
const thirdPartyKeys = readEnvFile([
  'NOTION_API_KEY',
  'OPENAPI_MCP_HEADERS',
  'FIGMA_API_KEY',
  'GITHUB_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'OPENAI_API_KEY',  // ADD: for cortex_search query embedding (Phase 17 D-06)
]);
```

### Pattern 9: QDRANT_URL Env Var for Containers

**What:** Pass `QDRANT_URL` pointing to `host.docker.internal:6333` into containers.
**Where:** In `buildContainerArgs()` after the credential proxy section.

```typescript
// Add unconditionally — Qdrant is always at host.docker.internal:6333 for containers
args.push('-e', `QDRANT_URL=http://${CONTAINER_HOST_GATEWAY}:6333`);
```

### Anti-Patterns to Avoid

- **IPC for cortex_read:** Reading vault files via IPC adds 1-2 second latency for no benefit. The vault is already mounted read-only — use it directly.
- **IPC for cortex_search:** Routing searches through IPC would serialize all searches through the host loop. Container → Qdrant is direct and sub-100ms.
- **Path traversal in cortex_read:** Must resolve the path and verify it stays within `/workspace/cortex/`. The `path.resolve()` + `startsWith()` guard is the established pattern.
- **Blocking cortex_write on embedding:** embedEntry() takes 200-500ms. Return immediately after writing IPC file. The watcher picks it up asynchronously.
- **Strict frontmatter validation rejecting partial writes:** cortex_write should use strict mode (all 4 Cortex fields required), but NOT reject if existing vault fields are missing. Only reject if the 4 new fields (`cortex_level`, `confidence`, `domain`, `scope`) are absent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Qdrant filter syntax | Custom filter builder | Direct Qdrant `must` array | Already documented in @qdrant/js-client-rest types |
| OpenAI embedding call | Raw fetch | `openai` SDK `embeddings.create()` | Already used in host-side embedder — same pattern |
| Vault frontmatter parsing | Custom YAML parser | `gray-matter` | Already used in parser.ts |
| Frontmatter validation | Custom validator | `validateFrontmatter()` from `src/cortex/schema.ts` — but this is host-only. Container needs inline Zod validation | schema.ts is not importable in container; inline Zod schema in ipc-mcp-stdio.ts |
| IPC file write | Custom file write | `writeIpcFile()` — already in ipc-mcp-stdio.ts | Handles atomic temp-rename, dir creation |
| Path traversal prevention | Complex checks | `path.resolve()` + `startsWith()` | Standard Node.js pattern, already used in project |

**Key insight:** The container cannot import from `src/cortex/` (host-side code). Any validation that needs to run in the container (e.g., schema validation in cortex_write) must be inlined into `ipc-mcp-stdio.ts` using the same Zod patterns.

---

## Common Pitfalls

### Pitfall 1: Container Cannot Import Host-Side Modules
**What goes wrong:** Importing `src/cortex/schema.ts` or `src/cortex/parser.ts` in `ipc-mcp-stdio.ts` fails at compile time — the container TypeScript build doesn't include `src/`.
**Why it happens:** The container agent-runner is a separate Node.js package with its own `tsconfig.json` and build. Host code is not in scope.
**How to avoid:** Inline the Zod validation schema needed for `cortex_write` directly in `ipc-mcp-stdio.ts`. The schema is small (4 fields: `cortex_level`, `confidence`, `domain`, `scope`) — copy the Zod schema inline, do not import from host.
**Warning signs:** TypeScript errors on `import from '../../../src/cortex/...'` in the container source.

### Pitfall 2: host.docker.internal:6333 Not Reachable Without --add-host
**What goes wrong:** Qdrant search returns ECONNREFUSED from inside the container.
**Why it happens:** On Linux, `host.docker.internal` is not automatically available — requires `--add-host=host.docker.internal:host-gateway`.
**How to avoid:** This is already handled by `hostGatewayArgs()` in `container-runtime.ts`. Verify the `QDRANT_URL` env var is passed and uses `host.docker.internal` (not `localhost`).
**Warning signs:** `ECONNREFUSED` or `EHOSTUNREACH` when container tries to reach `:6333`. Works fine from host but fails in container.

### Pitfall 3: cortex_write Path Traversal Attack Vector
**What goes wrong:** An agent sends `path: "../../src/config.ts"` to overwrite host application code.
**Why it happens:** Path concatenation without sanitization.
**How to avoid:** In the host-side IPC handler, use `path.resolve(vaultRoot, data.path)` and verify `resolved.startsWith(vaultRoot + path.sep)`. Reject silently with a warning log.
**Warning signs:** Paths with `..` segments in cortex_write IPC messages.

### Pitfall 4: cortex_write IPC Goes to Messages, Not Tasks
**What goes wrong:** Writing cortex_write to `TASKS_DIR` means the host processes it in `processTaskIpc()`, but the write of the file happens there — structurally fine but semantically wrong. More importantly: the IPC file from the container lands in `messagesDir` (per ipc-mcp-stdio.ts `MESSAGES_DIR = path.join(IPC_DIR, 'messages')`) and is processed in the messages loop, not the tasks loop.
**Why it happens:** The two loops are separate in `processIpcFiles()`. cortex_write is not a scheduled task.
**How to avoid:** Handle `cortex_write` in the messages processing loop (where `data.type === 'message'` etc.), not in `processTaskIpc()`.

### Pitfall 5: gray-matter Not Available in Container
**What goes wrong:** `cortex_read` calls `matter(content)` but `gray-matter` is not in container agent-runner's dependencies.
**Why it happens:** `gray-matter` is in the host package.json but not in `container/agent-runner/package.json`.
**How to avoid:** Add `gray-matter` to `container/agent-runner/package.json` and rebuild the container image. If cortex_read doesn't need to parse frontmatter (just returns raw content), gray-matter is optional — raw string return is sufficient for the agent's use case.

### Pitfall 6: Confidence Firewall Blocks L10 Writes (Bootstrap Blocker)
**What goes wrong:** The firewall logic blocks L10 writes because there's no L00 level. Bootstrap (Phase 18) needs to write L10 entries.
**Why it happens:** Firewall logic checks `parentLevel = L(N-10)`. L10 has parent L00, which doesn't exist in the schema.
**How to avoid:** Only apply the confidence firewall for L20 and above. L10 is always allowed (base level — no parent to check).

### Pitfall 7: Score Threshold Too High or Too Low
**What goes wrong:** cortex_search returns empty results (threshold too high) or irrelevant noise (no threshold).
**Why it happens:** Cosine similarity scores depend on the embedding model and collection content.
**How to avoid:** Do NOT set `score_threshold` by default. Return raw scores in the result payload so agents can filter if needed. Apply a sensible lower bound (e.g., 0.3) only to prevent truly unrelated results. With an empty collection (Phase 17 baseline), threshold cannot be empirically calibrated — omit it.

---

## Code Examples

### Verified: Qdrant search() signature (from installed @qdrant/js-client-rest types)

```typescript
// Source: node_modules/@qdrant/js-client-rest/dist/types/qdrant-client.d.ts
client.search(collection_name: string, {
  vector,           // number[] — required
  limit,            // number — optional, defaults to 10
  filter,           // { must?: Condition[], should?: Condition[], must_not?: Condition[] }
  with_payload,     // boolean | string[] — return payload fields
  score_threshold,  // number — optional minimum score
}): Promise<ScoredPoint[]>

// ScoredPoint shape:
{
  id: string | number,
  score: number,         // 0.0 - 1.0 for cosine
  payload?: Record<string, unknown>,
  vector?: number[],
}
```

### Verified: Qdrant scroll() for confidence firewall

```typescript
// Source: node_modules/@qdrant/js-client-rest/dist/types/qdrant-client.d.ts
client.scroll('cortex-entries', {
  filter: {
    must: [
      { key: 'cortex_level', match: { value: 'L10' } },
      { key: 'domain', match: { value: 'nanoclaw' } },
      { key: 'confidence', match: { any: ['medium', 'high'] } },
    ],
  },
  limit: 1,
  with_payload: false,
}): Promise<{ points: ScoredPoint[], next_page_offset: ... }>
```

### Verified: Live Qdrant collection payload indexes (confirmed from /collections/cortex-entries)

```json
{
  "payload_schema": {
    "domain": { "data_type": "keyword" },
    "cortex_level": { "data_type": "keyword" },
    "status": { "data_type": "keyword" },
    "project": { "data_type": "keyword" }
  }
}
```

Note: `confidence` field is NOT indexed. If confidence firewall queries become slow at scale, add an index. At current scale (0-500 entries), a scan is fine.

### Verified: writeIpcFile() in ipc-mcp-stdio.ts (lines 24-36)

```typescript
// Source: container/agent-runner/src/ipc-mcp-stdio.ts:24
function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);
  return filename;
}
```

### Verified: OpenAI embeddings.create() (same as host-side embedder.ts)

```typescript
// Source: src/cortex/embedder.ts:170
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: queryText,
});
const vector: number[] = response.data[0].embedding;
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| All Cortex tools via IPC (request-response) | Direct reads (cortex_read) + direct Qdrant (cortex_search) + IPC only for writes (cortex_write) | Decided in ARCHITECTURE.md — IPC adds latency for reads/searches |
| Single MCP server per container | Tools added to existing ipc-mcp-stdio.ts | MCP-05 requirement — no new processes |

---

## Open Questions

1. **Should cortex_read parse and strip frontmatter before returning, or return raw markdown?**
   - What we know: Agents need both the body content AND the metadata to make decisions.
   - What's unclear: Whether returning raw markdown (including YAML frontmatter) is more useful than pre-parsed JSON.
   - Recommendation: Return raw markdown. The agent can parse it if needed, and returning raw keeps the tool simple. The frontmatter is readable YAML.

2. **Should cortex_write validate content on the container side (strict Zod) or rely on host-side validation?**
   - What we know: The host embedder uses permissive mode; the write path should be strict (require all 4 fields).
   - What's unclear: Whether a failed validation should return an error immediately (container-side) or after the IPC roundtrip (host-side).
   - Recommendation: Validate on the container side BEFORE writing IPC. This gives the agent instant feedback without waiting for the IPC roundtrip. Inline the 4-field Zod schema in `ipc-mcp-stdio.ts`.

3. **How strict should the confidence firewall be — hard block or warning?**
   - What we know: The user designated this as Claude's discretion.
   - What's unclear: Whether hard blocking would frustrate agents during bootstrap (Phase 18).
   - Recommendation: Hard block (return `isError: true`) but with a clear error message explaining what L(N-1) entries need to exist. This enforces the pyramid contract — soft warnings get ignored by agents.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Container execution | ✓ | 29.3.0 | — |
| Qdrant (nanoclaw-qdrant container) | cortex_search | ✓ | Running, cortex-entries collection present | — |
| OpenAI API (via OPENAI_API_KEY) | cortex_search query embedding | Assumed (in .env from Phase 16) | text-embedding-3-small | — |
| `host.docker.internal` gateway | Container → Qdrant | ✓ | `--add-host` already in hostGatewayArgs() | — |
| Read-only cortex/ vault mount | cortex_read | Not yet (Phase 17 adds it) | — | Phase 17 Task: add mount |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` — `include: ['src/**/*.test.ts']` |
| Quick run command | `npx vitest run src/cortex/` |
| Full suite command | `npm run test` |

Note: Container agent-runner has no vitest setup. Container tool tests run on the host by importing the tool logic as a module (same pattern as existing Phase 16 tests that mock @qdrant/js-client-rest and openai).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEARCH-01 | Hybrid routing: vault path query routes to direct read, not Qdrant | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | ❌ Wave 0 |
| SEARCH-02 | Confidence firewall blocks L20 write when no medium+ L10 entries exist | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | ❌ Wave 0 |
| SEARCH-03 | cortex_search filter by project/cortex_level/domain builds correct Qdrant filter | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | ❌ Wave 0 |
| MCP-01 | cortex_search embeds query and calls qdrant.search with correct params | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | ❌ Wave 0 |
| MCP-02 | cortex_read returns file content for valid path, error for traversal | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | ❌ Wave 0 |
| MCP-03 | cortex_write validates frontmatter, writes IPC file for valid input | unit | `npx vitest run src/cortex/cortex-mcp-tools.test.ts` | ❌ Wave 0 |
| MCP-05 | Tools added to existing McpServer instance (no new server) | integration | Manual — verify container starts with tools registered | manual-only |

Note: Tests are written on the host for the tool logic functions extracted from `ipc-mcp-stdio.ts`. The actual MCP server integration is validated by running the container and calling the tools.

### Sampling Rate

- **Per task commit:** `npx vitest run src/cortex/`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/cortex/cortex-mcp-tools.test.ts` — covers SEARCH-01, SEARCH-02, SEARCH-03, MCP-01, MCP-02, MCP-03
  - Needs: mock `@qdrant/js-client-rest`, mock `openai`, mock `fs` for cortex_read
  - Pattern: same as `embedder.test.ts` (vi.mock for both clients)

---

## Sources

### Primary (HIGH confidence)
- `container/agent-runner/src/ipc-mcp-stdio.ts` — 11 existing tools, exact patterns for server.tool(), writeIpcFile(), Zod params
- `src/ipc.ts` — full processTaskIpc() and processIpcFiles() — exact integration point for cortex_write handler
- `src/container-runner.ts` — buildVolumeMounts(), buildContainerArgs() — exact mount and env var injection points
- `src/cortex/embedder.ts` — embedEntry(), createOpenAIClient() — reusable embedding pattern
- `src/cortex/qdrant-client.ts` — createQdrantClient(), COLLECTION_NAME — exact client factory
- `src/cortex/schema.ts` — CortexFieldsStrict, validateFrontmatter() — validation logic to inline in container
- `node_modules/@qdrant/js-client-rest/dist/types/qdrant-client.d.ts` — verified search() and scroll() signatures
- `curl http://localhost:6333/collections/cortex-entries` — verified live collection: cosine/1536-dim, payload indexes on domain/cortex_level/status/project

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — Data flow diagrams, component boundaries, IPC patterns
- `.planning/research/STACK.md` — Stack decisions, container agent-runner update plan
- `.planning/phases/16-embedding-pipeline/16-CONTEXT.md` — D-06: containers call OpenAI directly

### Tertiary (LOW confidence)
- None — all research is grounded in the actual codebase and live Qdrant instance.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified in package.json, container package.json verified empty of openai/qdrant
- Architecture: HIGH — all integration points read directly from source; IPC watcher code read in full; Qdrant confirmed live with correct collection schema
- Pitfalls: HIGH — path traversal, import boundary, and IPC routing pitfalls verified against actual code

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain — dependencies don't change, collection schema is locked)
