/**
 * Unit tests for Cortex fs.watch watcher.
 *
 * All external dependencies (fs.watch, embedEntry, readEnvFile, checkQdrantHealth)
 * are mocked so tests run offline without live services.
 *
 * Uses vi.useFakeTimers() to test 10-minute debounce without real waiting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FSWatcher } from 'node:fs';

// ---------------------------------------------------------------------------
// Hoisted mock vars
// ---------------------------------------------------------------------------

const { mockWatchCallback, mockFsWatcherClose, mockFsWatcher } = vi.hoisted(() => {
  let mockWatchCallback: ((event: string, filename: string | null) => void) | null = null;
  const mockFsWatcherClose = vi.fn();
  const mockFsWatcher = {
    close: mockFsWatcherClose,
  } as unknown as FSWatcher;
  return { mockWatchCallback, mockFsWatcherClose, mockFsWatcher };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  watch: vi.fn((dir: string, opts: object, callback: (event: string, filename: string | null) => void) => {
    // Store callback for test access
    (globalThis as Record<string, unknown>).__mockWatchCallback = callback;
    return mockFsWatcher;
  }),
}));

vi.mock('./embedder.js', () => ({
  embedEntry: vi.fn().mockResolvedValue({ status: 'embedded', filePath: '/cortex/test.md' }),
  createOpenAIClient: vi.fn().mockReturnValue({ mock: 'openai' }),
}));

vi.mock('./qdrant-client.js', () => ({
  createQdrantClient: vi.fn().mockReturnValue({ mock: 'qdrant' }),
  checkQdrantHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../env.js', () => ({
  readEnvFile: vi.fn().mockReturnValue({ OPENAI_API_KEY: 'sk-test-key' }),
}));

vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { watch } from 'node:fs';
import { startCortexWatcher, stopCortexWatcher, getInFlightFiles } from './watcher.js';
import { embedEntry } from './embedder.js';
import { checkQdrantHealth } from './qdrant-client.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Helper to simulate fs.watch callback
// ---------------------------------------------------------------------------

function simulateFileChange(event: string, filename: string | null): void {
  const cb = (globalThis as Record<string, unknown>).__mockWatchCallback as
    | ((e: string, f: string | null) => void)
    | undefined;
  if (cb) cb(event, filename);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startCortexWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset global callback
    (globalThis as Record<string, unknown>).__mockWatchCallback = null;
    // Re-setup default mocks
    vi.mocked(readEnvFile).mockReturnValue({ OPENAI_API_KEY: 'sk-test-key' });
    vi.mocked(checkQdrantHealth).mockResolvedValue(true);
    vi.mocked(embedEntry).mockResolvedValue({ status: 'embedded', filePath: '/cortex/test.md' });
  });

  afterEach(() => {
    stopCortexWatcher();
    vi.useRealTimers();
  });

  it('starts fs.watch with recursive:true option', async () => {
    await startCortexWatcher('/home/user/cortex');

    expect(watch).toHaveBeenCalledWith(
      '/home/user/cortex',
      expect.objectContaining({ recursive: true }),
      expect.any(Function),
    );
  });

  it('logs info message on successful start', async () => {
    await startCortexWatcher('/home/user/cortex');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ cortexDir: '/home/user/cortex' }),
      expect.stringContaining('Cortex watcher started'),
    );
  });

  it('does not start watcher when OPENAI_API_KEY is missing', async () => {
    vi.mocked(readEnvFile).mockReturnValue({});

    await startCortexWatcher('/home/user/cortex');

    expect(watch).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('OPENAI_API_KEY'),
    );
  });

  it('does not start watcher when Qdrant health check fails', async () => {
    vi.mocked(checkQdrantHealth).mockResolvedValue(false);

    await startCortexWatcher('/home/user/cortex');

    expect(watch).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Qdrant'),
    );
  });
});

describe('file change filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (globalThis as Record<string, unknown>).__mockWatchCallback = null;
    vi.mocked(readEnvFile).mockReturnValue({ OPENAI_API_KEY: 'sk-test-key' });
    vi.mocked(checkQdrantHealth).mockResolvedValue(true);
    vi.mocked(embedEntry).mockResolvedValue({ status: 'embedded', filePath: '/cortex/test.md' });
  });

  afterEach(() => {
    stopCortexWatcher();
    vi.useRealTimers();
  });

  it('processes .md files when debounce timer fires', async () => {
    await startCortexWatcher('/home/user/cortex');

    simulateFileChange('change', 'Areas/test.md');

    // Fire the debounce timer (10 minutes)
    await vi.runAllTimersAsync();

    expect(embedEntry).toHaveBeenCalledWith(
      '/home/user/cortex/Areas/test.md',
      expect.anything(),
      expect.anything(),
    );
  });

  it('ignores non-.md files', async () => {
    await startCortexWatcher('/home/user/cortex');

    simulateFileChange('change', 'Areas/notes.txt');
    simulateFileChange('change', 'config.json');
    simulateFileChange('change', 'image.png');

    await vi.runAllTimersAsync();

    expect(embedEntry).not.toHaveBeenCalled();
  });

  it('ignores events with null filename', async () => {
    await startCortexWatcher('/home/user/cortex');

    simulateFileChange('change', null);

    await vi.runAllTimersAsync();

    expect(embedEntry).not.toHaveBeenCalled();
  });

  it('collects multiple .md changes and processes them in one batch', async () => {
    await startCortexWatcher('/home/user/cortex');

    simulateFileChange('change', 'file1.md');
    simulateFileChange('change', 'file2.md');
    simulateFileChange('change', 'file3.md');

    await vi.runAllTimersAsync();

    expect(embedEntry).toHaveBeenCalledTimes(3);
  });

  it('deduplicates multiple changes to the same file', async () => {
    await startCortexWatcher('/home/user/cortex');

    simulateFileChange('change', 'file1.md');
    simulateFileChange('change', 'file1.md');
    simulateFileChange('change', 'file1.md');

    await vi.runAllTimersAsync();

    expect(embedEntry).toHaveBeenCalledTimes(1);
  });
});

describe('inFlightFiles self-trigger prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (globalThis as Record<string, unknown>).__mockWatchCallback = null;
    vi.mocked(readEnvFile).mockReturnValue({ OPENAI_API_KEY: 'sk-test-key' });
    vi.mocked(checkQdrantHealth).mockResolvedValue(true);
    vi.mocked(embedEntry).mockResolvedValue({ status: 'embedded', filePath: '/cortex/test.md' });
  });

  afterEach(() => {
    stopCortexWatcher();
    vi.useRealTimers();
  });

  it('ignores files that are currently in the inFlightFiles set', async () => {
    await startCortexWatcher('/home/user/cortex');

    // Simulate file being in-flight (embedder is writing it)
    const inFlight = getInFlightFiles();
    inFlight.add('/home/user/cortex/Areas/active.md');

    simulateFileChange('change', 'Areas/active.md');

    await vi.runAllTimersAsync();

    expect(embedEntry).not.toHaveBeenCalled();
  });

  it('processes a file after it is removed from inFlightFiles', async () => {
    await startCortexWatcher('/home/user/cortex');

    const inFlight = getInFlightFiles();
    // File is no longer in-flight
    inFlight.delete('/home/user/cortex/Areas/done.md');

    simulateFileChange('change', 'Areas/done.md');

    await vi.runAllTimersAsync();

    expect(embedEntry).toHaveBeenCalledWith(
      '/home/user/cortex/Areas/done.md',
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('stopCortexWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (globalThis as Record<string, unknown>).__mockWatchCallback = null;
    vi.mocked(readEnvFile).mockReturnValue({ OPENAI_API_KEY: 'sk-test-key' });
    vi.mocked(checkQdrantHealth).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes the fs watcher on stop', async () => {
    await startCortexWatcher('/home/user/cortex');
    stopCortexWatcher();

    expect(mockFsWatcherClose).toHaveBeenCalled();
  });

  it('cancels the debounce timer so no embedEntry is called after stop', async () => {
    vi.mocked(embedEntry).mockResolvedValue({ status: 'embedded', filePath: '/cortex/test.md' });
    await startCortexWatcher('/home/user/cortex');

    simulateFileChange('change', 'Areas/test.md');

    // Stop before timer fires
    stopCortexWatcher();

    await vi.runAllTimersAsync();

    expect(embedEntry).not.toHaveBeenCalled();
  });

  it('clears inFlightFiles on stop', async () => {
    await startCortexWatcher('/home/user/cortex');

    const inFlight = getInFlightFiles();
    inFlight.add('/home/user/cortex/something.md');

    stopCortexWatcher();

    expect(getInFlightFiles().size).toBe(0);
  });

  it('is safe to call stopCortexWatcher without starting', () => {
    // Should not throw
    expect(() => stopCortexWatcher()).not.toThrow();
  });
});

describe('DEBOUNCE_MS constant', () => {
  it('DEBOUNCE_MS is exported and equals 600000 (10 minutes)', async () => {
    const { DEBOUNCE_MS } = await import('./watcher.js');
    expect(DEBOUNCE_MS).toBe(600000);
  });
});
