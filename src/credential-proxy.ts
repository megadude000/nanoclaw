/**
 * Credential proxy stub.
 * The original credential proxy was removed; containers now use OneCLI directly.
 * This stub keeps the import in index.ts working without changes.
 */
import http from 'http';

import { logger } from './logger.js';

/** Detect which auth mode to use for containers. Stub returns 'onecli'. */
export function detectAuthMode(): 'onecli' | 'proxy' | 'api-key' {
  return 'onecli';
}

export function startCredentialProxy(
  port: number,
  host: string,
): Promise<http.Server> {
  const server = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end('credential proxy disabled');
  });

  if (!port) {
    logger.info('Credential proxy disabled (port=0)');
    return Promise.resolve(server);
  }

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      logger.info({ port, host }, 'Credential proxy listening');
      resolve(server);
    });
  });
}
