/**
 * Notion webhook handler.
 *
 * Exported as a pure handler function — called by the unified webhook server.
 *
 * On comment.created events:
 *   - Extracts page_id + comment_id
 *   - Creates a one-time scheduled task in the DB
 *   - The task scheduler picks it up and runs the agent in main group context
 */
import crypto from 'crypto';
import https from 'https';
import { IncomingMessage, ServerResponse } from 'http';

import { createTask, getTaskById } from './db.js';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';
import { resolveTargets } from './webhook-router.js';

function notionApiGet(path: string, apiKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.notion.com',
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Notion API parse error: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function extractPlainText(richText: any[]): string {
  if (!Array.isArray(richText)) return '';
  return richText.map((t: any) => t.plain_text ?? '').join('');
}

async function fetchNotionContext(
  pageId: string,
  commentId: string,
): Promise<{ pageTitle: string; commentText: string; agentProp: string }> {
  const envVars = readEnvFile(['NOTION_API_KEY']);
  const apiKey = process.env.NOTION_API_KEY || envVars.NOTION_API_KEY || '';
  if (!apiKey) {
    return { pageTitle: '(unknown)', commentText: '(unknown)', agentProp: '' };
  }

  let pageTitle = '(unknown)';
  let agentProp = '';
  let commentText = '(unknown)';

  try {
    const page = await notionApiGet(`/v1/pages/${pageId}`, apiKey);
    const titleProp = Object.values(page.properties || {}).find(
      (p: any) => p.type === 'title',
    ) as any;
    if (titleProp?.title) pageTitle = extractPlainText(titleProp.title);
    const agent = page.properties?.Agent || page.properties?.agent;
    if (agent?.select?.name) agentProp = agent.select.name;
    else if (agent?.rich_text) agentProp = extractPlainText(agent.rich_text);
  } catch (err) {
    logger.warn({ err, pageId }, 'Failed to fetch Notion page');
  }

  try {
    const comment = await notionApiGet(`/v1/comments/${commentId}`, apiKey);
    if (comment.rich_text) commentText = extractPlainText(comment.rich_text);
  } catch (err) {
    logger.warn({ err, commentId }, 'Failed to fetch Notion comment');
  }

  return { pageTitle, commentText, agentProp };
}

export interface NotionHandlerConfig {
  signingSecret: string;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
}

export function handleNotionWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  rawBody: Buffer,
  config: NotionHandlerConfig,
): void {
  const body = rawBody.toString('utf-8');

  // Parse body first — verification requests must be handled before HMAC check
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    logger.warn('Notion webhook: invalid JSON body');
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  // Handle verification challenge BEFORE signature check
  // Notion sends this when setting up/verifying a webhook subscription
  if (event.verification_token) {
    logger.info(
      { verification_token: event.verification_token },
      'NOTION VERIFICATION TOKEN — paste this into the Notion webhook UI',
    );
    res.writeHead(200);
    res.end('OK');
    return;
  }

  if ((event.type as string) === 'url_verification') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ challenge: event.challenge }));
    return;
  }

  // Verify HMAC signature for all non-verification requests
  if (config.signingSecret) {
    const signature =
      (req.headers['x-notion-signature'] as string | undefined) ?? '';
    if (!signature) {
      logger.warn('Notion webhook: missing x-notion-signature header');
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    // Notion sends: sha256=<hex>
    const sigHex = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;
    const expected = crypto
      .createHmac('sha256', config.signingSecret)
      .update(rawBody)
      .digest('hex');

    let valid = false;
    try {
      valid = crypto.timingSafeEqual(
        Buffer.from(sigHex.padEnd(64, '0'), 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      /* malformed hex — stays invalid */
    }

    if (!valid) {
      logger.warn({ signature }, 'Notion webhook: invalid signature');
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
  }

  const type = (event.type as string | undefined) ?? '';
  logger.debug({ type }, 'Notion webhook event received');

  // Acknowledge immediately — Notion retries on non-2xx
  res.writeHead(200);
  res.end('OK');

  // Process asynchronously so we never block the HTTP response
  handleEvent(event, config).catch((err) =>
    logger.error({ err, type }, 'Notion webhook handler error'),
  );
}

// Notion UUIDs: 32 hex chars, optionally hyphenated
const NOTION_ID_RE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function isNotionId(value: unknown): value is string {
  return typeof value === 'string' && NOTION_ID_RE.test(value);
}

async function handleEvent(
  event: Record<string, unknown>,
  config: NotionHandlerConfig,
): Promise<void> {
  const type = event.type as string;

  if (type === 'comment.created') {
    return handleCommentCreated(event, config);
  }

  // Ignore other event types silently
  return;
}

async function handleCommentCreated(
  event: Record<string, unknown>,
  config: NotionHandlerConfig,
): Promise<void> {
  // Resolve routing targets
  const groups = config.getRegisteredGroups();
  const targets = resolveTargets('notion', groups);
  if (targets.length === 0) {
    logger.warn('Notion webhook: no routing targets available');
    return;
  }

  const entity = event.entity as Record<string, unknown> | undefined;
  const data = event.data as Record<string, unknown> | undefined;

  const rawCommentId: unknown =
    entity?.id ?? (data?.comment as Record<string, unknown> | undefined)?.id;

  const rawPageId: unknown =
    entity?.parent_id ??
    (data as Record<string, unknown> | undefined)?.page_id ??
    (data?.parent as Record<string, unknown> | undefined)?.page_id ??
    (
      (data?.comment as Record<string, unknown> | undefined)?.parent as
        | Record<string, unknown>
        | undefined
    )?.page_id;

  if (!isNotionId(rawPageId)) {
    logger.warn(
      { rawPageId, event },
      'Notion webhook: invalid or missing page_id — rejected',
    );
    return;
  }
  if (!isNotionId(rawCommentId)) {
    logger.warn(
      { rawCommentId, event },
      'Notion webhook: invalid or missing comment_id — rejected',
    );
    return;
  }

  const pageId = rawPageId;
  const commentId = rawCommentId;

  const taskId = `notion-comment-${commentId}`;

  if (getTaskById(taskId)) {
    logger.debug({ taskId }, 'Notion webhook: duplicate event, skipping');
    return;
  }

  const now = new Date().toISOString();
  const context = await fetchNotionContext(pageId, commentId);
  const prompt = buildAgentPrompt(pageId, commentId, context);

  for (const target of targets) {
    const targetTaskId =
      targets.length === 1 ? taskId : `${taskId}@${target.jid}`;
    try {
      createTask({
        id: targetTaskId,
        group_folder: target.group.folder,
        chat_jid: target.jid,
        prompt,
        schedule_type: 'once',
        schedule_value: now,
        context_mode: 'isolated',
        next_run: now,
        status: 'active',
        created_at: now,
      });
      logger.info(
        { pageId, commentId, taskId: targetTaskId, jid: target.jid },
        'Notion webhook: task created for target',
      );
    } catch (err) {
      logger.error(
        { err, taskId: targetTaskId, jid: target.jid },
        'Notion webhook: failed to create task for target',
      );
    }
  }
}

function buildAgentPrompt(
  pageId: string,
  commentId: string,
  context: { pageTitle: string; commentText: string; agentProp: string },
): string {
  const agentTag = context.agentProp ? ` [${context.agentProp}]` : '';

  return `New Notion comment notification. Send a concise summary to the chat — NOT a full analysis.

**${context.pageTitle}**${agentTag}
> ${context.commentText}

Reply with a short formatted message (3-5 lines max):
- Task name (bold) + link hint
- The comment text (quoted)
- One-line context if the Agent property suggests an action area

Do NOT do research. Do NOT write long responses. Do NOT create Notion pages. This is a notification channel — keep it scannable.`;
}
