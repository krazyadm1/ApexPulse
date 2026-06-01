const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1497075111549734963';
const API_KEY = '39e47f334e786791a2ba13c491edce58';
const API_BASE = 'https://api.mozambiquehe.re';
const LINKS_FILE = path.join(__dirname, 'linked-accounts.json');

// ─── Linked Accounts Persistence ─────────────────────────────────────────────

function loadLinks() {
  try { return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')); } catch { return {}; }
}

function saveLinks(links) {
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
}

// ─── API Helper ──────────────────────────────────────────────────────────────

function apiGet(endpoint, params) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    url.searchParams.set('auth', API_KEY);
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);

    https.get(url.toString(), { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid API response')); }
      });
    }).on('error', reject);
  });
}

// ─── Multi-platform Player Lookup ────────────────────────────────────────────

async function findPlayer(name, preferredPlatform) {
  if (preferredPlatform) {
    const data = await apiGet('/bridge', { player: name, platform: preferredPlatform });
    if (!data.Error) return data;
  }
  for (const platform of ['PC', 'PS4', 'X1']) {
    if (platform === preferredPlatform) continue;
    try {
      const data = await apiGet('/bridge', { player: name, platform });
      if (!data.Error) return data;
    } catch { /* try next */ }
  }
  return { Error: 'Player not found on any platform.' };
}

// ─── Rank Colors ─────────────────────────────────────────────────────────────

const RANK_COLORS = {
  'Unranked': 0x888888,
  'Rookie': 0x8B6914,
  'Bronze': 0xCD7F32,
  'Silver': 0x95A5A6,
  'Gold': 0xD4A928,
  'Platinum': 0x21C2A3,
  'Diamond': 0x51A8FF,
  'Master': 0xCE6CFF,
  'Predator': 0xFF3030,
};

function getRankColor(rankName) {
  for (const [key, color] of Object.entries(RANK_COLORS)) {
    if (rankName && rankName.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return 0x00D4FF;
}

// ─── Slash Command Definitions ───────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Look up an Apex Legends player\'s stats')
    .addStringOption(opt => opt.setName('player').setDescription('EA/Origin username (or leave blank if linked)'))
    .addStringOption(opt => opt.setName('platform').setDescription('Platform').addChoices(
      { name: 'PC', value: 'PC' },
      { name: 'PlayStation', value: 'PS4' },
      { name: 'Xbox', value: 'X1' },
    )),

  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show a player\'s current ranked status')
    .addStringOption(opt => opt.setName('player').setDescription('EA/Origin username (or leave blank if linked)'))
    .addStringOption(opt => opt.setName('platform').setDescription('Platform').addChoices(
      { name: 'PC', value: 'PC' },
      { name: 'PlayStation', value: 'PS4' },
      { name: 'Xbox', value: 'X1' },
    )),

  new SlashCommandBuilder()
    .setName('map')
    .setDescription('Show current map rotation and countdown'),

  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your EA/Origin name to your Discord account')
    .addStringOption(opt => opt.setName('name').setDescription('Your EA/Origin username').setRequired(true))
    .addStringOption(opt => opt.setName('platform').setDescription('Platform').addChoices(
      { name: 'PC', value: 'PC' },
      { name: 'PlayStation', value: 'PS4' },
      { name: 'Xbox', value: 'X1' },
    )),

  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your EA/Origin name from your Discord account'),

  new SlashCommandBuilder()
    .setName('credits')
    .setDescription('Show data sources and credits'),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Server leaderboard of linked players')
    .addStringOption(opt => opt.setName('sort').setDescription('Sort by').addChoices(
      { name: 'Kills', value: 'kills' },
      { name: 'Level', value: 'level' },
      { name: 'Rank', value: 'rank' },
    )),

  new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Compare two players side by side')
    .addStringOption(opt => opt.setName('player1').setDescription('First player').setRequired(true))
    .addStringOption(opt => opt.setName('player2').setDescription('Second player').setRequired(true))
    .addStringOption(opt => opt.setName('platform').setDescription('Platform').addChoices(
      { name: 'PC', value: 'PC' },
      { name: 'PlayStation', value: 'PS4' },
      { name: 'Xbox', value: 'X1' },
    )),
];

// ─── Reaction Role Config ────────────────────────────────────────────────────

const ROLES_CHANNEL_NAME = 'get-roles';

const RANK_EMOJIS = {
  apex_predator: '1510882181587927140',
  apex_master: '1510882182376456192',
  apex_diamond: '1510882183160528906',
  apex_platinum: '1510882183823229060',
  apex_gold: '1510882185081520148',
  apex_silver: '1510882186323034132',
  apex_bronze: '1510882188483100774',
  apex_rookie: '1510883730871550043',
};

const ROLE_MENUS = [
  {
    title: 'Select Your Apex Rank',
    description: 'React to get your current rank. Only one rank at a time — switching removes the old one.',
    footer: 'Rank badges from apexlegendsstatus.com',
    color: 0x00D4FF,
    unique: true,
    useCustomEmojis: true,
    roles: {
      [RANK_EMOJIS.apex_predator]: 'Predator',
      [RANK_EMOJIS.apex_master]: 'Master',
      [RANK_EMOJIS.apex_diamond]: 'Diamond',
      [RANK_EMOJIS.apex_platinum]: 'Platinum',
      [RANK_EMOJIS.apex_gold]: 'Gold',
      [RANK_EMOJIS.apex_silver]: 'Silver',
      [RANK_EMOJIS.apex_bronze]: 'Bronze',
      [RANK_EMOJIS.apex_rookie]: 'Rookie',
    },
  },
  {
    title: 'Select Your Platform',
    description: 'React to get your platform role. One platform at a time.',
    color: 0x00D4FF,
    unique: true,
    useCustomEmojis: true,
    roles: {
      '1510886573657292890': 'PC',
      '1510886574470987908': 'PlayStation',
      '1510886575603454043': 'Xbox',
    },
  },
  {
    title: 'Select Your Notification Pings',
    description: 'React to opt in to pings. You can pick as many as you want.',
    color: 0x00D4FF,
    unique: false,
    roles: { '📣': '📣 Announcements', '🎮': '🎮 LFG Ping', '🔔': '🔔 Update Ping', '🎉': '🎉 Event Ping' },
  },
];

const messageMenuMap = new Map();

// ─── Client Setup ────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

// ─── Register Slash Commands ─────────────────────────────────────────────────

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: commands.map(c => c.toJSON()),
    });
    console.log('Slash commands registered.');
  } catch (err) {
    console.error('Failed to register commands:', err.message);
  }
}

// ─── Resolve Player Name ─────────────────────────────────────────────────────

function resolvePlayer(interaction) {
  const explicit = interaction.options.getString('player');
  if (explicit) return { name: explicit, platform: interaction.options.getString('platform') || 'PC' };

  const links = loadLinks();
  const linked = links[interaction.user.id];
  if (linked) return { name: linked.name, platform: linked.platform || 'PC' };

  return null;
}

// ─── Command Handlers ────────────────────────────────────────────────────────

async function handleStats(interaction) {
  const player = resolvePlayer(interaction);
  if (!player) {
    return interaction.reply({ content: 'No player specified. Use `/link` to link your account, or provide a player name.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const data = await findPlayer(player.name, player.platform);

    if (data.Error) {
      return interaction.editReply(`Player **${player.name}** not found on any platform. Check the spelling.`);
    }

    const g = data.global || {};
    const total = data.total || {};
    const rank = g.rank || {};
    const legend = data.realtime?.selectedLegend || 'Unknown';

    const kills = total.kills?.value ?? null;
    const damage = total.damage?.value ?? null;
    const wins = total.wins?.value ?? null;
    const kd = total.kd?.value;
    const kdDisplay = (kd != null && kd >= 0) ? String(kd) : (kills != null && wins != null ? (kills / Math.max(1, kills - wins)).toFixed(2) : '—');

    const embed = new EmbedBuilder()
      .setColor(getRankColor(rank.rankName))
      .setTitle(`${g.name || player.name}`)
      .setDescription(`Level **${g.level || 0}** | ${rank.rankName || 'Unranked'} ${rank.rankDiv || ''} | ${rank.rankScore?.toLocaleString() || 0} RP`)
      .addFields(
        { name: 'Kills', value: kills != null ? kills.toLocaleString() : '*No tracker*', inline: true },
        { name: 'Damage', value: damage != null ? damage.toLocaleString() : '*No tracker*', inline: true },
        { name: 'Wins', value: wins != null ? wins.toLocaleString() : '*No tracker*', inline: true },
        { name: 'K/D', value: kdDisplay, inline: true },
        { name: 'Selected Legend', value: legend, inline: true },
        { name: 'Platform', value: g.platform || player.platform, inline: true },
      )
      .setThumbnail(rank.rankImg || null)
      .setFooter({ text: `ApexPulse | ${g.platform || player.platform}` })
      .setTimestamp();

    if (g.avatar) embed.setAuthor({ name: g.name, iconURL: g.avatar });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    return interaction.editReply(`API error: ${err.message}`);
  }
}

async function handleRank(interaction) {
  const player = resolvePlayer(interaction);
  if (!player) {
    return interaction.reply({ content: 'No player specified. Use `/link` to link your account, or provide a player name.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const data = await findPlayer(player.name, player.platform);

    if (data.Error) {
      return interaction.editReply(`Player **${player.name}** not found on any platform.`);
    }

    const g = data.global || {};
    const rank = g.rank || {};

    const embed = new EmbedBuilder()
      .setColor(getRankColor(rank.rankName))
      .setTitle(`${g.name || player.name} — Ranked`)
      .addFields(
        { name: 'Rank', value: `${rank.rankName || 'Unranked'} ${rank.rankDiv || ''}`, inline: true },
        { name: 'RP', value: `${(rank.rankScore || 0).toLocaleString()}`, inline: true },
        { name: 'Ladder Position', value: `#${(rank.ladderPosPlatform || 0).toLocaleString()}`, inline: true },
      )
      .setThumbnail(rank.rankImg || null)
      .setFooter({ text: 'ApexPulse' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    return interaction.editReply(`API error: ${err.message}`);
  }
}

async function handleMap(interaction) {
  await interaction.deferReply();

  try {
    const data = await apiGet('/maprotation', { version: 2 });

    const br = data.battle_royale || {};
    const ranked = data.ranked || {};
    const ltm = data.ltm || {};

    const embed = new EmbedBuilder()
      .setColor(0x00D4FF)
      .setTitle('Apex Legends — Map Rotation')
      .setTimestamp();

    if (br.current) {
      embed.addFields({
        name: '🎮 Battle Royale',
        value: `**${br.current.map}** — ${br.current.remainingTimer || '?'} left\nNext: ${br.next?.map || '?'}`,
        inline: false,
      });
    }

    if (ranked.current) {
      embed.addFields({
        name: '🏆 Ranked',
        value: `**${ranked.current.map}** — ${ranked.current.remainingTimer || '?'} left\nNext: ${ranked.next?.map || '?'}`,
        inline: false,
      });
    }

    if (ltm?.current) {
      embed.addFields({
        name: '🎭 Mixtape / LTM',
        value: `**${ltm.current.map}** — ${ltm.current.remainingTimer || '?'} left`,
        inline: false,
      });
    }

    embed.setFooter({ text: 'ApexPulse | Data from apexlegendsapi.com' });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    return interaction.editReply(`API error: ${err.message}`);
  }
}

async function handleLink(interaction) {
  const name = interaction.options.getString('name');
  const platform = interaction.options.getString('platform') || 'PC';

  await interaction.deferReply({ ephemeral: true });

  try {
    const data = await findPlayer(name, platform);
    if (data.Error) {
      return interaction.editReply(`Player **${name}** not found on any platform. Check the spelling.`);
    }

    const links = loadLinks();
    links[interaction.user.id] = {
      name: data.global?.name || name,
      platform,
      uid: data.global?.uid || null,
      linkedAt: Date.now(),
    };
    saveLinks(links);

    return interaction.editReply(`Linked **${data.global?.name || name}** (${platform}) to your Discord account. You can now use \`/stats\` and \`/rank\` without specifying a player name.`);
  } catch (err) {
    return interaction.editReply(`API error: ${err.message}`);
  }
}

async function handleUnlink(interaction) {
  const links = loadLinks();
  if (!links[interaction.user.id]) {
    return interaction.reply({ content: 'You don\'t have a linked account.', ephemeral: true });
  }
  delete links[interaction.user.id];
  saveLinks(links);
  return interaction.reply({ content: 'Account unlinked.', ephemeral: true });
}

async function handleLeaderboard(interaction) {
  const sortBy = interaction.options.getString('sort') || 'kills';
  const links = loadLinks();
  const entries = Object.entries(links);

  if (entries.length === 0) {
    return interaction.reply({ content: 'No linked players yet. Use `/link` to add yours!', ephemeral: true });
  }

  await interaction.deferReply();

  const results = [];
  for (const [discordId, info] of entries) {
    try {
      const data = await apiGet('/bridge', { player: info.name, platform: info.platform || 'PC' });
      if (data.Error) continue;

      const g = data.global || {};
      const total = data.total || {};
      results.push({
        discordId,
        name: g.name || info.name,
        level: g.level || 0,
        kills: total.kills?.value || 0,
        rankName: g.rank?.rankName || 'Unranked',
        rankDiv: g.rank?.rankDiv || 0,
        rankScore: g.rank?.rankScore || 0,
        platform: info.platform || 'PC',
      });
    } catch { /* skip failed lookups */ }
  }

  if (results.length === 0) {
    return interaction.editReply('Could not fetch stats for any linked players.');
  }

  if (sortBy === 'kills') results.sort((a, b) => b.kills - a.kills);
  else if (sortBy === 'level') results.sort((a, b) => b.level - a.level);
  else if (sortBy === 'rank') results.sort((a, b) => b.rankScore - a.rankScore);

  const lines = results.slice(0, 15).map((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    if (sortBy === 'rank') {
      return `${medal} **${r.name}** — ${r.rankName} ${r.rankDiv} (${r.rankScore.toLocaleString()} RP)`;
    } else if (sortBy === 'level') {
      return `${medal} **${r.name}** — Level ${r.level}`;
    } else {
      return `${medal} **${r.name}** — ${r.kills.toLocaleString()} kills`;
    }
  });

  const sortLabel = sortBy === 'rank' ? 'Rank' : sortBy === 'level' ? 'Level' : 'Kills';

  const embed = new EmbedBuilder()
    .setColor(0x00D4FF)
    .setTitle(`ApexPulse Leaderboard — ${sortLabel}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${results.length} linked players | Use /link to join` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleCredits(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x00D4FF)
    .setTitle('ApexPulse — Credits & Sources')
    .setDescription(
      '**Player Stats API**\n[apexlegendsapi.com](https://apexlegendsapi.com) (mozambiquehe.re)\n\n' +
      '**Rank Badge Images**\n[apexlegendsstatus.com](https://apexlegendsstatus.com/game-stats/cosmetics-statistics)\n\n' +
      '**Game Events**\n[Overwolf GEP](https://overwolf.github.io) (Game Events Provider)\n\n' +
      '**Built by**\nApexPulse'
    )
    .setFooter({ text: 'ApexPulse — The Apex Legends tracker that actually works.' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

async function handleCompare(interaction) {
  const p1Name = interaction.options.getString('player1');
  const p2Name = interaction.options.getString('player2');
  const platform = interaction.options.getString('platform') || 'PC';

  await interaction.deferReply();

  try {
    const [d1, d2] = await Promise.all([
      findPlayer(p1Name, platform),
      findPlayer(p2Name, platform),
    ]);

    if (d1.Error) return interaction.editReply(`Player **${p1Name}** not found.`);
    if (d2.Error) return interaction.editReply(`Player **${p2Name}** not found.`);

    const g1 = d1.global || {};
    const g2 = d2.global || {};
    const t1 = d1.total || {};
    const t2 = d2.total || {};
    const r1 = g1.rank || {};
    const r2 = g2.rank || {};

    const fmt = (v) => v != null ? v.toLocaleString() : '—';

    const embed = new EmbedBuilder()
      .setColor(0x00D4FF)
      .setTitle(`${g1.name || p1Name}  vs  ${g2.name || p2Name}`)
      .addFields(
        { name: 'Level', value: `**${g1.level || 0}** vs **${g2.level || 0}**`, inline: false },
        { name: g1.name || p1Name, value: [
          `Kills: **${fmt(t1.kills?.value)}**`,
          `Damage: **${fmt(t1.damage?.value)}**`,
          `Wins: **${fmt(t1.wins?.value)}**`,
          `K/D: **${t1.kd?.value ?? '—'}**`,
          `Rank: **${r1.rankName || 'Unranked'} ${r1.rankDiv || ''}**`,
          `RP: **${fmt(r1.rankScore)}**`,
        ].join('\n'), inline: true },
        { name: g2.name || p2Name, value: [
          `Kills: **${fmt(t2.kills?.value)}**`,
          `Damage: **${fmt(t2.damage?.value)}**`,
          `Wins: **${fmt(t2.wins?.value)}**`,
          `K/D: **${t2.kd?.value ?? '—'}**`,
          `Rank: **${r2.rankName || 'Unranked'} ${r2.rankDiv || ''}**`,
          `RP: **${fmt(r2.rankScore)}**`,
        ].join('\n'), inline: true },
      )
      .setFooter({ text: `${platform} | ApexPulse` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    return interaction.editReply(`API error: ${err.message}`);
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`Bot online: ${client.user.tag}`);
  await registerCommands();

  // Set up reaction roles
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('Guild not found. Check GUILD_ID.');
    return;
  }

  const channel = guild.channels.cache.find(c => c.name === ROLES_CHANNEL_NAME);
  if (!channel) {
    console.log(`#${ROLES_CHANNEL_NAME} channel not found — skipping reaction roles.`);
    return;
  }

  const existing = await channel.messages.fetch({ limit: 20 });
  const botMessages = existing.filter(m => m.author.id === client.user.id);

  if (botMessages.size >= ROLE_MENUS.length) {
    const sorted = [...botMessages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (let i = 0; i < ROLE_MENUS.length; i++) {
      messageMenuMap.set(sorted[i].id, ROLE_MENUS[i]);
      console.log(`Reattached: ${ROLE_MENUS[i].title} (${sorted[i].id})`);
    }
  } else {
    for (const msg of botMessages.values()) {
      await msg.delete().catch(() => {});
    }

    for (const menu of ROLE_MENUS) {
      const lines = Object.entries(menu.roles).map(([emojiKey, role]) => {
        if (menu.useCustomEmojis) {
          const ge = guild.emojis.cache.get(emojiKey);
          const en = ge ? ge.name : role.toLowerCase();
          return `<:${en}:${emojiKey}>  →  **${role}**`;
        }
        return `${emojiKey}  →  **${role}**`;
      });
      const embed = new EmbedBuilder()
        .setTitle(menu.title)
        .setDescription(menu.description + '\n\n' + lines.join('\n'))
        .setColor(menu.color)
        .setFooter({ text: menu.footer || 'ApexPulse Roles' });

      const msg = await channel.send({ embeds: [embed] });
      for (const emojiKey of Object.keys(menu.roles)) {
        if (menu.useCustomEmojis) await msg.react(emojiKey);
        else await msg.react(emojiKey);
      }
      messageMenuMap.set(msg.id, menu);
      console.log(`Posted: ${menu.title}`);
    }
  }

  console.log('Reaction roles ready.');
});

// ─── Slash Command Router ────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'stats': return await handleStats(interaction);
      case 'rank': return await handleRank(interaction);
      case 'map': return await handleMap(interaction);
      case 'link': return await handleLink(interaction);
      case 'unlink': return await handleUnlink(interaction);
      case 'leaderboard': return await handleLeaderboard(interaction);
      case 'credits': return await handleCredits(interaction);
      case 'compare': return await handleCompare(interaction);
    }
  } catch (err) {
    console.error(`Command error (${interaction.commandName}):`, err);
    const reply = { content: 'Something went wrong. Try again.', ephemeral: true };
    if (interaction.deferred) await interaction.editReply(reply.content).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});

// ─── Reaction Role Handlers ─────────────────────────────────────────────────

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const menu = messageMenuMap.get(reaction.message.id);
  if (!menu) return;

  const emojiKey = menu.useCustomEmojis ? reaction.emoji.id : reaction.emoji.name;
  const roleName = menu.roles[emojiKey];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) return;

  if (menu.unique) {
    const otherRoleNames = Object.values(menu.roles).filter(r => r !== roleName);
    for (const otherName of otherRoleNames) {
      const otherRole = guild.roles.cache.find(r => r.name === otherName);
      if (otherRole && member.roles.cache.has(otherRole.id)) {
        await member.roles.remove(otherRole).catch(() => {});
      }
    }
    const currentEmojiId = reaction.emoji.id || reaction.emoji.name;
    for (const [, msgReaction] of reaction.message.reactions.cache) {
      const otherKey = msgReaction.emoji.id || msgReaction.emoji.name;
      if (otherKey !== currentEmojiId) await msgReaction.users.remove(user.id).catch(() => {});
    }
  }

  await member.roles.add(role).catch(err => console.error(`Failed to add role: ${err.message}`));
  console.log(`+ ${user.tag} → ${roleName}`);
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const menu = messageMenuMap.get(reaction.message.id);
  if (!menu) return;

  const emojiKey = menu.useCustomEmojis ? reaction.emoji.id : reaction.emoji.name;
  const roleName = menu.roles[emojiKey];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) return;

  await member.roles.remove(role).catch(err => console.error(`Failed to remove role: ${err.message}`));
  console.log(`- ${user.tag} ✕ ${roleName}`);
});

// ─── Welcome New Members ─────────────────────────────────────────────────────

client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.find(c => c.name === 'welcome');
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x00D4FF)
    .setDescription(
      `Hey ${member}, welcome to **ApexPulse**! 👋\n\n` +
      `• Grab your roles in <#${member.guild.channels.cache.find(c => c.name === 'get-roles')?.id || 'get-roles'}>\n` +
      `• Read the rules in <#${member.guild.channels.cache.find(c => c.name === 'rules')?.id || 'rules'}>\n` +
      `• Say hi in <#${member.guild.channels.cache.find(c => c.name === 'introductions')?.id || 'introductions'}>\n\n` +
      `You're member **#${member.guild.memberCount}**!`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => {});
});

// ─── Start ───────────────────────────────────────────────────────────────────

client.login(BOT_TOKEN);
