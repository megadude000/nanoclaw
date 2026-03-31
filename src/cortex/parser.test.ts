import { describe, it, expect, afterEach } from 'vitest';
import { parseCortexEntry } from './parser.js';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempFiles: string[] = [];

function createTempFile(name: string, content: string): string {
  const filePath = join(tmpdir(), `cortex-test-${name}-${Date.now()}.md`);
  writeFileSync(filePath, content, 'utf-8');
  tempFiles.push(filePath);
  return filePath;
}

afterEach(() => {
  for (const f of tempFiles) {
    if (existsSync(f)) unlinkSync(f);
  }
  tempFiles.length = 0;
});

describe('Cortex Parser', () => {
  it('source_hash excludes frontmatter: same body different frontmatter -> same hash', () => {
    const body = '# Hello World\n\nSome meaningful content here.';
    const fileA = createTempFile('hash-a', `---\ntitle: A\n---\n${body}`);
    const fileB = createTempFile(
      'hash-b',
      `---\ntitle: B\nstatus: active\n---\n${body}`,
    );

    const a = parseCortexEntry(fileA, 'permissive');
    const b = parseCortexEntry(fileB, 'permissive');

    expect(a.sourceHash).toBe(b.sourceHash);
  });

  it('source_hash changes with body: same frontmatter different body -> different hash', () => {
    const frontmatter = '---\ntitle: Same\n---\n';
    const fileA = createTempFile('body-a', frontmatter + '# Content A');
    const fileB = createTempFile('body-b', frontmatter + '# Content B');

    const a = parseCortexEntry(fileA, 'permissive');
    const b = parseCortexEntry(fileB, 'permissive');

    expect(a.sourceHash).not.toBe(b.sourceHash);
  });

  it('handles file with no frontmatter: permissive mode infers defaults', () => {
    const filePath = createTempFile('no-fm', '# Hello\n\nSome content');
    const result = parseCortexEntry(filePath, 'permissive');

    expect(result.validation.valid).toBe(true);
    expect(result.frontmatter).toEqual({});
    expect(result.content).toContain('# Hello');
    expect(result.sourceHash).toBeTruthy();
    expect(result.validation.warnings.length).toBeGreaterThan(0);
  });

  it('parses real vault file in permissive mode', () => {
    // Use absolute path to the real vault file in the main repo
    const vaultFile =
      '/home/andrii-panasenko/nanoclaw/cortex/Areas/Projects/YourWave/YourWave.md';
    if (!existsSync(vaultFile)) {
      // Skip if running in CI or different machine
      return;
    }

    const result = parseCortexEntry(vaultFile, 'permissive');
    expect(result.validation.valid).toBe(true);
    expect(result.frontmatter.project).toBe('YourWave');
    expect(result.sourceHash).toBeTruthy();
    expect(result.content).toContain('YourWave');
  });

  it('strict mode fails on real vault file missing cortex fields', () => {
    const vaultFile =
      '/home/andrii-panasenko/nanoclaw/cortex/Areas/Projects/YourWave/YourWave.md';
    if (!existsSync(vaultFile)) {
      return;
    }

    const result = parseCortexEntry(vaultFile, 'strict');
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
  });
});
