import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmbedBuilder } from 'discord.js';

// --- Mocks ---

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock fs module
const mockReadFileSyncFn = vi.fn();
const mockWriteFileSyncFn = vi.fn();

vi.mock('fs', () => ({
  default: {
    readFileSync: mockReadFileSyncFn,
    writeFileSync: mockWriteFileSyncFn,
  },
  readFileSync: mockReadFileSyncFn,
  writeFileSync: mockWriteFileSyncFn,
}));

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock env.ts
const mockReadEnvFileFn = vi.fn().mockReturnValue({});
vi.mock('./env.js', () => ({
  readEnvFile: mockReadEnvFileFn,
}));

// Mock config.ts DATA_DIR
vi.mock('./config.js', () => ({
  DATA_DIR: '/mock/data',
}));

import { exec } from 'child_process';

const mockExec = vi.mocked(exec);

// Helper: make exec resolve with stdout (active)
// exec callback signature: (err, stdout, stderr)
function mockExecActive() {
  mockExec.mockImplementation(
    (_cmd: unknown, _opts: unknown, callback: unknown) => {
      const cb = (typeof _opts === 'function' ? _opts : callback) as (
        err: null,
        stdout: string,
        stderr: string,
      ) => void;
      cb(null, 'active\n', '');
      return {} as ReturnType<typeof exec>;
    },
  );
}

// Helper: make exec call back with error (non-zero exit — inactive service)
function mockExecInactive() {
  mockExec.mockImplementation(
    (_cmd: unknown, _opts: unknown, callback: unknown) => {
      const cb = (typeof _opts === 'function' ? _opts : callback) as (
        err: Error,
        stdout: string,
        stderr: string,
      ) => void;
      const err = new Error('inactive');
      cb(err, '', 'inactive');
      return {} as ReturnType<typeof exec>;
    },
  );
}

describe('health-monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default: no state file (throws ENOENT)
    mockReadFileSyncFn.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    // Default: env returns no custom services
    mockReadEnvFileFn.mockReturnValue({});
    // Reset process.env
    delete process.env.HEALTH_MONITOR_SERVICES;
    delete process.env.CLOUDFLARE_TUNNEL_NAME;
    delete process.env.HEALTH_CHECK_INTERVAL_MS;
    delete process.env.QDRANT_CONTAINER_NAME;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildServiceConfigs', () => {
    it('defaults to nanoclaw service when no env set', async () => {
      const { buildServiceConfigs } = await import('./health-monitor.js');
      const configs = buildServiceConfigs();
      const nanoclaw = configs.find((c) => c.name === 'nanoclaw');
      expect(nanoclaw).toBeDefined();
      expect(nanoclaw?.command).toContain('systemctl --user is-active');
      expect(nanoclaw?.command).toContain('nanoclaw');
    });

    it('uses custom service list from process.env.HEALTH_MONITOR_SERVICES', async () => {
      process.env.HEALTH_MONITOR_SERVICES = 'nanoclaw,yw-dev';
      const { buildServiceConfigs } = await import('./health-monitor.js');
      const configs = buildServiceConfigs();
      const names = configs.map((c) => c.name);
      expect(names).toContain('nanoclaw');
      expect(names).toContain('yw-dev');
    });

    it('uses --user flag for app services', async () => {
      process.env.HEALTH_MONITOR_SERVICES = 'nanoclaw,yw-dev';
      const { buildServiceConfigs } = await import('./health-monitor.js');
      const configs = buildServiceConfigs();
      for (const c of configs.filter((c) => c.name !== 'cloudflared')) {
        expect(c.command).toContain('--user');
      }
    });

    it('adds cloudflared without --user when CLOUDFLARE_TUNNEL_NAME is set', async () => {
      process.env.CLOUDFLARE_TUNNEL_NAME = 'my-tunnel';
      const { buildServiceConfigs } = await import('./health-monitor.js');
      const configs = buildServiceConfigs();
      const cloudflared = configs.find((c) => c.name === 'cloudflared');
      expect(cloudflared).toBeDefined();
      expect(cloudflared?.command).not.toContain('--user');
      expect(cloudflared?.command).toBe('systemctl is-active cloudflared');
    });

    it('does NOT add cloudflared when CLOUDFLARE_TUNNEL_NAME is not set', async () => {
      const { buildServiceConfigs } = await import('./health-monitor.js');
      const configs = buildServiceConfigs();
      const cloudflared = configs.find((c) => c.name === 'cloudflared');
      expect(cloudflared).toBeUndefined();
    });

    it('always includes cortex service using default container name', async () => {
      const { buildServiceConfigs } = await import('./health-monitor.js');
      const configs = buildServiceConfigs();
      const cortex = configs.find((c) => c.name === 'cortex');
      expect(cortex).toBeDefined();
      expect(cortex?.command).toContain('docker inspect');
      expect(cortex?.command).toContain('nanoclaw-qdrant');
    });

    it('uses QDRANT_CONTAINER_NAME env var for cortex check', async () => {
      process.env.QDRANT_CONTAINER_NAME = 'my-qdrant';
      const { buildServiceConfigs } = await import('./health-monitor.js');
      const configs = buildServiceConfigs();
      const cortex = configs.find((c) => c.name === 'cortex');
      expect(cortex).toBeDefined();
      expect(cortex?.command).toContain('my-qdrant');
    });

    it('skips cortex when QDRANT_CONTAINER_NAME is empty string', async () => {
      process.env.QDRANT_CONTAINER_NAME = '';
      const { buildServiceConfigs } = await import('./health-monitor.js');
      const configs = buildServiceConfigs();
      const cortex = configs.find((c) => c.name === 'cortex');
      expect(cortex).toBeUndefined();
    });
  });

  describe('loadState', () => {
    it('returns all services as unknown when file does not exist', async () => {
      mockReadFileSyncFn.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const { loadState } = await import('./health-monitor.js');
      const state = loadState(['nanoclaw', 'yw-dev']);
      expect(state.get('nanoclaw')).toBe('unknown');
      expect(state.get('yw-dev')).toBe('unknown');
    });

    it('loads state from file and matches service names', async () => {
      mockReadFileSyncFn.mockReturnValue(
        JSON.stringify({ nanoclaw: 'up', 'yw-dev': 'down' }),
      );
      const { loadState } = await import('./health-monitor.js');
      const state = loadState(['nanoclaw', 'yw-dev']);
      expect(state.get('nanoclaw')).toBe('up');
      expect(state.get('yw-dev')).toBe('down');
    });

    it('restores only keys matching current service list', async () => {
      mockReadFileSyncFn.mockReturnValue(
        JSON.stringify({ nanoclaw: 'up', 'old-service': 'down' }),
      );
      const { loadState } = await import('./health-monitor.js');
      const state = loadState(['nanoclaw']);
      expect(state.get('nanoclaw')).toBe('up');
      expect(state.has('old-service')).toBe(false);
    });

    it('returns unknown for all on parse error', async () => {
      mockReadFileSyncFn.mockReturnValue('not-valid-json');
      const { loadState } = await import('./health-monitor.js');
      const state = loadState(['nanoclaw']);
      expect(state.get('nanoclaw')).toBe('unknown');
    });
  });

  describe('saveState', () => {
    it('writes JSON to health-state.json', async () => {
      const { saveState } = await import('./health-monitor.js');
      const stateMap = new Map([['nanoclaw', 'up' as const]]);
      saveState(stateMap);
      expect(mockWriteFileSyncFn).toHaveBeenCalledWith(
        expect.stringContaining('health-state.json'),
        expect.stringContaining('nanoclaw'),
      );
    });

    it('does not throw on write error', async () => {
      mockWriteFileSyncFn.mockImplementation(() => {
        throw new Error('EPERM');
      });
      const { saveState } = await import('./health-monitor.js');
      const stateMap = new Map([['nanoclaw', 'up' as const]]);
      expect(() => saveState(stateMap)).not.toThrow();
    });
  });

  describe('runHealthCheck state transitions', () => {
    it('posts DOWN embed when service transitions from unknown to down', async () => {
      mockExecInactive();
      const { runHealthCheck } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'unknown'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHealthCheck(services, stateMap, sendEmbed);

      expect(sendEmbed).toHaveBeenCalledOnce();
      const embed = sendEmbed.mock.calls[0][0];
      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.color).toBe(0xed4245);
    });

    it('does NOT post embed for unknown to up transition (startup spam prevention)', async () => {
      mockExecActive();
      const { runHealthCheck } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'unknown'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHealthCheck(services, stateMap, sendEmbed);

      expect(sendEmbed).not.toHaveBeenCalled();
    });

    it('posts DOWN embed when service transitions from up to down', async () => {
      mockExecInactive();
      const { runHealthCheck } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'up'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHealthCheck(services, stateMap, sendEmbed);

      expect(sendEmbed).toHaveBeenCalledOnce();
      const embed = sendEmbed.mock.calls[0][0];
      expect(embed.data.color).toBe(0xed4245);
    });

    it('posts UP embed when service transitions from down to up', async () => {
      mockExecActive();
      const { runHealthCheck } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'down'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHealthCheck(services, stateMap, sendEmbed);

      expect(sendEmbed).toHaveBeenCalledOnce();
      const embed = sendEmbed.mock.calls[0][0];
      expect(embed.data.color).toBe(0x57f287);
    });

    it('does NOT post embed when up service stays up', async () => {
      mockExecActive();
      const { runHealthCheck } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'up'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHealthCheck(services, stateMap, sendEmbed);

      expect(sendEmbed).not.toHaveBeenCalled();
    });

    it('saves state after a transition occurs', async () => {
      mockExecInactive();
      const { runHealthCheck } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'up'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHealthCheck(services, stateMap, sendEmbed);

      expect(mockWriteFileSyncFn).toHaveBeenCalled();
    });
  });

  describe('runHeartbeat', () => {
    it('posts heartbeat embed when all services are up', async () => {
      const { runHeartbeat } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'up'],
        ['yw-dev', 'up'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
        { name: 'yw-dev', command: 'systemctl --user is-active yw-dev' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHeartbeat(stateMap, services, sendEmbed);

      expect(sendEmbed).toHaveBeenCalledOnce();
      const embed = sendEmbed.mock.calls[0][0];
      expect(embed.data.color).toBe(0x95a5a6);
    });

    it('does NOT post heartbeat when any service is down', async () => {
      const { runHeartbeat } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'up'],
        ['yw-dev', 'down'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
        { name: 'yw-dev', command: 'systemctl --user is-active yw-dev' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHeartbeat(stateMap, services, sendEmbed);

      expect(sendEmbed).not.toHaveBeenCalled();
    });

    it('does NOT post heartbeat when any service is unknown', async () => {
      const { runHeartbeat } = await import('./health-monitor.js');
      const stateMap = new Map<string, 'up' | 'down' | 'unknown'>([
        ['nanoclaw', 'unknown'],
      ]);
      const services = [
        { name: 'nanoclaw', command: 'systemctl --user is-active nanoclaw' },
      ];
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      await runHeartbeat(stateMap, services, sendEmbed);

      expect(sendEmbed).not.toHaveBeenCalled();
    });
  });

  describe('startHealthMonitor', () => {
    it('returns a cleanup function', async () => {
      mockExecActive();
      const { startHealthMonitor } = await import('./health-monitor.js');
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      const cleanup = startHealthMonitor(sendEmbed);

      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('starts with 10 second initial delay before first poll', async () => {
      mockExecActive();
      const { startHealthMonitor } = await import('./health-monitor.js');
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      const cleanup = startHealthMonitor(sendEmbed);

      // No exec before 10 seconds
      expect(mockExec).not.toHaveBeenCalled();

      // Advance 10 seconds — first poll fires
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockExec).toHaveBeenCalled();

      cleanup();
    });

    it('cleanup clears all timers so no more exec calls', async () => {
      mockExecActive();
      const { startHealthMonitor } = await import('./health-monitor.js');
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      const cleanup = startHealthMonitor(sendEmbed);
      // Advance past first poll
      await vi.advanceTimersByTimeAsync(10000);
      cleanup();

      // After cleanup, advancing time should not trigger more exec calls
      mockExec.mockClear();
      await vi.advanceTimersByTimeAsync(120000);
      expect(mockExec).not.toHaveBeenCalled();
    });
  });

  describe('exec timeout', () => {
    it('sets 5000ms timeout option on exec calls', async () => {
      mockExecActive();
      const { startHealthMonitor } = await import('./health-monitor.js');
      const sendEmbed = vi.fn().mockResolvedValue(undefined);

      const cleanup = startHealthMonitor(sendEmbed);
      await vi.advanceTimersByTimeAsync(10000);

      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );

      cleanup();
    });
  });
});
