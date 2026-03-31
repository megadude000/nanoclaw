/**
 * Health monitor core module.
 *
 * Polls systemctl for service status, detects state transitions, posts
 * Discord embeds, and persists state to disk for crash recovery.
 *
 * Entry point: startHealthMonitor(sendEmbed) — returns a cleanup function.
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

import type { EmbedBuilder } from 'discord.js';

import { DATA_DIR } from './config.js';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';
import {
  buildDownEmbed,
  buildUpEmbed,
  buildHeartbeatEmbed,
} from './health-monitor-embeds.js';

// --- Types ---

type ServiceState = 'up' | 'down' | 'unknown';
type SendEmbedFn = (embed: EmbedBuilder) => Promise<void>;

export interface ServiceConfig {
  name: string;
  command: string;
}

// --- Helpers ---

/**
 * Wraps child_process.exec in a Promise with a configurable timeout.
 */
export function execAsync(
  cmd: string,
  timeoutMs = 5000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        // Attach stdout/stderr to the error for inspection
        const enriched = Object.assign(err, {
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
        reject(enriched);
      } else {
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '' });
      }
    });
  });
}

/**
 * Load persisted service states from data/health-state.json.
 * Returns a Map with all current services; unknown for any missing/invalid.
 */
export function loadState(services: string[]): Map<string, ServiceState> {
  const stateFile = path.join(DATA_DIR, 'health-state.json');
  const result = new Map<string, ServiceState>();

  // Initialize all services as unknown
  for (const s of services) {
    result.set(s, 'unknown');
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [key, value] of Object.entries(parsed)) {
      // Only restore keys that are in the current service list
      if (
        result.has(key) &&
        (value === 'up' || value === 'down' || value === 'unknown')
      ) {
        result.set(key, value as ServiceState);
      }
    }
  } catch {
    // File missing or parse error — stick with 'unknown' for all
  }

  return result;
}

/**
 * Persist current service states to data/health-state.json.
 */
export function saveState(stateMap: Map<string, ServiceState>): void {
  const stateFile = path.join(DATA_DIR, 'health-state.json');
  try {
    fs.writeFileSync(
      stateFile,
      JSON.stringify(Object.fromEntries(stateMap), null, 2),
    );
  } catch (err) {
    logger.error({ err }, 'Failed to save health state to disk');
  }
}

/**
 * Build the list of services to monitor from environment variables.
 *
 * - HEALTH_MONITOR_SERVICES: comma-separated list (default: 'nanoclaw')
 * - CLOUDFLARE_TUNNEL_NAME: if set, adds 'cloudflared' with system-level check
 *
 * systemctl scope:
 * - App services (nanoclaw, yw-dev, etc.): systemctl --user is-active {service}
 * - cloudflared: systemctl is-active cloudflared (system daemon, no --user)
 */
export function buildServiceConfigs(): ServiceConfig[] {
  const envValues = readEnvFile([
    'HEALTH_MONITOR_SERVICES',
    'CLOUDFLARE_TUNNEL_NAME',
    'QDRANT_CONTAINER_NAME',
  ]);

  const servicesEnv =
    process.env.HEALTH_MONITOR_SERVICES ??
    envValues.HEALTH_MONITOR_SERVICES ??
    'nanoclaw';

  const cloudfareTunnelName =
    process.env.CLOUDFLARE_TUNNEL_NAME ?? envValues.CLOUDFLARE_TUNNEL_NAME;

  const serviceNames = servicesEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const configs: ServiceConfig[] = serviceNames.map((name) => ({
    name,
    command: `systemctl --user is-active ${name}`,
  }));

  // Cloudflare tunnel: system-level service, no --user flag
  if (cloudfareTunnelName) {
    configs.push({
      name: 'cloudflared',
      command: 'systemctl is-active cloudflared',
    });
  }

  // Cortex (Qdrant): check via docker inspect
  const qdrantContainer =
    process.env.QDRANT_CONTAINER_NAME ??
    envValues.QDRANT_CONTAINER_NAME ??
    'nanoclaw-qdrant';

  if (qdrantContainer) {
    configs.push({
      name: 'cortex',
      command: `docker inspect --format='{{if .State.Running}}active{{end}}' ${qdrantContainer}`,
    });
  }

  return configs;
}

/**
 * Check a single service's current state by running its systemctl command.
 */
async function checkService(
  svc: ServiceConfig,
): Promise<{ state: ServiceState; stderr: string }> {
  try {
    const { stdout } = await execAsync(svc.command);
    return { state: stdout.trim() === 'active' ? 'up' : 'down', stderr: '' };
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? '';
    return { state: 'down', stderr };
  }
}

/**
 * Run one health check cycle across all services.
 * Posts embeds for state transitions. Suppresses unknown->up (startup spam).
 */
export async function runHealthCheck(
  services: ServiceConfig[],
  stateMap: Map<string, ServiceState>,
  sendEmbed: SendEmbedFn,
): Promise<void> {
  let changed = false;

  for (const svc of services) {
    const previous = stateMap.get(svc.name) ?? 'unknown';
    const { state: current, stderr } = await checkService(svc);

    if (current === previous) continue;

    // State transition detected
    logger.info(
      { service: svc.name, from: previous, to: current },
      'Health state transition',
    );

    stateMap.set(svc.name, current);
    changed = true;

    if (current === 'down' && (previous === 'up' || previous === 'unknown')) {
      // Service went down — post alert
      sendEmbed(buildDownEmbed(svc.name, stderr || undefined)).catch((err) =>
        logger.error({ err, service: svc.name }, 'Failed to send down embed'),
      );
    } else if (current === 'up' && previous === 'down') {
      // Service recovered — post recovery
      sendEmbed(buildUpEmbed(svc.name)).catch((err) =>
        logger.error({ err, service: svc.name }, 'Failed to send up embed'),
      );
    }
    // unknown -> up: suppress (startup spam prevention)
  }

  if (changed) {
    saveState(stateMap);
  }
}

/**
 * Post a heartbeat embed only when ALL services are up.
 */
export async function runHeartbeat(
  stateMap: Map<string, ServiceState>,
  services: ServiceConfig[],
  sendEmbed: SendEmbedFn,
): Promise<void> {
  const allUp = services.every((s) => stateMap.get(s.name) === 'up');
  if (!allUp) return;

  const serviceNames = services.map((s) => s.name);
  sendEmbed(buildHeartbeatEmbed(serviceNames)).catch((err) =>
    logger.error({ err }, 'Failed to send heartbeat embed'),
  );
}

/**
 * Start the health monitor polling loop.
 *
 * - First poll after 10 seconds (startup delay)
 * - Subsequent polls every HEALTH_CHECK_INTERVAL_MS (default: 60000ms)
 * - Heartbeat every 30 minutes when all services are up
 *
 * Returns a cleanup function to stop all timers.
 */
export function startHealthMonitor(sendEmbed: SendEmbedFn): () => void {
  const services = buildServiceConfigs();

  if (services.length === 0) {
    logger.warn('Health monitor: no services configured, monitoring disabled');
    return () => {};
  }

  const stateMap = loadState(services.map((s) => s.name));

  const envValues = readEnvFile(['HEALTH_CHECK_INTERVAL_MS']);
  const checkIntervalMs = parseInt(
    process.env.HEALTH_CHECK_INTERVAL_MS ??
      envValues.HEALTH_CHECK_INTERVAL_MS ??
      '60000',
    10,
  );
  const heartbeatIntervalMs = 1800000; // 30 minutes

  logger.info(
    { services: services.map((s) => s.name), checkIntervalMs },
    'Health monitor started',
  );

  // First poll after 10s startup delay
  const firstPollTimeout = setTimeout(() => {
    runHealthCheck(services, stateMap, sendEmbed).catch((err) =>
      logger.error({ err }, 'Health check error'),
    );
  }, 10000);

  // Recurring poll interval
  const checkInterval = setInterval(() => {
    runHealthCheck(services, stateMap, sendEmbed).catch((err) =>
      logger.error({ err }, 'Health check error'),
    );
  }, checkIntervalMs);

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    runHeartbeat(stateMap, services, sendEmbed).catch((err) =>
      logger.error({ err }, 'Heartbeat error'),
    );
  }, heartbeatIntervalMs);

  return () => {
    clearTimeout(firstPollTimeout);
    clearInterval(checkInterval);
    clearInterval(heartbeatInterval);
  };
}
