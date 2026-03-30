/**
 * Cortex Schema Types
 *
 * TypeScript types for the Cortex YAML frontmatter specification.
 * Knowledge pyramid levels (L10-L50), confidence ratings, and validation results.
 */

/** Knowledge pyramid level: L10 (file facts) to L50 (experiential) */
export type CortexLevel = 'L10' | 'L20' | 'L30' | 'L40' | 'L50';

/** Confidence rating for a knowledge entry */
export type Confidence = 'low' | 'medium' | 'high';

/** Cortex frontmatter fields (after validation/inference) */
export interface CortexFrontmatter {
  cortex_level: CortexLevel;
  confidence: Confidence;
  domain: string;
  scope: string;
  source_hash?: string;
  embedding_model?: string;
  [key: string]: unknown;
}

/** Result of validating frontmatter against the Cortex schema */
export interface ValidationResult {
  valid: boolean;
  data: CortexFrontmatter;
  warnings: string[];
  errors: string[];
}

/** Defaults inferred from file path and existing metadata */
export interface InferredDefaults {
  cortex_level: CortexLevel;
  confidence: Confidence;
  domain: string;
  scope: string;
}

/** A fully parsed Cortex entry (frontmatter + body + hash + validation) */
export interface ParsedCortexEntry {
  filePath: string;
  frontmatter: Record<string, unknown>;
  content: string;
  sourceHash: string;
  validation: ValidationResult;
}

/**
 * Staleness TTLs in days per knowledge pyramid level.
 * After N days without re-validation, an entry is flagged as stale
 * and deprioritized in search ranking (not deleted).
 */
export const STALENESS_TTLS: Record<CortexLevel, number> = {
  L10: 14,
  L20: 30,
  L30: 60,
  L40: 90,
  L50: 180,
};
