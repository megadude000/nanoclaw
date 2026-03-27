import { Client, GatewayIntentBits, Events } from 'discord.js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const token = envContent.match(/DISCORD_BOT_TOKEN=(.*)/)?.[1]?.trim();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`Current bot name: ${c.user.tag}`);

  // Change bot nickname in guild to "Jarvis"
  const guild = c.guilds.cache.first()!;
  const me = await guild.members.fetch(c.user.id);
  await me.setNickname('Jarvis');
  console.log('✓ Bot nickname set to "Jarvis" in server');

  client.destroy();
});

client.login(token);
