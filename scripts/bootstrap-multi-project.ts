/**
 * Bootstrap Multi-Project Cortex Knowledge Base
 *
 * Reads vault markdown files for YourWave, ContentFactory, and NightShift,
 * generates L10/L20 Cortex entries (one per source doc), writes them under
 * cortex/Areas/Projects/{Project}/bootstrap/, and embeds via embedEntry().
 *
 * Pure generation logic lives in src/cortex/multi-project-bootstrap.ts
 * so it can be unit-tested independently.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-multi-project.ts              # full run (requires Qdrant + OPENAI_API_KEY)
 *   npx tsx scripts/bootstrap-multi-project.ts --dry-run    # print entries without writing/embedding
 *   npx tsx scripts/bootstrap-multi-project.ts --write-only # write files, skip embedding
 *   npx tsx scripts/bootstrap-multi-project.ts --project yourwave  # filter to one project
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {
  generateProjectEntries,
  PROJECT_PASCAL,
  type ProjectSlug,
  type VaultDoc,
  type GeneratedEntry,
} from '../src/cortex/multi-project-bootstrap.js';
import { embedEntry, createOpenAIClient } from '../src/cortex/embedder.js';
import { createQdrantClient, checkQdrantHealth } from '../src/cortex/qdrant-client.js';

// Re-export types for tests (tests import from scripts/ in non-split mode)
export type { VaultDoc, GeneratedEntry };
export { generateProjectEntries };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const VAULT_ROOT = path.join(PROJECT_ROOT, 'cortex', 'Areas', 'Projects');

const DRY_RUN = process.argv.includes('--dry-run');
const WRITE_ONLY = process.argv.includes('--write-only');

// Filter: --project yourwave|contentfactory|nightshift|all
const PROJECT_ARG = (() => {
  const idx = process.argv.indexOf('--project');
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return 'all';
})();

/** Today's date in YYYY-MM-DD format. */
const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// generateHubEntry
// ---------------------------------------------------------------------------

/**
 * Generate a hub entry for the project at cortex_level L40.
 * Lists all bootstrapped entries in a table.
 */
function generateHubEntry(
  projectSlug: ProjectSlug,
  entries: GeneratedEntry[],
): GeneratedEntry {
  const pascalCase = PROJECT_PASCAL[projectSlug];
  const title = pascalCase.replace(/([A-Z])/g, ' $1').trim();

  const bodyLines: string[] = [];
  bodyLines.push(`# ${title}\n`);
  bodyLines.push(`> Knowledge hub for the ${title} project.\n`);
  bodyLines.push('## Bootstrapped Entries\n');
  bodyLines.push('| Entry | Level | Scope |');
  bodyLines.push('|-------|-------|-------|');
  for (const e of entries) {
    bodyLines.push(`| [${e.filename}](bootstrap/${e.filename}) | ${e.level} | ${e.frontmatter.scope} |`);
  }
  bodyLines.push('');

  const body = bodyLines.join('\n');
  const frontmatter: GeneratedEntry['frontmatter'] = {
    cortex_level: 'L40',
    confidence: 'high',
    domain: projectSlug,
    scope: `${projectSlug} project hub`,
    type: 'bootstrap-extract',
    tags: [projectSlug, 'bootstrap', 'hub'],
    created: TODAY,
    project: projectSlug,
  };

  const fullContent = matter.stringify(body, frontmatter);
  const vaultPath = path.join(VAULT_ROOT, pascalCase, 'bootstrap', `${pascalCase}.md`);

  return {
    filename: `${pascalCase}.md`,
    vaultPath,
    content: fullContent,
    body,
    level: 'L40',
    frontmatter,
  };
}

// ---------------------------------------------------------------------------
// loadVaultDocs
// ---------------------------------------------------------------------------

/**
 * Recursively read all .md files from a directory.
 * Skips the 'bootstrap' subdirectory to avoid re-reading our own output.
 */
function loadVaultDocs(dir: string): VaultDoc[] {
  const docs: VaultDoc[] = [];

  function walk(d: string) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'bootstrap') continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        docs.push({ filename: entry.name, content });
      }
    }
  }

  walk(dir);
  return docs;
}

// ---------------------------------------------------------------------------
// processProject
// ---------------------------------------------------------------------------

/**
 * Load vault docs for a project, generate entries, optionally write + embed.
 */
async function processProject(
  projectSlug: ProjectSlug,
  openai: ReturnType<typeof createOpenAIClient> | null,
  qdrant: ReturnType<typeof createQdrantClient> | null,
): Promise<void> {
  const pascalCase = PROJECT_PASCAL[projectSlug];
  const vaultDir = path.join(VAULT_ROOT, pascalCase);

  console.log(`\n[${pascalCase}] Loading vault docs from ${path.relative(PROJECT_ROOT, vaultDir)}/`);

  const vaultDocs = loadVaultDocs(vaultDir);
  console.log(`[${pascalCase}] Found ${vaultDocs.length} source docs`);

  const entries = generateProjectEntries(projectSlug, vaultDocs, VAULT_ROOT, TODAY);
  console.log(`[${pascalCase}] Generated ${entries.length} entries`);

  // Generate hub entry
  const hubEntry = generateHubEntry(projectSlug, entries);
  const allEntries = [...entries, hubEntry];

  if (DRY_RUN) {
    console.log(`\n[${pascalCase}] Dry-run entries:`);
    for (const entry of allEntries) {
      const rel = path.relative(PROJECT_ROOT, entry.vaultPath);
      console.log(`  ${entry.level}  ${rel}`);
    }
    return;
  }

  // Write vault files
  for (const entry of allEntries) {
    fs.mkdirSync(path.dirname(entry.vaultPath), { recursive: true });
    fs.writeFileSync(entry.vaultPath, entry.content, 'utf-8');
  }
  console.log(`[${pascalCase}] Wrote ${allEntries.length} entries to vault`);

  if (WRITE_ONLY || !openai || !qdrant) return;

  // Embed all entries
  let embedded = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of allEntries) {
    const result = await embedEntry(entry.vaultPath, openai, qdrant, { force: true });
    if (result.status === 'embedded') {
      embedded++;
    } else if (result.status === 'skipped') {
      skipped++;
    } else {
      errors++;
      console.error(`  Error embedding ${entry.filename}: ${result.reason}`);
    }
  }

  console.log(`[${pascalCase}] Embedded: ${embedded}, Skipped: ${skipped}, Errors: ${errors}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const mode = DRY_RUN ? 'dry-run' : WRITE_ONLY ? 'write-only' : 'full';
  console.log(`Bootstrap Multi-Project Cortex (${mode}, project=${PROJECT_ARG})`);

  const allSlugs: ProjectSlug[] = ['yourwave', 'contentfactory', 'nightshift'];
  const slugs: ProjectSlug[] =
    PROJECT_ARG === 'all'
      ? allSlugs
      : allSlugs.filter((s) => s === PROJECT_ARG);

  if (slugs.length === 0) {
    console.error(`Unknown project: ${PROJECT_ARG}. Use: yourwave | contentfactory | nightshift | all`);
    process.exit(1);
  }

  let openai: ReturnType<typeof createOpenAIClient> | null = null;
  let qdrant: ReturnType<typeof createQdrantClient> | null = null;

  if (!DRY_RUN && !WRITE_ONLY) {
    try {
      openai = createOpenAIClient();
    } catch (err) {
      console.error('Failed to create OpenAI client:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
    qdrant = createQdrantClient();
    const healthy = await checkQdrantHealth(qdrant);
    if (!healthy) {
      console.error('Qdrant is not reachable at localhost:6333. Exiting.');
      process.exit(1);
    }
  }

  for (const slug of slugs) {
    await processProject(slug, openai, qdrant);
  }

  if (!DRY_RUN) {
    const total = slugs.reduce((acc, slug) => {
      const pascalCase = PROJECT_PASCAL[slug];
      const bootstrapDir = path.join(VAULT_ROOT, pascalCase, 'bootstrap');
      if (!fs.existsSync(bootstrapDir)) return acc;
      return acc + fs.readdirSync(bootstrapDir).filter(f => f.endsWith('.md')).length;
    }, 0);
    console.log(`\nTotal vault entries written: ${total}`);
  }

  console.log('\nDone.');
  process.exit(0);
}

main();
