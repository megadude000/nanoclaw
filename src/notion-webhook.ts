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
): Promise<{
  pageTitle: string;
  commentText: string;
  agentProp: string;
  isBot: boolean;
}> {
  const envVars = readEnvFile(['NOTION_API_KEY']);
  const apiKey = process.env.NOTION_API_KEY || envVars.NOTION_API_KEY || '';
  if (!apiKey) {
    return {
      pageTitle: '(unknown)',
      commentText: '(unknown)',
      agentProp: '',
      isBot: false,
    };
  }

  let pageTitle = '(unknown)';
  let agentProp = '';
  let commentText = '(unknown)';
  let isBot = false;

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
    // Detect bot-authored comments to prevent infinite loops
    const createdBy = comment.created_by as Record<string, unknown> | undefined;
    if (createdBy?.type === 'bot') isBot = true;
  } catch (err) {
    logger.warn({ err, commentId }, 'Failed to fetch Notion comment');
  }

  return { pageTitle, commentText, agentProp, isBot };
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

  const context = await fetchNotionContext(pageId, commentId);

  // Skip bot-authored comments to prevent infinite webhook loops
  if (context.isBot) {
    logger.debug(
      { commentId, pageId },
      'Notion webhook: skipping bot-authored comment',
    );
    return;
  }

  const now = new Date().toISOString();
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
  const agentTag = context.agentProp ? ` [Agent: ${context.agentProp}]` : '';

  return `You are a context-aware Notion assistant. A new comment was posted on a Notion page. Read the page, understand the comment, and take the most appropriate action.

IMPORTANT: Send ALL messages using mcp__nanoclaw__send_message with sender set to "Alfred". Use ONLY Telegram formatting: single *asterisks* for bold, \`backticks\` for code. No markdown headings.

## Trigger
**Page:** ${context.pageTitle}${agentTag}
**Page ID:** ${pageId}
**Comment:** ${context.commentText}

## Step 1: Understand context
- Use the Notion MCP tools to read the full page content (mcp__notionApi__API-retrieve-a-page with page_id "${pageId}")
- Read the page blocks to get the full body (mcp__notionApi__API-get-block-children with block_id "${pageId}")
- Understand what this page is about (task, spec, bug, idea, meeting note, etc.)

## Step 2: Classify the comment intent
Based on the comment text, determine what's being asked:
- **Question** → Research and reply with an answer as a Notion comment
- **Action request** ("do X", "fix Y", "update Z") → Execute the action, then report back
- **Bug report / issue** → Investigate in the codebase (~/YW_Core), diagnose, suggest or apply fix
- **Review request** → Read the referenced content, provide feedback as a Notion comment
- **Status update / FYI** → Acknowledge briefly, no heavy action needed
- **Code task** → Write or modify code in ~/YW_Core as requested

## Step 3: Act
- For questions/reviews: Reply as a Notion comment on the page (mcp__notionApi__API-create-a-comment with parent.page_id "${pageId}")
- For code tasks: Work in ~/YW_Core, commit with descriptive message, push if confident
- For actions: Execute, then reply as a Notion comment confirming what was done

## Step 4: Report to chat
Send a brief message to the chat summarizing what you did:
- Page name (bold) + what the comment asked
- What action you took (1-2 sentences)
- Result or status

## Rules
- Always read the full page before acting — context matters
- If the Agent property is set, it hints at the domain (e.g., "Frontend", "Backend", "Design")
- For risky changes (deletions, major refactors), describe the plan in a Notion comment first instead of executing
- If unsure what's being asked, reply on Notion asking for clarification
- Keep chat messages short (3-5 lines). Put detailed responses in Notion comments.`;
}
