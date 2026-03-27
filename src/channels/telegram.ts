import fs from 'fs';
import https from 'https';
import path from 'path';

import { Api, Bot } from 'grammy';

import { GROUPS_DIR } from '../config.js';
import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { transcribeAudio } from '../transcription.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

function downloadToFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (res) => {
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

export interface TelegramChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  onCriticalCommand?: (chatJid: string, command: string) => void;
}

/**
 * Send a message with Telegram Markdown parse mode, falling back to plain text.
 * Claude's output naturally matches Telegram's Markdown v1 format:
 *   *bold*, _italic_, `code`, ```code blocks```, [links](url)
 */
async function sendTelegramMessage(
  api: { sendMessage: Api['sendMessage'] },
  chatId: string | number,
  text: string,
  options: { message_thread_id?: number } = {},
): Promise<void> {
  try {
    await api.sendMessage(chatId, text, {
      ...options,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    // Fallback: send as plain text if Markdown parsing fails
    logger.debug({ err }, 'Markdown send failed, falling back to plain text');
    await api.sendMessage(chatId, text, options);
  }
}

// Bot pool for agent teams: send-only Api instances (no polling)
const poolApis: Api[] = [];
// Maps "{groupFolder}:{senderName}" → pool Api index for stable assignment
const senderBotMap = new Map<string, number>();
let nextPoolIndex = 0;

/**
 * Initialize send-only Api instances for the bot pool.
 * Each pool bot can send messages but doesn't poll for updates.
 */
export async function initBotPool(tokens: string[]): Promise<void> {
  for (const token of tokens) {
    try {
      const api = new Api(token);
      const me = await api.getMe();
      poolApis.push(api);
      logger.info(
        { username: me.username, id: me.id, poolSize: poolApis.length },
        'Pool bot initialized',
      );
    } catch (err) {
      logger.error({ err }, 'Failed to initialize pool bot');
    }
  }
  if (poolApis.length > 0) {
    logger.info({ count: poolApis.length }, 'Telegram bot pool ready');
  }
}

/**
 * Send a message via a pool bot assigned to the given sender name.
 * Assigns bots round-robin on first use; subsequent messages from the
 * same sender in the same group always use the same bot.
 * On first assignment, renames the bot to match the sender's role.
 */
export async function sendPoolMessage(
  chatId: string,
  text: string,
  sender: string,
  groupFolder: string,
): Promise<void> {
  if (poolApis.length === 0) {
    logger.warn({ chatId, sender }, 'No pool bots available, falling back');
    return;
  }

  const key = `${groupFolder}:${sender}`;
  let idx = senderBotMap.get(key);
  if (idx === undefined) {
    idx = nextPoolIndex % poolApis.length;
    nextPoolIndex++;
    senderBotMap.set(key, idx);
    try {
      await poolApis[idx].setMyName(sender);
      await new Promise((r) => setTimeout(r, 2000));
      logger.info(
        { sender, groupFolder, poolIndex: idx },
        'Assigned and renamed pool bot',
      );
    } catch (err) {
      logger.warn(
        { sender, err },
        'Failed to rename pool bot (sending anyway)',
      );
    }
  }

  const api = poolApis[idx];
  try {
    const numericId = chatId.replace(/^tg:/, '');
    const MAX_LENGTH = 4096;
    if (text.length <= MAX_LENGTH) {
      await api.sendMessage(numericId, text);
    } else {
      for (let i = 0; i < text.length; i += MAX_LENGTH) {
        await api.sendMessage(numericId, text.slice(i, i + MAX_LENGTH));
      }
    }
    logger.info(
      { chatId, sender, poolIndex: idx, length: text.length },
      'Pool message sent',
    );
  } catch (err) {
    logger.error({ chatId, sender, err }, 'Failed to send pool message');
  }
}

export class TelegramChannel implements Channel {
  name = 'telegram';

  private bot: Bot | null = null;
  private opts: TelegramChannelOpts;
  private botToken: string;

  constructor(botToken: string, opts: TelegramChannelOpts) {
    this.botToken = botToken;
    this.opts = opts;
  }

  async connect(): Promise<void> {
    this.bot = new Bot(this.botToken, {
      client: {
        baseFetchConfig: { agent: https.globalAgent, compress: true },
      },
    });

    // Command to get chat ID (useful for registration)
    this.bot.command('chatid', (ctx) => {
      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type;
      const chatName =
        chatType === 'private'
          ? ctx.from?.first_name || 'Private'
          : (ctx.chat as any).title || 'Unknown';

      ctx.reply(
        `Chat ID: \`tg:${chatId}\`\nName: ${chatName}\nType: ${chatType}`,
        { parse_mode: 'Markdown' },
      );
    });

    // Command to check bot status
    this.bot.command('ping', (ctx) => {
      ctx.reply(`${ASSISTANT_NAME} is online.`);
    });

    // Command to reboot the host machine (main group only)
    this.bot.command('reboot', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group?.isMain) {
        ctx.reply('Reboot is only available in the main group.');
        return;
      }
      await ctx.reply('Rebooting...');
      const { execFile } = await import('child_process');
      execFile('sudo', ['/sbin/reboot'], (err) => {
        if (err) logger.error({ err }, 'Reboot failed');
      });
    });

    // Restart NanoClaw (systemd will restart it)
    this.bot.command('restart', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group?.isMain) return;
      await ctx.reply('🔄 Restarting NanoClaw...');
      setTimeout(() => process.exit(0), 1000);
    });

    // Kill active container
    this.bot.command('kill', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group?.isMain) return;
      this.opts.onCriticalCommand?.(chatJid, 'kill');
      await ctx.reply('💀 Killing active container...');
    });

    // Stop active container
    this.bot.command('stop', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group?.isMain) return;
      this.opts.onCriticalCommand?.(chatJid, 'stop');
      await ctx.reply('🛑 Stopping container...');
    });

    // Spin up YourWave atlas (build + serve)
    this.bot.command('spin_yw', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group?.isMain) return;
      await ctx.reply('🚀 Building & spinning up YourWave...');
      const { exec } = await import('child_process');
      const { writeFileSync } = await import('fs');
      const ywDir = '/home/andrii-panasenko/YW_Core';
      const node22Bin =
        '/home/andrii-panasenko/.local/share/fnm/node-versions/v22.22.1/installation/bin';
      const script = '/tmp/spin_yw.sh';
      writeFileSync(
        script,
        `#!/bin/sh
export PATH="${node22Bin}:$PATH"
cd ${ywDir} || exit 1
npm run build || exit 1
pkill -f 'serve.*dist.*4321' 2>/dev/null || true; fuser -k 4321/tcp 2>/dev/null || true
pkill -f 'storybook.*6006' 2>/dev/null || true; fuser -k 6006/tcp 2>/dev/null || true
setsid nohup npx serve dist -l 4321 > /tmp/astro-serve.log 2>&1 &
disown
CI=true setsid nohup npx storybook dev -p 6006 --no-open > /tmp/storybook.log 2>&1 &
disown
`,
        { mode: 0o755 },
      );
      exec(script, { maxBuffer: 10 * 1024 * 1024 }, (err) => {
        if (err) {
          ctx.reply(`❌ Error: ${err.message}`);
          logger.error({ err }, 'spin_yw failed');
        } else {
          ctx.reply(
            '✅ YourWave live:\n• dev.yourwave.uk (atlas)\n• storybook.yourwave.uk (storybook)',
          );
        }
      });
    });

    // Set bot menu commands
    this.bot.api
      .setMyCommands([
        { command: 'ping', description: 'Check bot status' },
        { command: 'restart', description: 'Restart NanoClaw' },
        { command: 'kill', description: 'Kill active container' },
        { command: 'stop', description: 'Stop active container' },
        { command: 'spin_yw', description: 'Build & serve YourWave atlas' },
        { command: 'reboot', description: 'Reboot host machine' },
        { command: 'chatid', description: 'Show chat ID' },
      ])
      .catch((err) => logger.warn({ err }, 'Failed to set bot commands'));

    this.bot.on('message:text', async (ctx) => {
      // Skip commands
      if (ctx.message.text.startsWith('/')) return;

      const chatJid = `tg:${ctx.chat.id}`;
      let content = ctx.message.text;
      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id.toString() ||
        'Unknown';
      const sender = ctx.from?.id.toString() || '';
      const msgId = ctx.message.message_id.toString();

      // Determine chat name
      const chatName =
        ctx.chat.type === 'private'
          ? senderName
          : (ctx.chat as any).title || chatJid;

      // Translate Telegram @bot_username mentions into TRIGGER_PATTERN format.
      // Telegram @mentions (e.g., @andy_ai_bot) won't match TRIGGER_PATTERN
      // (e.g., ^@Andy\b), so we prepend the trigger when the bot is @mentioned.
      const botUsername = ctx.me?.username?.toLowerCase();
      if (botUsername) {
        const entities = ctx.message.entities || [];
        const isBotMentioned = entities.some((entity) => {
          if (entity.type === 'mention') {
            const mentionText = content
              .substring(entity.offset, entity.offset + entity.length)
              .toLowerCase();
            return mentionText === `@${botUsername}`;
          }
          return false;
        });
        if (isBotMentioned && !TRIGGER_PATTERN.test(content)) {
          content = `@${ASSISTANT_NAME} ${content}`;
        }
      }

      // Store chat metadata for discovery
      const isGroup =
        ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(
        chatJid,
        timestamp,
        chatName,
        'telegram',
        isGroup,
      );

      // Only deliver full message for registered groups
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        logger.debug(
          { chatJid, chatName },
          'Message from unregistered Telegram chat',
        );
        return;
      }

      // Deliver message — startMessageLoop() will pick it up
      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });

      logger.info(
        { chatJid, chatName, sender: senderName },
        'Telegram message stored',
      );
    });

    // Handle non-text messages with placeholders so the agent knows something was sent
    const storeNonText = (ctx: any, placeholder: string) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id?.toString() ||
        'Unknown';
      const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';

      const isGroup =
        ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(
        chatJid,
        timestamp,
        undefined,
        'telegram',
        isGroup,
      );
      this.opts.onMessage(chatJid, {
        id: ctx.message.message_id.toString(),
        chat_jid: chatJid,
        sender: ctx.from?.id?.toString() || '',
        sender_name: senderName,
        content: `${placeholder}${caption}`,
        timestamp,
        is_from_me: false,
      });
    };

    this.bot.on('message:photo', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id?.toString() ||
        'Unknown';
      const caption = ctx.message.caption ? `\n${ctx.message.caption}` : '';

      let content = `[Photo]${caption}`;

      try {
        // Download highest-resolution photo
        const photos = ctx.message.photo;
        const best = photos[photos.length - 1];
        const fileInfo = await ctx.api.getFile(best.file_id);
        const filePath = fileInfo.file_path;
        if (filePath) {
          const imgDir = path.join(GROUPS_DIR, group.folder, 'images');
          fs.mkdirSync(imgDir, { recursive: true });
          const filename = `photo_${Date.now()}.jpg`;
          const localPath = path.join(imgDir, filename);
          const url = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
          await downloadToFile(url, localPath);
          content = `[Photo: images/${filename}]${caption}\n(Use the Read tool to view this image)`;
          logger.debug({ filename, chatJid }, 'Telegram photo saved');
        }
      } catch (err) {
        logger.warn(
          { err },
          'Failed to download Telegram photo, using placeholder',
        );
      }

      const isGroup =
        ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(
        chatJid,
        timestamp,
        undefined,
        'telegram',
        isGroup,
      );
      this.opts.onMessage(chatJid, {
        id: ctx.message.message_id.toString(),
        chat_jid: chatJid,
        sender: ctx.from?.id?.toString() || '',
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });
    });
    this.bot.on('message:video', (ctx) => {
      const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
      const duration = ctx.message.video?.duration
        ? ` (${ctx.message.video.duration}s)`
        : '';
      storeNonText(ctx, `[Video${duration}${caption}]`);
    });

    // Download voice messages so agent can reference them
    this.bot.on('message:voice', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id?.toString() ||
        'Unknown';
      const duration = ctx.message.voice?.duration
        ? ` (${ctx.message.voice.duration}s)`
        : '';
      let content = `[Voice message${duration}]`;

      try {
        const fileInfo = await ctx.api.getFile(ctx.message.voice.file_id);
        if (fileInfo.file_path) {
          const mediaDir = path.join(GROUPS_DIR, group.folder, 'media');
          fs.mkdirSync(mediaDir, { recursive: true });
          const filename = `voice_${Date.now()}.ogg`;
          const localPath = path.join(mediaDir, filename);
          const url = `https://api.telegram.org/file/bot${this.botToken}/${fileInfo.file_path}`;
          await downloadToFile(url, localPath);
          const transcript = await transcribeAudio(localPath);
          if (transcript) {
            content = `[Voice: ${transcript}]`;
          } else {
            content = `[Voice message${duration}: media/${filename}]`;
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to download voice message');
      }

      const isGroup =
        ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(
        chatJid,
        timestamp,
        undefined,
        'telegram',
        isGroup,
      );
      this.opts.onMessage(chatJid, {
        id: ctx.message.message_id.toString(),
        chat_jid: chatJid,
        sender: ctx.from?.id?.toString() || '',
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });
    });

    // Download audio files
    this.bot.on('message:audio', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id?.toString() ||
        'Unknown';
      const title =
        ctx.message.audio?.title || ctx.message.audio?.file_name || 'audio';
      let content = `[Audio: ${title}]`;

      try {
        const fileInfo = await ctx.api.getFile(ctx.message.audio.file_id);
        if (fileInfo.file_path) {
          const mediaDir = path.join(GROUPS_DIR, group.folder, 'media');
          fs.mkdirSync(mediaDir, { recursive: true });
          const ext =
            path.extname(ctx.message.audio?.file_name || '.mp3') || '.mp3';
          const filename = `audio_${Date.now()}${ext}`;
          const localPath = path.join(mediaDir, filename);
          const url = `https://api.telegram.org/file/bot${this.botToken}/${fileInfo.file_path}`;
          await downloadToFile(url, localPath);
          content = `[Audio: ${title} → media/${filename}]`;
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to download audio file');
      }

      const isGroup =
        ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(
        chatJid,
        timestamp,
        undefined,
        'telegram',
        isGroup,
      );
      this.opts.onMessage(chatJid, {
        id: ctx.message.message_id.toString(),
        chat_jid: chatJid,
        sender: ctx.from?.id?.toString() || '',
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });
    });
    this.bot.on('message:document', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      const doc = ctx.message.document;
      const name = doc?.file_name || 'file';
      const mime = doc?.mime_type || '';

      // Download PDFs for text extraction
      if (group && mime === 'application/pdf' && doc?.file_id) {
        const timestamp = new Date(ctx.message.date * 1000).toISOString();
        const senderName =
          ctx.from?.first_name ||
          ctx.from?.username ||
          ctx.from?.id?.toString() ||
          'Unknown';
        const caption = ctx.message.caption ? `\n${ctx.message.caption}` : '';
        let content = `[PDF: ${name}]${caption}`;

        try {
          const fileInfo = await ctx.api.getFile(doc.file_id);
          const filePath = fileInfo.file_path;
          if (filePath) {
            const attachDir = path.join(
              GROUPS_DIR,
              group.folder,
              'attachments',
            );
            fs.mkdirSync(attachDir, { recursive: true });
            const filename = `${Date.now()}_${name}`;
            const localPath = path.join(attachDir, filename);
            const url = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
            await downloadToFile(url, localPath);
            content = `[PDF: attachments/${filename}]${caption}\n(Use pdf-reader to extract text: \`pdf-reader read /workspace/group/attachments/${filename}\`)`;
            logger.debug({ filename, chatJid }, 'Telegram PDF saved');
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to download Telegram PDF');
        }

        const isGroup =
          ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
        this.opts.onChatMetadata(
          chatJid,
          timestamp,
          undefined,
          'telegram',
          isGroup,
        );
        this.opts.onMessage(chatJid, {
          id: ctx.message.message_id.toString(),
          chat_jid: chatJid,
          sender: ctx.from?.id?.toString() || '',
          sender_name: senderName,
          content,
          timestamp,
          is_from_me: false,
        });
      } else {
        storeNonText(ctx, `[Document: ${name}]`);
      }
    });
    this.bot.on('message:sticker', (ctx) => {
      const emoji = ctx.message.sticker?.emoji || '';
      storeNonText(ctx, `[Sticker ${emoji}]`);
    });
    this.bot.on('message:location', (ctx) => storeNonText(ctx, '[Location]'));
    this.bot.on('message:contact', (ctx) => storeNonText(ctx, '[Contact]'));

    // Handle user reactions — interpret as messages to the agent
    const reactionMeanings: Record<string, string> = {
      '👍': 'так / підтверджую',
      '👎': 'ні / відхиляю',
      '❤': 'подобається',
      '🔥': 'відмінно / топ',
      '🎉': 'чудово',
      '😮': 'здивований',
      '😢': 'не підходить / сумно',
      '😡': 'незадоволений',
      '🤔': 'треба подумати / не впевнений',
      '🤮': 'жахливо',
      '💩': 'погано',
      '🙏': 'дякую',
      '👌': 'ок / прийнято',
    };
    this.bot.on('message_reaction', (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const newReactions = (ctx.messageReaction as any).new_reaction || [];
      if (newReactions.length === 0) return;

      const emoji = newReactions[0]?.emoji;
      if (!emoji) return;

      const meaning = reactionMeanings[emoji] || emoji;
      const senderName = ctx.messageReaction.user
        ? (ctx.messageReaction.user as any).first_name ||
          (ctx.messageReaction.user as any).username ||
          'User'
        : 'User';
      const sender = ctx.messageReaction.user
        ? String((ctx.messageReaction.user as any).id)
        : '';
      const timestamp = new Date().toISOString();

      this.opts.onMessage(chatJid, {
        // Use the actual Telegram message_id so the host can set a valid reaction
        id: String(
          (ctx.messageReaction as any).message_id ?? `reaction-${Date.now()}`,
        ),
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content: `[Реакція: ${emoji} — ${meaning}]`,
        timestamp,
        is_from_me: false,
      });
      logger.info(
        { chatJid, emoji, meaning, sender: senderName },
        'User reaction interpreted as message',
      );
    });

    // Handle inline keyboard button presses — deliver as a message to the agent
    this.bot.on('callback_query:data', async (ctx) => {
      const chatJid = `tg:${ctx.chat?.id ?? ctx.from.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        await ctx.answerCallbackQuery();
        return;
      }
      const data = ctx.callbackQuery.data;
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id.toString() ||
        'Unknown';
      const sender = ctx.from?.id.toString() || '';
      const timestamp = new Date().toISOString();

      await ctx.answerCallbackQuery();

      this.opts.onMessage(chatJid, {
        id: `cb-${ctx.callbackQuery.id}`,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content: `[Button pressed: ${data}]`,
        timestamp,
        is_from_me: false,
      });
      logger.info(
        { chatJid, sender: senderName, data },
        'Telegram callback query handled',
      );
    });

    // Handle errors gracefully
    this.bot.catch((err) => {
      logger.error({ err: err.message }, 'Telegram bot error');
    });

    // Start polling — returns a Promise that resolves when started
    return new Promise<void>((resolve) => {
      this.bot!.start({
        // Include message_reaction so user emoji reactions are delivered
        allowed_updates: [
          'message',
          'callback_query',
          'message_reaction',
          'message_reaction_count',
        ],
        onStart: (botInfo) => {
          logger.info(
            { username: botInfo.username, id: botInfo.id },
            'Telegram bot connected',
          );
          console.log(`\n  Telegram bot: @${botInfo.username}`);
          console.log(
            `  Send /chatid to the bot to get a chat's registration ID\n`,
          );
          resolve();
        },
      });
    });
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized');
      return;
    }

    try {
      const numericId = jid.replace(/^tg:/, '');

      // Telegram has a 4096 character limit per message — split if needed
      const MAX_LENGTH = 4096;
      if (text.length <= MAX_LENGTH) {
        await sendTelegramMessage(this.bot.api, numericId, text);
      } else {
        for (let i = 0; i < text.length; i += MAX_LENGTH) {
          await sendTelegramMessage(
            this.bot.api,
            numericId,
            text.slice(i, i + MAX_LENGTH),
          );
        }
      }
      logger.info({ jid, length: text.length }, 'Telegram message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Telegram message');
    }
  }

  async reactToMessage(
    jid: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    if (!this.bot) return;
    try {
      const numericChatId = jid.replace(/^tg:/, '');
      const numericMsgId = parseInt(messageId, 10);
      if (isNaN(numericMsgId)) return;
      await this.bot.api.setMessageReaction(numericChatId, numericMsgId, [
        {
          type: 'emoji',
          emoji: emoji as Parameters<
            typeof this.bot.api.setMessageReaction
          >[2] extends Array<infer R>
            ? R extends { emoji: infer E }
              ? E
              : never
            : never,
        },
      ]);
      logger.info({ jid, messageId, emoji }, 'Telegram reaction set');
    } catch (err) {
      logger.debug(
        { jid, messageId, emoji, err },
        'Failed to set Telegram reaction',
      );
    }
  }

  async sendWithButtons(
    jid: string,
    text: string,
    buttons: Array<{ label: string; data: string }>,
    rowSize: number,
  ): Promise<void> {
    if (!this.bot) return;
    try {
      const numericId = jid.replace(/^tg:/, '');
      // Build inline keyboard rows
      const rows: Array<Array<{ text: string; callback_data: string }>> = [];
      for (let i = 0; i < buttons.length; i += rowSize) {
        rows.push(
          buttons
            .slice(i, i + rowSize)
            .map((b) => ({ text: b.label, callback_data: b.data })),
        );
      }
      await this.bot.api.sendMessage(numericId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: rows },
      });
      logger.info(
        { jid, buttonCount: buttons.length },
        'Telegram message with buttons sent',
      );
    } catch (err) {
      logger.error(
        { jid, err },
        'Failed to send Telegram message with buttons',
      );
    }
  }

  async sendPhoto(
    jid: string,
    photoPath: string,
    caption?: string,
  ): Promise<void> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized');
      return;
    }

    try {
      const numericId = jid.replace(/^tg:/, '');
      const { InputFile } = await import('grammy');
      const file = new InputFile(photoPath);
      await this.bot.api.sendPhoto(numericId, file, {
        caption: caption || undefined,
        parse_mode: caption ? 'HTML' : undefined,
      });
      logger.info(
        { jid, photoPath, hasCaption: !!caption },
        'Telegram photo sent',
      );
    } catch (err) {
      logger.error({ jid, photoPath, err }, 'Failed to send Telegram photo');
    }
  }

  isConnected(): boolean {
    return this.bot !== null;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('tg:');
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
      logger.info('Telegram bot stopped');
    }
  }

  async sendMessageRaw(
    jid: string,
    text: string,
  ): Promise<{ message_id: number } | undefined> {
    if (!this.bot) return undefined;
    try {
      const numericId = Number(jid.replace(/^tg:/, ''));
      const MAX_LENGTH = 4096;
      const msg = await this.bot.api.sendMessage(
        numericId,
        text.slice(0, MAX_LENGTH),
      );
      return { message_id: msg.message_id };
    } catch (err) {
      logger.debug({ jid, err }, 'sendMessageRaw failed');
      return undefined;
    }
  }

  async editMessage(
    jid: string,
    messageId: number,
    text: string,
  ): Promise<void> {
    if (!this.bot) return;
    try {
      const numericId = Number(jid.replace(/^tg:/, ''));
      await this.bot.api.editMessageText(numericId, messageId, text);
    } catch (err: any) {
      if (err?.error_code !== 400) {
        logger.debug(
          { jid, messageId, err },
          'Failed to edit Telegram message',
        );
      }
    }
  }

  async deleteMessage(jid: string, messageId: number): Promise<void> {
    if (!this.bot) return;
    try {
      const numericId = Number(jid.replace(/^tg:/, ''));
      await this.bot.api.deleteMessage(numericId, messageId);
    } catch (err) {
      logger.debug(
        { jid, messageId, err },
        'Failed to delete Telegram message',
      );
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.bot || !isTyping) return;
    try {
      const numericId = jid.replace(/^tg:/, '');
      await this.bot.api.sendChatAction(numericId, 'typing');
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to send Telegram typing indicator');
    }
  }
}

registerChannel('telegram', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['TELEGRAM_BOT_TOKEN']);
  const token =
    process.env.TELEGRAM_BOT_TOKEN || envVars.TELEGRAM_BOT_TOKEN || '';
  if (!token) {
    logger.warn('Telegram: TELEGRAM_BOT_TOKEN not set');
    return null;
  }
  return new TelegramChannel(token, opts);
});
