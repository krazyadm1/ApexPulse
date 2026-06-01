# ApexPulse Discord Server Setup

One-time bot that creates all roles, channels, categories, permissions, and welcome messages.

## Step 1: Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it "ApexPulse Setup" → Create
3. Go to the **Bot** tab on the left
4. Click **Reset Token** → copy the token (you'll need it in Step 3)
5. Under **Privileged Gateway Intents**, enable:
   - Server Members Intent
6. Save Changes

## Step 2: Invite the Bot to Your Server

1. Go to the **OAuth2** tab → **URL Generator**
2. Check these scopes: `bot`
3. Check these bot permissions:
   - Manage Roles
   - Manage Channels
   - Send Messages
   - Manage Messages
   - Read Message History
   - View Channels
4. Copy the generated URL → open it in your browser
5. Select your ApexPulse server → Authorize
6. **IMPORTANT**: In your server, go to Server Settings → Roles → drag the bot's auto-created role to the TOP (above all other roles). The bot can only create/manage roles below its own.

## Step 3: Run the Setup

```bash
cd discord-bot
npm install
```

Then run with your token and server ID:

```bash
# Windows (PowerShell)
$env:DISCORD_BOT_TOKEN="your-token-here"
$env:DISCORD_GUILD_ID="your-server-id-here"
npm run setup

# Windows (cmd)
set DISCORD_BOT_TOKEN=your-token-here
set DISCORD_GUILD_ID=your-server-id-here
npm run setup

# Or just edit setup.js lines 7-8 directly with your values
```

To get your server ID: enable Developer Mode in Discord settings → right-click your server name → Copy Server ID.

## Step 4: Post-Setup

After the bot finishes:

1. **Remove the bot** from the server (it was only needed once)
2. **Delete the bot application** from the Discord Developer Portal
3. **Assign yourself** the 👑 Owner role
4. **Add Carl-bot** (https://carl.gg) for reaction roles in #get-roles
5. **Upload server icon** (your ApexPulse logo)
6. **Optional**: Enable Community in Server Settings for a welcome screen

## What Gets Created

### Roles (22 total)
| Category | Roles |
|----------|-------|
| Staff | 👑 Owner, 🛡️ Admin, ⚔️ Moderator, 🎙️ Community Manager |
| Special | 🤖 Bot, ⭐ OG, 🧪 Beta Tester, 🐛 Bug Hunter, 📢 Content Creator |
| Apex Ranks | Predator, Master, Diamond, Platinum, Gold, Silver, Bronze, Rookie |
| Ping | 📣 Announcements, 🎮 LFG Ping, 🔔 Update Ping, 🎉 Event Ping |
| Platform | PC, PlayStation, Xbox |
| Base | ✅ Verified |

### Channels (31 total, 8 categories)
- 📌 INFORMATION — welcome, rules, announcements, changelogs, get-roles, faq
- 💬 COMMUNITY — general, introductions, apex-discussion, clips-and-highlights, memes, off-topic
- 🎮 LOOKING FOR GROUP — lfg-ranked, lfg-pubs, lfg-arenas, lfg-mixtape, lfg-scrims
- 🎤 VOICE — General Voice, LFG Voice 1-3, Ranked Squad, AFK
- 🛠️ APEXPULSE SUPPORT — support-general, bug-reports, feature-requests, beta-testing (locked)
- 🏆 STATS & FLEX — stat-check, rank-ups, loadouts, pack-openings
- 📢 CONTENT CREATORS — self-promo, stream-announcements
- 🔒 STAFF — staff-chat, mod-logs, staff-voice (staff only)

### Permissions
- Info channels are read-only (staff can post)
- Staff channels hidden from everyone except staff roles
- Beta testing locked to 🧪 Beta Tester + staff
- All other channels open to everyone
