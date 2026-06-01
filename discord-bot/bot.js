const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const GUILD_ID = process.env.DISCORD_GUILD_ID || 'YOUR_SERVER_ID_HERE';
const ROLES_CHANNEL_NAME = 'get-roles';

const ROLE_MENUS = [
  {
    title: 'Select Your Apex Rank',
    description: 'React to get your current rank. Only one rank at a time — switching removes the old one.',
    color: 0x00D4FF,
    unique: true,
    roles: {
      '🔴': 'Predator',
      '🟣': 'Master',
      '🔵': 'Diamond',
      '🟢': 'Platinum',
      '🟡': 'Gold',
      '⚪': 'Silver',
      '🟤': 'Bronze',
      '🟫': 'Rookie',
    },
  },
  {
    title: 'Select Your Platform',
    description: 'React to get your platform role. One platform at a time.',
    color: 0x00D4FF,
    unique: true,
    roles: {
      '🖥️': 'PC',
      '🎮': 'PlayStation',
      '🕹️': 'Xbox',
    },
  },
  {
    title: 'Select Your Notification Pings',
    description: 'React to opt in to pings. You can pick as many as you want.',
    color: 0x00D4FF,
    unique: false,
    roles: {
      '📣': '📣 Announcements',
      '🎮': '🎮 LFG Ping',
      '🔔': '🔔 Update Ping',
      '🎉': '🎉 Event Ping',
    },
  },
];

// Track which message IDs belong to which menu config
const messageMenuMap = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

client.once('ready', async () => {
  console.log(`Bot online: ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('Guild not found. Check GUILD_ID.');
    process.exit(1);
  }

  const channel = guild.channels.cache.find(c => c.name === ROLES_CHANNEL_NAME);
  if (!channel) {
    console.error(`#${ROLES_CHANNEL_NAME} channel not found.`);
    process.exit(1);
  }

  // Clear old bot messages in the channel
  const existing = await channel.messages.fetch({ limit: 20 });
  const botMessages = existing.filter(m => m.author.id === client.user.id);
  for (const msg of botMessages.values()) {
    await msg.delete().catch(() => {});
  }

  // Post each reaction role menu
  for (const menu of ROLE_MENUS) {
    const lines = Object.entries(menu.roles).map(([emoji, role]) => `${emoji}  →  **${role}**`);

    const embed = new EmbedBuilder()
      .setTitle(menu.title)
      .setDescription(menu.description + '\n\n' + lines.join('\n'))
      .setColor(menu.color)
      .setFooter({ text: 'ApexPulse Roles' });

    const msg = await channel.send({ embeds: [embed] });

    // Add all reactions
    for (const emoji of Object.keys(menu.roles)) {
      await msg.react(emoji);
    }

    messageMenuMap.set(msg.id, menu);
    console.log(`Posted: ${menu.title} (${msg.id})`);
  }

  console.log('\nReaction roles ready. Keep this bot running.');
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  // Fetch partials if needed
  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const menu = messageMenuMap.get(reaction.message.id);
  if (!menu) return;

  const emoji = reaction.emoji.name;
  const roleName = menu.roles[emoji];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) {
    console.error(`Role not found: ${roleName}`);
    return;
  }

  // If unique mode, remove other roles from this menu first
  if (menu.unique) {
    const otherRoleNames = Object.values(menu.roles).filter(r => r !== roleName);
    for (const otherName of otherRoleNames) {
      const otherRole = guild.roles.cache.find(r => r.name === otherName);
      if (otherRole && member.roles.cache.has(otherRole.id)) {
        await member.roles.remove(otherRole).catch(() => {});
      }
    }
    // Remove other reactions from this message
    for (const [, msgReaction] of reaction.message.reactions.cache) {
      if (msgReaction.emoji.name !== emoji) {
        await msgReaction.users.remove(user.id).catch(() => {});
      }
    }
  }

  await member.roles.add(role).catch(err => {
    console.error(`Failed to add role ${roleName}: ${err.message}`);
  });
  console.log(`+ ${user.tag} → ${roleName}`);
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const menu = messageMenuMap.get(reaction.message.id);
  if (!menu) return;

  const emoji = reaction.emoji.name;
  const roleName = menu.roles[emoji];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) return;

  await member.roles.remove(role).catch(err => {
    console.error(`Failed to remove role ${roleName}: ${err.message}`);
  });
  console.log(`- ${user.tag} ✕ ${roleName}`);
});

client.login(BOT_TOKEN);
