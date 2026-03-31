/**
 * Bootstrap Cortex Knowledge Base
 *
 * Parses NanoClaw's src/*.ts files via regex, generates L10/L20 Cortex vault
 * entries (one per source module), writes them to cortex/Areas/Projects/NanoClaw/,
 * and embeds them into Qdrant by calling embedEntry() directly.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-cortex.ts           # full run (requires Qdrant + OPENAI_API_KEY)
 *   npx tsx scripts/bootstrap-cortex.ts --dry-run  # print entry count without writing/embedding
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { embedEntry, createOpenAIClient } from '../src/cortex/embedder.js';
import { createQdrantClient, checkQdrantHealth } from '../src/cortex/qdrant-client.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const VAULT_BASE = path.join(
  PROJECT_ROOT,
  'cortex',
  'Areas',
  'Projects',
  'NanoClaw',
);
const VAULT_SRC = path.join(VAULT_BASE, 'src');
const DRY_RUN = process.argv.includes('--dry-run');
const WRITE_ONLY = process.argv.includes('--write-only');

const IPC_MCP_PATH = path.join(
  PROJECT_ROOT,
  'container',
  'agent-runner',
  'src',
  'ipc-mcp-stdio.ts',
);

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const EXPORT_FUNCTION =
  /^export\s+(async\s+)?function\s+(\w+)\s*\(/;
const EXPORT_INTERFACE = /^export\s+interface\s+(\w+)/;
const EXPORT_TYPE = /^export\s+type\s+(\w+)/;
const EXPORT_CLASS = /^export\s+class\s+(\w+)/;
const EXPORT_CONST = /^export\s+const\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/;
const PROCESS_ENV = /process\.env\.(\w+)/g;
const JSDOC_BLOCK = /\/\*\*\s*([\s\S]*?)\*\//g;

// IPC extraction patterns
const IPC_CASE_TYPE = /case\s+'(\w+)'/g;
const MCP_TOOL_NAME = /server\.tool\(\s*['"]([^'"]+)['"]/g;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedExport {
  kind: 'function' | 'interface' | 'type' | 'class' | 'const';
  name: string;
  signature?: string;
  jsdoc?: string;
}

interface GeneratedEntry {
  vaultPath: string;
  content: string;
  level: 'L10' | 'L20' | 'L40';
  scope: string;
}

// ---------------------------------------------------------------------------
// walkSourceFiles
// ---------------------------------------------------------------------------

/**
 * Recursively find all .ts files under dir, excluding test files and re-export
 * index files.
 */
function walkSourceFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // Skip test files
        if (entry.name.endsWith('.test.ts')) continue;
        // Skip channels/index.ts (re-exports only)
        const rel = path.relative(SRC_DIR, fullPath);
        if (rel === path.join('channels', 'index.ts')) continue;
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

// ---------------------------------------------------------------------------
// extractExports
// ---------------------------------------------------------------------------

/**
 * Extract exported symbols from TypeScript source content via regex.
 * Captures JSDoc comments immediately above exports.
 */
function extractExports(content: string): ExtractedExport[] {
  const lines = content.split('\n');
  const exports: ExtractedExport[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpMatchArray | null;

    // Try each export pattern
    match = line.match(EXPORT_FUNCTION);
    if (match) {
      const name = match[2];
      // Gather params: everything after the opening paren
      let paramText = line.slice(line.indexOf('(') + 1);
      // Handle multi-line params: if paren not closed, scan forward
      if (!line.includes(')')) {
        for (let j = i + 1; j < lines.length && j < i + 10; j++) {
          paramText += ' ' + lines[j].trim();
          if (lines[j].includes(')')) break;
        }
      }
      // Extract just the params (up to closing paren)
      const closeParen = paramText.indexOf(')');
      const params = closeParen >= 0 ? paramText.slice(0, closeParen) : paramText;
      const jsdoc = extractJsdocAbove(lines, i);
      exports.push({
        kind: 'function',
        name,
        signature: `${name}(${params.replace(/\s+/g, ' ').trim()})`,
        jsdoc,
      });
      continue;
    }

    match = line.match(EXPORT_INTERFACE);
    if (match) {
      exports.push({
        kind: 'interface',
        name: match[1],
        jsdoc: extractJsdocAbove(lines, i),
      });
      continue;
    }

    match = line.match(EXPORT_TYPE);
    if (match) {
      exports.push({
        kind: 'type',
        name: match[1],
        jsdoc: extractJsdocAbove(lines, i),
      });
      continue;
    }

    match = line.match(EXPORT_CLASS);
    if (match) {
      exports.push({
        kind: 'class',
        name: match[1],
        jsdoc: extractJsdocAbove(lines, i),
      });
      continue;
    }

    match = line.match(EXPORT_CONST);
    if (match) {
      const name = match[1];
      const typeAnnotation = match[2]?.trim();
      exports.push({
        kind: 'const',
        name,
        signature: typeAnnotation ? `${name}: ${typeAnnotation}` : name,
        jsdoc: extractJsdocAbove(lines, i),
      });
      continue;
    }
  }

  return exports;
}

// ---------------------------------------------------------------------------
// extractJsdocAbove
// ---------------------------------------------------------------------------

/**
 * Scan backwards from line index to find the JSDoc comment block immediately
 * above it. Returns the first line of the JSDoc (summary line).
 */
function extractJsdocAbove(lines: string[], lineIndex: number): string | undefined {
  // Walk backwards to find */ then scan up to /**
  let j = lineIndex - 1;
  // Skip blank lines
  while (j >= 0 && lines[j].trim() === '') j--;

  if (j < 0) return undefined;

  // Check if the line above ends with */
  if (!lines[j].trim().endsWith('*/')) return undefined;

  // Find the opening /**
  let start = j;
  while (start >= 0 && !lines[start].trim().startsWith('/**')) {
    start--;
  }
  if (start < 0) return undefined;

  // Extract the text between /** and */
  const jsdocLines: string[] = [];
  for (let k = start; k <= j; k++) {
    let text = lines[k]
      .trim()
      .replace(/^\/\*\*\s*/, '')
      .replace(/\*\/\s*$/, '')
      .replace(/^\*\s?/, '')
      .trim();
    if (text) jsdocLines.push(text);
  }

  return jsdocLines[0] || undefined;
}

// ---------------------------------------------------------------------------
// extractEnvVars
// ---------------------------------------------------------------------------

/**
 * Find all process.env.VARNAME references in source content, deduplicated.
 */
function extractEnvVars(content: string): string[] {
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(PROCESS_ENV.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars).sort();
}

// ---------------------------------------------------------------------------
// classifyLevel
// ---------------------------------------------------------------------------

/**
 * Classify a source file as L10 (factual) or L20 (behavioral) based on
 * the research classification table.
 */
function classifyLevel(relPath: string): 'L10' | 'L20' {
  const basename = path.basename(relPath);
  const l20Files = [
    'ipc.ts',
    'index.ts',
    'container-runner.ts',
    'task-scheduler.ts',
    'health-monitor.ts',
    'watcher.ts',
    'embedder.ts',
    'discord-server-manager.ts',
  ];
  if (l20Files.includes(basename)) return 'L20';
  if (basename.includes('webhook')) return 'L20';
  return 'L10';
}

// ---------------------------------------------------------------------------
// inferCategory
// ---------------------------------------------------------------------------

/**
 * Infer a tag category from the relative path.
 */
function inferCategory(relPath: string): string {
  if (relPath.startsWith('channels/')) return 'channel';
  if (relPath.startsWith('cortex/')) return 'cortex';
  if (relPath.includes('webhook')) return 'webhook';
  if (relPath.includes('ipc')) return 'ipc';
  if (relPath.includes('discord')) return 'discord';
  if (relPath.includes('container')) return 'container';
  if (relPath.includes('health')) return 'health';
  if (relPath.includes('task')) return 'scheduler';
  return 'core';
}

// ---------------------------------------------------------------------------
// generateFrontmatter
// ---------------------------------------------------------------------------

/**
 * Produce frontmatter object for a bootstrap entry.
 */
function generateFrontmatter(
  relPath: string,
  level: 'L10' | 'L20' | 'L40',
): Record<string, unknown> {
  const category = inferCategory(relPath);
  return {
    cortex_level: level,
    confidence: 'high',
    domain: 'nanoclaw',
    scope: `src/${relPath} exports`,
    type: 'bootstrap-extract',
    tags: ['nanoclaw', 'bootstrap', category],
    created: '2026-03-31',
    project: 'nanoclaw',
  };
}

// ---------------------------------------------------------------------------
// generateEntryBody
// ---------------------------------------------------------------------------

/**
 * Generate markdown body for a source module entry.
 */
function generateEntryBody(
  relPath: string,
  exports: ExtractedExport[],
  envVars: string[],
  fileContent: string,
): string {
  const filename = path.basename(relPath);
  // Try to get file-level JSDoc
  const fileLevelMatch = fileContent.match(/^\/\*\*\s*([\s\S]*?)\*\//);
  let description = `Exports from ${filename}`;
  if (fileLevelMatch) {
    const firstLine = fileLevelMatch[1]
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter(Boolean)[0];
    if (firstLine) description = firstLine;
  }

  const sections: string[] = [];
  sections.push(`# ${filename}\n`);
  sections.push(`> ${description}\n`);
  sections.push('## Exports\n');

  // Group by kind
  const groups: Record<string, ExtractedExport[]> = {
    function: [],
    interface: [],
    type: [],
    const: [],
    class: [],
  };
  for (const exp of exports) {
    groups[exp.kind].push(exp);
  }

  const kindLabels: Record<string, string> = {
    function: 'Functions',
    interface: 'Interfaces',
    type: 'Types',
    const: 'Constants',
    class: 'Classes',
  };

  for (const [kind, label] of Object.entries(kindLabels)) {
    const items = groups[kind];
    if (items.length === 0) continue;
    sections.push(`### ${label}\n`);
    for (const item of items) {
      const sig = item.signature || item.name;
      const desc = item.jsdoc ? ` -- ${item.jsdoc}` : '';
      sections.push(`- \`${sig}\`${desc}`);
    }
    sections.push('');
  }

  // Environment variables section
  if (envVars.length > 0) {
    sections.push('## Environment Variables\n');
    for (const v of envVars) {
      sections.push(`- \`${v}\` -- referenced in this module`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// computeVaultPath
// ---------------------------------------------------------------------------

/**
 * Map a source file path to its vault entry path.
 * src/foo/bar.ts -> cortex/Areas/Projects/NanoClaw/src/foo/bar.md
 */
function computeVaultPath(srcFile: string): string {
  const rel = path.relative(SRC_DIR, srcFile);
  const mdRel = rel.replace(/\.ts$/, '.md');
  return path.join(VAULT_SRC, mdRel);
}

// ---------------------------------------------------------------------------
// generateCrossCuttingEntries
// ---------------------------------------------------------------------------

/**
 * Generate special cross-cutting entries:
 * - env-vars.md: All environment variables across the codebase
 * - ipc-contracts.md: All IPC message types and MCP tool names
 */
function generateCrossCuttingEntries(
  sourceFiles: string[],
): GeneratedEntry[] {
  const entries: GeneratedEntry[] = [];

  // --- env-vars.md ---
  const envVarMap = new Map<string, string[]>();
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const vars = extractEnvVars(content);
    const rel = path.relative(SRC_DIR, file);
    for (const v of vars) {
      if (!envVarMap.has(v)) envVarMap.set(v, []);
      envVarMap.get(v)!.push(rel);
    }
  }

  const envBody: string[] = [];
  envBody.push('# Environment Variables\n');
  envBody.push(
    '> All environment variables referenced across the NanoClaw codebase.\n',
  );
  envBody.push('## Variables\n');
  const sortedVars = Array.from(envVarMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [varName, files] of sortedVars) {
    envBody.push(`- \`${varName}\` -- referenced in: ${files.join(', ')}`);
  }
  envBody.push('');

  const envFrontmatter = {
    cortex_level: 'L10',
    confidence: 'high',
    domain: 'nanoclaw',
    scope: 'environment variables across all modules',
    type: 'bootstrap-extract',
    tags: ['nanoclaw', 'bootstrap', 'config', 'env'],
    created: '2026-03-31',
    project: 'nanoclaw',
  };
  entries.push({
    vaultPath: path.join(VAULT_SRC, 'env-vars.md'),
    content: matter.stringify(envBody.join('\n'), envFrontmatter),
    level: 'L10',
    scope: 'environment variables across all modules',
  });

  // --- ipc-contracts.md ---
  const ipcBody: string[] = [];
  ipcBody.push('# IPC Contracts\n');
  ipcBody.push(
    '> All IPC message types, task types, and MCP tool definitions.\n',
  );

  // Extract IPC types from src/ipc.ts
  const ipcFile = path.join(SRC_DIR, 'ipc.ts');
  if (fs.existsSync(ipcFile)) {
    const ipcContent = fs.readFileSync(ipcFile, 'utf-8');
    const ipcTypes = new Set<string>();
    let m: RegExpExecArray | null;
    const caseRegex = new RegExp(IPC_CASE_TYPE.source, 'g');
    while ((m = caseRegex.exec(ipcContent)) !== null) {
      ipcTypes.add(m[1]);
    }

    if (ipcTypes.size > 0) {
      ipcBody.push('## IPC Task Types (host-side)\n');
      for (const t of Array.from(ipcTypes).sort()) {
        ipcBody.push(`- \`${t}\``);
      }
      ipcBody.push('');
    }
  }

  // Extract MCP tool names from container/agent-runner/src/ipc-mcp-stdio.ts
  if (fs.existsSync(IPC_MCP_PATH)) {
    const mcpContent = fs.readFileSync(IPC_MCP_PATH, 'utf-8');
    const mcpTools: string[] = [];
    let m: RegExpExecArray | null;
    const toolRegex = new RegExp(MCP_TOOL_NAME.source, 'g');
    while ((m = toolRegex.exec(mcpContent)) !== null) {
      mcpTools.push(m[1]);
    }

    if (mcpTools.length > 0) {
      ipcBody.push('## MCP Tools (container-side)\n');
      for (const t of mcpTools.sort()) {
        ipcBody.push(`- \`${t}\``);
      }
      ipcBody.push('');
    }
  }

  const ipcFrontmatter = {
    cortex_level: 'L20',
    confidence: 'high',
    domain: 'nanoclaw',
    scope: 'IPC contracts and MCP tool definitions',
    type: 'bootstrap-extract',
    tags: ['nanoclaw', 'bootstrap', 'ipc', 'mcp'],
    created: '2026-03-31',
    project: 'nanoclaw',
  };
  entries.push({
    vaultPath: path.join(VAULT_SRC, 'ipc-contracts.md'),
    content: matter.stringify(ipcBody.join('\n'), ipcFrontmatter),
    level: 'L20',
    scope: 'IPC contracts and MCP tool definitions',
  });

  return entries;
}

// ---------------------------------------------------------------------------
// generateHubFile
// ---------------------------------------------------------------------------

/**
 * Generate the NanoClaw.md hub file listing all bootstrapped entries.
 */
function generateHubFile(
  entries: Array<{ relPath: string; level: string; scope: string }>,
): GeneratedEntry {
  const body: string[] = [];
  body.push('# NanoClaw\n');
  body.push(
    '> Personal Claude assistant -- single Node.js process with skill-based channel system.\n',
  );
  body.push('## Bootstrapped Knowledge Entries\n');
  body.push('| Entry | Level | Scope |');
  body.push('|-------|-------|-------|');
  for (const e of entries) {
    body.push(`| [${e.relPath}](src/${e.relPath}) | ${e.level} | ${e.scope} |`);
  }
  body.push('');

  const frontmatter = {
    cortex_level: 'L40',
    confidence: 'high',
    domain: 'nanoclaw',
    scope: 'NanoClaw project hub',
    type: 'bootstrap-extract',
    tags: ['nanoclaw', 'bootstrap', 'hub'],
    created: '2026-03-31',
    project: 'nanoclaw',
  };

  return {
    vaultPath: path.join(VAULT_BASE, 'NanoClaw.md'),
    content: matter.stringify(body.join('\n'), frontmatter),
    level: 'L40',
    scope: 'NanoClaw project hub',
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    DRY_RUN ? 'Bootstrap Cortex (dry-run)...' : 'Bootstrap Cortex...',
  );

  // Walk source files
  const sourceFiles = walkSourceFiles(SRC_DIR);
  console.log(`Found ${sourceFiles.length} source files`);

  // Process each source file
  const allEntries: GeneratedEntry[] = [];
  const hubRows: Array<{ relPath: string; level: string; scope: string }> = [];

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const exports = extractExports(content);
    if (exports.length === 0) continue;

    const relPath = path.relative(SRC_DIR, file);
    const level = classifyLevel(relPath);
    const envVars = extractEnvVars(content);
    const body = generateEntryBody(relPath, exports, envVars, content);
    const fm = generateFrontmatter(relPath, level);
    const vaultPath = computeVaultPath(file);

    allEntries.push({
      vaultPath,
      content: matter.stringify(body, fm),
      level,
      scope: fm.scope as string,
    });

    hubRows.push({
      relPath: path.relative(SRC_DIR, file).replace(/\.ts$/, '.md'),
      level,
      scope: fm.scope as string,
    });
  }

  // Cross-cutting entries
  const crossCutting = generateCrossCuttingEntries(sourceFiles);
  for (const entry of crossCutting) {
    allEntries.push(entry);
    hubRows.push({
      relPath: path.relative(VAULT_SRC, entry.vaultPath),
      level: entry.level,
      scope: entry.scope,
    });
  }

  // Hub file
  const hubEntry = generateHubFile(hubRows);
  allEntries.push(hubEntry);

  const totalCount = allEntries.length;
  console.log(`Generated ${totalCount} entries (including hub + cross-cutting)`);

  if (DRY_RUN) {
    console.log('\n--- Dry-run: entries that would be generated ---\n');
    for (const entry of allEntries) {
      const rel = path.relative(PROJECT_ROOT, entry.vaultPath);
      console.log(`  ${entry.level}  ${rel}`);
    }
    console.log(`\nTotal: ${totalCount} entries`);
    console.log('Dry-run complete. No files written, no embeddings created.');
    process.exit(0);
  }

  // Write all files to vault
  for (const entry of allEntries) {
    fs.mkdirSync(path.dirname(entry.vaultPath), { recursive: true });
    fs.writeFileSync(entry.vaultPath, entry.content, 'utf-8');
  }
  console.log(`Wrote ${allEntries.length} entries to vault`);

  if (WRITE_ONLY) {
    console.log('Write-only mode. Files written, no embeddings created.');
    process.exit(0);
  }

  // Full run: check prerequisites and embed
  let openai: ReturnType<typeof createOpenAIClient>;
  let qdrant: ReturnType<typeof createQdrantClient>;
  try {
    openai = createOpenAIClient();
  } catch (err) {
    console.error(
      'Failed to create OpenAI client:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }

  qdrant = createQdrantClient();
  const healthy = await checkQdrantHealth(qdrant);
  if (!healthy) {
    console.error('Qdrant is not reachable at localhost:6333. Exiting.');
    process.exit(1);
  }

  // Embed all entries
  let embedded = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of allEntries) {
    const result = await embedEntry(entry.vaultPath, openai, qdrant, {
      force: true,
    });
    if (result.status === 'embedded') {
      embedded++;
      console.log(`  Embedded: ${path.relative(PROJECT_ROOT, entry.vaultPath)}`);
    } else if (result.status === 'skipped') {
      skipped++;
      console.log(
        `  Skipped: ${path.relative(PROJECT_ROOT, entry.vaultPath)} (${result.reason})`,
      );
    } else {
      errors++;
      console.error(
        `  Error: ${path.relative(PROJECT_ROOT, entry.vaultPath)} (${result.reason})`,
      );
    }
  }

  console.log(
    `\nBootstrap complete: ${embedded} embedded, ${skipped} skipped, ${errors} errors`,
  );
  process.exit(errors > 0 ? 1 : 0);
}

main();
