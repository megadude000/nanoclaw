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
import { IncomingMessage, ServerResponse } from 'http';

import { createTask, getTaskById } from './db.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';
import { resolveTargets } from './webhook-router.js';

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
  const prompt = buildAgentPrompt(pageId, commentId);

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

function buildAgentPrompt(pageId: string, commentId: string): string {
  return `You are a Notion task agent for **YourWave** — a specialty coffee startup in Prague, Czech Republic.

Context:
- YourWave = Coffee Discovery Experience. DTC e-shop + subscription + bundle builder.
- Phase 1: contract roasting (no own roaster yet). Solo founder, budget €5–15k.
- Products: Wave Origins (single origins), Morning Wave (blend), Explorer Wave (discovery box), Limited Wave (micro-lots), Guest Wave (curated).
- Market: Czech Republic, English-first, targeting Coffee Explorers psychographic.
- Tech: Astro + React + Tailwind + shadcn/ui (Coffee Atlas site), Shopify (e-shop).
- Content Factory ("Завод"): Claude-orchestrated content pipeline, Notion approval workflow.

A new comment was posted on a Notion task page. Take action now.

Page ID: ${pageId}
Comment ID: ${commentId}

## Steps

1. **Fetch the page** using mcp__notionApi__API-retrieve-a-page with page_id="${pageId}"
   - Record the task Name (title) and the **Agent** property value

2. **Fetch the comment** using mcp__notionApi__API-retrieve-a-comment with comment_id="${commentId}"
   - Extract plain text from the rich_text array

3. **Adopt the agent persona** based on the Agent property and act on the comment:
   - **Strategist** — synthesize, structure, create executive summaries, business planning
   - **Market Analyst** — use WebSearch + WebFetch to research CZ coffee market, competitors, trends
   - **Product Designer** — define coffee product specs, pricing tiers, packaging, bundle configs
   - **Ops Expert** — map workflows for roasting, packing, shipping, HACCP, supplier coordination
   - **Finance Planner** — build unit economics, projections, cost models for coffee business
   - **Marketing Expert** — research channels, content strategy, Instagram growth, community building
   - **Content Creator** — write Coffee Atlas articles, social captions, email copy
   - **Tech Lead** — plan features for Coffee Atlas site, Shopify setup, integrations

4. **Act on the comment** — choose the most appropriate response:
   - Create child sub-pages under this task (for research or writing deliverables)
   - Append structured content to the page body
   - Post a reply comment with results, a structured answer, or clarifying questions

5. **Update "Last Comment At"** — patch the page's "Last Comment At" date property to today

Be substantive. Do real research when needed. Deliver concrete content, not placeholders.
Always consider the Czech market context (suppliers, regulations, SZPI, S.R.O., VAT 12%).`;
}
