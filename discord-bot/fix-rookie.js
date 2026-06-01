const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1497075111549734963';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  const existing = guild.emojis.cache.find(e => e.name === 'apex_rookie');
  if (existing) {
    await existing.delete('Replacing with real Rookie badge');
    console.log('Deleted old apex_rookie');
  }

  const created = await guild.emojis.create({
    attachment: path.join(__dirname, '..', 'Apex Rank Badges', 'resized', 'apex_rookie.png'),
    name: 'apex_rookie',
    reason: 'Real Rookie badge',
  });
  console.log(`Uploaded new apex_rookie: ${created.id}`);

  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
