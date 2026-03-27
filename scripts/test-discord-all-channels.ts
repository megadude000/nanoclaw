import { Client, GatewayIntentBits, Events, TextChannel } from 'discord.js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const token = envContent.match(/DISCORD_BOT_TOKEN=(.*)/)?.[1]?.trim();

const channelMessages: Record<string, { text?: string; embed?: any }> = {
  main: {
    text: '**#main — General Assistant Channel**\nThis is the primary conversational channel. Messages here go directly to Andy (the NanoClaw agent) without needing a trigger pattern. It mirrors the Telegram main chat — use it for quick questions, commands, and general interaction. Think of it as your command center.',
  },
  agents: {
    embed: {
      title: '#agents — Swarm Agent Output',
      description: 'This channel displays output from Friday and Alfred — the two swarm sub-agents.\n\n**Friday** handles research, analysis, and information gathering.\n**Alfred** handles operational tasks, file management, and execution.\n\nEach agent posts with its own name and avatar via Discord webhooks, so you can tell at a glance who did what.',
      color: 0x7289da,
      fields: [
        { name: 'Friday', value: 'Research & Analysis', inline: true },
        { name: 'Alfred', value: 'Operations & Execution', inline: true },
      ],
    },
  },
  'yw-tasks': {
    embed: {
      title: '#yw-tasks — Notion Task Updates',
      description: 'Receives automated notifications from the Notion webhook whenever a YourWave task is created, updated, or completed.\n\nThe agent responds here in **project management mode** — focused on task context, priorities, deadlines, and project status. Ask about task progress, blockers, or next steps.',
      color: 0x00b894,
      fields: [
        { name: 'Source', value: 'Notion API webhook', inline: true },
        { name: 'Agent Mode', value: 'Project Manager', inline: true },
      ],
    },
  },
  bugs: {
    embed: {
      title: '#bugs — GitHub Issues & Bug Reports',
      description: 'Receives automated notifications when new GitHub Issues are created or bug reports come in.\n\nThe agent responds here in **bug triage mode** — focused on reproduction steps, severity assessment, root cause analysis, and fix suggestions. References the Cortex bug knowledge base for known issues.',
      color: 0xff6b6b,
      fields: [
        { name: 'Source', value: 'GitHub Issues webhook', inline: true },
        { name: 'Agent Mode', value: 'Bug Triage', inline: true },
      ],
    },
  },
  progress: {
    embed: {
      title: '#progress — Build & Progress Tracking',
      description: 'Displays live progress updates from the NanoClaw progress tracker. Messages here are **edited in-place** rather than creating new messages — so you see a single updating status line instead of spam.\n\nUsed for build status, deployment progress, and long-running task tracking.',
      color: 0xfdcb6e,
      fields: [
        { name: 'Update Style', value: 'In-place message editing', inline: true },
        { name: 'Agent Mode', value: 'Read-mostly / Status', inline: true },
      ],
    },
  },
  'dev-alerts': {
    embed: {
      title: '#dev-alerts — CI/CD & Deployment Notifications',
      description: 'Receives automated alerts from the GitHub CI webhook when builds pass, fail, or deployments complete.\n\nThis is your engineering early-warning system — check here for failed builds, test regressions, and deployment confirmations.',
      color: 0xe17055,
      fields: [
        { name: 'Source', value: 'GitHub CI webhook', inline: true },
        { name: 'Agent Mode', value: 'Alert / Notification', inline: true },
      ],
    },
  },
  logs: {
    embed: {
      title: '#logs — System Logs & Container Events',
      description: 'Captures system-level logs, container lifecycle events, and operational telemetry.\n\nMinimal interaction expected — this is primarily a **log sink** for observability. Useful for debugging container issues, tracking agent session starts/stops, and monitoring system health.',
      color: 0x636e72,
      fields: [
        { name: 'Interaction', value: 'Minimal / Read-only', inline: true },
        { name: 'Agent Mode', value: 'System Logs', inline: true },
      ],
    },
  },
  'bot-control': {
    embed: {
      title: '#bot-control — Server Management & Admin',
      description: 'The admin command channel. Use this to manage the Discord server structure — create/rename/delete channels, adjust permissions, and run server management IPC commands.\n\nOnly the **main group** has authorization to execute server management actions. Non-main channels cannot issue these commands.',
      color: 0x2d3436,
      fields: [
        { name: 'Authorization', value: 'Main group only', inline: true },
        { name: 'Agent Mode', value: 'Admin / Server Mgmt', inline: true },
      ],
    },
  },
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready: ${c.user.tag}`);
  const guild = c.guilds.cache.first()!;
  const channels = await guild.channels.fetch();

  for (const [name, content] of Object.entries(channelMessages)) {
    const ch = channels.find(c => c?.name === name);
    if (!ch || !('send' in ch)) {
      console.log(`✗ #${name} — not found or not text channel`);
      continue;
    }
    const textCh = ch as TextChannel;
    try {
      if (content.text) {
        await textCh.send(content.text);
      }
      if (content.embed) {
        await textCh.send({ embeds: [content.embed] });
      }
      console.log(`✓ #${name}`);
    } catch (err) {
      console.log(`✗ #${name} — ${err}`);
    }
  }

  console.log('\nDone!');
  client.destroy();
});

client.login(token);
