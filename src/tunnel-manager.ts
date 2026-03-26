import { execFileSync } from 'child_process';
import http from 'http';

import { logger } from './logger.js';

const NGROK_API = 'http://127.0.0.1:4040/api';

interface TunnelInfo {
  name: string;
  public_url: string;
  config: { addr: string };
}

/**
 * Call the ngrok local API (the already-running agent on :4040).
 */
function ngrokApi(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, NGROK_API);
    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Resolve the IP of a running Docker container by name prefix.
 */
function getContainerIp(containerName: string): string | null {
  try {
    const result = execFileSync(
      'docker',
      [
        'inspect',
        '-f',
        '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
        containerName,
      ],
      { encoding: 'utf-8', timeout: 5000 },
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}

function findContainerName(groupFolder: string): string | null {
  try {
    const result = execFileSync(
      'docker',
      [
        'ps',
        '--format',
        '{{.Names}}',
        '--filter',
        `name=nanoclaw-${groupFolder}-`,
      ],
      { encoding: 'utf-8', timeout: 5000 },
    );
    return result.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

export async function startTunnel(
  port: number,
  groupFolder?: string,
): Promise<string | null> {
  // Resolve target: container IP if available, otherwise localhost
  let addr = `localhost:${port}`;
  if (groupFolder) {
    const containerName = findContainerName(groupFolder);
    if (containerName) {
      const ip = getContainerIp(containerName);
      if (ip) {
        addr = `${ip}:${port}`;
        logger.info(
          { containerName, ip, port },
          'Resolved container IP for tunnel',
        );
      }
    }
  }

  try {
    // Check if tunnel already exists for this addr
    const existing = await ngrokApi('GET', '/api/tunnels');
    const match = existing?.tunnels?.find(
      (t: TunnelInfo) => t.config?.addr === addr,
    );
    if (match) {
      logger.info({ port, url: match.public_url }, 'Tunnel already active');
      return match.public_url;
    }

    // Create new tunnel via the running ngrok agent API
    const result = await ngrokApi('POST', '/api/tunnels', {
      name: `nanoclaw-${port}`,
      proto: 'http',
      addr,
    });

    const url = result?.public_url;
    if (url) {
      logger.info({ port, url, addr }, 'Tunnel started via ngrok API');
      return url;
    }

    logger.error({ port, result }, 'ngrok API returned no URL');
    return null;
  } catch (err) {
    logger.error({ err, port, addr }, 'Failed to start tunnel via ngrok API');
    return null;
  }
}

export async function stopTunnel(port: number): Promise<boolean> {
  try {
    await ngrokApi('DELETE', `/api/tunnels/nanoclaw-${port}`);
    logger.info({ port }, 'Tunnel stopped');
    return true;
  } catch (err) {
    logger.warn({ err, port }, 'Failed to stop tunnel');
    return false;
  }
}

export async function listTunnels(): Promise<
  Array<{ port: number; url: string }>
> {
  try {
    const data = await ngrokApi('GET', '/api/tunnels');
    return (data?.tunnels || []).map((t: TunnelInfo) => ({
      port: parseInt(t.config?.addr?.split(':').pop() || '0', 10),
      url: t.public_url,
    }));
  } catch {
    return [];
  }
}

export function stopAllTunnels(): void {
  // Best effort — fire and forget
  listTunnels()
    .then((tunnels) => {
      for (const t of tunnels) {
        if (t.port) stopTunnel(t.port);
      }
    })
    .catch(() => {});
}
