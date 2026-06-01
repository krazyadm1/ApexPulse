const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1497075111549734963';
const DIR = path.join(__dirname, '..', 'assets', 'discord-bot-emojis', 'resized');

const EMOJIS = [
  { name: 'platform_pc', file: 'platform_pc.png' },
  { name: 'platform_playstation', file: 'platform_playstation.png' },
  { name: 'platform_xbox', file: 'platform_xbox.png' },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);

  for (const emoji of EMOJIS) {
    const existing = guild.emojis.cache.find(e => e.name === emoji.name);
    if (existing) {
      await existing.delete('Replacing');
      console.log('Deleted old:', emoji.name);
    }
    const created = await guild.emojis.create({
      attachment: path.join(DIR, emoji.file),
      name: emoji.name,
      reason: 'ApexPulse platform icons',
    });
    console.log('Uploaded:', emoji.name, created.id);
  }

  console.log('\nEmoji IDs:');
  const refreshed = await guild.emojis.fetch();
  for (const emoji of EMOJIS) {
    const found = refreshed.find(e => e.name === emoji.name);
    if (found) console.log(`  '${emoji.name}': '${found.id}'`);
  }

  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
