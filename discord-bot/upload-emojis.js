const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1497075111549734963';
const BADGE_DIR = path.join(__dirname, '..', 'Apex Rank Badges', 'resized');

const EMOJIS = [
  { name: 'apex_predator', file: 'apex_predator.png' },
  { name: 'apex_master', file: 'apex_master.png' },
  { name: 'apex_diamond', file: 'apex_diamond.png' },
  { name: 'apex_platinum', file: 'apex_platinum.png' },
  { name: 'apex_gold', file: 'apex_gold.png' },
  { name: 'apex_silver', file: 'apex_silver.png' },
  { name: 'apex_bronze', file: 'apex_bronze.png' },
  { name: 'apex_rookie', file: 'apex_rookie.png' },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error('Guild not found'); process.exit(1); }

  for (const emoji of EMOJIS) {
    const existing = guild.emojis.cache.find(e => e.name === emoji.name);
    if (existing) {
      console.log(`  Already exists: :${emoji.name}: (${existing.id})`);
      continue;
    }

    const filePath = path.join(BADGE_DIR, emoji.file);
    if (!fs.existsSync(filePath)) {
      console.error(`  File not found: ${filePath}`);
      continue;
    }

    try {
      const created = await guild.emojis.create({
        attachment: filePath,
        name: emoji.name,
        reason: 'ApexPulse rank badges',
      });
      console.log(`  Uploaded: :${emoji.name}: (${created.id})`);
    } catch (err) {
      console.error(`  Failed: ${emoji.name} — ${err.message}`);
    }
  }

  console.log('\nDone. Emoji IDs for bot.js:');
  const refreshed = await guild.emojis.fetch();
  for (const emoji of EMOJIS) {
    const found = refreshed.find(e => e.name === emoji.name);
    if (found) console.log(`  '${emoji.name}': '<:${emoji.name}:${found.id}>'`);
  }

  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
