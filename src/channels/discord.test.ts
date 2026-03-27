import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- Mocks ---

// Mock registry (registerChannel runs at import time)
vi.mock('./registry.js', () => ({ registerChannel: vi.fn() }));

// Mock env reader (used by the factory, not needed in unit tests)
vi.mock('../env.js', () => ({ readEnvFile: vi.fn(() => ({})) }));

// Mock config
vi.mock('../config.js', () => ({
  ASSISTANT_NAME: 'Andy',
  TRIGGER_PATTERN: /^@Andy\b/i,
  GROUPS_DIR: '/tmp/test-groups',
}));

// Mock discord-group-utils
vi.mock('../discord-group-utils.js', () => ({
  sanitizeWithCollisionCheck: vi.fn(
    (name: string, _id: string, _existing: Set<string>) => `dc-${name}`,
  ),
  createGroupStub: vi.fn(
    (name: string, isMain: boolean) =>
      `# ${name}\n\nDiscord channel group.${isMain ? ' This is the main channel.' : ''}\n`,
  ),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock logger
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- discord.js mock ---

type Handler = (...args: any[]) => any;

const clientRef = vi.hoisted(() => ({ current: null as any }));

vi.mock('discord.js', () => {
  const Events = {
    MessageCreate: 'messageCreate',
    ClientReady: 'ready',
    Error: 'error',
    ShardDisconnect: 'shardDisconnect',
    ShardReconnecting: 'shardReconnecting',
    ShardResume: 'shardResume',
    InteractionCreate: 'interactionCreate',
  };

  const GatewayIntentBits = {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
    DirectMessages: 8,
  };

  const ButtonStyle = { Primary: 1 };

  class MockButtonBuilder {
    private _customId = '';
    private _label = '';
    private _style = 0;
    setCustomId(id: string) {
      this._customId = id;
      return this;
    }
    setLabel(label: string) {
      this._label = label;
      return this;
    }
    setStyle(style: number) {
      this._style = style;
      return this;
    }
  }

  class MockActionRowBuilder {
    components: any[] = [];
    addComponents(items: any[]) {
      this.components.push(...items);
      return this;
    }
  }

  class MockClient {
    eventHandlers = new Map<string, Handler[]>();
    user: any = { id: '999888777', tag: 'Andy#1234' };
    private _ready = false;

    constructor(_opts: any) {
      clientRef.current = this;
    }

    on(event: string, handler: Handler) {
      const existing = this.eventHandlers.get(event) || [];
      existing.push(handler);
      this.eventHandlers.set(event, existing);
      return this;
    }

    once(event: string, handler: Handler) {
      return this.on(event, handler);
    }

    async login(_token: string) {
      this._ready = true;
      // Fire the ready event
      const readyHandlers = this.eventHandlers.get('ready') || [];
      for (const h of readyHandlers) {
        h({ user: this.user });
      }
    }

    isReady() {
      return this._ready;
    }

    channels = {
      fetch: vi.fn().mockResolvedValue({
        send: vi.fn().mockResolvedValue({ id: 'sent_msg_001' }),
        sendTyping: vi.fn().mockResolvedValue(undefined),
        messages: {
          fetch: vi.fn().mockResolvedValue({
            edit: vi.fn().mockResolvedValue(undefined),
          }),
        },
      }),
    };

    destroy() {
      this._ready = false;
    }
  }

  // Mock TextChannel type
  class TextChannel {}

  return {
    Client: MockClient,
    Events,
    GatewayIntentBits,
    TextChannel,
    ActionRowBuilder: MockActionRowBuilder,
    ButtonBuilder: MockButtonBuilder,
    ButtonStyle,
  };
});

import { DiscordChannel, DiscordChannelOpts } from './discord.js';

// --- Test helpers ---

function createTestOpts(
  overrides?: Partial<DiscordChannelOpts>,
): DiscordChannelOpts {
  return {
    onMessage: vi.fn(),
    onChatMetadata: vi.fn(),
    registeredGroups: vi.fn(() => ({
      'dc:1234567890123456': {
        name: 'Test Server #general',
        folder: 'test-server',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    })),
    registerGroup: vi.fn(),
    ...overrides,
  };
}

function createMessage(overrides: {
  channelId?: string;
  content?: string;
  authorId?: string;
  authorUsername?: string;
  authorDisplayName?: string;
  memberDisplayName?: string;
  isBot?: boolean;
  guildName?: string;
  channelName?: string;
  messageId?: string;
  createdAt?: Date;
  attachments?: Map<string, any>;
  reference?: { messageId?: string };
  mentionsBotId?: boolean;
}) {
  const channelId = overrides.channelId ?? '1234567890123456';
  const authorId = overrides.authorId ?? '55512345';
  const botId = '999888777'; // matches mock client user id

  const mentionsMap = new Map();
  if (overrides.mentionsBotId) {
    mentionsMap.set(botId, { id: botId });
  }

  return {
    channelId,
    id: overrides.messageId ?? 'msg_001',
    content: overrides.content ?? 'Hello everyone',
    createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
    author: {
      id: authorId,
      username: overrides.authorUsername ?? 'alice',
      displayName: overrides.authorDisplayName ?? 'Alice',
      bot: overrides.isBot ?? false,
    },
    member: overrides.memberDisplayName
      ? { displayName: overrides.memberDisplayName }
      : null,
    guild: overrides.guildName ? { name: overrides.guildName } : null,
    channel: {
      name: overrides.channelName ?? 'general',
      messages: {
        fetch: vi.fn().mockResolvedValue({
          author: { username: 'Bob', displayName: 'Bob' },
          member: { displayName: 'Bob' },
        }),
      },
    },
    mentions: {
      users: mentionsMap,
    },
    attachments: overrides.attachments ?? new Map(),
    reference: overrides.reference ?? null,
  };
}

function currentClient() {
  return clientRef.current;
}

async function triggerMessage(message: any) {
  const handlers = currentClient().eventHandlers.get('messageCreate') || [];
  for (const h of handlers) await h(message);
}

// --- Tests ---

describe('DiscordChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Connection lifecycle ---

  describe('connection lifecycle', () => {
    it('resolves connect() when client is ready', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);

      await channel.connect();

      expect(channel.isConnected()).toBe(true);
    });

    it('registers message handlers on connect', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);

      await channel.connect();

      expect(currentClient().eventHandlers.has('messageCreate')).toBe(true);
      expect(currentClient().eventHandlers.has('error')).toBe(true);
      expect(currentClient().eventHandlers.has('ready')).toBe(true);
    });

    it('disconnects cleanly', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);

      await channel.connect();
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
    });

    it('isConnected() returns false before connect', () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);

      expect(channel.isConnected()).toBe(false);
    });
  });

  // --- Text message handling ---

  describe('text message handling', () => {
    it('delivers message for registered channel', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'Hello everyone',
        guildName: 'Test Server',
        channelName: 'general',
      });
      await triggerMessage(msg);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.any(String),
        'Test Server #general',
        'discord',
        true,
      );
      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          id: 'msg_001',
          chat_jid: 'dc:1234567890123456',
          sender: '55512345',
          sender_name: 'Alice',
          content: 'Hello everyone',
          is_from_me: false,
        }),
      );
    });

    it('only emits metadata for unregistered channels', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        channelId: '9999999999999999',
        content: 'Unknown channel',
        guildName: 'Other Server',
      });
      await triggerMessage(msg);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'dc:9999999999999999',
        expect.any(String),
        expect.any(String),
        'discord',
        true,
      );
      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('ignores bot messages', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({ isBot: true, content: 'I am a bot' });
      await triggerMessage(msg);

      expect(opts.onMessage).not.toHaveBeenCalled();
      expect(opts.onChatMetadata).not.toHaveBeenCalled();
    });

    it('uses member displayName when available (server nickname)', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'Hi',
        memberDisplayName: 'Alice Nickname',
        authorDisplayName: 'Alice Global',
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({ sender_name: 'Alice Nickname' }),
      );
    });

    it('falls back to author displayName when no member', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'Hi',
        memberDisplayName: undefined,
        authorDisplayName: 'Alice Global',
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({ sender_name: 'Alice Global' }),
      );
    });

    it('uses sender name for DM chats (no guild)', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({
          'dc:1234567890123456': {
            name: 'DM',
            folder: 'dm',
            trigger: '@Andy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'Hello',
        guildName: undefined,
        authorDisplayName: 'Alice',
      });
      await triggerMessage(msg);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.any(String),
        'Alice',
        'discord',
        false,
      );
    });

    it('uses guild name + channel name for server messages', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'Hello',
        guildName: 'My Server',
        channelName: 'bot-chat',
      });
      await triggerMessage(msg);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.any(String),
        'My Server #bot-chat',
        'discord',
        true,
      );
    });
  });

  // --- @mention translation ---

  describe('@mention translation', () => {
    it('translates <@botId> mention to trigger format', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: '<@999888777> what time is it?',
        mentionsBotId: true,
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '@Andy what time is it?',
        }),
      );
    });

    it('does not translate if message already matches trigger', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: '@Andy hello <@999888777>',
        mentionsBotId: true,
        guildName: 'Server',
      });
      await triggerMessage(msg);

      // Should NOT prepend @Andy — already starts with trigger
      // But the <@botId> should still be stripped
      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '@Andy hello',
        }),
      );
    });

    it('does not translate when bot is not mentioned', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'hello everyone',
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: 'hello everyone',
        }),
      );
    });

    it('handles <@!botId> (nickname mention format)', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: '<@!999888777> check this',
        mentionsBotId: true,
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '@Andy check this',
        }),
      );
    });
  });

  // --- Attachments ---

  describe('attachments', () => {
    it('stores image attachment with placeholder', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const attachments = new Map([
        ['att1', { name: 'photo.png', contentType: 'image/png' }],
      ]);
      const msg = createMessage({
        content: '',
        attachments,
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '[Image: photo.png]',
        }),
      );
    });

    it('stores video attachment with placeholder', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const attachments = new Map([
        ['att1', { name: 'clip.mp4', contentType: 'video/mp4' }],
      ]);
      const msg = createMessage({
        content: '',
        attachments,
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '[Video: clip.mp4]',
        }),
      );
    });

    it('stores file attachment with placeholder', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const attachments = new Map([
        ['att1', { name: 'report.pdf', contentType: 'application/pdf' }],
      ]);
      const msg = createMessage({
        content: '',
        attachments,
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '[File: report.pdf]',
        }),
      );
    });

    it('includes text content with attachments', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const attachments = new Map([
        ['att1', { name: 'photo.jpg', contentType: 'image/jpeg' }],
      ]);
      const msg = createMessage({
        content: 'Check this out',
        attachments,
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: 'Check this out\n[Image: photo.jpg]',
        }),
      );
    });

    it('handles multiple attachments', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const attachments = new Map([
        ['att1', { name: 'a.png', contentType: 'image/png' }],
        ['att2', { name: 'b.txt', contentType: 'text/plain' }],
      ]);
      const msg = createMessage({
        content: '',
        attachments,
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '[Image: a.png]\n[File: b.txt]',
        }),
      );
    });
  });

  // --- Reply context ---

  describe('reply context', () => {
    it('includes reply author in content', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'I agree with that',
        reference: { messageId: 'original_msg_id' },
        guildName: 'Server',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '[Reply to Bob] I agree with that',
        }),
      );
    });

    it('includes reply message preview in content', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'I agree',
        reference: { messageId: 'orig_id' },
        guildName: 'Server',
      });
      msg.channel.messages.fetch = vi.fn().mockResolvedValue({
        author: { username: 'Bob', displayName: 'Bob' },
        member: { displayName: 'Bob' },
        content: 'The original message text here',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '[Reply to Bob: "The original message text here"] I agree',
        }),
      );
    });

    it('truncates long reply preview at 100 chars', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'I agree',
        reference: { messageId: 'orig_id' },
        guildName: 'Server',
      });
      msg.channel.messages.fetch = vi.fn().mockResolvedValue({
        author: { username: 'Bob', displayName: 'Bob' },
        member: { displayName: 'Bob' },
        content: 'x'.repeat(150),
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '[Reply to Bob: "' + 'x'.repeat(100) + '..."] I agree',
        }),
      );
    });

    it('handles reply to message with no text content', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'I agree',
        reference: { messageId: 'orig_id' },
        guildName: 'Server',
      });
      msg.channel.messages.fetch = vi.fn().mockResolvedValue({
        author: { username: 'Bob', displayName: 'Bob' },
        member: { displayName: 'Bob' },
        content: '',
      });
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: '[Reply to Bob] I agree',
        }),
      );
    });

    it('handles deleted referenced message gracefully', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        content: 'I agree',
        reference: { messageId: 'orig_id' },
        guildName: 'Server',
      });
      msg.channel.messages.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Unknown Message'));
      await triggerMessage(msg);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          content: 'I agree',
        }),
      );
    });
  });

  // IN-05 coverage note: Trigger pattern logic (main group skips trigger,
  // non-main requires TRIGGER_PATTERN match) is implemented in index.ts
  // startMessageLoop() and is channel-agnostic. No Discord-specific code
  // or test needed. See index.ts lines ~432-447.

  // --- sendMessage ---

  describe('sendMessage', () => {
    it('sends message via channel', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      await channel.sendMessage('dc:1234567890123456', 'Hello');

      const fetchedChannel =
        await currentClient().channels.fetch('1234567890123456');
      expect(currentClient().channels.fetch).toHaveBeenCalledWith(
        '1234567890123456',
      );
    });

    it('strips dc: prefix from JID', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      await channel.sendMessage('dc:9876543210', 'Test');

      expect(currentClient().channels.fetch).toHaveBeenCalledWith('9876543210');
    });

    it('handles send failure gracefully', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      currentClient().channels.fetch.mockRejectedValueOnce(
        new Error('Channel not found'),
      );

      // Should not throw
      await expect(
        channel.sendMessage('dc:1234567890123456', 'Will fail'),
      ).resolves.toBeUndefined();
    });

    it('does nothing when client is not initialized', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);

      // Don't connect — client is null
      await channel.sendMessage('dc:1234567890123456', 'No client');

      // No error, no API call
    });

    it('splits messages exceeding 2000 characters using markdown-aware chunker', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockChannel = {
        send: vi.fn().mockResolvedValue({ id: 'sent_001' }),
        sendTyping: vi.fn(),
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      const longText = 'x'.repeat(3000);
      await channel.sendMessage('dc:1234567890123456', longText);

      // Should be split into multiple chunks (markdown-aware chunker handles this)
      expect(mockChannel.send).toHaveBeenCalledTimes(2);
      // All chunks together should equal original text
      const allSent = mockChannel.send.mock.calls
        .map((c: any[]) => c[0])
        .join('');
      expect(allSent).toBe(longText);
    });
  });

  // --- ownsJid ---

  describe('ownsJid', () => {
    it('owns dc: JIDs', () => {
      const channel = new DiscordChannel('test-token', createTestOpts());
      expect(channel.ownsJid('dc:1234567890123456')).toBe(true);
    });

    it('does not own WhatsApp group JIDs', () => {
      const channel = new DiscordChannel('test-token', createTestOpts());
      expect(channel.ownsJid('12345@g.us')).toBe(false);
    });

    it('does not own Telegram JIDs', () => {
      const channel = new DiscordChannel('test-token', createTestOpts());
      expect(channel.ownsJid('tg:123456789')).toBe(false);
    });

    it('does not own unknown JID formats', () => {
      const channel = new DiscordChannel('test-token', createTestOpts());
      expect(channel.ownsJid('random-string')).toBe(false);
    });
  });

  // --- setTyping ---

  describe('setTyping', () => {
    it('sends typing indicator when isTyping is true', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockChannel = {
        send: vi.fn(),
        sendTyping: vi.fn().mockResolvedValue(undefined),
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      await channel.setTyping('dc:1234567890123456', true);

      expect(mockChannel.sendTyping).toHaveBeenCalled();
    });

    it('does nothing when isTyping is false', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      await channel.setTyping('dc:1234567890123456', false);

      // channels.fetch should NOT be called
      expect(currentClient().channels.fetch).not.toHaveBeenCalled();
    });

    it('does nothing when client is not initialized', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);

      // Don't connect
      await channel.setTyping('dc:1234567890123456', true);

      // No error
    });
  });

  // --- Channel properties ---

  describe('channel properties', () => {
    it('has name "discord"', () => {
      const channel = new DiscordChannel('test-token', createTestOpts());
      expect(channel.name).toBe('discord');
    });
  });

  // --- editMessage ---

  describe('editMessage', () => {
    it('edits a message by fetching channel and message', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockEdit = vi.fn().mockResolvedValue(undefined);
      const mockChannel = {
        send: vi.fn(),
        sendTyping: vi.fn(),
        messages: {
          fetch: vi.fn().mockResolvedValue({ edit: mockEdit }),
        },
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      await channel.editMessage(
        'dc:1234567890123456',
        'msg_123',
        'Updated text',
      );

      expect(currentClient().channels.fetch).toHaveBeenCalledWith(
        '1234567890123456',
      );
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('msg_123');
      expect(mockEdit).toHaveBeenCalledWith('Updated text');
    });

    it('does nothing when client is not initialized', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      // Don't connect
      await channel.editMessage('dc:1234567890123456', 'msg_123', 'text');
      // No error thrown
    });

    it('handles edit failure gracefully', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      currentClient().channels.fetch.mockRejectedValueOnce(
        new Error('Not found'),
      );

      await expect(
        channel.editMessage('dc:1234567890123456', 'msg_123', 'text'),
      ).resolves.toBeUndefined();
    });
  });

  // --- sendMessageRaw ---

  describe('sendMessageRaw', () => {
    it('returns message_id from sent message', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockChannel = {
        send: vi.fn().mockResolvedValue({ id: 'discord_msg_456' }),
        sendTyping: vi.fn(),
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      const result = await channel.sendMessageRaw(
        'dc:1234567890123456',
        'Hello raw',
      );

      expect(result).toEqual({ message_id: 'discord_msg_456' });
      expect(mockChannel.send).toHaveBeenCalledWith('Hello raw');
    });

    it('returns undefined when client is not initialized', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      // Don't connect
      const result = await channel.sendMessageRaw(
        'dc:1234567890123456',
        'text',
      );
      expect(result).toBeUndefined();
    });

    it('truncates to 2000 chars', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockChannel = {
        send: vi.fn().mockResolvedValue({ id: 'msg_001' }),
        sendTyping: vi.fn(),
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      await channel.sendMessageRaw('dc:1234567890123456', 'x'.repeat(3000));

      expect(mockChannel.send).toHaveBeenCalledWith('x'.repeat(2000));
    });

    it('returns undefined on failure', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      currentClient().channels.fetch.mockRejectedValueOnce(new Error('fail'));

      const result = await channel.sendMessageRaw(
        'dc:1234567890123456',
        'text',
      );
      expect(result).toBeUndefined();
    });
  });

  // --- sendPhoto ---

  describe('sendPhoto', () => {
    it('sends photo with caption', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockChannel = {
        send: vi.fn().mockResolvedValue({ id: 'msg_001' }),
        sendTyping: vi.fn(),
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      await channel.sendPhoto(
        'dc:1234567890123456',
        '/tmp/photo.png',
        'My caption',
      );

      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'My caption',
        files: ['/tmp/photo.png'],
      });
    });

    it('sends photo without caption', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockChannel = {
        send: vi.fn().mockResolvedValue({ id: 'msg_001' }),
        sendTyping: vi.fn(),
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      await channel.sendPhoto('dc:1234567890123456', '/tmp/photo.png');

      expect(mockChannel.send).toHaveBeenCalledWith({
        content: undefined,
        files: ['/tmp/photo.png'],
      });
    });

    it('does nothing when client is not initialized', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.sendPhoto('dc:1234567890123456', '/tmp/photo.png');
      // No error
    });

    it('handles failure gracefully', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      currentClient().channels.fetch.mockRejectedValueOnce(new Error('fail'));

      await expect(
        channel.sendPhoto('dc:1234567890123456', '/tmp/photo.png'),
      ).resolves.toBeUndefined();
    });
  });

  // --- sendWithButtons ---

  describe('sendWithButtons', () => {
    it('sends message with button components', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockChannel = {
        send: vi.fn().mockResolvedValue({ id: 'msg_001' }),
        sendTyping: vi.fn(),
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      const buttons = [
        { label: 'Yes', data: 'confirm_yes' },
        { label: 'No', data: 'confirm_no' },
      ];
      await channel.sendWithButtons('dc:1234567890123456', 'Confirm?', buttons);

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Confirm?',
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.any(Object),
                expect.any(Object),
              ]),
            }),
          ]),
        }),
      );
    });

    it('splits buttons into rows based on rowSize', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockChannel = {
        send: vi.fn().mockResolvedValue({ id: 'msg_001' }),
        sendTyping: vi.fn(),
      };
      currentClient().channels.fetch.mockResolvedValue(mockChannel);

      const buttons = [
        { label: 'A', data: 'a' },
        { label: 'B', data: 'b' },
        { label: 'C', data: 'c' },
      ];
      await channel.sendWithButtons('dc:1234567890123456', 'Pick', buttons, 2);

      const sentArg = mockChannel.send.mock.calls[0][0];
      // Should have 2 rows: [A, B] and [C]
      expect(sentArg.components).toHaveLength(2);
      expect(sentArg.components[0].components).toHaveLength(2);
      expect(sentArg.components[1].components).toHaveLength(1);
    });

    it('does nothing when client is not initialized', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.sendWithButtons('dc:1234567890123456', 'text', []);
      // No error
    });
  });

  // --- interactionCreate handler ---

  describe('interactionCreate handler', () => {
    it('registers interactionCreate handler on connect', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      expect(currentClient().eventHandlers.has('interactionCreate')).toBe(true);
    });

    it('routes button clicks as messages to onMessage', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockInteraction = {
        isButton: () => true,
        deferUpdate: vi.fn().mockResolvedValue(undefined),
        channelId: '1234567890123456',
        id: 'interaction_001',
        customId: 'confirm_yes',
        user: { id: 'user_123', username: 'alice' },
        member: { displayName: 'Alice' },
      };

      const handlers =
        currentClient().eventHandlers.get('interactionCreate') || [];
      for (const h of handlers) await h(mockInteraction);

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          id: 'interaction_001',
          chat_jid: 'dc:1234567890123456',
          sender: 'user_123',
          sender_name: 'Alice',
          content: '@Andy [button:confirm_yes]',
          is_from_me: false,
        }),
      );
    });

    it('ignores non-button interactions', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockInteraction = {
        isButton: () => false,
      };

      const handlers =
        currentClient().eventHandlers.get('interactionCreate') || [];
      for (const h of handlers) await h(mockInteraction);

      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('falls back to username when no displayName on member', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const mockInteraction = {
        isButton: () => true,
        deferUpdate: vi.fn().mockResolvedValue(undefined),
        channelId: '1234567890123456',
        id: 'interaction_002',
        customId: 'action_1',
        user: { id: 'user_456', username: 'bob' },
        member: null,
      };

      const handlers =
        currentClient().eventHandlers.get('interactionCreate') || [];
      for (const h of handlers) await h(mockInteraction);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'dc:1234567890123456',
        expect.objectContaining({
          sender_name: 'bob',
        }),
      );
    });
  });

  // --- Shard lifecycle logging ---

  describe('shard lifecycle logging', () => {
    it('registers shard event handlers on connect', async () => {
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const client = currentClient();
      expect(client.eventHandlers.has('shardDisconnect')).toBe(true);
      expect(client.eventHandlers.has('shardReconnecting')).toBe(true);
      expect(client.eventHandlers.has('shardResume')).toBe(true);
    });

    it('logs warning on ShardDisconnect with shardId and code', async () => {
      const { logger } = await import('../logger.js');
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const client = currentClient();
      const handlers = client.eventHandlers.get('shardDisconnect') || [];
      for (const h of handlers) h({ code: 1006 }, 0);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ shardId: 0, code: 1006 }),
        expect.stringContaining('disconnected'),
      );
    });

    it('logs info on ShardReconnecting with shardId', async () => {
      const { logger } = await import('../logger.js');
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const client = currentClient();
      const handlers = client.eventHandlers.get('shardReconnecting') || [];
      for (const h of handlers) h(0);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ shardId: 0 }),
        expect.stringContaining('reconnecting'),
      );
    });

    it('logs info on ShardResume with shardId and replayedEvents', async () => {
      const { logger } = await import('../logger.js');
      const opts = createTestOpts();
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const client = currentClient();
      const handlers = client.eventHandlers.get('shardResume') || [];
      for (const h of handlers) h(0, 5);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ shardId: 0, replayedEvents: 5 }),
        expect.stringContaining('resumed'),
      );
    });
  });

  // --- Discord auto-registration ---

  describe('Discord auto-registration', () => {
    const UNREGISTERED_CHANNEL_ID = '9999888877776666';

    it('auto-registers channel on first message when not in registeredGroups', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({})),
      });
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        channelId: UNREGISTERED_CHANNEL_ID,
        content: 'hello',
        guildName: 'TestServer',
        channelName: 'bugs',
      });
      await triggerMessage(msg);

      expect(opts.registerGroup).toHaveBeenCalledWith(
        `dc:${UNREGISTERED_CHANNEL_ID}`,
        expect.objectContaining({
          name: 'TestServer #bugs',
          folder: 'dc-bugs',
          trigger: '@Andy',
          requiresTrigger: true,
        }),
      );
    });

    it('sets isMain=true when channelId matches DISCORD_MAIN_CHANNEL_ID', async () => {
      try {
        const opts = createTestOpts({
          registeredGroups: vi.fn(() => ({})),
        });
        const channel = new DiscordChannel('test-token', UNREGISTERED_CHANNEL_ID, opts);
        await channel.connect();

        const msg = createMessage({
          channelId: UNREGISTERED_CHANNEL_ID,
          content: 'hello',
          guildName: 'TestServer',
          channelName: 'general',
        });
        await triggerMessage(msg);

        expect(opts.registerGroup).toHaveBeenCalledWith(
          `dc:${UNREGISTERED_CHANNEL_ID}`,
          expect.objectContaining({
            isMain: true,
            requiresTrigger: false,
          }),
        );
      } finally {
        // mainChannelId is now a constructor param, no env cleanup needed
      }
    });

    it('does not re-register already registered channel', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({
          [`dc:${UNREGISTERED_CHANNEL_ID}`]: {
            name: 'Already Registered',
            folder: 'dc-already',
            trigger: '@Andy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        channelId: UNREGISTERED_CHANNEL_ID,
        content: 'hello',
        guildName: 'TestServer',
        channelName: 'already',
      });
      await triggerMessage(msg);

      expect(opts.registerGroup).not.toHaveBeenCalled();
    });

    it('creates CLAUDE.md stub on registration', async () => {
      const fs = await import('fs');
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({})),
      });
      const channel = new DiscordChannel('test-token', 'main-channel-id', opts);
      await channel.connect();

      const msg = createMessage({
        channelId: UNREGISTERED_CHANNEL_ID,
        content: 'hello',
        guildName: 'TestServer',
        channelName: 'bugs',
      });
      await triggerMessage(msg);

      expect(fs.default.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('dc-bugs'),
        expect.stringContaining('Discord channel group'),
      );
    });
  });
});
