# ApexPulse — Apex Legends Desktop Tracker

## Product Specification v1.0

**Working Title:** ApexPulse
**Platform:** Windows 10/11 Desktop Application
**Framework:** Electron + React + TypeScript
**Target Game:** Apex Legends (PC — Steam)
**Author:** Tristin / ApexPulse
**Date:** April 23, 2026

---

## 1. Problem Statement

Existing Apex Legends tracking apps (Blitz.gg, Tracker.gg) are unreliable for serious players:

- **Tracker.gg desktop app** frequently fails to connect, misses matches, and provides incomplete data
- **Blitz.gg** times out regularly, doesn't catch all matches, ignores weapon-level data, provides no meaningful legend ability analytics, and only reliably tracks Ranked mode — completely ignoring Pubs, Mixtape, and LTMs
- **Both** rely primarily on external APIs that are rate-limited and provide only the data EA/Respawn chooses to expose (which is minimal per-match detail)

ApexPulse solves this by using a **multi-source data strategy** — combining the unofficial Apex API, Overwolf Game Events (or equivalent local game event capture), and local file/log monitoring to build the most complete picture possible of every match across every mode.

---

## 2. Data Sources & Architecture

### 2.1 Data Source Hierarchy

ApexPulse uses three data layers, each filling gaps the others can't:

#### Layer 1: Unofficial Apex Legends API (api.mozambiquehe.re)

**What it provides:**
- Player profile stats (lifetime kills, wins, damage, level, rank)
- Currently equipped legend trackers (only the 3 the player has selected per legend)
- Current rank/LP/RP
- Map rotation (current and next for BR/Ranked/Mixtape)
- Crafting rotation
- Server status
- News/patch notes
- Leaderboard data (top 500 per stat/legend)
- Player UID lookup (by Origin name — required even for Steam players)

**What it CANNOT provide:**
- Per-match weapon breakdown
- Per-match legend ability usage (tactical/ultimate casts, damage from abilities)
- Match history for non-ranked modes (limited/unreliable)
- Real-time in-match data
- Inventory state during match

**Rate Limits:** Fair use policy, 1 API key per project. Free tier is sufficient for personal use; bulk polling should be throttled to ~2 req/sec.

**Key Endpoint:** `GET https://api.mozambiquehe.re/bridge?auth=KEY&player=NAME&platform=PC`

**Important:** For PC players, you must use the **Origin/EA account name**, not the Steam display name. The API resolves via Origin UID.

#### Layer 2: Overwolf Game Events Provider (GEP)

**This is the secret weapon.** Overwolf's GEP reads game memory in real-time (with EA/Respawn's blessing — it's officially sanctioned) and exposes rich event data that no API provides.

**Apex Legends GEP Events:**

| Feature | Data | Notes |
|---------|------|-------|
| `me` | Player name, ultimate cooldown | Local player info |
| `team` | Teammate names, legends selected, team state, knocked/alive status | Full squad composition |
| `kill` | Kill events with victim info | Real-time kill tracking |
| `damage` | Total damage dealt (updated live) | Includes armor damage |
| `death` | Death events | When local player dies |
| `revive` | Revive events | When player is revived |
| `match_state` | Active/inactive | Match start/end detection |
| `game_info` | Match state, game mode, legend | Current session info |
| `match_info` | Tabs (kills, assists, teams, players, damage, cash), pseudo match ID | In-match scoreboard data |
| `inventory` | Current inventory items | Weapons/items held |
| `location` | Player X/Y/Z coordinates | Map position |
| `match_summary` | Final rank, total teams, squad kills | End-of-match summary |
| `roster` | All players in lobby with team IDs, platform, state | Full lobby roster |
| `rank` | Victory true/false | Win detection |
| `kill_feed` | Attacker, victim, weapon name, action (kill/knockdown/bleed out) | **THE KEY TO WEAPON TRACKING** |

**Critical Insight:** The `kill_feed` event returns `weaponName` for every kill and knockdown in the match. This is how we track weapon performance — not from the API, but from real-time game events. Combined with `inventory` tracking, we can build per-weapon stats (kills per weapon, knockdowns per weapon, which weapons the player was carrying when they got kills).

**Integration Options:**
1. **Build as an Overwolf app** — Use their SDK directly, get native GEP access, distribution through Overwolf store
2. **Standalone Electron + Overwolf SDK bridge** — More complex but independent distribution
3. **Alternative: Direct memory reading** — NOT recommended (anti-cheat risk, maintenance nightmare)

**Recommended approach: Build as an Overwolf app for v1**, then evaluate standalone distribution later. Overwolf provides the game event infrastructure for free, handles anti-cheat compatibility, and Apex is a fully supported title.

#### Layer 3: Local File Monitoring

**Config/State Files:** `C:\Users\{USER}\Saved Games\Respawn\Apex\local\`
- `previousgamestate.txt` — Contains last match result data
- `settings.cfg` — Player settings (sensitivity, keybinds)
- `videoconfig.txt` — Graphics settings

**Steam Integration:** Steam client API can provide:
- Game launch/exit detection
- Play time tracking
- Screenshot capture triggers
- Steam friend list (for teammate identification)

**Log Files:** The game writes crash logs and some state to:
- `%USERPROFILE%\Documents\apex_crash.txt`
- Game installation directory logs

---

## 3. Feature Specification

### 3.1 Live Match Overlay

**Trigger:** Automatically activates when `match_state` transitions to `active`

**Overlay Panel (HUD — top-right or configurable position):**

```
┌─────────────────────────────────────┐
│ ▶ LIVE  |  BR Ranked  |  World's Edge │
├─────────────────────────────────────┤
│ You: Bangalore        K: 3  D: 580  │
│ ══════════════════════════          │
│ Teammate1: Lifeline   K: 1  D: 230  │
│ Teammate2: Wraith     K: 2  D: 410  │
├─────────────────────────────────────┤
│ Squad Kills: 6  |  Teams Left: 8   │
│ RP Change: +48 (est.)              │
├─────────────────────────────────────┤
│ 🔫 R-301: 2 kills                  │
│ 🔫 Peacekeeper: 1 kill             │
└─────────────────────────────────────┘
```

**Data Sources Used:**
- GEP `match_info.tabs` → kills, assists, damage, teams remaining
- GEP `kill_feed` → weapon-specific kill/knockdown tracking
- GEP `inventory` → current loadout
- GEP `team` → teammate legends, status
- GEP `location` → optional minimap position
- API `bridge` → pre-match rank/RP for estimated RP change calculation

**Lobby Intel (Pre-Match):**

When `roster` data populates during legend select, query the API for each player in the lobby to show:
- Player level and rank
- Lifetime K/D ratio
- Most-used legend
- Win rate (if available from trackers)
- Platform (PC/Console — crossplay indicator)

This is what Blitz does partially but times out on. ApexPulse should batch these lookups efficiently and cache results.

### 3.2 Post-Match Detailed Tracking

**Trigger:** `match_state` transitions to `inactive` or `match_summary` event fires

**Match Record Schema:**

```typescript
interface MatchRecord {
  // Identity
  matchId: string;          // Generated from timestamp + mode + map hash
  timestamp: Date;          // Match end time
  duration: number;         // Seconds (calculated from match_state transitions)

  // Mode & Map
  gameMode: GameMode;       // 'battle_royale' | 'ranked_br' | 'mixtape' | 'ltm' | 'firing_range'
  mapName: string;          // From GEP game_info

  // Performance
  placement: number;        // From match_summary.rank
  totalTeams: number;       // From match_summary.teams
  kills: number;
  assists: number;
  knockdowns: number;
  damage: number;           // Total damage (includes armor)
  revivesGiven: number;
  respawnsGiven: number;
  survivalTime: number;     // Seconds alive

  // Squad
  legend: string;           // Legend played
  teammates: TeammateRecord[];

  // Weapons
  weaponKills: WeaponKillRecord[];  // Weapon → kill count mapping
  weaponKnockdowns: WeaponKillRecord[];
  loadoutFinal: string[];   // Last known inventory weapons

  // Ranked (if applicable)
  rpBefore: number;
  rpAfter: number;
  rpChange: number;
  rankBefore: string;       // e.g., "Diamond IV"
  rankAfter: string;

  // Meta
  isWin: boolean;
  squadKills: number;       // From match_summary
}

interface WeaponKillRecord {
  weaponName: string;       // From kill_feed
  kills: number;
  knockdowns: number;
}

interface TeammateRecord {
  name: string;
  legend: string;
  platform: string;
  kills: number;            // From kill_feed if available
  damage: number;           // If visible in tabs
  survived: boolean;
}
```

**All game modes tracked equally.** This is a core differentiator — no more ranked-only tracking.

### 3.3 Historical Stats Dashboard

**Main Dashboard Panels:**

#### Overall Stats Card
- Total matches played (all modes, with mode breakdown)
- Overall K/D ratio, average damage, win rate
- Current rank + LP/RP with trend sparkline
- Hours played (this session, this week, this season)

#### Performance Over Time (Charts)
- Kills/game trend line (7-day rolling average)
- Damage/game trend line
- K/D ratio over time
- RP progression curve (ranked)
- Win rate by week/month

#### Legend Analytics
- Matches per legend (pie chart or bar)
- K/D per legend comparison
- Average damage per legend
- Win rate per legend
- **Legend-specific insights:** For each legend, show what abilities contribute (e.g., Bangalore: "Your smoke usage correlates with higher survival time" — derived from match patterns, not direct ability tracking since GEP doesn't expose ability casts)

#### Weapon Analytics (THE KILLER FEATURE)
- Kills per weapon (all-time and per-season)
- Most lethal weapon combos (which 2-weapon loadouts get you the most kills)
- Weapon pick frequency (how often you carry each weapon)
- Weapon kill rate (kills per match when carrying that weapon)
- Weapon category breakdown (AR / SMG / Sniper / Shotgun / Pistol / LMG / Marksman)
- Weapon performance trends over time

#### Game Mode Analytics
- Stats split by mode: BR, Ranked, Mixtape, LTMs
- Performance comparison across modes
- Time distribution across modes

### 3.4 Session Tracker

A "session" is a continuous playing period (gaps > 30 minutes = new session).

- Session start/end time
- Matches played this session
- Session K/D, damage, RP change
- Win streak tracking
- "Hot streak" detection (3+ kills/game average over last 5 games)
- Comparison to your averages ("You're playing 20% above your average damage today")

### 3.5 Map & Rotation Info

- Current map rotation for all modes (from API)
- Next map + countdown timer
- Crafting rotation items
- Server status indicator

---

## 4. Authentication & Account Linking

### 4.1 Overview

ApexPulse needs two distinct auth concepts:

1. **App Identity** — Who is this ApexPulse user? (Steam, Discord, or EA login)
2. **Game Account Linking** — What is their Origin/EA name + UID so we can pull Apex data?

The critical thing to understand: **the Apex API requires the Origin/EA account name**, not the Steam name. Every Steam Apex player has an EA account linked behind the scenes. ApexPulse needs to resolve this mapping automatically when possible, or guide the user through providing it manually.

### 4.2 Login Providers

#### Steam Login (Primary — Recommended Default)

**Protocol:** OpenID 2.0 (NOT OpenID Connect — Steam uses the legacy spec)

**Flow:**
1. User clicks "Sign in with Steam" in ApexPulse
2. App opens a BrowserWindow (Electron) or Overwolf browser to `https://steamcommunity.com/openid/`
3. User authenticates on Steam's domain (ApexPulse never sees their password)
4. Steam redirects back with the user's 64-bit SteamID in the Claimed ID URL
5. Format: `https://steamcommunity.com/openid/id/{steamid64}`
6. App stores SteamID64 locally

**What we get:**
- SteamID64 (unique identifier)
- Display name + avatar (via Steam Web API: `ISteamUser/GetPlayerSummaries`)
- Game ownership verification (confirm they own Apex Legends AppID 1172470)
- Friends list (for teammate identification)

**Libraries:**
- `node-steam-openid` or `passport-steam` for Node.js/Electron backend
- Must use OpenID 2.0 compatible library — OpenID Connect libs will NOT work

**Steam Web API Key Required:** Register at https://steamcommunity.com/dev/apikey (free, instant)

```typescript
// Steam OpenID flow in Electron main process
import { BrowserWindow } from 'electron';
import SteamAuth from 'node-steam-openid';

const steam = new SteamAuth({
  realm: 'http://localhost:3847',           // Local callback
  returnUrl: 'http://localhost:3847/auth/steam/callback',
  apiKey: process.env.STEAM_API_KEY
});

async function loginWithSteam(): Promise<SteamUser> {
  const redirectUrl = await steam.getRedirectUrl();
  
  const authWindow = new BrowserWindow({
    width: 800, height: 600,
    webPreferences: { nodeIntegration: false }
  });
  authWindow.loadURL(redirectUrl);
  
  // Listen for redirect back to localhost
  return new Promise((resolve) => {
    authWindow.webContents.on('will-redirect', async (event, url) => {
      if (url.startsWith('http://localhost:3847/auth/steam/callback')) {
        event.preventDefault();
        const user = await steam.authenticate(url);
        // user.steamid64, user.username, user.avatar
        authWindow.close();
        resolve(user);
      }
    });
  });
}
```

#### Discord Login

**Protocol:** OAuth2 (standard, well-documented)

**Flow:**
1. User clicks "Sign in with Discord"
2. App opens Discord OAuth2 authorize URL
3. User approves, Discord redirects with auth code
4. App exchanges code for access token via Discord API
5. Fetch user profile with token

**What we get:**
- Discord user ID, username, discriminator, avatar
- Guild memberships (could be useful for team/clan features later)
- Connected accounts — **Discord shows linked gaming accounts including Steam and potentially EA**

**Discord Developer Portal:** https://discord.com/developers/applications (create app, enable OAuth2)

**Scopes needed:** `identify`, `connections` (connections scope reveals linked Steam/EA accounts!)

```typescript
// Discord OAuth2 configuration
const DISCORD_CONFIG = {
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  redirectUri: 'http://localhost:3847/auth/discord/callback',
  scopes: ['identify', 'connections'],
  authorizeUrl: 'https://discord.com/api/oauth2/authorize',
  tokenUrl: 'https://discord.com/api/oauth2/token',
  userUrl: 'https://discord.com/api/v10/users/@me',
  connectionsUrl: 'https://discord.com/api/v10/users/@me/connections'
};

// After getting token, check for linked gaming accounts
async function getDiscordConnections(token: string) {
  const response = await axios.get(DISCORD_CONFIG.connectionsUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  // Look for Steam and EA/Origin connections
  const connections = response.data;
  const steamLink = connections.find(c => c.type === 'steam');
  const xboxLink = connections.find(c => c.type === 'xbox');
  // Note: EA/Origin may appear as 'epicgames' or may not be available
  // Steam connection gives us the Steam ID which we can use
  
  return { steamLink, xboxLink, allConnections: connections };
}
```

**Key advantage of Discord login:** The `connections` scope can auto-discover the user's linked Steam account, letting us chain Steam → Origin resolution without extra steps.

#### EA Account Login

**Protocol:** OAuth2 (EA's implementation)

**Challenge:** EA does NOT provide a public OAuth2 API for third-party apps. There is no developer portal where you can register an OAuth2 client for EA accounts the way you can with Steam or Discord.

**Workaround Options:**

1. **Manual Entry (Most Reliable for v1):**
   - User enters their EA/Origin username manually during setup
   - App validates it against the Apex API (`nametouid` endpoint)
   - If valid, store the Origin name + UID

2. **Auto-detect from GEP:**
   - When the user launches Apex, the GEP `me` event provides the in-game player name
   - This is the Origin name we need
   - **Best approach:** Use GEP auto-detection as the primary method, manual entry as fallback

3. **Steam-to-Origin Resolution:**
   - If user logs in via Steam, we have their SteamID64
   - The GEP `roster` event includes `platform_id` which may contain the Origin UID
   - The Apex API's `nametouid` can then resolve the full profile

### 4.3 Account Linking Strategy

The recommended flow combines all three methods to minimize friction:

```
┌─────────────────────────────────────────────────────────────┐
│                    FIRST-TIME SETUP FLOW                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Choose Login Method                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐             │
│  │  Steam   │  │ Discord  │  │ Skip (Local  │             │
│  │  Login   │  │  Login   │  │   Only)      │             │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘             │
│       │              │               │                      │
│  Step 2: Resolve EA/Origin Account                          │
│       │              │               │                      │
│       ▼              ▼               ▼                      │
│  ┌──────────────────────────────────────────┐              │
│  │  Option A: "Launch Apex and we'll         │              │
│  │  auto-detect your EA name" (via GEP)     │              │
│  │                                           │              │
│  │  Option B: "Enter your EA/Origin          │              │
│  │  username manually"                       │              │
│  │                                           │              │
│  │  Option C: (Discord only) Check           │              │
│  │  connected accounts for Steam → resolve   │              │
│  └──────────────────┬───────────────────────┘              │
│                     │                                       │
│  Step 3: Validate EA Account                                │
│                     │                                       │
│                     ▼                                       │
│  ┌──────────────────────────────────────────┐              │
│  │  Call: GET /nametouid?player={NAME}       │              │
│  │  Store: origin_name + origin_uid          │              │
│  │  Call: GET /bridge?player={NAME}          │              │
│  │  Verify: Profile loads with stats         │              │
│  └──────────────────┬───────────────────────┘              │
│                     │                                       │
│  Step 4: Ready!     │                                       │
│                     ▼                                       │
│  ┌──────────────────────────────────────────┐              │
│  │  Dashboard loads with profile data        │              │
│  │  GEP ready for next Apex launch           │              │
│  └──────────────────────────────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 "Skip Login" / Local-Only Mode

Not everyone wants to create accounts. ApexPulse should work **without any login** in a reduced mode:

- GEP still tracks all matches locally (weapon data, kills, damage — everything)
- API calls use manual Origin name entry (validated once, stored locally)
- No cloud sync, no social features
- All data in local SQLite
- Can upgrade to full account later without losing data

### 4.5 Auth Database Schema

```sql
-- User account (local, one row per install)
CREATE TABLE user_account (
  id TEXT PRIMARY KEY DEFAULT 'local',    -- Single user per install
  
  -- Primary login
  login_provider TEXT,                    -- 'steam', 'discord', or NULL (local-only)
  login_id TEXT,                          -- Provider-specific ID
  login_name TEXT,                        -- Display name from provider
  login_avatar TEXT,                      -- Avatar URL
  login_token TEXT,                       -- Encrypted OAuth token (for refresh)
  login_token_expires INTEGER,            -- Token expiry timestamp
  
  -- EA/Origin link (the critical one)
  origin_name TEXT,                       -- EA/Origin username
  origin_uid TEXT,                        -- EA/Origin UID (numeric)
  origin_verified BOOLEAN DEFAULT 0,      -- Validated against API
  origin_detection_method TEXT,           -- 'gep_auto', 'manual', 'discord_chain'
  
  -- Steam link
  steam_id TEXT,                          -- SteamID64
  steam_name TEXT,
  steam_avatar TEXT,
  
  -- Discord link
  discord_id TEXT,
  discord_name TEXT,
  discord_avatar TEXT,
  
  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login INTEGER
);

-- Linked accounts history (for multi-account support later)
CREATE TABLE linked_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,                 -- 'steam', 'discord', 'ea'
  provider_id TEXT NOT NULL,
  provider_name TEXT,
  linked_at INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  UNIQUE(provider, provider_id)
);
```

### 4.6 Security Considerations

- **Never store passwords** — all auth is OAuth/OpenID redirect-based
- **Encrypt stored tokens** — use Electron's `safeStorage` API to encrypt OAuth refresh tokens at rest
- **Steam API key** — bundle in app (it's a server-side key technically, but for a desktop app this is standard practice; rate limits protect abuse)
- **Discord client secret** — for desktop apps, Discord recommends PKCE flow (no client secret needed) OR embedding the secret (acceptable for distributed desktop apps since it's not truly secret)
- **Local-only by default** — no data leaves the machine unless the user explicitly enables cloud sync (future feature)
- **Token refresh** — Steam OpenID is stateless (no token to refresh, just re-auth). Discord tokens expire and need refresh via `refresh_token` grant

### 4.7 GEP Auto-Detection (The Best UX)

The smoothest experience is zero manual entry:

```typescript
// In gep-manager.ts — auto-detect Origin name on first Apex launch
class GEPManager {
  private onPlayerNameDetected(name: string) {
    const userAccount = db.getUserAccount();
    
    if (!userAccount.origin_name) {
      // First time detection — validate against API
      const uid = await apiClient.nameToUid(name);
      if (uid) {
        db.updateOriginLink(name, uid, 'gep_auto');
        // Show notification: "Detected your EA account: {name}"
        notifyRenderer('origin-linked', { name, uid, method: 'auto' });
      }
    } else if (userAccount.origin_name !== name) {
      // Name changed (user renamed their EA account)
      const uid = await apiClient.nameToUid(name);
      if (uid) {
        db.updateOriginLink(name, uid, 'gep_auto');
        notifyRenderer('origin-updated', { oldName: userAccount.origin_name, newName: name });
      }
    }
  }
}
```

This means: if the user skips all login, just installs ApexPulse and launches Apex, the GEP `me` event fires with their name, we validate it, and the app is fully functional without them typing a single character.

### 4.8 Login UI Mockup

```
┌─────────────────────────────────────────────┐
│                                             │
│           ⚡ Welcome to ApexPulse            │
│                                             │
│     The Apex Legends tracker that works.    │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  🎮  Sign in with Steam              │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  💬  Sign in with Discord             │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  🎯  Enter EA/Origin Name Manually    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│         ─── or ───                          │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  ⏭️  Skip — Just launch Apex and      │  │
│  │     we'll detect your account         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Your data stays local. No account needed.  │
│                                             │
└─────────────────────────────────────────────┘
```

After login, if Origin name isn't resolved yet:

```
┌─────────────────────────────────────────────┐
│                                             │
│       🔗 Link Your EA Account               │
│                                             │
│  We need your EA/Origin username to pull    │
│  your Apex Legends stats from the API.      │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  EA/Origin Username: [_______________]│  │
│  └───────────────────────────────────────┘  │
│                                             │
│  💡 Not sure? Open EA App → Profile →       │
│     Your EA ID is shown at the top.         │
│                                             │
│  ─── or ───                                 │
│                                             │
│  🎮 Launch Apex Legends and we'll detect    │
│     your EA name automatically.             │
│                                             │
│        [ Validate & Continue ]              │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.9 Provider-Specific Notes

#### Steam
- OpenID 2.0 is a legacy protocol — make sure you use a compatible library
- Steam does NOT provide email addresses via OpenID
- Steam profile must be public for friends list access (not required for auth itself)
- The SteamID64 is permanent and never changes even if display name changes
- Steam Web API key is tied to your Steam account — register one at steamcommunity.com/dev/apikey

#### Discord
- Use OAuth2 with PKCE for desktop apps (more secure, no client secret exposure)
- The `connections` scope requires user approval but reveals linked Steam/Xbox/etc. accounts
- Discord tokens expire after ~7 days; use refresh token to renew
- Rate limits: 50 requests per second on user routes

#### EA/Origin
- No public OAuth2 — manual entry or GEP auto-detect only
- Origin names can contain spaces and special characters
- Origin UIDs are numeric (e.g., "1000853021847")
- Name changes break API lookups by name — always store UID and prefer UID-based queries
- The API `nametouid` endpoint handles the name → UID resolution

---

## 5. Technical Architecture

### 5.1 Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Desktop Shell | Electron 30+ | Node.js backend for file I/O, API calls, SQLite. Mature overlay support |
| Frontend | React 18 + TypeScript | Component-based UI, fast iteration |
| Styling | Tailwind CSS | Rapid UI development, dark theme |
| Charts | Recharts or Victory | React-native charting |
| Local Database | SQLite (via better-sqlite3) | Fast, file-based, no server needed. Perfect for match history |
| Game Events | Overwolf GEP SDK | Officially sanctioned real-time game data |
| API Client | Axios | HTTP client for Apex API calls |
| State Management | Zustand | Lightweight, TypeScript-friendly |
| Overlay Rendering | Electron BrowserWindow (transparent, always-on-top) | In-game overlay |
| Build/Package | electron-builder | Windows installer (.exe / .msi) |

### 5.2 Application Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Electron Main Process            │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ GEP Bridge  │  │ API Poller   │  │ File       │ │
│  │ (Overwolf   │  │ (mozambique  │  │ Watcher    │ │
│  │  Events)    │  │  API client) │  │ (chokidar) │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
│         │               │                │         │
│         └───────┬───────┴────────┬───────┘         │
│                 ▼                                   │
│         ┌──────────────┐                            │
│         │ Data Merger  │ ← Reconciles all sources   │
│         │ & Normalizer │                            │
│         └──────┬───────┘                            │
│                │                                    │
│         ┌──────▼───────┐                            │
│         │   SQLite DB  │ ← Persistent match store   │
│         └──────┬───────┘                            │
│                │                                    │
│         ┌──────▼───────┐  ┌──────────────────┐     │
│         │ IPC Bridge   │──│ Overlay Window   │     │
│         └──────┬───────┘  │ (transparent,    │     │
│                │          │  always-on-top)   │     │
│                ▼          └──────────────────┘     │
│  ┌─────────────────────┐                           │
│  │ Main Dashboard      │ ← React app               │
│  │ (Renderer Process)  │                           │
│  └─────────────────────┘                           │
└─────────────────────────────────────────────────────┘
```

### 5.3 Database Schema

```sql
-- Core match records
CREATE TABLE matches (
  id TEXT PRIMARY KEY,                    -- UUID
  timestamp INTEGER NOT NULL,             -- Unix epoch ms
  duration INTEGER,                       -- seconds
  game_mode TEXT NOT NULL,                -- 'battle_royale', 'ranked_br', 'mixtape', etc.
  map_name TEXT,
  legend TEXT NOT NULL,
  placement INTEGER,
  total_teams INTEGER,
  kills INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  knockdowns INTEGER DEFAULT 0,
  damage INTEGER DEFAULT 0,
  revives_given INTEGER DEFAULT 0,
  respawns_given INTEGER DEFAULT 0,
  survival_time INTEGER,
  is_win BOOLEAN DEFAULT 0,
  squad_kills INTEGER DEFAULT 0,
  rp_before INTEGER,
  rp_after INTEGER,
  rp_change INTEGER,
  rank_before TEXT,
  rank_after TEXT,
  session_id TEXT,                        -- FK to sessions
  data_source TEXT DEFAULT 'gep',         -- 'gep', 'api', 'manual'
  raw_data TEXT                           -- JSON blob of raw event data for debugging
);

-- Weapon performance per match
CREATE TABLE match_weapons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL REFERENCES matches(id),
  weapon_name TEXT NOT NULL,
  kills INTEGER DEFAULT 0,
  knockdowns INTEGER DEFAULT 0,
  was_in_loadout BOOLEAN DEFAULT 0,       -- Was this weapon in final loadout?
  UNIQUE(match_id, weapon_name)
);

-- Teammates per match
CREATE TABLE match_teammates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL REFERENCES matches(id),
  player_name TEXT NOT NULL,
  legend TEXT,
  platform TEXT,
  kills INTEGER,
  damage INTEGER,
  survived BOOLEAN
);

-- Play sessions (continuous play periods)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  matches_played INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  total_damage INTEGER DEFAULT 0,
  total_rp_change INTEGER DEFAULT 0
);

-- Player profile snapshots (polled from API periodically)
CREATE TABLE profile_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  level INTEGER,
  rank_name TEXT,
  rank_score INTEGER,
  total_kills INTEGER,
  total_damage INTEGER,
  total_wins INTEGER,
  selected_legend TEXT,
  raw_data TEXT                           -- Full API response JSON
);

-- Legend stats (aggregated from matches table, but cached for performance)
CREATE TABLE legend_stats (
  legend TEXT PRIMARY KEY,
  matches_played INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  total_damage INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  avg_damage REAL,
  kd_ratio REAL,
  win_rate REAL,
  last_updated INTEGER
);

-- Weapon stats (aggregated)
CREATE TABLE weapon_stats (
  weapon_name TEXT PRIMARY KEY,
  total_kills INTEGER DEFAULT 0,
  total_knockdowns INTEGER DEFAULT 0,
  matches_used INTEGER DEFAULT 0,
  kills_per_match REAL,
  last_updated INTEGER
);

-- Indexes for common queries
CREATE INDEX idx_matches_timestamp ON matches(timestamp);
CREATE INDEX idx_matches_game_mode ON matches(game_mode);
CREATE INDEX idx_matches_legend ON matches(legend);
CREATE INDEX idx_matches_session ON matches(session_id);
CREATE INDEX idx_match_weapons_match ON match_weapons(match_id);
CREATE INDEX idx_match_weapons_weapon ON match_weapons(weapon_name);
```

### 5.4 Weapon Name Mapping

The GEP `kill_feed` returns internal weapon names. We need a mapping table:

```typescript
const WEAPON_MAP: Record<string, WeaponInfo> = {
  // Assault Rifles
  'r301': { display: 'R-301 Carbine', category: 'Assault Rifle', ammo: 'Light' },
  'flatline': { display: 'VK-47 Flatline', category: 'Assault Rifle', ammo: 'Heavy' },
  'havoc': { display: 'HAVOC Rifle', category: 'Assault Rifle', ammo: 'Energy' },
  'hemlok': { display: 'Hemlok Burst AR', category: 'Assault Rifle', ammo: 'Heavy' },
  'nemesis': { display: 'Nemesis Burst AR', category: 'Assault Rifle', ammo: 'Energy' },

  // SMGs
  'alternator': { display: 'Alternator SMG', category: 'SMG', ammo: 'Light' },
  'prowler': { display: 'Prowler Burst PDW', category: 'SMG', ammo: 'Heavy' },
  'r99': { display: 'R-99 SMG', category: 'SMG', ammo: 'Light' },
  'volt': { display: 'Volt SMG', category: 'SMG', ammo: 'Energy' },
  'car': { display: 'C.A.R. SMG', category: 'SMG', ammo: 'Light/Heavy' },

  // LMGs
  'devotion': { display: 'Devotion LMG', category: 'LMG', ammo: 'Energy' },
  'lstar': { display: 'L-STAR EMG', category: 'LMG', ammo: 'Energy' },
  'spitfire': { display: 'M600 Spitfire', category: 'LMG', ammo: 'Light' },
  'rampage': { display: 'Rampage LMG', category: 'LMG', ammo: 'Heavy' },

  // Marksman
  'g7': { display: 'G7 Scout', category: 'Marksman', ammo: 'Light' },
  'triple_take': { display: 'Triple Take', category: 'Marksman', ammo: 'Energy' },
  '3030': { display: '30-30 Repeater', category: 'Marksman', ammo: 'Heavy' },
  'bocek': { display: 'Bocek Compound Bow', category: 'Marksman', ammo: 'Arrows' },

  // Snipers
  'charge_rifle': { display: 'Charge Rifle', category: 'Sniper', ammo: 'Sniper' },
  'longbow': { display: 'Longbow DMR', category: 'Sniper', ammo: 'Sniper' },
  'kraber': { display: 'Kraber .50-Cal', category: 'Sniper', ammo: 'Unique' },
  'sentinel': { display: 'Sentinel', category: 'Sniper', ammo: 'Sniper' },

  // Shotguns
  'eva8': { display: 'EVA-8 Auto', category: 'Shotgun', ammo: 'Shotgun' },
  'mastiff': { display: 'Mastiff Shotgun', category: 'Shotgun', ammo: 'Shotgun' },
  'mozambique': { display: 'Mozambique Shotgun', category: 'Shotgun', ammo: 'Shotgun' },
  'peacekeeper': { display: 'Peacekeeper', category: 'Shotgun', ammo: 'Shotgun' },

  // Pistols
  'p2020': { display: 'P2020', category: 'Pistol', ammo: 'Light' },
  're45': { display: 'RE-45 Auto', category: 'Pistol', ammo: 'Light' },
  'wingman': { display: 'Wingman', category: 'Pistol', ammo: 'Sniper' },

  // Special
  'melee': { display: 'Melee', category: 'Melee', ammo: 'None' },
  'Bleed Out': { display: 'Bleed Out', category: 'Environmental', ammo: 'None' },
};
```

**Note:** Weapon names from GEP may vary — the mapping needs to be validated against actual GEP output and updated each season as the weapon pool rotates (care package weapons, floor loot changes, new weapons).

### 5.5 Legend Database

```typescript
interface LegendInfo {
  id: string;
  displayName: string;
  class: 'Assault' | 'Skirmisher' | 'Recon' | 'Support' | 'Controller';
  tactical: string;
  ultimate: string;
  passive: string;
}

const LEGENDS: Record<string, LegendInfo> = {
  'character_bangalore_NAME': {
    id: 'bangalore',
    displayName: 'Bangalore',
    class: 'Assault',
    tactical: 'Smoke Launcher',
    ultimate: 'Rolling Thunder',
    passive: 'Double Time'
  },
  // ... all legends
  // GEP returns legend names as '#character_LEGENDNAME_NAME'
};
```

---

## 6. Overwolf vs. Standalone Decision

### Option A: Overwolf App (RECOMMENDED for v1)

**Pros:**
- Native GEP access — no reverse engineering, no anti-cheat concerns
- Automatic game detection
- Built-in overlay system
- Distribution through Overwolf store (140M+ users)
- Revenue sharing model (ads in app)
- Auto-updates

**Cons:**
- Requires Overwolf client installed
- Revenue split with Overwolf
- Must follow Overwolf design guidelines
- Limited control over update schedule

### Option B: Standalone Electron App

**Pros:**
- Full control over distribution and monetization
- No Overwolf dependency
- Cleaner user experience (no extra client)

**Cons:**
- No GEP access — would need alternative for real-time game events
- Would need to use screen capture / OCR for in-match data (fragile)
- Or use Overwolf's "Electron" SDK (limited)
- Significantly more development effort for overlay

### Recommendation

**Start with Overwolf for v1** to get the richest data possible with the least effort. The GEP events for Apex are mature and well-documented. Once the core tracker logic, database, and analytics are proven, you can evaluate porting to a standalone Electron app if the Overwolf dependency becomes a dealbreaker.

**Alternative if Overwolf is rejected:** Build standalone Electron and accept that weapon/kill-feed tracking will rely on `previousgamestate.txt` polling + API delta calculations. This approach will miss real-time data but can still build match history from API snapshots taken before and after each match (stat deltas).

---

## 7. UI Design

### 7.1 Design Language

- **Dark theme primary** — gamers expect it, reduces eye strain during sessions
- **Accent color:** Electric cyan (#00E5FF) on dark navy (#0A1628) background
- **Typography:** Inter for UI, JetBrains Mono for stats/numbers
- **Card-based layout** — each stat group is a card with subtle glass-morphism
- **Animations:** Subtle transitions on stat updates, number count-up on match completion

### 7.2 Navigation

```
┌────────────────────────────────────────────────┐
│  [🎯] ApexPulse              ─ □ ×            │
├────────┬───────────────────────────────────────┤
│        │                                       │
│ 🏠 Home│   [Main Content Area]                 │
│        │                                       │
│ 📊 Stats│  Dashboard / Match detail / etc.     │
│        │                                       │
│ 🔫 Weapons│                                    │
│        │                                       │
│ 🦸 Legends│                                    │
│        │                                       │
│ 📜 History│                                    │
│        │                                       │
│ 🗺️ Maps│                                      │
│        │                                       │
│ ⚙️ Settings│                                   │
│        │                                       │
└────────┴───────────────────────────────────────┘
```

### 7.3 Key Screens

1. **Home/Dashboard** — Session summary, recent matches, quick stats, current map rotation
2. **Stats Overview** — Career stats with time range selector (today/week/season/all-time)
3. **Weapons** — Full weapon analytics with sorting, filtering, trends
4. **Legends** — Per-legend breakdown with comparison tools
5. **Match History** — Scrollable list of all matches, filterable by mode/legend/date, expandable for detail
6. **Match Detail** — Single match deep-dive: timeline, weapon breakdown, squad performance, lobby roster
7. **Maps** — Current rotation, map win rates, favorite drop spots (if location data tracked)
8. **Settings** — API key config, overlay toggle/position, data export, theme

---

## 8. Development Phases

### Phase 1: Foundation (Weeks 1–3)

- [ ] Overwolf app scaffold (manifest.json, background controller, main window)
- [ ] React + TypeScript + Tailwind setup within Overwolf window
- [ ] SQLite database initialization with schema (including auth tables)
- [ ] **Login screen: Steam OpenID 2.0 flow (BrowserWindow redirect)**
- [ ] **Login screen: Discord OAuth2 + PKCE flow**
- [ ] **Login screen: Manual EA/Origin name entry with API validation**
- [ ] **Login screen: "Skip" option for local-only mode**
- [ ] **GEP auto-detection of EA/Origin name on first Apex launch**
- [ ] **Encrypted token storage via Electron safeStorage**
- [ ] API client for mozambiquehe.re (player lookup, profile stats, map rotation)
- [ ] Basic dashboard showing profile stats from API
- [ ] Settings page with account linking management

### Phase 2: Live Game Events (Weeks 4–6)

- [ ] GEP integration — register for all Apex events
- [ ] Match state machine (lobby → legend select → in-match → post-match)
- [ ] Kill feed parser — extract weapon names, map to weapon database
- [ ] Inventory tracker — current loadout monitoring
- [ ] Match record builder — assemble complete MatchRecord from GEP events
- [ ] Auto-save match to SQLite on match end
- [ ] Session management (auto-detect session boundaries)

### Phase 3: Overlay (Weeks 7–8)

- [ ] Transparent overlay window (Overwolf in-game window)
- [ ] Live stats panel (kills, damage, teams, weapon kills)
- [ ] Lobby intel (pre-match player lookup)
- [ ] Overlay position/size persistence
- [ ] Hotkey toggle (show/hide overlay)
- [ ] Minimal performance impact validation

### Phase 4: Analytics & Polish (Weeks 9–12)

- [ ] Historical stats dashboard with charts (Recharts)
- [ ] Weapon analytics page
- [ ] Legend analytics page
- [ ] Match history list with filtering and search
- [ ] Match detail view
- [ ] Data export (CSV/JSON)
- [ ] Performance optimization and memory profiling
- [ ] Auto-updater
- [ ] Error reporting / crash analytics

### Phase 5: Nice-to-Haves (Post-Launch)

- [ ] Teammate stats (track regular squad performance)
- [ ] Achievement/badge tracking
- [ ] Clip auto-capture integration (Overwolf replay API)
- [ ] Heatmap of deaths/kills on map (using location data)
- [ ] Discord Rich Presence integration
- [ ] Web companion (view your stats on phone)
- [ ] Multi-account support
- [ ] Community features (compare with friends)

---

## 9. API Key & Setup Requirements

### For the Developer (You)

1. **Apex Legends Status API Key** — Register at https://apexlegendsapi.com/ (free)
2. **Overwolf Developer Account** — Register at https://dev.overwolf.com/ (free)
3. **Steam Web API Key** — Register at https://steamcommunity.com/dev/apikey (free, instant)
4. **Discord Application** — Create at https://discord.com/developers/applications (free, enable OAuth2, set redirect URI to `http://localhost:3847/auth/discord/callback`)
5. **Overwolf App submission** — Follow their app submission guidelines

### For the End User

1. Install Overwolf client
2. Install ApexPulse from Overwolf store
3. Sign in with Steam, Discord, or skip login entirely
4. If EA/Origin name isn't auto-detected: enter it manually or launch Apex once for auto-detect
5. Launch Apex Legends — ApexPulse auto-activates

---

## 10. Competitive Differentiators

| Feature | Blitz.gg | Tracker.gg | ApexPulse |
|---------|----------|------------|-----------|
| Ranked tracking | ✅ | ✅ | ✅ |
| Pubs tracking | ❌ | Partial | ✅ |
| Mixtape/LTM tracking | ❌ | ❌ | ✅ |
| Weapon kill tracking | ❌ | ❌ | ✅ |
| Weapon loadout analytics | ❌ | ❌ | ✅ |
| Legend ability insights | ❌ | ❌ | ✅ (pattern-based) |
| Reliable match detection | Partial | ❌ | ✅ (GEP-based) |
| Real-time overlay | ✅ | ✅ | ✅ |
| Lobby intel | Partial | ✅ | ✅ |
| Offline data persistence | ❌ | ❌ | ✅ (SQLite) |
| Data export | ❌ | ❌ | ✅ |
| Free, no premium wall | ❌ | ❌ | ✅ |

---

## 11. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| GEP event schema changes after Apex update | High | Version-pin GEP, maintain weapon/legend mappings as config files, not hardcoded. Monitor Overwolf dev channels for breaking changes |
| Unofficial API goes down or rate limits tighten | Medium | Cache aggressively, fall back to GEP-only data. API is supplementary, not primary |
| Overwolf discontinues Apex GEP support | High | Unlikely (Apex is top-5 game on Overwolf), but maintain clean abstraction layer over GEP so alternative sources can be swapped in |
| Anti-cheat blocks Overwolf | Critical | Overwolf is officially sanctioned by EA/Respawn. If this changes, it affects all Overwolf apps and they'd adapt |
| Weapon name mappings break on new season | Low | Maintain as JSON config, update each season. Community can contribute mappings |
| Performance impact on gameplay | Medium | Profile overlay rendering, use requestAnimationFrame throttling, lazy-load charts |

---

## 12. File Structure (Overwolf App)

```
apexpulse/
├── manifest.json                    # Overwolf app manifest
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── src/
│   ├── background/
│   │   ├── background.ts           # Main background controller
│   │   ├── gep-manager.ts          # GEP event registration & handling
│   │   ├── match-tracker.ts        # Match state machine
│   │   ├── api-client.ts           # Apex API wrapper
│   │   ├── database.ts             # SQLite operations
│   │   ├── session-manager.ts      # Session boundary detection
│   │   └── auth/
│   │       ├── auth-manager.ts     # Login orchestration & token management
│   │       ├── steam-auth.ts       # Steam OpenID 2.0 flow
│   │       ├── discord-auth.ts     # Discord OAuth2 + PKCE flow
│   │       ├── origin-resolver.ts  # EA/Origin name detection & validation
│   │       └── token-store.ts      # Encrypted token persistence (Electron safeStorage)
│   ├── overlay/
│   │   ├── overlay.tsx             # In-game overlay React root
│   │   ├── components/
│   │   │   ├── LiveStats.tsx
│   │   │   ├── LobbyIntel.tsx
│   │   │   └── WeaponTracker.tsx
│   │   └── overlay.html
│   ├── dashboard/
│   │   ├── App.tsx                 # Main dashboard React root
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── LinkAccount.tsx
│   │   │   ├── Home.tsx
│   │   │   ├── Stats.tsx
│   │   │   ├── Weapons.tsx
│   │   │   ├── Legends.tsx
│   │   │   ├── MatchHistory.tsx
│   │   │   ├── MatchDetail.tsx
│   │   │   ├── Maps.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── StatCard.tsx
│   │   │   ├── MatchRow.tsx
│   │   │   ├── WeaponChart.tsx
│   │   │   ├── LegendCard.tsx
│   │   │   ├── RPGraph.tsx
│   │   │   └── MapRotation.tsx
│   │   └── dashboard.html
│   ├── shared/
│   │   ├── types.ts                # TypeScript interfaces
│   │   ├── weapon-map.ts           # Weapon name → display mapping
│   │   ├── legend-map.ts           # Legend ID → info mapping
│   │   ├── constants.ts
│   │   └── utils.ts
│   └── stores/
│       ├── authStore.ts            # Zustand store for auth state & linked accounts
│       ├── matchStore.ts           # Zustand store for match data
│       ├── liveStore.ts            # Zustand store for live game state
│       └── settingsStore.ts
├── data/
│   ├── weapons.json                # Weapon database (updatable per season)
│   └── legends.json                # Legend database (updatable per season)
├── assets/
│   ├── icons/
│   ├── weapon-icons/               # Weapon SVG/PNG icons
│   └── legend-icons/               # Legend portrait images
└── dist/                           # Build output
```

---

## 13. Getting Started (Claude Code Workflow)

### Prerequisites

1. Node.js 18+ installed
2. Overwolf developer account created
3. Apex Legends Status API key obtained
4. Overwolf client installed on dev machine

### Bootstrap Commands

```bash
# Clone/init project
mkdir apexpulse && cd apexpulse
npm init -y

# Core dependencies
npm install react react-dom typescript @types/react @types/react-dom
npm install tailwindcss postcss autoprefixer
npm install zustand recharts axios better-sqlite3
npm install @overwolf/overwolf-api-ts  # Overwolf TypeScript types

# Auth dependencies
npm install node-steam-openid           # Steam OpenID 2.0
npm install passport passport-steam     # Alternative Steam auth strategy
# Discord OAuth2 is manual (simple HTTP — no special lib needed)
# EA/Origin — no auth lib, manual name entry + API validation

# Dev dependencies
npm install -D webpack webpack-cli ts-loader css-loader style-loader
npm install -D html-webpack-plugin copy-webpack-plugin
npm install -D @types/better-sqlite3

# Initialize Tailwind
npx tailwindcss init
```

### First Milestone

Get a working Overwolf app that:
1. Detects Apex Legends launch
2. Registers for GEP events
3. Logs kill_feed events to console with weapon names
4. Displays "ApexPulse is tracking" overlay in-game

This proves the entire data pipeline works before building any UI.

---

## Appendix A: Overwolf Manifest Template

```json
{
  "manifest_version": 2,
  "type": "WebApp",
  "meta": {
    "name": "ApexPulse",
    "version": "1.0.0",
    "minimum-overwolf-version": "0.230.0",
    "author": "ApexPulse",
    "icon": "icons/icon.png",
    "description": "The Apex Legends tracker that actually works."
  },
  "data": {
    "start_window": "background",
    "game_targeting": {
      "type": "dedicated",
      "game_ids": [21566]
    },
    "windows": {
      "background": {
        "file": "background/background.html",
        "is_background_page": true
      },
      "dashboard": {
        "file": "dashboard/dashboard.html",
        "desktop_only": true,
        "native_window": false,
        "size": { "width": 1200, "height": 800 },
        "min_size": { "width": 900, "height": 600 }
      },
      "overlay": {
        "file": "overlay/overlay.html",
        "in_game_only": true,
        "native_window": true,
        "size": { "width": 400, "height": 500 },
        "start_position": { "top": 10, "left": 10 },
        "topmost": true,
        "transparent": true,
        "clickthrough": true
      }
    },
    "game_events": [
      {
        "game_id": 21566,
        "features": [
          "gep_internal", "me", "team", "kill", "damage", "death",
          "revive", "match_state", "game_info", "match_info",
          "inventory", "location", "match_summary", "roster",
          "rank", "kill_feed"
        ]
      }
    ],
    "launch_events": [
      {
        "event": "GameLaunch",
        "event_data": { "game_ids": [21566] },
        "start_minimized": false
      }
    ]
  }
}
```

## Appendix B: Key API Endpoints Reference

```
# Player Stats
GET https://api.mozambiquehe.re/bridge?auth={KEY}&player={ORIGIN_NAME}&platform=PC

# Map Rotation
GET https://api.mozambiquehe.re/maprotation?auth={KEY}&version=2

# Crafting Rotation
GET https://api.mozambiquehe.re/crafting?auth={KEY}

# Server Status
GET https://api.mozambiquehe.re/servers?auth={KEY}

# News
GET https://api.mozambiquehe.re/news?auth={KEY}

# Player UID Lookup
GET https://api.mozambiquehe.re/nametouid?auth={KEY}&player={NAME}&platform=PC

# Match History (Events API — must add player first)
POST https://api.mozambiquehe.re/events?auth={KEY}&player={NAME}&platform=PC&action=add
GET https://api.mozambiquehe.re/events?auth={KEY}&player={NAME}&platform=PC&action=get
```

---

*This spec is designed to be used directly with Claude Code for iterative prototyping. Start with Phase 1, get data flowing, then layer on features.*
