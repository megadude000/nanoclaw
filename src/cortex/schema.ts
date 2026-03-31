/**
 * Cortex Schema Validation
 *
 * Zod v4 schemas for validating Cortex YAML frontmatter.
 * Supports strict mode (all Cortex fields required) and permissive mode
 * (missing fields get defaults inferred from file path).
 *
 * Pattern follows src/agent-message-schema.ts (z.enum, z.object, safeParse).
 */

import { z } from 'zod';
import type {
  CortexLevel,
  Confidence,
  CortexFrontmatter,
  ValidationResult,
  InferredDefaults,
} from './types.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Knowledge pyramid levels */
export const CortexLevelSchema = z.enum(['L10', 'L20', 'L30', 'L40', 'L50']);

/** Confidence ratings */
export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);

/** Core Cortex fields -- all required for strict (new writes) */
export const CortexFieldsStrict = z.object({
  cortex_level: CortexLevelSchema,
  confidence: ConfidenceSchema,
  domain: z.string().min(1),
  scope: z.string().min(1),
});

/** Embedding metadata -- optional until embedding pipeline runs */
export const EmbeddingMeta = z.object({
  source_hash: z.string().optional(),
  embedding_model: z.string().optional(),
});

/**
 * Existing vault fields preserved as-is.
 * Uses passthrough() so unknown fields are kept, not stripped.
 */
export const ExistingFields = z
  .object({
    type: z.string().optional(),
    status: z.string().optional(),
    tags: z.array(z.string()).optional(),
    created: z.union([z.string(), z.date()]).optional(),
    updated: z.union([z.string(), z.date()]).optional(),
    date: z.union([z.string(), z.date()]).optional(),
    project: z.string().optional(),
    last_updated: z.union([z.string(), z.date()]).optional(),
    topics: z.array(z.string()).optional(),
    day: z.string().optional(),
  })
  .passthrough();

/**
 * Full strict schema: all Cortex fields required.
 * Used by cortex_write MCP tool for new entries.
 * .passthrough() at end preserves unknown existing fields through merge.
 */
export const CortexFrontmatterStrict = ExistingFields.merge(CortexFieldsStrict)
  .merge(EmbeddingMeta)
  .passthrough();

/**
 * Permissive schema: Cortex fields optional, defaults applied externally.
 * Used for indexing existing vault files.
 */
export const CortexFrontmatterPermissive = ExistingFields.merge(
  CortexFieldsStrict.partial(),
)
  .merge(EmbeddingMeta)
  .passthrough();

// ---------------------------------------------------------------------------
// Path-based default inference
// ---------------------------------------------------------------------------

function inferLevelFromPath(filePath: string): CortexLevel {
  if (filePath.includes('Session-Logs/')) return 'L50';
  if (filePath.includes('Calendar/Daily/')) return 'L40';
  if (filePath.includes('System/')) return 'L10';
  if (filePath.includes('Research/')) return 'L20';

  // Projects: hub files (Name/Name.md) are L40, sub-files are L20
  const projectMatch = filePath.match(/Projects\/([^/]+)\/([^/]+)\.md$/);
  if (projectMatch) {
    const dirName = projectMatch[1];
    const fileName = projectMatch[2];
    // Hub file: directory name matches file name (e.g., YourWave/YourWave.md)
    if (fileName === dirName) return 'L40';
    return 'L20';
  }

  return 'L20'; // safe default
}

function inferDomainFromPath(filePath: string): string {
  // Try to extract project name from path: Projects/{Name}/
  const projectMatch = filePath.match(/Projects\/([^/]+)\//);
  if (projectMatch) return projectMatch[1].toLowerCase();

  if (filePath.includes('System/')) return 'nanoclaw';
  if (filePath.includes('Calendar/')) return 'personal';

  return 'general';
}

function inferScopeFromMeta(
  existingMeta: Record<string, unknown>,
  filePath: string,
): string {
  // Use existing type field if present
  if (typeof existingMeta.type === 'string' && existingMeta.type.length > 0) {
    return existingMeta.type;
  }

  // Derive from filename: strip .md, replace dots/hyphens with spaces
  const basename = filePath.split('/').pop() ?? '';
  return (
    basename
      .replace(/\.md$/, '')
      .replace(/[.\-_]/g, ' ')
      .trim() || 'unknown'
  );
}

/**
 * Infer sensible defaults for missing Cortex fields from file path and
 * existing metadata. Used by permissive validation mode.
 */
export function inferDefaults(
  filePath: string,
  existingMeta: Record<string, unknown>,
): InferredDefaults {
  const cortex_level = inferLevelFromPath(filePath);

  // Domain: prefer existing project field (lowercased), else infer from path
  const domain =
    typeof existingMeta.project === 'string' && existingMeta.project.length > 0
      ? existingMeta.project.toLowerCase()
      : inferDomainFromPath(filePath);

  const scope = inferScopeFromMeta(existingMeta, filePath);

  return { cortex_level, confidence: 'low', domain, scope };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate frontmatter against the Cortex schema.
 *
 * - strict: all four Cortex fields required. Returns errors naming bad fields.
 * - permissive: missing fields get defaults inferred from file path.
 *   Existing domain/project fields are NOT overwritten by inference (Pitfall 2).
 */
export function validateFrontmatter(
  raw: Record<string, unknown>,
  filePath: string,
  mode: 'strict' | 'permissive' = 'permissive',
): ValidationResult {
  if (mode === 'strict') {
    const result = CortexFrontmatterStrict.safeParse(raw);
    if (!result.success) {
      return {
        valid: false,
        data: raw as CortexFrontmatter,
        warnings: [],
        errors: result.error.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`,
        ),
      };
    }
    return {
      valid: true,
      data: result.data as CortexFrontmatter,
      warnings: [],
      errors: [],
    };
  }

  // Permissive: infer defaults for missing Cortex fields
  const defaults = inferDefaults(filePath, raw);
  const warnings: string[] = [];

  // Build merged object: defaults first, raw overrides
  // IMPORTANT: existing domain in raw is NOT overwritten (Pitfall 2)
  const merged: Record<string, unknown> = {};

  // Apply defaults only for missing cortex fields
  if (!raw.cortex_level) {
    merged.cortex_level = defaults.cortex_level;
    warnings.push('cortex_level defaulted to ' + defaults.cortex_level);
  }
  if (!raw.confidence) {
    merged.confidence = defaults.confidence;
    warnings.push('confidence defaulted to low');
  }
  if (!raw.domain && !raw.project) {
    // Only default domain if neither domain nor project exist in raw
    merged.domain = defaults.domain;
    warnings.push('domain inferred as ' + defaults.domain);
  } else if (!raw.domain && raw.project) {
    // project exists but domain doesn't -- infer domain from project
    merged.domain = (raw.project as string).toLowerCase();
    warnings.push('domain inferred from project as ' + merged.domain);
  }
  if (!raw.scope) {
    merged.scope = defaults.scope;
    warnings.push('scope inferred as ' + defaults.scope);
  }

  // Spread raw over merged so existing values take precedence
  const final = { ...merged, ...raw };

  const result = CortexFrontmatterPermissive.safeParse(final);
  if (!result.success) {
    return {
      valid: false,
      data: final as CortexFrontmatter,
      warnings,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }

  return {
    valid: true,
    data: result.data as CortexFrontmatter,
    warnings,
    errors: [],
  };
}
