/**
 * Stdio MCP Server for NanoClaw
 * Standalone process that agent teams subagents can inherit.
 * Reads context from environment variables, writes IPC files for the host.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { CronExpressionParser } from 'cron-parser';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Inline graph loading for search augmentation (container cannot import from host src/cortex/)
// ---------------------------------------------------------------------------

type NeighborEntry = { path: string; type: string; direction: 'outgoing' | 'incoming' };
type GraphIndex = Map<string, NeighborEntry[]>;

function loadGraphIndex(graphPath: string): GraphIndex {
  const idx: GraphIndex = new Map();
  try {
    if (!fs.existsSync(graphPath)) return idx;
    const raw = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    if (!raw?.edges || !Array.isArray(raw.edges)) return idx;
    for (const edge of raw.edges) {
      if (!edge.source || !edge.target || !edge.type) continue;
      if (!idx.has(edge.source)) idx.set(edge.source, []);
      idx.get(edge.source)!.push({ path: edge.target, type: edge.type, direction: 'outgoing' });
      if (!idx.has(edge.target)) idx.set(edge.target, []);
      idx.get(edge.target)!.push({ path: edge.source, type: edge.type, direction: 'incoming' });
    }
  } catch { /* graceful degradation: empty graph */ }
  return idx;
}

// Load graph at MCP server startup -- read-only in container, stale during session (acceptable per Phase 19 design)
const graphIndex = loadGraphIndex('/workspace/cortex/cortex-graph.json');

const IPC_DIR = '/workspace/ipc';
const MESSAGES_DIR = path.join(IPC_DIR, 'messages');
const TASKS_DIR = path.join(IPC_DIR, 'tasks');

// Context from environment variables (set by the agent runner)
const chatJid = process.env.NANOCLAW_CHAT_JID!;
const groupFolder = process.env.NANOCLAW_GROUP_FOLDER!;
const isMain = process.env.NANOCLAW_IS_MAIN === '1';
const assistantName = process.env.NANOCLAW_ASSISTANT_NAME || 'Agent';

function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);

  // Atomic write: temp file then rename
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);

  return filename;
}

const server = new McpServer({
  name: 'nanoclaw',
  version: '1.0.0',
});

server.tool(
  'send_message',
  "Send a message to the user or group immediately while you're still running. Use this for progress updates or to send multiple messages. You can call this multiple times.",
  {
    text: z.string().describe('The message text to send'),
    sender: z
      .string()
      .optional()
      .describe(
        'Your role/identity name (e.g. "Researcher"). When set, messages appear from a dedicated bot in Telegram.',
      ),
    target_jid: z
      .string()
      .optional()
      .describe(
        '(Main group only) Override destination JID — e.g. a Discord channel like dc:1234567890. Defaults to the current group chat.',
      ),
  },
  async (args) => {
    const data: Record<string, string | undefined> = {
      type: 'message',
      chatJid: args.target_jid || chatJid,
      text: args.text,
      sender: args.sender || undefined,
      groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(MESSAGES_DIR, data);

    return { content: [{ type: 'text' as const, text: 'Message sent.' }] };
  },
);

server.tool(
  'report_agent_status',
  `Report task lifecycle status to the #agents Discord channel. Call this to announce task pickup, completion, or progress updates. Use 'took' when starting work, 'closed' when finishing, 'progress' for intermediate updates. DO NOT use for chat messages — use send_message for that.`,
  {
    messageType: z
      .enum(['took', 'closed', 'progress'])
      .describe(
        'Status type: took=started task, closed=completed task, progress=in-flight update',
      ),
    title: z.string().describe('Short task title (80 chars recommended)'),
    taskId: z
      .string()
      .optional()
      .describe('Task ID, e.g. task-1234567890-abc123'),
    description: z
      .string()
      .optional()
      .describe('What is being worked on (progress) or description snippet (took)'),
    prUrl: z.string().optional().describe('PR URL if applicable (for closed type)'),
    summary: z
      .string()
      .optional()
      .describe(
        'What was accomplished (for closed/progress — avoids opaque status messages)',
      ),
  },
  async (args) => {
    const data = {
      type: 'agent_status',
      messageType: args.messageType,
      title: args.title,
      taskId: args.taskId,
      description: args.description,
      prUrl: args.prUrl,
      summary: args.summary,
      agentName: assistantName,
      groupFolder,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(MESSAGES_DIR, data);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Status "${args.messageType}" reported to #agents.`,
        },
      ],
    };
  },
);

server.tool(
  'report_blocker',
  `Report a blocker to the #agents Discord channel. Call this when you hit a permission error, a service/tunnel is unavailable, or you need human input to resolve an ambiguity. The blocker will appear as a red embed in #agents so the user can act on it.`,
  {
    blockerType: z
      .enum(['perm', 'service', 'conflict'])
      .describe(
        'perm=permission/access denied, service=service/tunnel unavailable, conflict=ambiguity needing human input',
      ),
    resource: z
      .string()
      .describe(
        'What is blocked — repo name, API endpoint, service name, or decision needed',
      ),
    description: z
      .string()
      .describe('Error detail or context about the blocker'),
    taskId: z
      .string()
      .optional()
      .describe('Task ID if applicable, e.g. task-1234567890-abc123'),
  },
  async (args) => {
    const data = {
      type: 'agent_blocker',
      blockerType: args.blockerType,
      resource: args.resource,
      description: args.description,
      taskId: args.taskId,
      agentName: assistantName,
      groupFolder,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(MESSAGES_DIR, data);
    return {
      content: [{ type: 'text' as const, text: 'Blocker reported to #agents.' }],
    };
  },
);

server.tool(
  'report_handoff',
  `Report a task handoff to the #agents Discord channel. Call this when you are passing work to another agent. The handoff will appear as a purple embed in #agents so the receiving agent and user have context.`,
  {
    toAgent: z
      .string()
      .describe('Name of the agent receiving the work (e.g. "Alfred", "Friday")'),
    what: z.string().describe('Description of the task being handed off'),
    why: z
      .string()
      .describe('Reason for the handoff — context the receiving agent needs'),
    taskId: z
      .string()
      .optional()
      .describe('Task ID if applicable, e.g. task-1234567890-abc123'),
  },
  async (args) => {
    const data = {
      type: 'agent_handoff',
      toAgent: args.toAgent,
      what: args.what,
      why: args.why,
      taskId: args.taskId,
      agentName: assistantName,
      groupFolder,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(MESSAGES_DIR, data);
    return {
      content: [
        { type: 'text' as const, text: 'Handoff reported to #agents.' },
      ],
    };
  },
);

server.tool(
  'schedule_task',
  `Schedule a recurring or one-time task. The task will run as a full agent with access to all tools. Returns the task ID for future reference. To modify an existing task, use update_task instead.

CONTEXT MODE - Choose based on task type:
• "group": Task runs in the group's conversation context, with access to chat history. Use for tasks that need context about ongoing discussions, user preferences, or recent interactions.
• "isolated": Task runs in a fresh session with no conversation history. Use for independent tasks that don't need prior context. When using isolated mode, include all necessary context in the prompt itself.

If unsure which mode to use, you can ask the user. Examples:
- "Remind me about our discussion" → group (needs conversation context)
- "Check the weather every morning" → isolated (self-contained task)
- "Follow up on my request" → group (needs to know what was requested)
- "Generate a daily report" → isolated (just needs instructions in prompt)

MESSAGING BEHAVIOR - The task agent's output is sent to the user or group. It can also use send_message for immediate delivery, or wrap output in <internal> tags to suppress it. Include guidance in the prompt about whether the agent should:
• Always send a message (e.g., reminders, daily briefings)
• Only send a message when there's something to report (e.g., "notify me if...")
• Never send a message (background maintenance tasks)

SCHEDULE VALUE FORMAT (all times are LOCAL timezone):
• cron: Standard cron expression (e.g., "*/5 * * * *" for every 5 minutes, "0 9 * * *" for daily at 9am LOCAL time)
• interval: Milliseconds between runs (e.g., "300000" for 5 minutes, "3600000" for 1 hour)
• once: Local time WITHOUT "Z" suffix (e.g., "2026-02-01T15:30:00"). Do NOT use UTC/Z suffix.`,
  {
    prompt: z
      .string()
      .describe(
        'What the agent should do when the task runs. For isolated mode, include all necessary context here.',
      ),
    schedule_type: z
      .enum(['cron', 'interval', 'once'])
      .describe(
        'cron=recurring at specific times, interval=recurring every N ms, once=run once at specific time',
      ),
    schedule_value: z
      .string()
      .describe(
        'cron: "*/5 * * * *" | interval: milliseconds like "300000" | once: local timestamp like "2026-02-01T15:30:00" (no Z suffix!)',
      ),
    context_mode: z
      .enum(['group', 'isolated'])
      .default('group')
      .describe(
        'group=runs with chat history and memory, isolated=fresh session (include context in prompt)',
      ),
    target_group_jid: z
      .string()
      .optional()
      .describe(
        '(Main group only) JID of the group to schedule the task for. Defaults to the current group.',
      ),
    script: z
      .string()
      .optional()
      .describe(
        'Optional bash script to run before waking the agent. Script must output JSON on the last line of stdout: { "wakeAgent": boolean, "data"?: any }. If wakeAgent is false, the agent is not called. Test your script with bash -c "..." before scheduling.',
      ),
    silent: z
      .boolean()
      .optional()
      .describe(
        'When true, suppresses progress tracking messages (typing indicator, ⏳ working, ✅ Done in Xs). Use for background maintenance tasks that should be invisible to the user.',
      ),
  },
  async (args) => {
    // Validate schedule_value before writing IPC
    if (args.schedule_type === 'cron') {
      try {
        CronExpressionParser.parse(args.schedule_value);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid cron: "${args.schedule_value}". Use format like "0 9 * * *" (daily 9am) or "*/5 * * * *" (every 5 min).`,
            },
          ],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'interval') {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid interval: "${args.schedule_value}". Must be positive milliseconds (e.g., "300000" for 5 min).`,
            },
          ],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'once') {
      if (
        /[Zz]$/.test(args.schedule_value) ||
        /[+-]\d{2}:\d{2}$/.test(args.schedule_value)
      ) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Timestamp must be local time without timezone suffix. Got "${args.schedule_value}" — use format like "2026-02-01T15:30:00".`,
            },
          ],
          isError: true,
        };
      }
      const date = new Date(args.schedule_value);
      if (isNaN(date.getTime())) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid timestamp: "${args.schedule_value}". Use local time format like "2026-02-01T15:30:00".`,
            },
          ],
          isError: true,
        };
      }
    }

    // Non-main groups can only schedule for themselves
    const targetJid =
      isMain && args.target_group_jid ? args.target_group_jid : chatJid;

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const data = {
      type: 'schedule_task',
      taskId,
      prompt: args.prompt,
      script: args.script || undefined,
      schedule_type: args.schedule_type,
      schedule_value: args.schedule_value,
      context_mode: args.context_mode || 'group',
      silent: args.silent === true ? true : undefined,
      targetJid,
      createdBy: groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${taskId} scheduled: ${args.schedule_type} - ${args.schedule_value}`,
        },
      ],
    };
  },
);

server.tool(
  'list_tasks',
  "List all scheduled tasks. From main: shows all tasks. From other groups: shows only that group's tasks.",
  {},
  async () => {
    const tasksFile = path.join(IPC_DIR, 'current_tasks.json');

    try {
      if (!fs.existsSync(tasksFile)) {
        return {
          content: [
            { type: 'text' as const, text: 'No scheduled tasks found.' },
          ],
        };
      }

      const allTasks = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));

      const tasks = isMain
        ? allTasks
        : allTasks.filter(
            (t: { groupFolder: string }) => t.groupFolder === groupFolder,
          );

      if (tasks.length === 0) {
        return {
          content: [
            { type: 'text' as const, text: 'No scheduled tasks found.' },
          ],
        };
      }

      const formatted = tasks
        .map(
          (t: {
            id: string;
            prompt: string;
            schedule_type: string;
            schedule_value: string;
            status: string;
            next_run: string;
          }) =>
            `- [${t.id}] ${t.prompt.slice(0, 50)}... (${t.schedule_type}: ${t.schedule_value}) - ${t.status}, next: ${t.next_run || 'N/A'}`,
        )
        .join('\n');

      return {
        content: [
          { type: 'text' as const, text: `Scheduled tasks:\n${formatted}` },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error reading tasks: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  'pause_task',
  'Pause a scheduled task. It will not run until resumed.',
  { task_id: z.string().describe('The task ID to pause') },
  async (args) => {
    const data = {
      type: 'pause_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} pause requested.`,
        },
      ],
    };
  },
);

server.tool(
  'resume_task',
  'Resume a paused task.',
  { task_id: z.string().describe('The task ID to resume') },
  async (args) => {
    const data = {
      type: 'resume_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} resume requested.`,
        },
      ],
    };
  },
);

server.tool(
  'cancel_task',
  'Cancel and delete a scheduled task.',
  { task_id: z.string().describe('The task ID to cancel') },
  async (args) => {
    const data = {
      type: 'cancel_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} cancellation requested.`,
        },
      ],
    };
  },
);

server.tool(
  'update_task',
  'Update an existing scheduled task. Only provided fields are changed; omitted fields stay the same.',
  {
    task_id: z.string().describe('The task ID to update'),
    prompt: z.string().optional().describe('New prompt for the task'),
    schedule_type: z
      .enum(['cron', 'interval', 'once'])
      .optional()
      .describe('New schedule type'),
    schedule_value: z
      .string()
      .optional()
      .describe('New schedule value (see schedule_task for format)'),
    script: z
      .string()
      .optional()
      .describe(
        'New script for the task. Set to empty string to remove the script.',
      ),
    silent: z
      .boolean()
      .optional()
      .describe(
        'When true, suppresses progress tracking messages. Set to false to re-enable.',
      ),
  },
  async (args) => {
    // Validate schedule_value if provided
    if (
      args.schedule_type === 'cron' ||
      (!args.schedule_type && args.schedule_value)
    ) {
      if (args.schedule_value) {
        try {
          CronExpressionParser.parse(args.schedule_value);
        } catch {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Invalid cron: "${args.schedule_value}".`,
              },
            ],
            isError: true,
          };
        }
      }
    }
    if (args.schedule_type === 'interval' && args.schedule_value) {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid interval: "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
    }

    const data: Record<string, string | undefined> = {
      type: 'update_task',
      taskId: args.task_id,
      groupFolder,
      isMain: String(isMain),
      timestamp: new Date().toISOString(),
    };
    if (args.prompt !== undefined) data.prompt = args.prompt;
    if (args.script !== undefined) data.script = args.script;
    if (args.schedule_type !== undefined)
      data.schedule_type = args.schedule_type;
    if (args.schedule_value !== undefined)
      data.schedule_value = args.schedule_value;
    if (args.silent !== undefined) data.silent = String(args.silent);

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} update requested.`,
        },
      ],
    };
  },
);

server.tool(
  'register_group',
  `Register a new chat/group so the agent can respond to messages there. Main group only.

Use available_groups.json to find the JID for a group. The folder name must be channel-prefixed: "{channel}_{group-name}" (e.g., "whatsapp_family-chat", "telegram_dev-team", "discord_general"). Use lowercase with hyphens for the group name part.`,
  {
    jid: z
      .string()
      .describe(
        'The chat JID (e.g., "120363336345536173@g.us", "tg:-1001234567890", "dc:1234567890123456")',
      ),
    name: z.string().describe('Display name for the group'),
    folder: z
      .string()
      .describe(
        'Channel-prefixed folder name (e.g., "whatsapp_family-chat", "telegram_dev-team")',
      ),
    trigger: z.string().describe('Trigger word (e.g., "@Andy")'),
    requiresTrigger: z
      .boolean()
      .optional()
      .describe(
        'Whether messages must start with the trigger word. Default: false (respond to all messages). Set to true for busy groups with many participants where you only want the agent to respond when explicitly mentioned.',
      ),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can register new groups.',
          },
        ],
        isError: true,
      };
    }

    const data = {
      type: 'register_group',
      jid: args.jid,
      name: args.name,
      folder: args.folder,
      trigger: args.trigger,
      requiresTrigger: args.requiresTrigger ?? false,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Group "${args.name}" registered. It will start receiving messages immediately.`,
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Cortex MCP Tools — inlined logic (container cannot import from host src/)
// ---------------------------------------------------------------------------

/**
 * Inlined CortexFieldsStrict Zod schema.
 * Copy of src/cortex/schema.ts — do NOT import from host.
 */
const CortexFieldsStrict = z.object({
  cortex_level: z.enum(['L10', 'L20', 'L30', 'L40', 'L50']),
  confidence: z.enum(['low', 'medium', 'high']),
  domain: z.string().min(1),
  scope: z.string().min(1),
});

/** Returns true if query looks like an exact vault path (not natural language). */
function isVaultPath(query: string): boolean {
  return (
    query.endsWith('.md') ||
    query.startsWith('Areas/') ||
    query.startsWith('Calendar/') ||
    query.startsWith('System/')
  );
}

/**
 * Confidence firewall for L20+: check that L(N-10) entries with medium+
 * confidence exist in the same domain before allowing a higher-level write.
 * Returns true (blocked) if none exist. L10 is always allowed.
 */
async function checkConfidenceFirewall(
  level: string,
  domain: string,
  qdrant: QdrantClient,
): Promise<boolean> {
  if (level === 'L10') return false;
  const levelNum = parseInt(level.slice(1), 10);
  const parentLevel = `L${levelNum - 10}`;
  const result = await qdrant.scroll('cortex-entries', {
    filter: {
      must: [
        { key: 'cortex_level', match: { value: parentLevel } },
        { key: 'domain', match: { value: domain } },
        { key: 'confidence', match: { any: ['medium', 'high'] } },
      ],
    },
    limit: 1,
    with_payload: false,
  });
  return result.points.length === 0;
}

// cortex_search — hybrid semantic/vault-path search
server.tool(
  'cortex_search',
  'Search the Cortex knowledge base. For natural language queries, returns semantically ranked entries. For vault paths (ending in .md or starting with Areas/, Calendar/, System/), returns the entry directly.',
  {
    query: z
      .string()
      .describe(
        'Natural language query or exact vault path (e.g. "Areas/Projects/NanoClaw/ipc-design.md")',
      ),
    project: z
      .string()
      .optional()
      .describe('Filter by project name (e.g. "nanoclaw")'),
    cortex_level: z
      .enum(['L10', 'L20', 'L30', 'L40', 'L50'])
      .optional()
      .describe('Filter by knowledge level'),
    domain: z
      .string()
      .optional()
      .describe('Filter by domain (e.g. "architecture", "operations")'),
    limit: z
      .number()
      .optional()
      .describe('Max results to return (1-20, default 5)'),
  },
  async (args) => {
    const vaultRoot = '/workspace/cortex';

    // Hybrid routing: exact vault path → direct file read
    if (isVaultPath(args.query)) {
      const resolved = path.join(vaultRoot, args.query);
      if (!fs.existsSync(resolved)) {
        return {
          content: [{ type: 'text' as const, text: `Not found: ${args.query}` }],
          isError: true,
        };
      }
      const content = fs.readFileSync(resolved, 'utf-8');
      return { content: [{ type: 'text' as const, text: content }] };
    }

    // Semantic search: embed query + search Qdrant
    const qdrantUrl = process.env.QDRANT_URL || 'http://host.docker.internal:6333';
    const qdrant = new QdrantClient({ url: qdrantUrl });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const embedResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: args.query,
    });
    const queryVector: number[] = embedResponse.data[0].embedding;

    const mustConditions: Array<{ key: string; match: { value: string } }> = [];
    if (args.project)
      mustConditions.push({ key: 'project', match: { value: args.project } });
    if (args.cortex_level)
      mustConditions.push({
        key: 'cortex_level',
        match: { value: args.cortex_level },
      });
    if (args.domain)
      mustConditions.push({ key: 'domain', match: { value: args.domain } });

    const limit = Math.min(args.limit ?? 5, 20);
    const results = await qdrant.search('cortex-entries', {
      vector: queryVector,
      limit,
      with_payload: true,
      filter: mustConditions.length > 0 ? { must: mustConditions } : undefined,
    });

    const formatted = results.map((r) => {
      const base: Record<string, unknown> = {
        path: r.payload?.file_path,
        score: r.score,
        level: r.payload?.cortex_level,
        domain: r.payload?.domain,
        project: r.payload?.project,
      };
      const neighbors = graphIndex.get(r.payload?.file_path as string);
      if (neighbors && neighbors.length > 0) {
        base.related = neighbors;
      }
      return base;
    });

    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(formatted, null, 2) },
      ],
    };
  },
);

// cortex_read — read a vault entry by path
server.tool(
  'cortex_read',
  'Read a Cortex entry by its vault path. Returns full content including frontmatter.',
  {
    path: z
      .string()
      .describe(
        'Relative vault path, e.g. "Areas/Projects/NanoClaw/architecture.md"',
      ),
  },
  async (args) => {
    const vaultRoot = '/workspace/cortex';
    const resolved = path.resolve(vaultRoot, args.path);

    // Path traversal guard
    if (!resolved.startsWith(vaultRoot + '/')) {
      return {
        content: [
          { type: 'text' as const, text: 'Error: path traversal not allowed' },
        ],
        isError: true,
      };
    }
    if (!fs.existsSync(resolved)) {
      return {
        content: [{ type: 'text' as const, text: `Not found: ${args.path}` }],
        isError: true,
      };
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    return { content: [{ type: 'text' as const, text: content }] };
  },
);

// cortex_write — create or update a Cortex entry via IPC
server.tool(
  'cortex_write',
  'Create or update a Cortex entry. Content must include valid YAML frontmatter with cortex_level (L10-L50), confidence (low/medium/high), domain, and scope fields.',
  {
    path: z
      .string()
      .describe(
        'Relative vault path, e.g. "Areas/Projects/NanoClaw/new-decision.md"',
      ),
    content: z
      .string()
      .describe('Full markdown content with YAML frontmatter block'),
  },
  async (args) => {
    // Parse and validate frontmatter before sending to host
    const parsed = matter(args.content);
    const validation = CortexFieldsStrict.safeParse(parsed.data);

    if (!validation.success) {
      const errors = validation.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      return {
        content: [
          { type: 'text' as const, text: `Validation failed: ${errors}` },
        ],
        isError: true,
      };
    }

    const { cortex_level, domain } = validation.data;

    // Confidence firewall for L20+
    const levelNum = parseInt(cortex_level.slice(1), 10);
    if (levelNum >= 20) {
      const qdrantUrl =
        process.env.QDRANT_URL || 'http://host.docker.internal:6333';
      const qdrant = new QdrantClient({ url: qdrantUrl });
      const blocked = await checkConfidenceFirewall(cortex_level, domain, qdrant);
      if (blocked) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Firewall: L${levelNum - 10} entries for domain '${domain}' lack medium+ confidence`,
            },
          ],
          isError: true,
        };
      }
    }

    // Write IPC file for host to process
    writeIpcFile(MESSAGES_DIR, {
      type: 'cortex_write',
      path: args.path,
      content: args.content,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Entry queued for write: ${args.path}`,
        },
      ],
    };
  },
);

// cortex_relate — declare a typed relationship between two Cortex entries via IPC
server.tool(
  'cortex_relate',
  'Declare a typed relationship between two Cortex entries. Edge types: BUILT_FROM (implementation from spec), REFERENCES (cites/depends), BLOCKS (prerequisite), CROSS_LINK (related across domains), SUPERSEDES (newer replaces older).',
  {
    source: z
      .string()
      .describe(
        'Source entry vault path (e.g. "Areas/Projects/NanoClaw/ipc-design.md")',
      ),
    target: z.string().describe('Target entry vault path'),
    edge_type: z
      .enum(['BUILT_FROM', 'REFERENCES', 'BLOCKS', 'CROSS_LINK', 'SUPERSEDES'])
      .describe('Relationship type from source to target'),
  },
  async (args) => {
    if (args.source === args.target) {
      return {
        content: [
          { type: 'text' as const, text: 'Error: self-edges not allowed' },
        ],
        isError: true,
      };
    }
    writeIpcFile(MESSAGES_DIR, {
      type: 'cortex_relate',
      source: args.source,
      target: args.target,
      edge_type: args.edge_type,
      groupFolder,
      timestamp: new Date().toISOString(),
    });
    return {
      content: [
        {
          type: 'text' as const,
          text: `Edge declared: ${args.source} --${args.edge_type}--> ${args.target}`,
        },
      ],
    };
  },
);

// Start the stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
