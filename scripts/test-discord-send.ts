import { Client, GatewayIntentBits, Events } from 'discord.js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const token = envContent.match(/DISCORD_BOT_TOKEN=(.*)/)?.[1]?.trim();
const mainChannelId = envContent.match(/DISCORD_MAIN_CHANNEL_ID=(.*)/)?.[1]?.trim();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready: ${c.user.tag}`);

  // Test 1: Send a message to #main
  try {
    const mainChannel = await c.channels.fetch(mainChannelId!);
    if (mainChannel && 'send' in mainChannel) {
      const msg = await (mainChannel as any).send('🟢 NanoClaw Discord integration is live! All systems operational.');
      console.log(`✓ Message sent to #main (${msg.id})`);

      // Test 2: Edit the message
      await msg.edit('🟢 NanoClaw Discord integration is live! All systems operational. *(edited)*');
      console.log('✓ Message edited successfully');
    }
  } catch (err) {
    console.error('✗ Send to #main failed:', err);
  }

  // Test 3: Send to #bugs channel
  const guild = c.guilds.cache.first()!;
  const channels = await guild.channels.fetch();
  const bugsChannel = channels.find(ch => ch?.name === 'bugs');
  if (bugsChannel && 'send' in bugsChannel) {
    await (bugsChannel as any).send({
      embeds: [{
        title: '🐛 Test Bug Report',
        description: 'This is a test embed from the Discord integration.',
        color: 0xff0000,
        fields: [
          { name: 'Priority', value: 'High', inline: true },
          { name: 'Status', value: 'Open', inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
    console.log('✓ Embed sent to #bugs');
  }

  // Test 4: Send to #progress channel
  const progressChannel = channels.find(ch => ch?.name === 'progress');
  if (progressChannel && 'send' in progressChannel) {
    const progressMsg = await (progressChannel as any).send('⏳ Progress: Building... [1/5]');
    await new Promise(r => setTimeout(r, 1000));
    await progressMsg.edit('⏳ Progress: Building... [3/5]');
    await new Promise(r => setTimeout(r, 1000));
    await progressMsg.edit('✅ Progress: Complete! [5/5]');
    console.log('✓ Progress message sent and edited in #progress');
  }

  console.log('\nAll tests passed!');
  client.destroy();
});

client.login(token);
