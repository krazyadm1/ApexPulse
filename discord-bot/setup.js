const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');

// ============================================================
// CONFIGURATION — edit your bot token and server ID here
// ============================================================
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const GUILD_ID = process.env.DISCORD_GUILD_ID || 'YOUR_SERVER_ID_HERE';

// ============================================================
// ROLE DEFINITIONS (created top-to-bottom = highest to lowest)
// ============================================================
const ROLES = [
  // --- Staff ---
  { name: '👑 Owner',            color: '#00D4FF', hoist: true, permissions: [PermissionFlagsBits.Administrator] },
  { name: '🛡️ Admin',            color: '#E74C3C', hoist: true, permissions: [PermissionFlagsBits.Administrator] },
  { name: '⚔️ Moderator',        color: '#E67E22', hoist: true, permissions: [
    PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ModerateMembers,
  ]},
  { name: '🎙️ Community Manager', color: '#F39C12', hoist: true, permissions: [
    PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ModerateMembers,
  ]},

  // --- Special ---
  { name: '🤖 Bot',              color: '#7289DA', hoist: false, permissions: [] },
  { name: '⭐ OG',               color: '#FFD700', hoist: true, permissions: [] },
  { name: '🧪 Beta Tester',      color: '#00D4FF', hoist: true, permissions: [] },
  { name: '🐛 Bug Hunter',       color: '#2ECC71', hoist: false, permissions: [] },
  { name: '📢 Content Creator',  color: '#E91E63', hoist: true, permissions: [] },

  // --- Apex Rank Roles ---
  { name: 'Predator',   color: '#FF3030', hoist: true, permissions: [] },
  { name: 'Master',     color: '#CE6CFF', hoist: true, permissions: [] },
  { name: 'Diamond',    color: '#51A8FF', hoist: true, permissions: [] },
  { name: 'Platinum',   color: '#21C2A3', hoist: true, permissions: [] },
  { name: 'Gold',       color: '#D4A928', hoist: true, permissions: [] },
  { name: 'Silver',     color: '#95A5A6', hoist: true, permissions: [] },
  { name: 'Bronze',     color: '#CD7F32', hoist: true, permissions: [] },
  { name: 'Rookie',     color: '#8B6914', hoist: true, permissions: [] },

  // --- Notification Ping Roles ---
  { name: '📣 Announcements',    color: null, hoist: false, permissions: [] },
  { name: '🎮 LFG Ping',         color: null, hoist: false, permissions: [] },
  { name: '🔔 Update Ping',      color: null, hoist: false, permissions: [] },
  { name: '🎉 Event Ping',       color: null, hoist: false, permissions: [] },

  // --- Platform Roles ---
  { name: 'PC',          color: null, hoist: false, permissions: [] },
  { name: 'PlayStation', color: null, hoist: false, permissions: [] },
  { name: 'Xbox',        color: null, hoist: false, permissions: [] },

  // --- Base ---
  { name: '✅ Verified',  color: '#2ECC71', hoist: false, permissions: [] },
];

// ============================================================
// CHANNEL STRUCTURE
// ============================================================

// Helper: standard read-only for everyone, send for staff
const readOnly = (roles) => [
  { id: 'everyone', deny: [PermissionFlagsBits.SendMessages] },
  { id: '🛡️ Admin', allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
  { id: '⚔️ Moderator', allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
];

const staffOnly = () => [
  { id: 'everyone', deny: [PermissionFlagsBits.ViewChannel] },
  { id: '👑 Owner', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  { id: '🛡️ Admin', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  { id: '⚔️ Moderator', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  { id: '🎙️ Community Manager', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
];

const CATEGORIES = [
  {
    name: '📌 INFORMATION',
    channels: [
      { name: 'welcome',        type: ChannelType.GuildText, topic: 'Welcome to the ApexPulse community! Read the rules and grab your roles.', overwrites: readOnly() },
      { name: 'rules',           type: ChannelType.GuildText, topic: 'Server rules — read before participating.', overwrites: readOnly() },
      { name: 'announcements',   type: ChannelType.GuildText, topic: 'Official ApexPulse announcements and updates.', overwrites: readOnly() },
      { name: 'changelogs',      type: ChannelType.GuildText, topic: 'ApexPulse app version history and patch notes.', overwrites: readOnly() },
      { name: 'get-roles',       type: ChannelType.GuildText, topic: 'React to get your rank, platform, and notification roles.' , overwrites: readOnly() },
      { name: 'faq',             type: ChannelType.GuildText, topic: 'Frequently asked questions about ApexPulse.', overwrites: readOnly() },
    ],
  },
  {
    name: '💬 COMMUNITY',
    channels: [
      { name: 'general',         type: ChannelType.GuildText, topic: 'General chat — keep it chill.' },
      { name: 'introductions',   type: ChannelType.GuildText, topic: 'New here? Introduce yourself!' },
      { name: 'apex-discussion',  type: ChannelType.GuildText, topic: 'Talk about Apex Legends — meta, patch notes, lore, whatever.' },
      { name: 'clips-and-highlights', type: ChannelType.GuildText, topic: 'Drop your best clips and highlights here.' },
      { name: 'memes',           type: ChannelType.GuildText, topic: 'Apex memes only. Keep it SFW.' },
      { name: 'off-topic',       type: ChannelType.GuildText, topic: 'Anything that doesn\'t fit elsewhere.' },
    ],
  },
  {
    name: '🎮 LOOKING FOR GROUP',
    channels: [
      { name: 'lfg-ranked',      type: ChannelType.GuildText, topic: 'Find ranked teammates. Post your rank, platform, and region.' },
      { name: 'lfg-pubs',        type: ChannelType.GuildText, topic: 'Looking for casual/pub teammates.' },
      { name: 'lfg-arenas',      type: ChannelType.GuildText, topic: 'Find arena partners.' },
      { name: 'lfg-mixtape',     type: ChannelType.GuildText, topic: 'TDM, Control, Gun Run — find your squad.' },
      { name: 'lfg-scrims',      type: ChannelType.GuildText, topic: 'Competitive scrims and tournament team finding.' },
    ],
  },
  {
    name: '🎤 VOICE',
    channels: [
      { name: 'General Voice',   type: ChannelType.GuildVoice },
      { name: 'LFG Voice 1',     type: ChannelType.GuildVoice },
      { name: 'LFG Voice 2',     type: ChannelType.GuildVoice },
      { name: 'LFG Voice 3',     type: ChannelType.GuildVoice },
      { name: 'Ranked Squad',    type: ChannelType.GuildVoice },
      { name: 'AFK',             type: ChannelType.GuildVoice },
    ],
  },
  {
    name: '🛠️ APEXPULSE SUPPORT',
    channels: [
      { name: 'support-general',  type: ChannelType.GuildText, topic: 'General support questions about ApexPulse.' },
      { name: 'bug-reports',      type: ChannelType.GuildText, topic: 'Report bugs here. Include your OS, app version, and steps to reproduce.' },
      { name: 'feature-requests', type: ChannelType.GuildText, topic: 'Got an idea? Post it here. Upvote ideas you like.' },
      { name: 'beta-testing',     type: ChannelType.GuildText, topic: 'Beta builds and testing discussion.', overwrites: [
        { id: 'everyone', deny: [PermissionFlagsBits.ViewChannel] },
        { id: '🧪 Beta Tester', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: '🛡️ Admin', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: '⚔️ Moderator', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ]},
    ],
  },
  {
    name: '🏆 STATS & FLEX',
    channels: [
      { name: 'stat-check',      type: ChannelType.GuildText, topic: 'Post your stats, badges, and rank screenshots.' },
      { name: 'rank-ups',        type: ChannelType.GuildText, topic: 'Hit a new rank? Celebrate here!' },
      { name: 'loadouts',        type: ChannelType.GuildText, topic: 'Share your favorite weapon loadouts and legend setups.' },
      { name: 'pack-openings',   type: ChannelType.GuildText, topic: 'Heirloom pulls, legendary drops — show us what you got.' },
    ],
  },
  {
    name: '📢 CONTENT CREATORS',
    channels: [
      { name: 'self-promo',      type: ChannelType.GuildText, topic: 'Share your YouTube, Twitch, TikTok content. One post per day.' },
      { name: 'stream-announcements', type: ChannelType.GuildText, topic: 'Going live? Let people know.' },
    ],
  },
  {
    name: '🔒 STAFF',
    channels: [
      { name: 'staff-chat',      type: ChannelType.GuildText, topic: 'Internal staff discussion.', overwrites: staffOnly() },
      { name: 'mod-logs',        type: ChannelType.GuildText, topic: 'Moderation action logs.', overwrites: staffOnly() },
      { name: 'staff-voice',     type: ChannelType.GuildVoice, overwrites: staffOnly() },
    ],
  },
];

// ============================================================
// WELCOME EMBED CONTENT
// ============================================================
function buildWelcomeEmbed() {
  return new EmbedBuilder()
    .setColor(0x00D4FF)
    .setTitle('Welcome to ApexPulse')
    .setDescription(
      'ApexPulse is the Apex Legends companion app that tracks your stats, match history, and live game data — right on your desktop.\n\n' +
      '**Get Started:**\n' +
      '1. Read the rules in #rules\n' +
      '2. Grab your roles in #get-roles\n' +
      '3. Say hi in #introductions\n' +
      '4. Find teammates in the LFG channels\n\n' +
      '**Links:**\n' +
      '• [Download ApexPulse](https://overwolf.com) *(coming soon)*\n' +
      '• [Report a Bug](#bug-reports)\n' +
      '• [Request a Feature](#feature-requests)'
    )
    .setFooter({ text: 'ApexPulse — The Apex Legends tracker that actually works.' })
    .setTimestamp();
}

function buildRulesEmbed() {
  return new EmbedBuilder()
    .setColor(0x00D4FF)
    .setTitle('Server Rules')
    .setDescription(
      '**1.** Be respectful. No hate speech, harassment, or discrimination.\n' +
      '**2.** No spam, self-promo outside #self-promo, or excessive pinging.\n' +
      '**3.** Keep content SFW. No NSFW in any channel.\n' +
      '**4.** No cheating discussion — no hacks, exploits, or cheat tools.\n' +
      '**5.** No account selling/buying or real-money trading.\n' +
      '**6.** Use channels for their intended purpose.\n' +
      '**7.** Listen to staff. Mod decisions are final.\n' +
      '**8.** No doxxing or sharing personal info without consent.\n' +
      '**9.** English in public channels. Other languages in #off-topic.\n' +
      '**10.** Have fun. This is a gaming community, not a courtroom.\n\n' +
      '*Breaking rules = warn → mute → kick → ban. Staff discretion applies.*'
    )
    .setFooter({ text: 'Last updated' })
    .setTimestamp();
}

function buildRolesEmbed() {
  return new EmbedBuilder()
    .setColor(0x00D4FF)
    .setTitle('Get Your Roles')
    .setDescription(
      '**Apex Rank** *(pick one)*\n' +
      '🔴 Predator | 🟣 Master | 🔵 Diamond | 🟢 Platinum\n' +
      '🟡 Gold | ⚪ Silver | 🟤 Bronze | 🟫 Rookie\n\n' +
      '**Platform** *(pick one)*\n' +
      '🖥️ PC | 🎮 PlayStation | 🎮 Xbox\n\n' +
      '**Notifications** *(pick any)*\n' +
      '📣 Announcements | 🎮 LFG Ping | 🔔 Update Ping | 🎉 Event Ping\n\n' +
      '*React to this message to get your roles!*\n' +
      '*Set up a role-react bot (like Carl-bot or YAGPDB) to automate this.*'
    )
    .setFooter({ text: 'ApexPulse Roles' });
}

// ============================================================
// SETUP LOGIC
// ============================================================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error(`Could not find guild ${GUILD_ID}. Make sure the bot is in the server.`);
    process.exit(1);
  }

  console.log(`Setting up server: ${guild.name}\n`);

  // --- Create Roles ---
  console.log('=== CREATING ROLES ===');
  const roleMap = new Map();

  for (let i = ROLES.length - 1; i >= 0; i--) {
    const roleDef = ROLES[i];
    const existing = guild.roles.cache.find(r => r.name === roleDef.name);
    if (existing) {
      console.log(`  ✓ Role already exists: ${roleDef.name}`);
      roleMap.set(roleDef.name, existing);
      continue;
    }

    try {
      const permissions = roleDef.permissions.length > 0
        ? roleDef.permissions.reduce((acc, p) => acc | p, 0n)
        : 0n;

      const role = await guild.roles.create({
        name: roleDef.name,
        color: roleDef.color || undefined,
        hoist: roleDef.hoist,
        permissions: permissions,
        reason: 'ApexPulse server setup',
      });
      roleMap.set(roleDef.name, role);
      console.log(`  + Created role: ${roleDef.name}`);
    } catch (err) {
      console.error(`  ✗ Failed to create role ${roleDef.name}: ${err.message}`);
    }
  }

  // Reorder roles so they display correctly (highest first)
  console.log('\n  Reordering roles...');
  try {
    const positions = [];
    for (let i = 0; i < ROLES.length; i++) {
      const role = roleMap.get(ROLES[i].name);
      if (role && !role.managed) {
        positions.push({ role: role.id, position: ROLES.length - i });
      }
    }
    await guild.roles.setPositions(positions);
    console.log('  ✓ Roles reordered');
  } catch (err) {
    console.error(`  ✗ Role reorder failed (bot role may need to be higher): ${err.message}`);
  }

  // --- Create Categories and Channels ---
  console.log('\n=== CREATING CHANNELS ===');

  for (const categoryDef of CATEGORIES) {
    let category = guild.channels.cache.find(
      c => c.name === categoryDef.name && c.type === ChannelType.GuildCategory
    );

    if (!category) {
      try {
        category = await guild.channels.create({
          name: categoryDef.name,
          type: ChannelType.GuildCategory,
          reason: 'ApexPulse server setup',
        });
        console.log(`\n  + Created category: ${categoryDef.name}`);
      } catch (err) {
        console.error(`  ✗ Failed to create category ${categoryDef.name}: ${err.message}`);
        continue;
      }
    } else {
      console.log(`\n  ✓ Category exists: ${categoryDef.name}`);
    }

    for (const channelDef of categoryDef.channels) {
      const existing = guild.channels.cache.find(
        c => c.name === channelDef.name.toLowerCase().replace(/ /g, '-') && c.parentId === category.id
      );

      if (existing) {
        console.log(`    ✓ Channel exists: ${channelDef.name}`);
        continue;
      }

      try {
        const permissionOverwrites = [];
        if (channelDef.overwrites) {
          for (const ow of channelDef.overwrites) {
            let targetId;
            if (ow.id === 'everyone') {
              targetId = guild.id;
            } else {
              const role = roleMap.get(ow.id);
              if (!role) continue;
              targetId = role.id;
            }
            permissionOverwrites.push({
              id: targetId,
              allow: ow.allow || [],
              deny: ow.deny || [],
            });
          }
        }

        await guild.channels.create({
          name: channelDef.name,
          type: channelDef.type || ChannelType.GuildText,
          parent: category.id,
          topic: channelDef.topic || null,
          permissionOverwrites: permissionOverwrites.length > 0 ? permissionOverwrites : undefined,
          reason: 'ApexPulse server setup',
        });
        console.log(`    + Created channel: ${channelDef.name}`);
      } catch (err) {
        console.error(`    ✗ Failed to create channel ${channelDef.name}: ${err.message}`);
      }
    }
  }

  // --- Post Welcome Messages ---
  console.log('\n=== POSTING WELCOME CONTENT ===');

  const welcomeChannel = guild.channels.cache.find(c => c.name === 'welcome' && c.type === ChannelType.GuildText);
  const rulesChannel = guild.channels.cache.find(c => c.name === 'rules' && c.type === ChannelType.GuildText);
  const rolesChannel = guild.channels.cache.find(c => c.name === 'get-roles' && c.type === ChannelType.GuildText);

  if (welcomeChannel) {
    const messages = await welcomeChannel.messages.fetch({ limit: 1 });
    if (messages.size === 0) {
      await welcomeChannel.send({ embeds: [buildWelcomeEmbed()] });
      console.log('  + Posted welcome embed');
    } else {
      console.log('  ✓ Welcome channel already has content');
    }
  }

  if (rulesChannel) {
    const messages = await rulesChannel.messages.fetch({ limit: 1 });
    if (messages.size === 0) {
      await rulesChannel.send({ embeds: [buildRulesEmbed()] });
      console.log('  + Posted rules embed');
    } else {
      console.log('  ✓ Rules channel already has content');
    }
  }

  if (rolesChannel) {
    const messages = await rolesChannel.messages.fetch({ limit: 1 });
    if (messages.size === 0) {
      await rolesChannel.send({ embeds: [buildRolesEmbed()] });
      console.log('  + Posted roles embed');
    } else {
      console.log('  ✓ Roles channel already has content');
    }
  }

  // --- Update Server Settings ---
  console.log('\n=== SERVER SETTINGS ===');
  try {
    const updates = {};

    if (welcomeChannel) {
      updates.systemChannel = welcomeChannel.id;
    }
    if (rulesChannel) {
      updates.rulesChannel = rulesChannel.id;
    }

    if (Object.keys(updates).length > 0) {
      await guild.edit(updates);
      console.log('  ✓ Updated server system/rules channels');
    }
  } catch (err) {
    console.error(`  ✗ Failed to update server settings: ${err.message}`);
  }

  console.log('\n========================================');
  console.log('  SERVER SETUP COMPLETE');
  console.log('========================================');
  console.log('\nNext steps:');
  console.log('  1. Add a role-react bot (Carl-bot or YAGPDB) for #get-roles');
  console.log('  2. Upload your server icon/banner');
  console.log('  3. Enable Community features in Server Settings if desired');
  console.log('  4. Assign yourself the 👑 Owner role');
  console.log('  5. Move the bot\'s auto-created role above all custom roles');
  console.log('\nYou can safely remove this bot from the server now.');

  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN).catch(err => {
  console.error('Failed to login. Check your bot token.');
  console.error(err.message);
  process.exit(1);
});
