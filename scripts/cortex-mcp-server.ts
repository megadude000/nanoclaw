#!/usr/bin/env npx tsx
// @ts-check
/**
 * Cortex MCP Server (stdio)
 *
 * Exposes cortex_search, cortex_read, cortex_write, cortex_relate as MCP tools
 * to the global Claude Code CLI. Register in ~/.claude/settings.json under mcpServers.
 *
 * Paths are hardcoded absolute so the server works regardless of Claude Code's cwd.
 * Degrades gracefully when OPENAI_API_KEY is absent or Qdrant is unreachable.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildSearchHandler,
  buildReadHandler,
  buildWriteHandler,
  buildRelateHandler,
} from '../src/cortex/cortex-mcp-tools.js';
import { buildIndex, loadGraph } from '../src/cortex/cortex-graph.js';

// ---------------------------------------------------------------------------
// Hardcoded absolute paths
// ---------------------------------------------------------------------------

const VAULT_ROOT = '/home/andrii-panasenko/nanoclaw/cortex';
const GRAPH_PATH = '/home/andrii-panasenko/nanoclaw/cortex/cortex-graph.json';
const IPC_DIR = '/home/andrii-panasenko/nanoclaw/data/ipc';

// ---------------------------------------------------------------------------
// writeIpc helper
// ---------------------------------------------------------------------------

function writeIpc(data: object): void {
  const messagesDir = path.join(IPC_DIR, 'messages');
  fs.mkdirSync(messagesDir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(messagesDir, filename);
  const tmp = `${filepath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filepath);
}

// ---------------------------------------------------------------------------
// Graceful startup: init deps, degrade on failure
// ---------------------------------------------------------------------------

let qdrant: QdrantClient | null = null;
let openai: OpenAI | null = null;

try {
  qdrant = new QdrantClient({ host: 'localhost', port: 6333 });
} catch (err) {
  process.stderr.write(`[cortex-mcp] WARNING: Qdrant unavailable: ${err}\n`);
}

if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (err) {
    process.stderr.write(`[cortex-mcp] WARNING: OpenAI init failed: ${err}\n`);
  }
} else {
  process.stderr.write('[cortex-mcp] WARNING: OPENAI_API_KEY not set — semantic search disabled, vault path reads still work\n');
}

let graphIndex = new Map();
try {
  const graph = loadGraph(GRAPH_PATH);
  graphIndex = buildIndex(graph);
} catch (err) {
  process.stderr.write(`[cortex-mcp] WARNING: graph load failed: ${err}\n`);
}

// ---------------------------------------------------------------------------
// Build handlers
// ---------------------------------------------------------------------------

// For search/write: pass stubs when deps are null so errors surface at call time
const qdrantStub = qdrant ?? (new Proxy({} as QdrantClient, {
  get: (_t, prop) => () => Promise.reject(new Error(`Qdrant unavailable (prop: ${String(prop)})`)),
}));
const openaiStub = openai ?? (new Proxy({} as OpenAI, {
  get: (_t, prop) => {
    if (prop === 'embeddings') {
      return {
        create: () => Promise.reject(new Error('OPENAI_API_KEY not set — semantic search unavailable. Use a vault path (e.g. Areas/foo.md) for direct file reads.')),
      };
    }
    return () => Promise.reject(new Error(`OpenAI unavailable (prop: ${String(prop)})`));
  },
}));

const searchHandler = buildSearchHandler({
  qdrant: qdrantStub,
  openai: openaiStub,
  vaultRoot: VAULT_ROOT,
  graphIndex,
});

const readHandler = buildReadHandler({ vaultRoot: VAULT_ROOT });

const writeHandler = buildWriteHandler({
  qdrant: qdrantStub,
  writeIpc,
  vaultRoot: VAULT_ROOT,
});

const relateHandler = buildRelateHandler({ writeIpc });

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'nanoclaw-cortex',
  version: '1.0.0',
});

server.tool(
  'cortex_search',
  'Search the Cortex knowledge base. Use a vault-relative path ending in .md for direct file reads (no OpenAI required). Use natural language for semantic vector search.',
  {
    query: z.string().describe('Search query or vault-relative path (e.g. "Areas/Projects/Foo/bar.md")'),
    project: z.string().optional().describe('Filter by project name'),
    cortex_level: z.enum(['L10', 'L20', 'L30', 'L40', 'L50']).optional().describe('Filter by cortex level'),
    domain: z.string().optional().describe('Filter by domain'),
    limit: z.number().optional().describe('Max results (default 5, max 20)'),
  },
  searchHandler,
);

server.tool(
  'cortex_read',
  'Read a Cortex vault entry by vault-relative path (e.g. "Areas/Projects/Foo/bar.md").',
  {
    path: z.string().describe('Vault-relative path to the entry'),
  },
  readHandler,
);

server.tool(
  'cortex_write',
  'Write a new Cortex entry. Content must include valid frontmatter with cortex_level, confidence, domain, and scope fields.',
  {
    path: z.string().describe('Vault-relative path for the entry'),
    content: z.string().describe('Full markdown content including frontmatter'),
  },
  writeHandler,
);

server.tool(
  'cortex_relate',
  'Declare a typed edge between two Cortex entries.',
  {
    source: z.string().describe('Vault-relative path of the source entry'),
    target: z.string().describe('Vault-relative path of the target entry'),
    edge_type: z.enum(['BUILT_FROM', 'REFERENCES', 'BLOCKS', 'CROSS_LINK', 'SUPERSEDES']).describe('Edge type'),
  },
  relateHandler,
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[cortex-mcp] Server started on stdio\n');
