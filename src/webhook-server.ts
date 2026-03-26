/**
 * Unified webhook server — single HTTP server on one port, routes by URL path.
 *
 * Routes:
 *   POST /notion  → Notion webhook handler
 *   POST /github  → GitHub webhook handler
 *   GET  /health  → Health check
 *
 * Listens on WEBHOOK_PORT (default 3456, localhost only).
 * ngrok / Cloudflare Tunnel forwards public HTTPS traffic here.
 */
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { URL } from 'url';

import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';
import { handleNotionWebhook, NotionHandlerConfig } from './notion-webhook.js';
import { handleGitHubWebhook, GitHubHandlerConfig } from './github-webhook.js';
import {
  handleBugReportWebhook,
  BugReportHandlerConfig,
} from './bugreport-webhook.js';

export interface WebhookServerConfig {
  port: number;
  notionSigningSecret: string;
  githubSigningSecret: string;
  githubToken: string;
  githubRepo: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}

export function startWebhookServer(config: WebhookServerConfig): Server {
  const notionConfig: NotionHandlerConfig = {
    signingSecret: config.notionSigningSecret,
    getRegisteredGroups: config.getRegisteredGroups,
  };

  const githubConfig: GitHubHandlerConfig = {
    signingSecret: config.githubSigningSecret,
    githubToken: config.githubToken,
    githubRepo: config.githubRepo,
    getRegisteredGroups: config.getRegisteredGroups,
  };

  const bugReportConfig: BugReportHandlerConfig = {
    githubToken: config.githubToken,
    githubRepo: config.githubRepo,
  };

  const server = createServer((req, res) => {
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`,
    );
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // Health check
    if (req.method === 'GET' && pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          routes: ['/notion', '/github', '/bugreport'],
        }),
      );
      return;
    }

    // CORS preflight for bugreport endpoint
    if (req.method === 'OPTIONS' && pathname === '/bugreport') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // Only POST for webhook endpoints
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    // Collect body
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);

      switch (pathname) {
        case '/notion':
          handleNotionRoute(req, res, rawBody, notionConfig);
          break;
        case '/github':
          handleGitHubRoute(req, res, rawBody, githubConfig);
          break;
        case '/bugreport':
          handleBugReportWebhook(req, res, rawBody, bugReportConfig);
          break;
        default:
          logger.warn({ pathname }, 'Webhook server: unknown path');
          res.writeHead(404);
          res.end('Not Found');
      }
    });

    req.on('error', (err) => {
      logger.error({ err }, 'Webhook server request error');
      try {
        res.writeHead(500);
        res.end();
      } catch {
        /* ignore */
      }
    });
  });

  server.listen(config.port, '127.0.0.1', () => {
    logger.info(
      { port: config.port },
      'Webhook server listening on localhost (routes: /notion, /github, /bugreport, /health)',
    );
  });

  return server;
}

function handleNotionRoute(
  req: IncomingMessage,
  res: ServerResponse,
  rawBody: Buffer,
  config: NotionHandlerConfig,
): void {
  handleNotionWebhook(req, res, rawBody, config);
}

function handleGitHubRoute(
  req: IncomingMessage,
  res: ServerResponse,
  rawBody: Buffer,
  config: GitHubHandlerConfig,
): void {
  handleGitHubWebhook(req, res, rawBody, config);
}
