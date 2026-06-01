const { Client, GatewayIntentBits } = require('discord.js');
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1497075111549734963';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  const channel = guild.channels.cache.find(c => c.name === 'get-roles');
  if (!channel) { console.log('No #get-roles'); process.exit(1); }
  const msgs = await channel.messages.fetch({ limit: 20 });
  const botMsgs = msgs.filter(m => m.author.id === client.user.id);
  for (const msg of botMsgs.values()) await msg.delete().catch(() => {});
  console.log(`Deleted ${botMsgs.size} bot messages. Restart bot to post fresh.`);
  client.destroy();
  process.exit(0);
});
client.login(BOT_TOKEN);
