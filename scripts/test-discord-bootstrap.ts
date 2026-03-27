import { Client, GatewayIntentBits, Events } from 'discord.js';
import { readFileSync } from 'fs';
import { DiscordServerManager } from '../src/discord-server-manager.js';

const envContent = readFileSync('.env', 'utf-8');
const token = envContent.match(/DISCORD_BOT_TOKEN=(.*)/)?.[1]?.trim();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready: ${c.user.tag}`);
  const guild = c.guilds.cache.first();
  if (!guild) {
    console.log('No guild found');
    client.destroy();
    return;
  }
  console.log(`Guild: ${guild.name} (${guild.id})`);

  const manager = new DiscordServerManager({ getGuild: () => guild });
  console.log('\nBootstrapping server structure...');
  try {
    const result = await manager.handleAction('bootstrap', guild.id, {});
    console.log('Bootstrap result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Bootstrap failed:', err);
  }

  // List channels after bootstrap
  const refreshed = await guild.channels.fetch();
  console.log('\nChannels after bootstrap:');
  for (const [id, ch] of refreshed) {
    if (!ch) continue;
    const typeName = ch.type === 4 ? 'CATEGORY' : ch.type === 0 ? 'TEXT' : `TYPE:${ch.type}`;
    const parent = ch.parentId ? ` (under ${ch.parentId})` : '';
    console.log(`  ${typeName}: #${ch.name} — ${id}${parent}`);
  }

  client.destroy();
});

client.login(token);
