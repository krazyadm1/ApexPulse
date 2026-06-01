const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1497075111549734963';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ─── Welcome Message ─────────────────────────────────────────────────────────

function buildWelcomeEmbed() {
  return new EmbedBuilder()
    .setColor(0x00D4FF)
    .setTitle('Welcome to ApexPulse')
    .setDescription(
      'The community hub for **ApexPulse** — the Apex Legends tracker that actually works.\n\n' +
      '**What is ApexPulse?**\n' +
      'A free Overwolf app that tracks your matches, stats, weapon performance, legend analytics, and ranked progress in real time — with a live in-game overlay.\n\n' +
      '**Getting Started:**\n' +
      '1. Read the rules in <#rules>\n' +
      '2. Grab your rank and platform roles in <#get-roles>\n' +
      '3. Introduce yourself in <#introductions>\n' +
      '4. Find teammates in the LFG channels\n' +
      '5. Download ApexPulse from the Overwolf App Store *(coming soon)*\n\n' +
      '**Links:**\n' +
      '• [Download ApexPulse](https://github.com/krazyadm1/ApexPulse/releases) — Latest release\n' +
      '• [Report a Bug](https://discord.com/channels/' + GUILD_ID + '/bug-reports) — Help us improve\n' +
      '• [Request a Feature](https://discord.com/channels/' + GUILD_ID + '/feature-requests) — Tell us what you want\n' +
      '• [Ko-fi](https://ko-fi.com/krazyadm) — Support development'
    )
    .setImage('https://raw.githubusercontent.com/krazyadm1/ApexPulse/master/assets/icons/icon.png')
    .setFooter({ text: 'ApexPulse — The Apex Legends tracker that actually works.' })
    .setTimestamp();
}

// ─── Rules ───────────────────────────────────────────────────────────────────

function buildRulesEmbed() {
  return new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle('Server Rules')
    .setDescription(
      'By participating in this server, you agree to follow these rules. Violations will result in warnings, mutes, kicks, or bans at staff discretion.\n\n' +

      '**1. Be Respectful**\n' +
      'No hate speech, harassment, discrimination, threats, or personal attacks. Trash talk is fine — toxicity is not.\n\n' +

      '**2. No Spam**\n' +
      'No excessive messages, emojis, images, or pings. No walls of text. No chain messages.\n\n' +

      '**3. No Self-Promotion**\n' +
      'Keep self-promo to <#self-promo> only. One post per day. No DM advertising.\n\n' +

      '**4. Keep It SFW**\n' +
      'No NSFW content in any channel. No gore, shock content, or disturbing imagery.\n\n' +

      '**5. No Cheating Discussion**\n' +
      'Do not discuss, share, or promote hacks, exploits, cheat tools, or aim assist manipulation. Zero tolerance.\n\n' +

      '**6. No Account Trading**\n' +
      'No selling, buying, or trading Apex accounts, in-game items, or services for real money.\n\n' +

      '**7. Use Channels Correctly**\n' +
      'Post content in the appropriate channel. Off-topic conversation goes in <#off-topic>.\n\n' +

      '**8. Listen to Staff**\n' +
      'Moderator decisions are final. If you disagree, DM an admin — don\'t argue in public channels.\n\n' +

      '**9. No Doxxing**\n' +
      'Never share someone\'s personal information without their explicit consent.\n\n' +

      '**10. Have Fun**\n' +
      'This is a gaming community. Be cool, help each other, and enjoy the game.\n\n' +

      '*Consequences: Warning → Mute → Kick → Ban. Severity depends on the offense.*'
    )
    .setFooter({ text: 'Last updated: June 2026' })
    .setTimestamp();
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'What is ApexPulse?',
    a: 'ApexPulse is a free Overwolf app for Apex Legends that tracks your matches, stats, weapons, legends, ranked RP, and more — all locally on your PC. It includes a live in-game overlay showing kills, damage, squad kills, and teams remaining.',
  },
  {
    q: 'Is ApexPulse safe to use? Will I get banned?',
    a: 'Yes, it\'s safe. ApexPulse runs on Overwolf, which is officially approved by EA/Respawn for Apex Legends. It only reads game event data — it never modifies game files, injects code, or interacts with anti-cheat.',
  },
  {
    q: 'How do I install ApexPulse?',
    a: '1. Install [Overwolf](https://www.overwolf.com/)\n2. Download ApexPulse from the [Overwolf App Store](https://www.overwolf.com/app/apexpulse) or [GitHub Releases](https://github.com/krazyadm1/ApexPulse/releases)\n3. Launch Apex Legends — ApexPulse starts automatically\n4. Press **Shift+F1** to toggle the overlay',
  },
  {
    q: 'Do I need an API key?',
    a: 'A free API key from [apexlegendsapi.com](https://apexlegendsapi.com) is included by default. It enables profile stats, map rotations, server status, and player lookups. You can replace it with your own key in Settings if needed.',
  },
  {
    q: 'Where is my data stored?',
    a: 'All match data, settings, and account info are stored **locally on your computer** in a SQLite database. Nothing is uploaded to any server. The only external calls are to the Apex Legends Status API (for stats/maps) and Steam/Discord (for optional login).',
  },
  {
    q: 'The overlay isn\'t showing up. What do I do?',
    a: '1. Make sure Apex is running in **fullscreen borderless** or **windowed** mode (not exclusive fullscreen)\n2. Press **Shift+F1** (or your custom hotkey)\n3. Check Settings → Overlay is enabled\n4. If Apex is running as administrator, ApexPulse may also need admin privileges',
  },
  {
    q: 'How does match tracking work?',
    a: 'ApexPulse uses Overwolf\'s Game Events Provider (GEP) to receive real-time events from Apex Legends — kills, damage, match state changes, team info, etc. It also supports LiveAPI for custom lobby data. No screen reading or OCR is involved.',
  },
  {
    q: 'How do I use the Discord bot?',
    a: '**Commands:**\n• `/stats [player]` — Look up player stats\n• `/rank [player]` — Show ranked status\n• `/map` — Current map rotation\n• `/link [name]` — Link your EA name to Discord\n• `/leaderboard` — Server leaderboard\n• `/credits` — Data sources and credits',
  },
  {
    q: 'How do I report a bug or request a feature?',
    a: 'Use the <#bug-reports> channel for bugs (include your OS, app version, and steps to reproduce). Use <#feature-requests> for ideas. You can also open an issue on [GitHub](https://github.com/krazyadm1/ApexPulse/issues).',
  },
  {
    q: 'Is ApexPulse free?',
    a: 'Yes, 100% free with no paywalled features. If you want to support development, you can donate via [Ko-fi](https://ko-fi.com/krazyadm).',
  },
];

function buildFaqEmbeds() {
  return FAQ_ITEMS.map((item, i) => {
    return new EmbedBuilder()
      .setColor(0x00D4FF)
      .setTitle(`${i + 1}. ${item.q}`)
      .setDescription(item.a);
  });
}

// ─── Changelogs ──────────────────────────────────────────────────────────────

const CHANGELOGS = [
  {
    version: '0.1.0',
    date: '2026-04-23',
    title: 'Initial Build',
    changes: [
      'Project scaffolding with Overwolf Electron (ow-electron)',
      'SQLite database for local match storage',
      'Basic GEP integration for Apex Legends game events',
      'Dashboard with Home, Stats, and Settings pages',
      'Steam and Discord OAuth login flow',
      'EA/Origin account auto-detection',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-05-27',
    title: 'Backend & API Wiring',
    changes: [
      'Full match tracking pipeline: GEP events → match tracker → database',
      'LiveAPI integration for custom lobby data',
      'Weapon and legend stats aggregation from match history',
      'Map rotation and crafting rotation from mozambiquehe.re API',
      'Player profile stats with rank badge display',
      'Session manager with RP tracking',
      'Lobby intel: teammate and opponent stat lookups',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-05-29',
    title: 'Pre-Submission Hardening',
    changes: [
      'FTUE onboarding flow: Consent → Welcome → Login → Link → API Key',
      'In-game overlay with live match HUD (kills, damage, KDA, teams)',
      'Hotkey support (Shift+F1) with reassignment in settings',
      'Post-match summary popup with placement and stats',
      'Rating prompt after 5 tracked matches',
      'Coach marks for first-time feature discovery',
      'Error toasts for API/GEP failures',
      'Empty states for all pages',
      'FAQ page with 8 Q&A items',
      'Second screen auto-positioning for overlay',
      'Ad slot component with visibility-aware cleanup',
      'Uninstall survey (Google Form) via NSIS',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-31',
    title: 'Launch Release',
    changes: [
      'Sortable legend rankings table with portraits and pick rate',
      'Sortable weapon rankings table with icons and rank column',
      'Headshot % body diagram (Apex firing range dummy SVG) + trend chart',
      'Ranked Progress: rank badge, session RP, weekly RP, RP sparkline',
      'Dark/Light theme system with instant toggle',
      'Hardware acceleration toggle',
      'Data export (full JSON) via native save dialog',
      'Ko-fi donation/support button',
      'Offline detection banner',
      'Map data caching for instant page load',
      'Collapsible crafting rotation',
      'Multi-layer launcher icon (16/32/48/256)',
      'Overwolf QA checklist compliance: icons, ad flags, manifest validation',
      'Discord bot with /stats, /rank, /map, /link, /leaderboard commands',
      'Custom rank badge emojis and reaction roles',
    ],
  },
];

function buildChangelogEmbeds() {
  return CHANGELOGS.map(log => {
    const changes = log.changes.map(c => `• ${c}`).join('\n');
    return new EmbedBuilder()
      .setColor(0x00D4FF)
      .setTitle(`v${log.version} — ${log.title}`)
      .setDescription(changes)
      .setFooter({ text: log.date })
      .setTimestamp(new Date(log.date));
  });
}

// ─── Post to channel helper ──────────────────────────────────────────────────

async function postToChannel(guild, channelName, embeds, clearExisting = false) {
  const channel = guild.channels.cache.find(c => c.name === channelName);
  if (!channel) {
    console.log(`  Channel #${channelName} not found — skipping`);
    return;
  }

  if (clearExisting) {
    const existing = await channel.messages.fetch({ limit: 50 });
    const botMsgs = existing.filter(m => m.author.id === client.user.id);
    for (const msg of botMsgs.values()) await msg.delete().catch(() => {});
  }

  const existingMsgs = await channel.messages.fetch({ limit: 5 });
  const hasBotContent = existingMsgs.some(m => m.author.id === client.user.id);

  if (hasBotContent && !clearExisting) {
    console.log(`  #${channelName} already has bot content — skipping`);
    return;
  }

  for (const embed of Array.isArray(embeds) ? embeds : [embeds]) {
    await channel.send({ embeds: [embed] });
  }
  console.log(`  Posted ${Array.isArray(embeds) ? embeds.length : 1} embed(s) to #${channelName}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}\n`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error('Guild not found'); process.exit(1); }

  console.log('=== Welcome ===');
  await postToChannel(guild, 'welcome', buildWelcomeEmbed(), true);

  console.log('=== Rules ===');
  await postToChannel(guild, 'rules', buildRulesEmbed(), true);

  console.log('=== FAQ ===');
  await postToChannel(guild, 'faq', buildFaqEmbeds(), true);

  console.log('=== Changelogs ===');
  await postToChannel(guild, 'changelogs', buildChangelogEmbeds(), true);

  console.log('\nDone. All channels populated.');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
