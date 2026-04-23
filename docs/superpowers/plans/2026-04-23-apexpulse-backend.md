# ApexPulse Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete backend and shared infrastructure for ApexPulse — database, API client, GEP event processing, match tracking, session management, auth, window messaging, and Zustand stores — wiring them into the existing Overwolf frontend.

**Architecture:** Pure Overwolf app with 3 windows (background, dashboard, overlay). Background process handles all data: GEP events, API polling, SQLite storage, auth. Dashboard and overlay receive data via Overwolf window messaging. Zustand stores on the frontend subscribe to messages and expose reactive state to React components.

**Tech Stack:** TypeScript, sql.js (WASM SQLite), Axios, Zustand 5, Overwolf APIs (games.events, windows, io), React 19

**Critical constraint:** Overwolf apps run in a browser environment — no native Node.js modules. `better-sqlite3` will NOT work. We use `sql.js` (SQLite compiled to WASM) instead, persisted to disk via Overwolf's `io` API.

---

## File Map

### New files to create:
```
src/
├── background/
│   ├── gep-manager.ts          # GEP event registration, parsing, routing
│   ├── match-tracker.ts        # State machine: lobby → in-match → post-match → MatchRecord
│   ├── session-manager.ts      # Session boundary detection (30-min gap)
│   ├── api-client.ts           # mozambiquehe.re API wrapper
│   ├── database.ts             # sql.js database layer (schema, CRUD)
│   ├── messaging.ts            # Overwolf window messaging bridge
│   └── auth/
│       ├── auth-manager.ts     # Login orchestration
│       ├── steam-auth.ts       # Steam OpenID 2.0 browser flow
│       ├── discord-auth.ts     # Discord OAuth2 + PKCE browser flow
│       └── origin-resolver.ts  # EA/Origin name detection & validation
├── shared/
│   ├── constants.ts            # App-wide constants (API URLs, game IDs, timeouts)
│   └── utils.ts                # UUID generation, timestamp helpers
└── stores/
    ├── authStore.ts            # Auth state, user account, linked accounts
    ├── matchStore.ts           # Match history, stats aggregation
    ├── liveStore.ts            # Live in-match state (kills, damage, weapons)
    └── settingsStore.ts        # User preferences, API key, overlay config
```

### Existing files to modify:
```
src/background/background.ts    # Wire all managers together
src/shared/types.ts             # Add DB, auth, session, messaging, API types
src/shared/legend-map.ts        # Expand to all 25+ legends
src/shared/weapon-map.ts        # Fix category typos (spitfire, rampage)
src/dashboard/App.tsx           # Connect to Zustand stores instead of mock data
src/overlay/App.tsx             # Connect to liveStore instead of mock data
package.json                    # Replace better-sqlite3 with sql.js, add uuid
webpack.config.js               # Add sql.js WASM file copy
```

---

## Task 1: Foundation — Dependencies, Types, Constants, Utils

**Files:**
- Modify: `package.json`
- Modify: `webpack.config.js`
- Modify: `src/shared/types.ts`
- Create: `src/shared/constants.ts`
- Create: `src/shared/utils.ts`
- Modify: `src/shared/legend-map.ts`
- Modify: `src/shared/weapon-map.ts`

- [ ] **Step 1: Update dependencies**

Remove `better-sqlite3` and `@types/better-sqlite3`. Add `sql.js` and `uuid`:

```bash
npm uninstall better-sqlite3 @types/better-sqlite3
npm install sql.js
npm install -D @types/uuid
```

Note: `uuid` is not needed — we'll generate UUIDs via `crypto.randomUUID()` which is available in modern browsers/Overwolf.

- [ ] **Step 2: Update webpack.config.js to copy sql.js WASM**

Add to the CopyPlugin patterns array:

```javascript
{ from: 'node_modules/sql.js/dist/sql-wasm.wasm', to: 'sql-wasm.wasm' },
```

Also add to module config to handle .wasm files:

```javascript
experiments: {
  asyncWebAssembly: true,
},
```

- [ ] **Step 3: Expand src/shared/types.ts with all backend types**

Add these types AFTER the existing types (do NOT modify existing interfaces):

```typescript
// === Database Types ===

export interface DbMatchRow {
  id: string;
  timestamp: number;
  duration: number | null;
  game_mode: string;
  map_name: string | null;
  legend: string;
  placement: number | null;
  total_teams: number | null;
  kills: number;
  assists: number;
  knockdowns: number;
  damage: number;
  revives_given: number;
  respawns_given: number;
  survival_time: number | null;
  is_win: number;
  squad_kills: number;
  rp_before: number | null;
  rp_after: number | null;
  rp_change: number | null;
  rank_before: string | null;
  rank_after: string | null;
  session_id: string | null;
  data_source: string;
  raw_data: string | null;
}

export interface DbMatchWeaponRow {
  id?: number;
  match_id: string;
  weapon_name: string;
  kills: number;
  knockdowns: number;
  was_in_loadout: number;
}

export interface DbMatchTeammateRow {
  id?: number;
  match_id: string;
  player_name: string;
  legend: string | null;
  platform: string | null;
  kills: number | null;
  damage: number | null;
  survived: number | null;
}

export interface DbSessionRow {
  id: string;
  start_time: number;
  end_time: number | null;
  matches_played: number;
  total_kills: number;
  total_damage: number;
  total_rp_change: number;
}

export interface DbUserAccountRow {
  id: string;
  login_provider: string | null;
  login_id: string | null;
  login_name: string | null;
  login_avatar: string | null;
  login_token: string | null;
  login_token_expires: number | null;
  origin_name: string | null;
  origin_uid: string | null;
  origin_verified: number;
  origin_detection_method: string | null;
  steam_id: string | null;
  steam_name: string | null;
  steam_avatar: string | null;
  discord_id: string | null;
  discord_name: string | null;
  discord_avatar: string | null;
  created_at: number;
  updated_at: number;
  last_login: number | null;
}

export interface DbProfileSnapshotRow {
  id?: number;
  timestamp: number;
  level: number | null;
  rank_name: string | null;
  rank_score: number | null;
  total_kills: number | null;
  total_damage: number | null;
  total_wins: number | null;
  selected_legend: string | null;
  raw_data: string | null;
}

// === API Response Types ===

export interface ApexApiPlayerResponse {
  global: {
    name: string;
    uid: number;
    platform: string;
    level: number;
    toNextLevelPercent: number;
    rank: {
      rankScore: number;
      rankName: string;
      rankDiv: number;
      ladderPosPlatform: number;
      rankImg: string;
    };
    battlepass: {
      level: string;
    };
  };
  realtime: {
    lobbyState: string;
    isOnline: number;
    isInGame: number;
    canJoin: number;
    partyFull: number;
    selectedLegend: string;
    currentState: string;
    currentStateSinceTimestamp: number;
  };
  legends: {
    selected: {
      LegendName: string;
      data: Array<{ name: string; value: number; key: string }>;
    };
    all: Record<string, {
      data?: Array<{ name: string; value: number; key: string }>;
    }>;
  };
  total: {
    kills?: { value: number };
    damage?: { value: number };
    wins?: { value: number };
    [key: string]: { value: number } | undefined;
  };
}

export interface ApexApiMapRotationResponse {
  battle_royale: {
    current: { map: string; remainingTimer: string; remainingSecs: number; start: number; end: number };
    next: { map: string; start: number; end: number };
  };
  ranked: {
    current: { map: string; remainingTimer: string; remainingSecs: number; start: number; end: number };
    next: { map: string; start: number; end: number };
  };
  ltm?: {
    current: { map: string; remainingTimer: string; remainingSecs: number };
    next: { map: string };
  };
}

export interface ApexApiCraftingResponse {
  bundle: string;
  start: number;
  end: number;
  bundleContent: Array<{
    item: string;
    cost: number;
    itemType: { name: string; rarity: string };
  }>;
}

export interface ApexApiServerStatusResponse {
  [region: string]: {
    HTTP: number;
    QueryDelay: number;
    RTT: number;
    Status: string;
  };
}

export interface ApexApiNameToUidResponse {
  name: string;
  uid: string;
  pid: string;
  platform: string;
}

// === GEP Event Types ===

export type MatchState = 'inactive' | 'active';

export interface GepKillFeedEvent {
  attackerName: string;
  victimName: string;
  weaponName: string;
  action: 'kill' | 'knockdown' | 'bleedout';
}

export interface GepMatchSummary {
  rank: number;
  teams: number;
  squadKills: number;
}

export interface GepTeamMember {
  name: string;
  legend: string;
  platform: string;
  state: 'alive' | 'knocked' | 'dead';
}

export interface GepInventoryItem {
  name: string;
  slot: string;
}

export interface GepLocationData {
  x: number;
  y: number;
  z: number;
}

export interface GepRosterPlayer {
  name: string;
  teamId: number;
  platform: string;
  isTeammate: boolean;
}

// === Match Tracker Types ===

export type TrackerState = 'idle' | 'lobby' | 'legend_select' | 'in_match' | 'post_match';

export interface LiveMatchData {
  state: TrackerState;
  matchStartTime: number | null;
  gameMode: GameMode | null;
  mapName: string | null;
  legend: string | null;
  kills: number;
  assists: number;
  knockdowns: number;
  damage: number;
  squadKills: number;
  teamsLeft: number;
  teammates: GepTeamMember[];
  weaponKills: Record<string, number>;
  weaponKnockdowns: Record<string, number>;
  inventory: string[];
  placement: number | null;
  rpEstimate: number | null;
}

// === Window Messaging Types ===

export type MessageType =
  | 'LIVE_MATCH_UPDATE'
  | 'MATCH_ENDED'
  | 'MATCH_HISTORY_UPDATE'
  | 'PROFILE_UPDATE'
  | 'MAP_ROTATION_UPDATE'
  | 'AUTH_STATE_CHANGE'
  | 'SETTINGS_UPDATE'
  | 'SESSION_UPDATE'
  | 'ORIGIN_DETECTED'
  | 'REQUEST_STATE';

export interface WindowMessage<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: number;
}

// === Session Types ===

export interface SessionData {
  id: string;
  startTime: number;
  endTime: number | null;
  matchesPlayed: number;
  totalKills: number;
  totalDamage: number;
  totalRpChange: number;
}

// === Settings Types ===

export interface AppSettings {
  apiKey: string;
  overlayEnabled: boolean;
  overlayPosition: { top: number; left: number };
  overlayOpacity: number;
  overlayHotkey: string;
  autoDetectOrigin: boolean;
  pollIntervalMs: number;
  sessionTimeoutMs: number;
}

// === Auth Types ===

export type LoginProvider = 'steam' | 'discord' | null;
export type OriginDetectionMethod = 'gep_auto' | 'manual' | 'discord_chain' | null;

export interface UserAccount {
  id: string;
  loginProvider: LoginProvider;
  loginName: string | null;
  loginAvatar: string | null;
  originName: string | null;
  originUid: string | null;
  originVerified: boolean;
  originDetectionMethod: OriginDetectionMethod;
  steamId: string | null;
  steamName: string | null;
  steamAvatar: string | null;
  discordId: string | null;
  discordName: string | null;
  discordAvatar: string | null;
}
```

- [ ] **Step 4: Create src/shared/constants.ts**

```typescript
export const APEX_GAME_ID = 21566;

export const API_BASE_URL = 'https://api.mozambiquehe.re';
export const API_ENDPOINTS = {
  bridge: '/bridge',
  mapRotation: '/maprotation',
  crafting: '/crafting',
  servers: '/servers',
  news: '/news',
  nameToUid: '/nametouid',
  events: '/events',
} as const;

export const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
export const STEAM_API_BASE = 'https://api.steampowered.com';
export const DISCORD_API_BASE = 'https://discord.com/api/v10';
export const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
export const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

export const AUTH_CALLBACK_PORT = 3847;
export const AUTH_CALLBACK_BASE = `http://localhost:${AUTH_CALLBACK_PORT}`;

export const DB_FILENAME = 'apexpulse.db';
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const API_POLL_INTERVAL_MS = 120_000; // 2 minutes
export const API_RATE_LIMIT_MS = 500; // 2 req/sec = 500ms between requests
export const DB_SAVE_INTERVAL_MS = 30_000; // Auto-save DB every 30s

export const DEFAULT_SETTINGS: import('./types').AppSettings = {
  apiKey: '',
  overlayEnabled: true,
  overlayPosition: { top: 10, left: 10 },
  overlayOpacity: 0.8,
  overlayHotkey: 'Shift+F1',
  autoDetectOrigin: true,
  pollIntervalMs: API_POLL_INTERVAL_MS,
  sessionTimeoutMs: SESSION_TIMEOUT_MS,
};

export const WINDOW_NAMES = {
  background: 'background',
  dashboard: 'dashboard',
  overlay: 'overlay',
} as const;
```

- [ ] **Step 5: Create src/shared/utils.ts**

```typescript
export function generateId(): string {
  return crypto.randomUUID();
}

export function nowMs(): number {
  return Date.now();
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function normalizeWeaponName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function normalizeLegendName(raw: string): string {
  // GEP returns '#character_LEGENDNAME_NAME' format
  const match = raw.match(/character_(\w+)_NAME/i);
  if (match) return match[1].toLowerCase();
  return raw.toLowerCase().replace(/[^a-z]/g, '');
}

export function parseGameMode(raw: string): import('./types').GameMode {
  const lower = raw.toLowerCase();
  if (lower.includes('ranked')) return 'ranked_br';
  if (lower.includes('mixtape') || lower.includes('tdm') || lower.includes('control') || lower.includes('gun_run')) return 'mixtape';
  if (lower.includes('ltm') || lower.includes('event')) return 'ltm';
  if (lower.includes('firing') || lower.includes('range')) return 'firing_range';
  return 'battle_royale';
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
```

- [ ] **Step 6: Complete src/shared/legend-map.ts with all legends**

Replace entire file with all 26 legends:

```typescript
import { LegendInfo } from './types';

export const LEGENDS: Record<string, LegendInfo> = {
  bangalore: { id: 'bangalore', displayName: 'Bangalore', class: 'Assault', tactical: 'Smoke Launcher', ultimate: 'Rolling Thunder', passive: 'Double Time' },
  bloodhound: { id: 'bloodhound', displayName: 'Bloodhound', class: 'Recon', tactical: 'Eye of the Allfather', ultimate: 'Beast of the Hunt', passive: 'Tracker' },
  caustic: { id: 'caustic', displayName: 'Caustic', class: 'Controller', tactical: 'Nox Gas Trap', ultimate: 'Nox Gas Grenade', passive: 'Nox Vision' },
  crypto: { id: 'crypto', displayName: 'Crypto', class: 'Recon', tactical: 'Surveillance Drone', ultimate: 'Drone EMP', passive: 'Neurolink' },
  fuse: { id: 'fuse', displayName: 'Fuse', class: 'Assault', tactical: 'Knuckle Cluster', ultimate: 'The Motherlode', passive: 'Grenadier' },
  gibraltar: { id: 'gibraltar', displayName: 'Gibraltar', class: 'Support', tactical: 'Dome of Protection', ultimate: 'Defensive Bombardment', passive: 'Gun Shield' },
  horizon: { id: 'horizon', displayName: 'Horizon', class: 'Skirmisher', tactical: 'Gravity Lift', ultimate: 'Black Hole', passive: 'Spacewalk' },
  lifeline: { id: 'lifeline', displayName: 'Lifeline', class: 'Support', tactical: 'D.O.C. Heal Drone', ultimate: 'Care Package', passive: 'Combat Medic' },
  loba: { id: 'loba', displayName: 'Loba', class: 'Support', tactical: 'Burglar\'s Best Friend', ultimate: 'Black Market Boutique', passive: 'Eye for Quality' },
  mirage: { id: 'mirage', displayName: 'Mirage', class: 'Support', tactical: 'Psyche Out', ultimate: 'Life of the Party', passive: 'Now You See Me...' },
  newcastle: { id: 'newcastle', displayName: 'Newcastle', class: 'Support', tactical: 'Mobile Shield', ultimate: 'Castle Wall', passive: 'Retrieve the Wounded' },
  octane: { id: 'octane', displayName: 'Octane', class: 'Skirmisher', tactical: 'Stim', ultimate: 'Launch Pad', passive: 'Swift Mend' },
  pathfinder: { id: 'pathfinder', displayName: 'Pathfinder', class: 'Skirmisher', tactical: 'Grappling Hook', ultimate: 'Zipline Gun', passive: 'Insider Knowledge' },
  rampart: { id: 'rampart', displayName: 'Rampart', class: 'Controller', tactical: 'Amped Cover', ultimate: 'Sheila', passive: 'Modded Loader' },
  revenant: { id: 'revenant', displayName: 'Revenant', class: 'Assault', tactical: 'Shadow Pounce', ultimate: 'Forged Shadows', passive: 'Assassin\'s Instinct' },
  seer: { id: 'seer', displayName: 'Seer', class: 'Recon', tactical: 'Focus of Attention', ultimate: 'Exhibit', passive: 'Heart Seeker' },
  valkyrie: { id: 'valkyrie', displayName: 'Valkyrie', class: 'Skirmisher', tactical: 'Missile Swarm', ultimate: 'Skyward Dive', passive: 'VTOL Jets' },
  vantage: { id: 'vantage', displayName: 'Vantage', class: 'Recon', tactical: 'Echo Relocation', ultimate: 'Sniper\'s Mark', passive: 'Spotter\'s Lens' },
  wattson: { id: 'wattson', displayName: 'Wattson', class: 'Controller', tactical: 'Perimeter Security', ultimate: 'Interception Pylon', passive: 'Spark of Genius' },
  wraith: { id: 'wraith', displayName: 'Wraith', class: 'Skirmisher', tactical: 'Into the Void', ultimate: 'Dimensional Rift', passive: 'Voices from the Void' },
  ash: { id: 'ash', displayName: 'Ash', class: 'Assault', tactical: 'Arc Snare', ultimate: 'Phase Breach', passive: 'Marked for Death' },
  mad_maggie: { id: 'mad_maggie', displayName: 'Mad Maggie', class: 'Assault', tactical: 'Riot Drill', ultimate: 'Wrecking Ball', passive: 'Warlord\'s Ire' },
  ballistic: { id: 'ballistic', displayName: 'Ballistic', class: 'Assault', tactical: 'Whistler', ultimate: 'Tempest', passive: 'Sling' },
  catalyst: { id: 'catalyst', displayName: 'Catalyst', class: 'Controller', tactical: 'Piercing Spikes', ultimate: 'Dark Veil', passive: 'Barricade' },
  conduit: { id: 'conduit', displayName: 'Conduit', class: 'Support', tactical: 'Radiant Transfer', ultimate: 'Energy Barricade', passive: 'Savior\'s Speed' },
  alter: { id: 'alter', displayName: 'Alter', class: 'Skirmisher', tactical: 'Void Passage', ultimate: 'Void Nexus', passive: 'Gift from the Rift' },
};
```

- [ ] **Step 7: Fix weapon-map.ts category typos**

In `src/shared/weapon-map.ts`, fix spitfire and rampage entries:
- `'spitfire': { display: 'M600 Spitfire', category: 'Light', ...}` → category should be `'LMG'`
- `'rampage': { display: 'Rampage LMG', category: 'Heavy', ...}` → category should be `'LMG'`

Also add the 'Bleed Out' special entry from the spec:
```typescript
'bleed_out': { display: 'Bleed Out', category: 'Environmental', ammo: 'None' },
```

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: foundation — types, constants, utils, complete legend/weapon maps"
```

---

## Task 2: Database Layer (sql.js)

**Files:**
- Create: `src/background/database.ts`

**Depends on:** Task 1 (types, constants)

- [ ] **Step 1: Create src/background/database.ts**

```typescript
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { DbMatchRow, DbMatchWeaponRow, DbMatchTeammateRow, DbSessionRow, DbUserAccountRow, DbProfileSnapshotRow, MatchRecord, SessionData, UserAccount } from '../shared/types';
import { DB_FILENAME, DB_SAVE_INTERVAL_MS } from '../shared/constants';
import { nowMs } from '../shared/utils';

let db: SqlJsDatabase | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;

function getDbPath(): string {
  // Overwolf local app data path
  const localAppData = overwolf.io.paths?.localAppData ?? '';
  return `${localAppData}\\ApexPulse\\${DB_FILENAME}`;
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => file,
  });

  const dbPath = getDbPath();

  // Try to load existing database
  try {
    const existingData = await readFileAsUint8Array(dbPath);
    if (existingData) {
      db = new SQL.Database(existingData);
      console.log('Loaded existing database from', dbPath);
    } else {
      db = new SQL.Database();
      console.log('Created new database');
    }
  } catch {
    db = new SQL.Database();
    console.log('Created new database (no existing file)');
  }

  createSchema();
  startAutoSave();
}

function createSchema(): void {
  if (!db) throw new Error('Database not initialized');

  db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      duration INTEGER,
      game_mode TEXT NOT NULL,
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
      is_win INTEGER DEFAULT 0,
      squad_kills INTEGER DEFAULT 0,
      rp_before INTEGER,
      rp_after INTEGER,
      rp_change INTEGER,
      rank_before TEXT,
      rank_after TEXT,
      session_id TEXT,
      data_source TEXT DEFAULT 'gep',
      raw_data TEXT
    );

    CREATE TABLE IF NOT EXISTS match_weapons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL REFERENCES matches(id),
      weapon_name TEXT NOT NULL,
      kills INTEGER DEFAULT 0,
      knockdowns INTEGER DEFAULT 0,
      was_in_loadout INTEGER DEFAULT 0,
      UNIQUE(match_id, weapon_name)
    );

    CREATE TABLE IF NOT EXISTS match_teammates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL REFERENCES matches(id),
      player_name TEXT NOT NULL,
      legend TEXT,
      platform TEXT,
      kills INTEGER,
      damage INTEGER,
      survived INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      matches_played INTEGER DEFAULT 0,
      total_kills INTEGER DEFAULT 0,
      total_damage INTEGER DEFAULT 0,
      total_rp_change INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_account (
      id TEXT PRIMARY KEY DEFAULT 'local',
      login_provider TEXT,
      login_id TEXT,
      login_name TEXT,
      login_avatar TEXT,
      login_token TEXT,
      login_token_expires INTEGER,
      origin_name TEXT,
      origin_uid TEXT,
      origin_verified INTEGER DEFAULT 0,
      origin_detection_method TEXT,
      steam_id TEXT,
      steam_name TEXT,
      steam_avatar TEXT,
      discord_id TEXT,
      discord_name TEXT,
      discord_avatar TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login INTEGER
    );

    CREATE TABLE IF NOT EXISTS profile_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      level INTEGER,
      rank_name TEXT,
      rank_score INTEGER,
      total_kills INTEGER,
      total_damage INTEGER,
      total_wins INTEGER,
      selected_legend TEXT,
      raw_data TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_matches_timestamp ON matches(timestamp);
    CREATE INDEX IF NOT EXISTS idx_matches_game_mode ON matches(game_mode);
    CREATE INDEX IF NOT EXISTS idx_matches_legend ON matches(legend);
    CREATE INDEX IF NOT EXISTS idx_matches_session ON matches(session_id);
    CREATE INDEX IF NOT EXISTS idx_match_weapons_match ON match_weapons(match_id);
    CREATE INDEX IF NOT EXISTS idx_match_weapons_weapon ON match_weapons(weapon_name);
    CREATE INDEX IF NOT EXISTS idx_profile_snapshots_timestamp ON profile_snapshots(timestamp);
  `);
}

// === File I/O Helpers ===

function readFileAsUint8Array(path: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    overwolf.io.readBinaryFile(path, {}, (result) => {
      if (result.success && result.content) {
        resolve(new Uint8Array(result.content));
      } else {
        resolve(null);
      }
    });
  });
}

function ensureDirectory(path: string): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf('\\'));
  return new Promise((resolve) => {
    overwolf.io.createDirectory(dir, (result) => {
      resolve(); // Ignore errors — directory may already exist
    });
  });
}

export async function saveDatabase(): Promise<void> {
  if (!db) return;
  const data = db.export();
  const dbPath = getDbPath();
  await ensureDirectory(dbPath);

  return new Promise((resolve, reject) => {
    // Convert to base64 for Overwolf's file write
    const blob = new Blob([data]);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      overwolf.io.writeFileContents(dbPath, base64, 'UTF8', true, (result) => {
        if (result.success) {
          resolve();
        } else {
          console.error('Failed to save database:', result.error);
          reject(new Error(result.error));
        }
      });
    };
    reader.readAsDataURL(blob);
  });
}

function startAutoSave(): void {
  if (saveTimer) clearInterval(saveTimer);
  saveTimer = setInterval(() => saveDatabase(), DB_SAVE_INTERVAL_MS);
}

// === Match CRUD ===

export function insertMatch(match: MatchRecord): void {
  if (!db) throw new Error('Database not initialized');

  db.run(
    `INSERT INTO matches (id, timestamp, duration, game_mode, map_name, legend, placement, total_teams,
      kills, assists, knockdowns, damage, revives_given, respawns_given, survival_time,
      is_win, squad_kills, rp_before, rp_after, rp_change, rank_before, rank_after,
      session_id, data_source, raw_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      match.matchId, match.timestamp, match.duration, match.gameMode, match.mapName,
      match.legend, match.placement, match.totalTeams, match.kills, match.assists,
      match.knockdowns, match.damage, match.revivesGiven, match.respawnsGiven,
      match.survivalTime, match.isWin ? 1 : 0, match.squadKills,
      match.rpBefore ?? null, match.rpAfter ?? null, match.rpChange ?? null,
      match.rankBefore ?? null, match.rankAfter ?? null,
      null, 'gep', JSON.stringify(match),
    ]
  );

  // Insert weapon kills
  for (const wk of match.weaponKills) {
    const existing = match.weaponKnockdowns.find(wn => wn.weaponName === wk.weaponName);
    db.run(
      `INSERT OR REPLACE INTO match_weapons (match_id, weapon_name, kills, knockdowns, was_in_loadout)
       VALUES (?, ?, ?, ?, ?)`,
      [match.matchId, wk.weaponName, wk.kills, existing?.knockdowns ?? 0,
       match.loadoutFinal.includes(wk.weaponName) ? 1 : 0]
    );
  }

  // Insert knockdowns for weapons not already inserted via kills
  for (const wn of match.weaponKnockdowns) {
    if (!match.weaponKills.find(wk => wk.weaponName === wn.weaponName)) {
      db.run(
        `INSERT OR REPLACE INTO match_weapons (match_id, weapon_name, kills, knockdowns, was_in_loadout)
         VALUES (?, ?, 0, ?, ?)`,
        [match.matchId, wn.weaponName, wn.knockdowns,
         match.loadoutFinal.includes(wn.weaponName) ? 1 : 0]
      );
    }
  }

  // Insert loadout weapons not already inserted
  for (const weapon of match.loadoutFinal) {
    db.run(
      `INSERT OR IGNORE INTO match_weapons (match_id, weapon_name, kills, knockdowns, was_in_loadout)
       VALUES (?, ?, 0, 0, 1)`,
      [match.matchId, weapon]
    );
  }

  // Insert teammates
  for (const tm of match.teammates) {
    db.run(
      `INSERT INTO match_teammates (match_id, player_name, legend, platform, kills, damage, survived)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [match.matchId, tm.name, tm.legend, tm.platform, tm.kills, tm.damage, tm.survived ? 1 : 0]
    );
  }
}

export function getRecentMatches(limit: number = 20, offset: number = 0): MatchRecord[] {
  if (!db) return [];

  const rows = db.exec(
    `SELECT * FROM matches ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  if (!rows.length || !rows[0].values.length) return [];

  return rows[0].values.map((row) => {
    const matchRow = rowToObject<DbMatchRow>(rows[0].columns, row);
    return dbRowToMatchRecord(matchRow);
  });
}

export function getMatchById(id: string): MatchRecord | null {
  if (!db) return null;

  const rows = db.exec(`SELECT * FROM matches WHERE id = ?`, [id]);
  if (!rows.length || !rows[0].values.length) return null;

  const matchRow = rowToObject<DbMatchRow>(rows[0].columns, rows[0].values[0]);
  return dbRowToMatchRecord(matchRow);
}

export function getMatchesByMode(mode: string, limit: number = 50): MatchRecord[] {
  if (!db) return [];
  const rows = db.exec(
    `SELECT * FROM matches WHERE game_mode = ? ORDER BY timestamp DESC LIMIT ?`,
    [mode, limit]
  );
  if (!rows.length) return [];
  return rows[0].values.map(row => dbRowToMatchRecord(rowToObject<DbMatchRow>(rows[0].columns, row)));
}

export function getMatchesByLegend(legend: string, limit: number = 50): MatchRecord[] {
  if (!db) return [];
  const rows = db.exec(
    `SELECT * FROM matches WHERE legend = ? ORDER BY timestamp DESC LIMIT ?`,
    [legend, limit]
  );
  if (!rows.length) return [];
  return rows[0].values.map(row => dbRowToMatchRecord(rowToObject<DbMatchRow>(rows[0].columns, row)));
}

export function getOverallStats(): { totalMatches: number; totalKills: number; totalDamage: number; totalWins: number; avgDamage: number; kdRatio: number; winRate: number } {
  if (!db) return { totalMatches: 0, totalKills: 0, totalDamage: 0, totalWins: 0, avgDamage: 0, kdRatio: 0, winRate: 0 };

  const rows = db.exec(`
    SELECT
      COUNT(*) as total_matches,
      COALESCE(SUM(kills), 0) as total_kills,
      COALESCE(SUM(damage), 0) as total_damage,
      COALESCE(SUM(is_win), 0) as total_wins,
      COALESCE(AVG(damage), 0) as avg_damage,
      COALESCE(SUM(kills), 0) as deaths_proxy
    FROM matches
    WHERE game_mode != 'firing_range'
  `);

  if (!rows.length || !rows[0].values.length) return { totalMatches: 0, totalKills: 0, totalDamage: 0, totalWins: 0, avgDamage: 0, kdRatio: 0, winRate: 0 };

  const r = rows[0].values[0];
  const totalMatches = Number(r[0]);
  const totalKills = Number(r[1]);
  const totalDamage = Number(r[2]);
  const totalWins = Number(r[3]);
  const avgDamage = Number(r[4]);
  // K/D approximation: deaths ≈ matches - wins (you die once per non-win match)
  const deaths = Math.max(totalMatches - totalWins, 1);
  const kdRatio = totalKills / deaths;
  const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;

  return { totalMatches, totalKills, totalDamage, totalWins, avgDamage: Math.round(avgDamage), kdRatio: Math.round(kdRatio * 100) / 100, winRate: Math.round(winRate * 10) / 10 };
}

export function getWeaponStats(): Array<{ weaponName: string; totalKills: number; totalKnockdowns: number; matchesUsed: number }> {
  if (!db) return [];
  const rows = db.exec(`
    SELECT weapon_name, SUM(kills) as total_kills, SUM(knockdowns) as total_knockdowns, COUNT(DISTINCT match_id) as matches_used
    FROM match_weapons
    GROUP BY weapon_name
    ORDER BY total_kills DESC
  `);
  if (!rows.length) return [];
  return rows[0].values.map(r => ({
    weaponName: String(r[0]),
    totalKills: Number(r[1]),
    totalKnockdowns: Number(r[2]),
    matchesUsed: Number(r[3]),
  }));
}

export function getLegendStats(): Array<{ legend: string; matches: number; kills: number; damage: number; wins: number; avgDamage: number; kdRatio: number }> {
  if (!db) return [];
  const rows = db.exec(`
    SELECT legend,
      COUNT(*) as matches,
      COALESCE(SUM(kills), 0) as kills,
      COALESCE(SUM(damage), 0) as damage,
      COALESCE(SUM(is_win), 0) as wins,
      COALESCE(AVG(damage), 0) as avg_damage
    FROM matches
    WHERE game_mode != 'firing_range'
    GROUP BY legend
    ORDER BY matches DESC
  `);
  if (!rows.length) return [];
  return rows[0].values.map(r => {
    const matches = Number(r[1]);
    const kills = Number(r[2]);
    const wins = Number(r[4]);
    const deaths = Math.max(matches - wins, 1);
    return {
      legend: String(r[0]),
      matches,
      kills,
      damage: Number(r[3]),
      wins,
      avgDamage: Math.round(Number(r[5])),
      kdRatio: Math.round((kills / deaths) * 100) / 100,
    };
  });
}

// === Session CRUD ===

export function upsertSession(session: SessionData): void {
  if (!db) return;
  db.run(
    `INSERT OR REPLACE INTO sessions (id, start_time, end_time, matches_played, total_kills, total_damage, total_rp_change)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.startTime, session.endTime, session.matchesPlayed, session.totalKills, session.totalDamage, session.totalRpChange]
  );
}

export function getLatestSession(): SessionData | null {
  if (!db) return null;
  const rows = db.exec(`SELECT * FROM sessions ORDER BY start_time DESC LIMIT 1`);
  if (!rows.length || !rows[0].values.length) return null;
  const r = rowToObject<DbSessionRow>(rows[0].columns, rows[0].values[0]);
  return { id: r.id, startTime: r.start_time, endTime: r.end_time, matchesPlayed: r.matches_played, totalKills: r.total_kills, totalDamage: r.total_damage, totalRpChange: r.total_rp_change };
}

// === User Account CRUD ===

export function getUserAccount(): UserAccount | null {
  if (!db) return null;
  const rows = db.exec(`SELECT * FROM user_account WHERE id = 'local'`);
  if (!rows.length || !rows[0].values.length) return null;
  const r = rowToObject<DbUserAccountRow>(rows[0].columns, rows[0].values[0]);
  return {
    id: r.id,
    loginProvider: r.login_provider as UserAccount['loginProvider'],
    loginName: r.login_name,
    loginAvatar: r.login_avatar,
    originName: r.origin_name,
    originUid: r.origin_uid,
    originVerified: r.origin_verified === 1,
    originDetectionMethod: r.origin_detection_method as UserAccount['originDetectionMethod'],
    steamId: r.steam_id,
    steamName: r.steam_name,
    steamAvatar: r.steam_avatar,
    discordId: r.discord_id,
    discordName: r.discord_name,
    discordAvatar: r.discord_avatar,
  };
}

export function upsertUserAccount(account: Partial<DbUserAccountRow>): void {
  if (!db) return;
  const now = nowMs();
  const existing = getUserAccount();
  if (existing) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, value] of Object.entries(account)) {
      if (key === 'id') continue;
      sets.push(`${key} = ?`);
      vals.push(value);
    }
    sets.push('updated_at = ?');
    vals.push(now);
    vals.push('local');
    db.run(`UPDATE user_account SET ${sets.join(', ')} WHERE id = ?`, vals);
  } else {
    db.run(
      `INSERT INTO user_account (id, created_at, updated_at, origin_name, origin_uid, origin_verified, origin_detection_method, login_provider, login_name, login_avatar, steam_id, steam_name, discord_id, discord_name)
       VALUES ('local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [now, now, account.origin_name ?? null, account.origin_uid ?? null, account.origin_verified ?? 0, account.origin_detection_method ?? null,
       account.login_provider ?? null, account.login_name ?? null, account.login_avatar ?? null,
       account.steam_id ?? null, account.steam_name ?? null, account.discord_id ?? null, account.discord_name ?? null]
    );
  }
}

// === Profile Snapshots ===

export function insertProfileSnapshot(snapshot: Omit<DbProfileSnapshotRow, 'id'>): void {
  if (!db) return;
  db.run(
    `INSERT INTO profile_snapshots (timestamp, level, rank_name, rank_score, total_kills, total_damage, total_wins, selected_legend, raw_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [snapshot.timestamp, snapshot.level, snapshot.rank_name, snapshot.rank_score, snapshot.total_kills, snapshot.total_damage, snapshot.total_wins, snapshot.selected_legend, snapshot.raw_data]
  );
}

export function getLatestProfileSnapshot(): DbProfileSnapshotRow | null {
  if (!db) return null;
  const rows = db.exec(`SELECT * FROM profile_snapshots ORDER BY timestamp DESC LIMIT 1`);
  if (!rows.length || !rows[0].values.length) return null;
  return rowToObject<DbProfileSnapshotRow>(rows[0].columns, rows[0].values[0]);
}

// === Helpers ===

function rowToObject<T>(columns: string[], values: unknown[]): T {
  const obj: Record<string, unknown> = {};
  columns.forEach((col, i) => { obj[col] = values[i]; });
  return obj as T;
}

function dbRowToMatchRecord(row: DbMatchRow): MatchRecord {
  // Get weapon data
  const weaponRows = db!.exec(`SELECT * FROM match_weapons WHERE match_id = ?`, [row.id]);
  const weaponKills: MatchRecord['weaponKills'] = [];
  const weaponKnockdowns: MatchRecord['weaponKnockdowns'] = [];
  const loadoutFinal: string[] = [];

  if (weaponRows.length && weaponRows[0].values.length) {
    for (const wr of weaponRows[0].values) {
      const w = rowToObject<DbMatchWeaponRow>(weaponRows[0].columns, wr);
      if (w.kills > 0) weaponKills.push({ weaponName: w.weapon_name, kills: w.kills, knockdowns: w.knockdowns });
      if (w.knockdowns > 0 && !weaponKills.find(wk => wk.weaponName === w.weapon_name)) {
        weaponKnockdowns.push({ weaponName: w.weapon_name, kills: 0, knockdowns: w.knockdowns });
      }
      if (w.was_in_loadout) loadoutFinal.push(w.weapon_name);
    }
  }

  // Get teammate data
  const tmRows = db!.exec(`SELECT * FROM match_teammates WHERE match_id = ?`, [row.id]);
  const teammates: MatchRecord['teammates'] = [];
  if (tmRows.length && tmRows[0].values.length) {
    for (const tr of tmRows[0].values) {
      const t = rowToObject<DbMatchTeammateRow>(tmRows[0].columns, tr);
      teammates.push({
        name: t.player_name,
        legend: t.legend ?? '',
        platform: t.platform ?? '',
        kills: t.kills ?? 0,
        damage: t.damage ?? 0,
        survived: (t.survived ?? 0) === 1,
      });
    }
  }

  return {
    matchId: row.id,
    timestamp: row.timestamp,
    duration: row.duration ?? 0,
    gameMode: row.game_mode as MatchRecord['gameMode'],
    mapName: row.map_name ?? '',
    placement: row.placement ?? 0,
    totalTeams: row.total_teams ?? 0,
    kills: row.kills,
    assists: row.assists,
    knockdowns: row.knockdowns,
    damage: row.damage,
    revivesGiven: row.revives_given,
    respawnsGiven: row.respawns_given,
    survivalTime: row.survival_time ?? 0,
    legend: row.legend,
    teammates,
    weaponKills,
    weaponKnockdowns,
    loadoutFinal,
    rpBefore: row.rp_before ?? undefined,
    rpAfter: row.rp_after ?? undefined,
    rpChange: row.rp_change ?? undefined,
    rankBefore: row.rank_before ?? undefined,
    rankAfter: row.rank_after ?? undefined,
    isWin: row.is_win === 1,
    squadKills: row.squad_kills,
  };
}

export function closeDatabase(): void {
  if (saveTimer) clearInterval(saveTimer);
  saveDatabase().then(() => {
    if (db) db.close();
    db = null;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/background/database.ts
git commit -m "feat: sql.js database layer with full schema and CRUD operations"
```

---

## Task 3: API Client

**Files:**
- Create: `src/background/api-client.ts`

**Depends on:** Task 1 (types, constants)

- [ ] **Step 1: Create src/background/api-client.ts**

```typescript
import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL, API_ENDPOINTS, API_RATE_LIMIT_MS } from '../shared/constants';
import { ApexApiPlayerResponse, ApexApiMapRotationResponse, ApexApiCraftingResponse, ApexApiServerStatusResponse, ApexApiNameToUidResponse } from '../shared/types';

let apiKey = '';
let lastRequestTime = 0;

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < API_RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, API_RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export function setApiKey(key: string): void {
  apiKey = key;
}

export function getApiKey(): string {
  return apiKey;
}

function ensureApiKey(): void {
  if (!apiKey) throw new Error('API key not set. Call setApiKey() first.');
}

export async function getPlayerStats(playerName: string, platform: string = 'PC'): Promise<ApexApiPlayerResponse | null> {
  ensureApiKey();
  await throttle();
  try {
    const response = await client.get(API_ENDPOINTS.bridge, {
      params: { auth: apiKey, player: playerName, platform },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch player stats:', error);
    return null;
  }
}

export async function getMapRotation(): Promise<ApexApiMapRotationResponse | null> {
  ensureApiKey();
  await throttle();
  try {
    const response = await client.get(API_ENDPOINTS.mapRotation, {
      params: { auth: apiKey, version: 2 },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch map rotation:', error);
    return null;
  }
}

export async function getCraftingRotation(): Promise<ApexApiCraftingResponse[] | null> {
  ensureApiKey();
  await throttle();
  try {
    const response = await client.get(API_ENDPOINTS.crafting, {
      params: { auth: apiKey },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch crafting rotation:', error);
    return null;
  }
}

export async function getServerStatus(): Promise<ApexApiServerStatusResponse | null> {
  ensureApiKey();
  await throttle();
  try {
    const response = await client.get(API_ENDPOINTS.servers, {
      params: { auth: apiKey },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch server status:', error);
    return null;
  }
}

export async function nameToUid(playerName: string, platform: string = 'PC'): Promise<ApexApiNameToUidResponse | null> {
  ensureApiKey();
  await throttle();
  try {
    const response = await client.get(API_ENDPOINTS.nameToUid, {
      params: { auth: apiKey, player: playerName, platform },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to resolve name to UID:', error);
    return null;
  }
}

export async function lookupMultiplePlayers(names: string[], platform: string = 'PC'): Promise<Map<string, ApexApiPlayerResponse>> {
  const results = new Map<string, ApexApiPlayerResponse>();
  for (const name of names) {
    const data = await getPlayerStats(name, platform);
    if (data) results.set(name, data);
  }
  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/background/api-client.ts
git commit -m "feat: Apex API client with throttling and all endpoints"
```

---

## Task 4: Window Messaging Bridge

**Files:**
- Create: `src/background/messaging.ts`

**Depends on:** Task 1 (types)

- [ ] **Step 1: Create src/background/messaging.ts**

This module handles Overwolf inter-window communication. The background process broadcasts messages; dashboard and overlay listen.

```typescript
import { WindowMessage, MessageType, WINDOW_NAMES } from '../shared/types';
import { WINDOW_NAMES as WIN } from '../shared/constants';

type MessageHandler = (message: WindowMessage) => void;
const handlers: Map<MessageType, Set<MessageHandler>> = new Map();

export function onMessage(type: MessageType, handler: MessageHandler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler);
  return () => handlers.get(type)?.delete(handler);
}

export function setupMessageListener(): void {
  overwolf.windows.onMessageReceived.addListener((message: overwolf.windows.MessageReceivedEvent) => {
    try {
      const parsed = JSON.parse(message.content) as WindowMessage;
      const typeHandlers = handlers.get(parsed.type);
      if (typeHandlers) {
        typeHandlers.forEach(h => h(parsed));
      }
    } catch {
      console.warn('Failed to parse window message:', message.content);
    }
  });
}

export function sendToWindow(windowName: string, message: WindowMessage): void {
  const content = JSON.stringify(message);
  overwolf.windows.getWindow(windowName, (result) => {
    if (result.success && result.window) {
      overwolf.windows.sendMessage(result.window.id, 'apexpulse', content, () => {});
    }
  });
}

export function broadcast(message: WindowMessage): void {
  sendToWindow(WIN.dashboard, message);
  sendToWindow(WIN.overlay, message);
}

export function broadcastLiveUpdate<T>(payload: T): void {
  broadcast({ type: 'LIVE_MATCH_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastMatchEnded<T>(payload: T): void {
  broadcast({ type: 'MATCH_ENDED', payload, timestamp: Date.now() });
}

export function broadcastMatchHistory<T>(payload: T): void {
  broadcast({ type: 'MATCH_HISTORY_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastProfile<T>(payload: T): void {
  broadcast({ type: 'PROFILE_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastMapRotation<T>(payload: T): void {
  broadcast({ type: 'MAP_ROTATION_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastAuthChange<T>(payload: T): void {
  broadcast({ type: 'AUTH_STATE_CHANGE', payload, timestamp: Date.now() });
}

export function broadcastSettings<T>(payload: T): void {
  broadcast({ type: 'SETTINGS_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastSession<T>(payload: T): void {
  broadcast({ type: 'SESSION_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastOriginDetected(name: string, uid: string): void {
  broadcast({ type: 'ORIGIN_DETECTED', payload: { name, uid }, timestamp: Date.now() });
}

// For renderer windows: set up listener that calls registered callbacks
export function setupRendererListener(): void {
  overwolf.windows.onMessageReceived.addListener((message: overwolf.windows.MessageReceivedEvent) => {
    try {
      const parsed = JSON.parse(message.content) as WindowMessage;
      const typeHandlers = handlers.get(parsed.type);
      if (typeHandlers) {
        typeHandlers.forEach(h => h(parsed));
      }
    } catch {
      // Ignore unparseable messages
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/background/messaging.ts
git commit -m "feat: Overwolf window messaging bridge"
```

---

## Task 5: GEP Manager

**Files:**
- Create: `src/background/gep-manager.ts`

**Depends on:** Task 1 (types, utils)

- [ ] **Step 1: Create src/background/gep-manager.ts**

```typescript
import { APEX_GAME_ID } from '../shared/constants';
import { GepKillFeedEvent, GepMatchSummary, GepTeamMember, MatchState, GepRosterPlayer } from '../shared/types';
import { normalizeWeaponName, normalizeLegendName, parseGameMode } from '../shared/utils';

type GepEventCallback = {
  onMatchStateChange: (state: MatchState) => void;
  onKillFeed: (event: GepKillFeedEvent) => void;
  onKill: (kills: number) => void;
  onAssist: (assists: number) => void;
  onDamage: (total: number) => void;
  onKnockdown: (knockdowns: number) => void;
  onDeath: () => void;
  onRevive: () => void;
  onTeamUpdate: (team: GepTeamMember[]) => void;
  onInventoryUpdate: (items: string[]) => void;
  onLocationUpdate: (x: number, y: number, z: number) => void;
  onMatchSummary: (summary: GepMatchSummary) => void;
  onRosterUpdate: (players: GepRosterPlayer[]) => void;
  onPlayerNameDetected: (name: string) => void;
  onGameModeDetected: (mode: string) => void;
  onMapDetected: (map: string) => void;
  onLegendDetected: (legend: string) => void;
};

let callbacks: GepEventCallback | null = null;
let featuresSet = false;
let retryCount = 0;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

export function registerCallbacks(cbs: GepEventCallback): void {
  callbacks = cbs;
}

export function initGep(): void {
  overwolf.games.events.onInfoUpdates2.addListener(handleInfoUpdate);
  overwolf.games.events.onNewEvents.addListener(handleNewEvents);
  setFeatures();
}

function setFeatures(): void {
  const features = [
    'gep_internal', 'me', 'team', 'kill', 'damage', 'death',
    'revive', 'match_state', 'game_info', 'match_info',
    'inventory', 'location', 'match_summary', 'roster',
    'rank', 'kill_feed',
  ];

  overwolf.games.events.setRequiredFeatures(features, (info) => {
    if (info.success) {
      console.log('[GEP] Features set successfully');
      featuresSet = true;
      retryCount = 0;
    } else {
      console.warn('[GEP] Failed to set features, retrying...', info.error);
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(setFeatures, RETRY_DELAY_MS);
      }
    }
  });
}

function handleInfoUpdate(info: overwolf.games.events.InfoUpdates2Event): void {
  if (!callbacks) return;

  const { feature, info: data } = info;

  try {
    switch (feature) {
      case 'me': {
        const meData = data as Record<string, string>;
        if (meData.me && typeof meData.me === 'string') {
          try {
            const parsed = JSON.parse(meData.me);
            if (parsed.name) callbacks.onPlayerNameDetected(parsed.name);
          } catch {
            // me data might be a plain name string
            if (meData.me) callbacks.onPlayerNameDetected(meData.me);
          }
        }
        break;
      }
      case 'match_info': {
        const matchData = data as Record<string, unknown>;
        if (matchData.pseudo_match_id) {
          // Match started
        }
        if (matchData.tabs) {
          const tabs = typeof matchData.tabs === 'string' ? JSON.parse(matchData.tabs) : matchData.tabs;
          if (tabs.kills !== undefined) callbacks.onKill(Number(tabs.kills));
          if (tabs.assists !== undefined) callbacks.onAssist(Number(tabs.assists));
          if (tabs.damage !== undefined) callbacks.onDamage(Number(tabs.damage));
          if (tabs.knockdowns !== undefined) callbacks.onKnockdown(Number(tabs.knockdowns));
        }
        break;
      }
      case 'game_info': {
        const gameData = data as Record<string, unknown>;
        if (gameData.game_mode) callbacks.onGameModeDetected(String(gameData.game_mode));
        if (gameData.map) callbacks.onMapDetected(String(gameData.map));
        if (gameData.legend) callbacks.onLegendDetected(normalizeLegendName(String(gameData.legend)));
        break;
      }
      case 'team': {
        const teamData = data as Record<string, unknown>;
        const members: GepTeamMember[] = [];
        for (const [key, val] of Object.entries(teamData)) {
          if (key.startsWith('teammate')) {
            const tm = typeof val === 'string' ? JSON.parse(val) : val;
            members.push({
              name: tm.name ?? '',
              legend: normalizeLegendName(tm.legend ?? ''),
              platform: tm.platform ?? 'PC',
              state: tm.state ?? 'alive',
            });
          }
        }
        if (members.length > 0) callbacks.onTeamUpdate(members);
        break;
      }
      case 'inventory': {
        const invData = data as Record<string, unknown>;
        const items: string[] = [];
        for (const [key, val] of Object.entries(invData)) {
          if (key.startsWith('inventory_')) {
            const item = typeof val === 'string' ? JSON.parse(val) : val;
            if (item.name) items.push(normalizeWeaponName(item.name));
          }
        }
        if (items.length > 0) callbacks.onInventoryUpdate(items);
        break;
      }
      case 'location': {
        const locData = data as Record<string, string>;
        if (locData.location) {
          const loc = JSON.parse(locData.location);
          callbacks.onLocationUpdate(Number(loc.x), Number(loc.y), Number(loc.z));
        }
        break;
      }
      case 'roster': {
        const rosterData = data as Record<string, unknown>;
        const players: GepRosterPlayer[] = [];
        for (const [key, val] of Object.entries(rosterData)) {
          if (key.startsWith('roster_')) {
            const p = typeof val === 'string' ? JSON.parse(val) : val;
            players.push({
              name: p.name ?? '',
              teamId: Number(p.team_id ?? 0),
              platform: p.platform ?? 'PC',
              isTeammate: Boolean(p.is_teammate),
            });
          }
        }
        if (players.length > 0) callbacks.onRosterUpdate(players);
        break;
      }
    }
  } catch (error) {
    console.error('[GEP] Error handling info update:', feature, error);
  }
}

function handleNewEvents(events: overwolf.games.events.NewGameEvents): void {
  if (!callbacks) return;

  for (const event of events.events) {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

      switch (event.name) {
        case 'match_state': {
          const state: MatchState = data === 'active' || data.state === 'active' ? 'active' : 'inactive';
          callbacks.onMatchStateChange(state);
          break;
        }
        case 'kill_feed': {
          callbacks.onKillFeed({
            attackerName: data.attackerName ?? data.attacker ?? '',
            victimName: data.victimName ?? data.victim ?? '',
            weaponName: normalizeWeaponName(data.weaponName ?? data.weapon ?? ''),
            action: data.action ?? 'kill',
          });
          break;
        }
        case 'kill': {
          callbacks.onKill(Number(data.totalKills ?? data.count ?? data));
          break;
        }
        case 'death': {
          callbacks.onDeath();
          break;
        }
        case 'revive': {
          callbacks.onRevive();
          break;
        }
        case 'damage': {
          callbacks.onDamage(Number(data.totalDamage ?? data.damage ?? data));
          break;
        }
        case 'match_summary': {
          callbacks.onMatchSummary({
            rank: Number(data.rank ?? data.placement ?? 0),
            teams: Number(data.teams ?? data.totalTeams ?? 0),
            squadKills: Number(data.squadKills ?? data.squad_kills ?? 0),
          });
          break;
        }
        case 'rank': {
          // Win detection: rank event with victory=true
          break;
        }
      }
    } catch (error) {
      console.error('[GEP] Error handling event:', event.name, error);
    }
  }
}

export function cleanup(): void {
  overwolf.games.events.onInfoUpdates2.removeListener(handleInfoUpdate);
  overwolf.games.events.onNewEvents.removeListener(handleNewEvents);
  callbacks = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/background/gep-manager.ts
git commit -m "feat: GEP manager with full event parsing and routing"
```

---

## Task 6: Match Tracker (State Machine)

**Files:**
- Create: `src/background/match-tracker.ts`

**Depends on:** Task 1 (types, utils), Task 2 (database), Task 5 (GEP)

- [ ] **Step 1: Create src/background/match-tracker.ts**

```typescript
import { MatchRecord, LiveMatchData, TrackerState, GepKillFeedEvent, GepMatchSummary, GepTeamMember, MatchState, WeaponKillRecord } from '../shared/types';
import { generateId, nowMs, parseGameMode } from '../shared/utils';
import { insertMatch } from './database';
import { broadcastLiveUpdate, broadcastMatchEnded } from './messaging';

let live: LiveMatchData = createEmptyLiveData();
let playerName: string = '';

type MatchEndCallback = (match: MatchRecord) => void;
let onMatchEndCallback: MatchEndCallback | null = null;

export function setPlayerName(name: string): void {
  playerName = name;
}

export function getPlayerName(): string {
  return playerName;
}

export function onMatchEnd(callback: MatchEndCallback): void {
  onMatchEndCallback = callback;
}

export function getLiveData(): LiveMatchData {
  return { ...live };
}

function createEmptyLiveData(): LiveMatchData {
  return {
    state: 'idle',
    matchStartTime: null,
    gameMode: null,
    mapName: null,
    legend: null,
    kills: 0,
    assists: 0,
    knockdowns: 0,
    damage: 0,
    squadKills: 0,
    teamsLeft: 0,
    teammates: [],
    weaponKills: {},
    weaponKnockdowns: {},
    inventory: [],
    placement: null,
    rpEstimate: null,
  };
}

function transitionTo(newState: TrackerState): void {
  const old = live.state;
  live.state = newState;
  console.log(`[MatchTracker] ${old} → ${newState}`);
}

export function handleMatchStateChange(state: MatchState): void {
  if (state === 'active' && live.state === 'idle') {
    // Match starting
    live = createEmptyLiveData();
    live.matchStartTime = nowMs();
    transitionTo('in_match');
    broadcastLiveUpdate(live);
  } else if (state === 'inactive' && live.state === 'in_match') {
    // Match ending
    transitionTo('post_match');
    finalizeMatch();
  }
}

export function handleKillFeed(event: GepKillFeedEvent): void {
  if (live.state !== 'in_match') return;

  const isPlayerKill = event.attackerName === playerName;
  const isPlayerTeamKill = live.teammates.some(t => t.name === event.attackerName) || isPlayerKill;

  if (isPlayerKill) {
    if (event.action === 'kill' || event.action === 'knockdown') {
      const weapon = event.weaponName;
      if (event.action === 'kill') {
        live.weaponKills[weapon] = (live.weaponKills[weapon] ?? 0) + 1;
      } else {
        live.weaponKnockdowns[weapon] = (live.weaponKnockdowns[weapon] ?? 0) + 1;
      }
    }
  }

  if (isPlayerTeamKill && event.action === 'kill') {
    live.squadKills++;
  }

  broadcastLiveUpdate(live);
}

export function handleKill(totalKills: number): void {
  if (live.state !== 'in_match') return;
  live.kills = totalKills;
  broadcastLiveUpdate(live);
}

export function handleAssist(totalAssists: number): void {
  if (live.state !== 'in_match') return;
  live.assists = totalAssists;
  broadcastLiveUpdate(live);
}

export function handleDamage(totalDamage: number): void {
  if (live.state !== 'in_match') return;
  live.damage = totalDamage;
  broadcastLiveUpdate(live);
}

export function handleKnockdown(totalKnockdowns: number): void {
  if (live.state !== 'in_match') return;
  live.knockdowns = totalKnockdowns;
  broadcastLiveUpdate(live);
}

export function handleDeath(): void {
  if (live.state !== 'in_match') return;
  broadcastLiveUpdate(live);
}

export function handleRevive(): void {
  if (live.state !== 'in_match') return;
  live.revivesGiven = (live as LiveMatchData & { revivesGiven?: number }).revivesGiven ?? 0;
  broadcastLiveUpdate(live);
}

export function handleTeamUpdate(team: GepTeamMember[]): void {
  live.teammates = team;
  if (live.state === 'idle' || live.state === 'lobby') {
    transitionTo('legend_select');
  }
  broadcastLiveUpdate(live);
}

export function handleInventoryUpdate(items: string[]): void {
  live.inventory = items;
  broadcastLiveUpdate(live);
}

export function handleMatchSummary(summary: GepMatchSummary): void {
  live.placement = summary.rank;
  live.squadKills = summary.squadKills;
  live.teamsLeft = 0;

  if (live.state === 'in_match') {
    transitionTo('post_match');
    finalizeMatch();
  }
}

export function handleGameModeDetected(mode: string): void {
  live.gameMode = parseGameMode(mode);
}

export function handleMapDetected(map: string): void {
  live.mapName = map;
}

export function handleLegendDetected(legend: string): void {
  live.legend = legend;
}

export function handleTeamsLeft(teams: number): void {
  live.teamsLeft = teams;
  broadcastLiveUpdate(live);
}

function finalizeMatch(): void {
  const duration = live.matchStartTime ? Math.round((nowMs() - live.matchStartTime) / 1000) : 0;

  const weaponKills: WeaponKillRecord[] = Object.entries(live.weaponKills).map(([weaponName, kills]) => ({
    weaponName,
    kills,
    knockdowns: live.weaponKnockdowns[weaponName] ?? 0,
  }));

  const weaponKnockdowns: WeaponKillRecord[] = Object.entries(live.weaponKnockdowns)
    .filter(([name]) => !live.weaponKills[name])
    .map(([weaponName, knockdowns]) => ({ weaponName, kills: 0, knockdowns }));

  const record: MatchRecord = {
    matchId: generateId(),
    timestamp: nowMs(),
    duration,
    gameMode: live.gameMode ?? 'battle_royale',
    mapName: live.mapName ?? 'Unknown',
    placement: live.placement ?? 0,
    totalTeams: live.teamsLeft,
    kills: live.kills,
    assists: live.assists,
    knockdowns: live.knockdowns,
    damage: live.damage,
    revivesGiven: 0,
    respawnsGiven: 0,
    survivalTime: duration,
    legend: live.legend ?? 'Unknown',
    teammates: live.teammates.map(t => ({
      name: t.name,
      legend: t.legend,
      platform: t.platform,
      kills: 0,
      damage: 0,
      survived: t.state === 'alive',
    })),
    weaponKills,
    weaponKnockdowns,
    loadoutFinal: [...live.inventory],
    isWin: live.placement === 1,
    squadKills: live.squadKills,
  };

  try {
    insertMatch(record);
    console.log('[MatchTracker] Match saved:', record.matchId);
  } catch (error) {
    console.error('[MatchTracker] Failed to save match:', error);
  }

  broadcastMatchEnded(record);

  if (onMatchEndCallback) {
    onMatchEndCallback(record);
  }

  // Reset for next match
  setTimeout(() => {
    live = createEmptyLiveData();
    transitionTo('idle');
  }, 5000);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/background/match-tracker.ts
git commit -m "feat: match tracker state machine with weapon kill attribution"
```

---

## Task 7: Session Manager

**Files:**
- Create: `src/background/session-manager.ts`

**Depends on:** Task 1 (types, utils, constants), Task 2 (database)

- [ ] **Step 1: Create src/background/session-manager.ts**

```typescript
import { SessionData, MatchRecord } from '../shared/types';
import { SESSION_TIMEOUT_MS } from '../shared/constants';
import { generateId, nowMs } from '../shared/utils';
import { upsertSession, getLatestSession } from './database';
import { broadcastSession } from './messaging';

let currentSession: SessionData | null = null;
let sessionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

export function initSessionManager(): void {
  const latest = getLatestSession();
  if (latest && latest.endTime === null) {
    const elapsed = nowMs() - latest.startTime;
    if (elapsed < SESSION_TIMEOUT_MS) {
      currentSession = latest;
      resetTimeout();
      return;
    }
    // Close stale session
    latest.endTime = latest.startTime + SESSION_TIMEOUT_MS;
    upsertSession(latest);
  }
}

export function getCurrentSession(): SessionData | null {
  return currentSession ? { ...currentSession } : null;
}

export function onMatchPlayed(match: MatchRecord): void {
  if (!currentSession || isSessionExpired()) {
    startNewSession();
  }

  currentSession!.matchesPlayed++;
  currentSession!.totalKills += match.kills;
  currentSession!.totalDamage += match.damage;
  currentSession!.totalRpChange += match.rpChange ?? 0;

  upsertSession(currentSession!);
  broadcastSession(currentSession!);
  resetTimeout();
}

function isSessionExpired(): boolean {
  if (!currentSession) return true;
  return nowMs() - (currentSession.endTime ?? currentSession.startTime) > SESSION_TIMEOUT_MS;
}

function startNewSession(): void {
  if (currentSession) {
    currentSession.endTime = nowMs();
    upsertSession(currentSession);
  }

  currentSession = {
    id: generateId(),
    startTime: nowMs(),
    endTime: null,
    matchesPlayed: 0,
    totalKills: 0,
    totalDamage: 0,
    totalRpChange: 0,
  };

  upsertSession(currentSession);
  broadcastSession(currentSession);
}

function resetTimeout(): void {
  if (sessionTimeoutTimer) clearTimeout(sessionTimeoutTimer);
  sessionTimeoutTimer = setTimeout(() => {
    if (currentSession) {
      currentSession.endTime = nowMs();
      upsertSession(currentSession);
      broadcastSession(currentSession);
      currentSession = null;
    }
  }, SESSION_TIMEOUT_MS);
}

export function endCurrentSession(): void {
  if (currentSession) {
    currentSession.endTime = nowMs();
    upsertSession(currentSession);
    broadcastSession(currentSession);
    currentSession = null;
  }
  if (sessionTimeoutTimer) clearTimeout(sessionTimeoutTimer);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/background/session-manager.ts
git commit -m "feat: session manager with 30-minute timeout detection"
```

---

## Task 8: Auth System

**Files:**
- Create: `src/background/auth/auth-manager.ts`
- Create: `src/background/auth/steam-auth.ts`
- Create: `src/background/auth/discord-auth.ts`
- Create: `src/background/auth/origin-resolver.ts`

**Depends on:** Task 1 (types, constants), Task 2 (database), Task 3 (API client)

- [ ] **Step 1: Create src/background/auth/origin-resolver.ts**

```typescript
import { nameToUid } from '../api-client';
import { upsertUserAccount, getUserAccount } from '../database';
import { broadcastOriginDetected } from '../messaging';

export async function resolveOriginName(name: string, method: 'gep_auto' | 'manual' | 'discord_chain'): Promise<boolean> {
  const result = await nameToUid(name);
  if (!result || !result.uid) {
    console.warn('[OriginResolver] Could not resolve name:', name);
    return false;
  }

  upsertUserAccount({
    origin_name: result.name,
    origin_uid: result.uid,
    origin_verified: 1,
    origin_detection_method: method,
  });

  broadcastOriginDetected(result.name, result.uid);
  console.log(`[OriginResolver] Linked EA account: ${result.name} (${result.uid}) via ${method}`);
  return true;
}

export async function handleGepPlayerNameDetected(detectedName: string): Promise<void> {
  const account = getUserAccount();

  if (!account || !account.originName) {
    // First time detection
    await resolveOriginName(detectedName, 'gep_auto');
  } else if (account.originName !== detectedName) {
    // Name changed
    console.log(`[OriginResolver] EA name changed: ${account.originName} → ${detectedName}`);
    await resolveOriginName(detectedName, 'gep_auto');
  }
}

export function getOriginName(): string | null {
  const account = getUserAccount();
  return account?.originName ?? null;
}

export function getOriginUid(): string | null {
  const account = getUserAccount();
  return account?.originUid ?? null;
}
```

- [ ] **Step 2: Create src/background/auth/steam-auth.ts**

```typescript
import { AUTH_CALLBACK_BASE } from '../../shared/constants';
import { upsertUserAccount } from '../database';
import { broadcastAuthChange } from '../messaging';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

interface SteamAuthResult {
  steamId: string;
  success: boolean;
}

export function getSteamOpenIdUrl(): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${AUTH_CALLBACK_BASE}/auth/steam/callback`,
    'openid.realm': AUTH_CALLBACK_BASE,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

export function parseSteamCallback(url: string): SteamAuthResult {
  try {
    const params = new URL(url).searchParams;
    const claimedId = params.get('openid.claimed_id') ?? '';
    // Format: https://steamcommunity.com/openid/id/{steamid64}
    const match = claimedId.match(/\/id\/(\d+)$/);
    if (match) {
      return { steamId: match[1], success: true };
    }
  } catch {
    // Parse failed
  }
  return { steamId: '', success: false };
}

export async function fetchSteamProfile(steamId: string, steamApiKey: string): Promise<{ name: string; avatar: string } | null> {
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamId}`;
    const response = await fetch(url);
    const data = await response.json();
    const player = data?.response?.players?.[0];
    if (player) {
      return {
        name: player.personaname,
        avatar: player.avatarfull || player.avatar,
      };
    }
  } catch (error) {
    console.error('[SteamAuth] Failed to fetch profile:', error);
  }
  return null;
}

export async function completeSteamLogin(callbackUrl: string, steamApiKey: string): Promise<boolean> {
  const result = parseSteamCallback(callbackUrl);
  if (!result.success) return false;

  const profile = await fetchSteamProfile(result.steamId, steamApiKey);

  upsertUserAccount({
    login_provider: 'steam',
    login_id: result.steamId,
    login_name: profile?.name ?? null,
    login_avatar: profile?.avatar ?? null,
    steam_id: result.steamId,
    steam_name: profile?.name ?? null,
    steam_avatar: profile?.avatar ?? null,
  });

  broadcastAuthChange({
    provider: 'steam',
    steamId: result.steamId,
    name: profile?.name,
    avatar: profile?.avatar,
  });

  return true;
}

export function initiateSteamLogin(): void {
  const url = getSteamOpenIdUrl();
  overwolf.utils.openUrlInDefaultBrowser(url);
}
```

- [ ] **Step 3: Create src/background/auth/discord-auth.ts**

```typescript
import { DISCORD_AUTH_URL, DISCORD_TOKEN_URL, DISCORD_API_BASE, AUTH_CALLBACK_BASE } from '../../shared/constants';
import { upsertUserAccount } from '../database';
import { broadcastAuthChange } from '../messaging';

let discordClientId = '';

export function setDiscordClientId(id: string): void {
  discordClientId = id;
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

let codeVerifier = '';

export async function getDiscordAuthUrl(): Promise<string> {
  if (!discordClientId) throw new Error('Discord client ID not set');

  codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: discordClientId,
    response_type: 'code',
    redirect_uri: `${AUTH_CALLBACK_BASE}/auth/discord/callback`,
    scope: 'identify connections',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${DISCORD_AUTH_URL}?${params.toString()}`;
}

export async function exchangeDiscordCode(code: string): Promise<boolean> {
  if (!discordClientId) return false;

  try {
    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: discordClientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${AUTH_CALLBACK_BASE}/auth/discord/callback`,
        code_verifier: codeVerifier,
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return false;

    // Fetch user profile
    const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userResponse.json();

    // Fetch connections to find Steam/EA links
    const connectionsResponse = await fetch(`${DISCORD_API_BASE}/users/@me/connections`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const connections = await connectionsResponse.json();

    const steamConnection = Array.isArray(connections)
      ? connections.find((c: { type: string }) => c.type === 'steam')
      : null;

    upsertUserAccount({
      login_provider: 'discord',
      login_id: user.id,
      login_name: user.username,
      login_avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      login_token: tokens.access_token,
      login_token_expires: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      discord_id: user.id,
      discord_name: user.username,
      discord_avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      ...(steamConnection ? { steam_id: steamConnection.id, steam_name: steamConnection.name } : {}),
    });

    broadcastAuthChange({
      provider: 'discord',
      discordId: user.id,
      name: user.username,
      steamId: steamConnection?.id,
    });

    return true;
  } catch (error) {
    console.error('[DiscordAuth] Failed to exchange code:', error);
    return false;
  }
}

export function initiateDiscordLogin(): void {
  getDiscordAuthUrl().then(url => {
    overwolf.utils.openUrlInDefaultBrowser(url);
  });
}
```

- [ ] **Step 4: Create src/background/auth/auth-manager.ts**

```typescript
import { getUserAccount } from '../database';
import { UserAccount } from '../../shared/types';
import { broadcastAuthChange } from '../messaging';
import { initiateSteamLogin, completeSteamLogin } from './steam-auth';
import { initiateDiscordLogin, exchangeDiscordCode, setDiscordClientId } from './discord-auth';
import { resolveOriginName, handleGepPlayerNameDetected, getOriginName } from './origin-resolver';

interface AuthConfig {
  steamApiKey?: string;
  discordClientId?: string;
}

let config: AuthConfig = {};

export function initAuth(authConfig: AuthConfig): void {
  config = authConfig;
  if (authConfig.discordClientId) {
    setDiscordClientId(authConfig.discordClientId);
  }
}

export function getAuthState(): UserAccount | null {
  return getUserAccount();
}

export function isOriginLinked(): boolean {
  const account = getUserAccount();
  return Boolean(account?.originVerified);
}

export function loginSteam(): void {
  initiateSteamLogin();
}

export function loginDiscord(): void {
  initiateDiscordLogin();
}

export async function handleSteamCallback(callbackUrl: string): Promise<boolean> {
  return completeSteamLogin(callbackUrl, config.steamApiKey ?? '');
}

export async function handleDiscordCallback(code: string): Promise<boolean> {
  return exchangeDiscordCode(code);
}

export async function linkOriginManual(name: string): Promise<boolean> {
  return resolveOriginName(name, 'manual');
}

export async function handlePlayerDetected(name: string): Promise<void> {
  await handleGepPlayerNameDetected(name);
}

export function broadcastCurrentAuthState(): void {
  const account = getUserAccount();
  broadcastAuthChange(account);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/background/auth/
git commit -m "feat: auth system — Steam OpenID, Discord OAuth2+PKCE, EA/Origin resolver"
```

---

## Task 9: Zustand Stores

**Files:**
- Create: `src/stores/authStore.ts`
- Create: `src/stores/matchStore.ts`
- Create: `src/stores/liveStore.ts`
- Create: `src/stores/settingsStore.ts`

**Depends on:** Task 1 (types, constants), Task 4 (messaging)

- [ ] **Step 1: Create src/stores/liveStore.ts**

```typescript
import { create } from 'zustand';
import { LiveMatchData, TrackerState, WindowMessage } from '../shared/types';
import { onMessage, setupRendererListener } from '../background/messaging';

interface LiveState {
  matchState: TrackerState;
  kills: number;
  assists: number;
  knockdowns: number;
  damage: number;
  squadKills: number;
  teamsLeft: number;
  legend: string | null;
  mapName: string | null;
  gameMode: string | null;
  teammates: LiveMatchData['teammates'];
  weaponKills: Record<string, number>;
  inventory: string[];
  placement: number | null;
  isLive: boolean;
  init: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  matchState: 'idle',
  kills: 0,
  assists: 0,
  knockdowns: 0,
  damage: 0,
  squadKills: 0,
  teamsLeft: 0,
  legend: null,
  mapName: null,
  gameMode: null,
  teammates: [],
  weaponKills: {},
  inventory: [],
  placement: null,
  isLive: false,

  init: () => {
    setupRendererListener();
    onMessage('LIVE_MATCH_UPDATE', (msg: WindowMessage) => {
      const data = msg.payload as LiveMatchData;
      set({
        matchState: data.state,
        kills: data.kills,
        assists: data.assists,
        knockdowns: data.knockdowns,
        damage: data.damage,
        squadKills: data.squadKills,
        teamsLeft: data.teamsLeft,
        legend: data.legend,
        mapName: data.mapName,
        gameMode: data.gameMode,
        teammates: data.teammates,
        weaponKills: data.weaponKills,
        inventory: data.inventory,
        placement: data.placement,
        isLive: data.state === 'in_match',
      });
    });

    onMessage('MATCH_ENDED', () => {
      set({ isLive: false, matchState: 'idle' });
    });
  },
}));
```

- [ ] **Step 2: Create src/stores/matchStore.ts**

```typescript
import { create } from 'zustand';
import { MatchRecord, WindowMessage } from '../shared/types';
import { onMessage } from '../background/messaging';

interface MatchState {
  recentMatches: MatchRecord[];
  totalMatches: number;
  totalKills: number;
  totalDamage: number;
  totalWins: number;
  avgDamage: number;
  kdRatio: number;
  winRate: number;
  weaponStats: Array<{ weaponName: string; totalKills: number; totalKnockdowns: number; matchesUsed: number }>;
  legendStats: Array<{ legend: string; matches: number; kills: number; damage: number; wins: number; avgDamage: number; kdRatio: number }>;
  init: () => void;
  addMatch: (match: MatchRecord) => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  recentMatches: [],
  totalMatches: 0,
  totalKills: 0,
  totalDamage: 0,
  totalWins: 0,
  avgDamage: 0,
  kdRatio: 0,
  winRate: 0,
  weaponStats: [],
  legendStats: [],

  init: () => {
    onMessage('MATCH_HISTORY_UPDATE', (msg: WindowMessage) => {
      const data = msg.payload as {
        recentMatches: MatchRecord[];
        stats: { totalMatches: number; totalKills: number; totalDamage: number; totalWins: number; avgDamage: number; kdRatio: number; winRate: number };
        weaponStats: MatchState['weaponStats'];
        legendStats: MatchState['legendStats'];
      };
      set({
        recentMatches: data.recentMatches,
        totalMatches: data.stats.totalMatches,
        totalKills: data.stats.totalKills,
        totalDamage: data.stats.totalDamage,
        totalWins: data.stats.totalWins,
        avgDamage: data.stats.avgDamage,
        kdRatio: data.stats.kdRatio,
        winRate: data.stats.winRate,
        weaponStats: data.weaponStats,
        legendStats: data.legendStats,
      });
    });

    onMessage('MATCH_ENDED', (msg: WindowMessage) => {
      const match = msg.payload as MatchRecord;
      set(state => ({
        recentMatches: [match, ...state.recentMatches].slice(0, 50),
        totalMatches: state.totalMatches + 1,
        totalKills: state.totalKills + match.kills,
        totalDamage: state.totalDamage + match.damage,
        totalWins: state.totalWins + (match.isWin ? 1 : 0),
      }));
    });
  },

  addMatch: (match: MatchRecord) => {
    set(state => ({
      recentMatches: [match, ...state.recentMatches].slice(0, 50),
    }));
  },
}));
```

- [ ] **Step 3: Create src/stores/authStore.ts**

```typescript
import { create } from 'zustand';
import { UserAccount, WindowMessage } from '../shared/types';
import { onMessage } from '../background/messaging';

interface AuthState {
  user: UserAccount | null;
  isOriginLinked: boolean;
  isLoggedIn: boolean;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isOriginLinked: false,
  isLoggedIn: false,

  init: () => {
    onMessage('AUTH_STATE_CHANGE', (msg: WindowMessage) => {
      const account = msg.payload as UserAccount | null;
      set({
        user: account,
        isOriginLinked: Boolean(account?.originVerified),
        isLoggedIn: Boolean(account?.loginProvider),
      });
    });

    onMessage('ORIGIN_DETECTED', (msg: WindowMessage) => {
      const data = msg.payload as { name: string; uid: string };
      set(state => ({
        user: state.user ? { ...state.user, originName: data.name, originUid: data.uid, originVerified: true } : null,
        isOriginLinked: true,
      }));
    });
  },
}));
```

- [ ] **Step 4: Create src/stores/settingsStore.ts**

```typescript
import { create } from 'zustand';
import { AppSettings, WindowMessage } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { onMessage } from '../background/messaging';

interface SettingsState extends AppSettings {
  init: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,

  init: () => {
    // Load from localStorage as fallback (settings are lightweight)
    const saved = localStorage.getItem('apexpulse_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppSettings>;
        set(parsed);
      } catch {
        // Ignore corrupt settings
      }
    }

    onMessage('SETTINGS_UPDATE', (msg: WindowMessage) => {
      const settings = msg.payload as Partial<AppSettings>;
      set(settings);
    });
  },

  updateSettings: (partial: Partial<AppSettings>) => {
    set(state => {
      const updated = { ...state, ...partial };
      localStorage.setItem('apexpulse_settings', JSON.stringify({
        apiKey: updated.apiKey,
        overlayEnabled: updated.overlayEnabled,
        overlayPosition: updated.overlayPosition,
        overlayOpacity: updated.overlayOpacity,
        overlayHotkey: updated.overlayHotkey,
        autoDetectOrigin: updated.autoDetectOrigin,
        pollIntervalMs: updated.pollIntervalMs,
        sessionTimeoutMs: updated.sessionTimeoutMs,
      }));
      return partial;
    });

    // Notify background
    const bgWindow = overwolf.windows.getMainWindow();
    if (bgWindow && (bgWindow as unknown as { onSettingsChange?: (s: Partial<AppSettings>) => void }).onSettingsChange) {
      (bgWindow as unknown as { onSettingsChange: (s: Partial<AppSettings>) => void }).onSettingsChange(partial);
    }
  },
}));
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/
git commit -m "feat: Zustand stores — auth, match, live, settings"
```

---

## Task 10: Wire Background Controller

**Files:**
- Modify: `src/background/background.ts` (complete rewrite)

**Depends on:** All previous tasks

- [ ] **Step 1: Rewrite src/background/background.ts**

```typescript
import { initDatabase, saveDatabase, closeDatabase, getRecentMatches, getOverallStats, getWeaponStats, getLegendStats } from './database';
import { initGep, registerCallbacks, cleanup as cleanupGep } from './gep-manager';
import { setPlayerName, handleMatchStateChange, handleKillFeed, handleKill, handleAssist, handleDamage, handleKnockdown, handleDeath, handleRevive, handleTeamUpdate, handleInventoryUpdate, handleMatchSummary, handleGameModeDetected, handleMapDetected, handleLegendDetected, onMatchEnd, getLiveData } from './match-tracker';
import { initSessionManager, onMatchPlayed, endCurrentSession, getCurrentSession } from './session-manager';
import { setApiKey, getPlayerStats, getMapRotation } from './api-client';
import { setupMessageListener, broadcastMatchHistory, broadcastProfile, broadcastMapRotation, broadcastSession, onMessage } from './messaging';
import { initAuth, handlePlayerDetected, broadcastCurrentAuthState, isOriginLinked, getAuthState, loginSteam, loginDiscord, linkOriginManual, handleSteamCallback, handleDiscordCallback } from './auth/auth-manager';
import { getOriginName } from './auth/origin-resolver';
import { API_POLL_INTERVAL_MS } from '../shared/constants';
import { AppSettings, WindowMessage } from '../shared/types';

let pollTimer: ReturnType<typeof setInterval> | null = null;

class BackgroundController {
  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    console.log('[ApexPulse] Initializing...');

    // 1. Database
    await initDatabase();
    console.log('[ApexPulse] Database ready');

    // 2. Load settings
    const settings = this.loadSettings();
    if (settings.apiKey) setApiKey(settings.apiKey);

    // 3. Auth
    initAuth({
      steamApiKey: settings.steamApiKey ?? '',
      discordClientId: settings.discordClientId ?? '',
    });

    // 4. Session manager
    initSessionManager();

    // 5. Window messaging
    setupMessageListener();
    this.setupBackgroundMessageHandlers();

    // 6. GEP
    registerCallbacks({
      onMatchStateChange: handleMatchStateChange,
      onKillFeed: handleKillFeed,
      onKill: handleKill,
      onAssist: handleAssist,
      onDamage: handleDamage,
      onKnockdown: handleKnockdown,
      onDeath: handleDeath,
      onRevive: handleRevive,
      onTeamUpdate: handleTeamUpdate,
      onInventoryUpdate: handleInventoryUpdate,
      onLocationUpdate: () => {},
      onMatchSummary: handleMatchSummary,
      onRosterUpdate: () => {},
      onPlayerNameDetected: async (name: string) => {
        setPlayerName(name);
        await handlePlayerDetected(name);
      },
      onGameModeDetected: handleGameModeDetected,
      onMapDetected: handleMapDetected,
      onLegendDetected: handleLegendDetected,
    });
    initGep();

    // 7. Match end → session tracking + refresh history
    onMatchEnd((match) => {
      onMatchPlayed(match);
      this.broadcastFullState();
    });

    // 8. Start API polling
    this.startPolling(settings.apiKey ? API_POLL_INTERVAL_MS : 0);

    // 9. Open dashboard
    this.openDashboard();

    console.log('[ApexPulse] Initialization complete');
  }

  private loadSettings(): AppSettings & { steamApiKey?: string; discordClientId?: string } {
    try {
      const raw = localStorage.getItem('apexpulse_settings');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      apiKey: '',
      overlayEnabled: true,
      overlayPosition: { top: 10, left: 10 },
      overlayOpacity: 0.8,
      overlayHotkey: 'Shift+F1',
      autoDetectOrigin: true,
      pollIntervalMs: API_POLL_INTERVAL_MS,
      sessionTimeoutMs: 30 * 60 * 1000,
    };
  }

  private setupBackgroundMessageHandlers(): void {
    onMessage('REQUEST_STATE', () => {
      this.broadcastFullState();
    });
  }

  broadcastFullState(): void {
    // Match history + stats
    broadcastMatchHistory({
      recentMatches: getRecentMatches(50),
      stats: getOverallStats(),
      weaponStats: getWeaponStats(),
      legendStats: getLegendStats(),
    });

    // Session
    const session = getCurrentSession();
    if (session) broadcastSession(session);

    // Auth
    broadcastCurrentAuthState();
  }

  private startPolling(intervalMs: number): void {
    if (!intervalMs) return;
    if (pollTimer) clearInterval(pollTimer);

    const poll = async () => {
      const originName = getOriginName();
      if (!originName) return;

      // Player stats
      const stats = await getPlayerStats(originName);
      if (stats) broadcastProfile(stats);

      // Map rotation
      const maps = await getMapRotation();
      if (maps) broadcastMapRotation(maps);
    };

    poll(); // Initial poll
    pollTimer = setInterval(poll, intervalMs);
  }

  private openDashboard(): void {
    overwolf.windows.obtainDeclaredWindow('dashboard', (result) => {
      if (result.success) {
        overwolf.windows.restore(result.window.id, () => {});
      }
    });
  }

  // Exposed for settings store to call via getMainWindow()
  onSettingsChange(settings: Partial<AppSettings>): void {
    if (settings.apiKey !== undefined) {
      setApiKey(settings.apiKey);
      this.startPolling(settings.pollIntervalMs ?? API_POLL_INTERVAL_MS);
    }
    localStorage.setItem('apexpulse_settings', JSON.stringify({
      ...this.loadSettings(),
      ...settings,
    }));
  }
}

// Expose controller on the background window for cross-window access
const controller = new BackgroundController();
(window as unknown as {
  apexpulse: BackgroundController;
  loginSteam: typeof loginSteam;
  loginDiscord: typeof loginDiscord;
  linkOriginManual: typeof linkOriginManual;
  handleSteamCallback: typeof handleSteamCallback;
  handleDiscordCallback: typeof handleDiscordCallback;
  onSettingsChange: (s: Partial<AppSettings>) => void;
  requestState: () => void;
}).apexpulse = controller;
(window as unknown as Record<string, unknown>).loginSteam = loginSteam;
(window as unknown as Record<string, unknown>).loginDiscord = loginDiscord;
(window as unknown as Record<string, unknown>).linkOriginManual = linkOriginManual;
(window as unknown as Record<string, unknown>).handleSteamCallback = handleSteamCallback;
(window as unknown as Record<string, unknown>).handleDiscordCallback = handleDiscordCallback;
(window as unknown as Record<string, unknown>).onSettingsChange = (s: Partial<AppSettings>) => controller.onSettingsChange(s);
(window as unknown as Record<string, unknown>).requestState = () => controller.broadcastFullState();

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  endCurrentSession();
  cleanupGep();
  closeDatabase();
});
```

- [ ] **Step 2: Commit**

```bash
git add src/background/background.ts
git commit -m "feat: wire background controller — GEP, DB, API, auth, messaging all connected"
```

---

## Task 11: Connect Frontend to Real Data

**Files:**
- Modify: `src/dashboard/App.tsx`
- Modify: `src/overlay/App.tsx`
- Modify: `src/dashboard/index.tsx`
- Modify: `src/overlay/index.tsx`

**Depends on:** All previous tasks

- [ ] **Step 1: Update src/dashboard/index.tsx to initialize stores**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../index.css';
import { useMatchStore } from '../stores/matchStore';
import { useAuthStore } from '../stores/authStore';
import { useLiveStore } from '../stores/liveStore';
import { useSettingsStore } from '../stores/settingsStore';

// Initialize all stores (register message listeners)
useMatchStore.getState().init();
useAuthStore.getState().init();
useLiveStore.getState().init();
useSettingsStore.getState().init();

// Request initial state from background
setTimeout(() => {
  try {
    const bgWindow = overwolf.windows.getMainWindow();
    if (bgWindow && (bgWindow as unknown as { requestState?: () => void }).requestState) {
      (bgWindow as unknown as { requestState: () => void }).requestState();
    }
  } catch {}
}, 500);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Update src/dashboard/App.tsx to use stores**

Replace the entire component with store-connected version:

```tsx
import React from 'react';
import { useMatchStore } from '../stores/matchStore';
import { useLiveStore } from '../stores/liveStore';
import { WEAPON_MAP } from '../shared/weapon-map';
import { LEGENDS } from '../shared/legend-map';

const App: React.FC = () => {
  const { recentMatches, totalKills, kdRatio, avgDamage, winRate, totalMatches } = useMatchStore();
  const { isLive, kills: liveKills, damage: liveDamage, legend: liveLegend } = useLiveStore();

  return (
    <div className="flex h-screen bg-apex-dark text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-apex-navy border-r border-white border-opacity-10 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-apex-cyan tracking-tighter">APEX PULSE</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {['Home', 'Stats', 'Weapons', 'Legends', 'History', 'Maps', 'Settings'].map((item) => (
            <a
              key={item}
              href="#"
              className={`block px-4 py-2 rounded-lg transition-colors ${
                item === 'Home' ? 'bg-apex-cyan bg-opacity-10 text-apex-cyan' : 'hover:bg-white hover:bg-opacity-5'
              }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-gray-400">
              {totalMatches > 0 ? `${totalMatches} matches tracked` : 'Welcome back, Legend.'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-apex-navy px-4 py-2 rounded-lg border border-white border-opacity-10">
              <span className="text-gray-400 text-sm">Status:</span>
              <span className={`ml-2 font-medium ${isLive ? 'text-green-400' : 'text-gray-500'}`}>
                {isLive ? 'In Match' : 'Idle'}
              </span>
            </div>
          </div>
        </header>

        {/* Live Match Banner */}
        {isLive && (
          <div className="glass-card border-apex-cyan border-opacity-30 mb-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <span className="text-apex-cyan font-bold animate-pulse">▶ LIVE</span>
                <span className="text-white font-bold">{liveLegend ? LEGENDS[liveLegend]?.displayName ?? liveLegend : '—'}</span>
              </div>
              <div className="flex space-x-6">
                <div><span className="text-gray-400 text-sm">Kills:</span> <span className="font-bold ml-1">{liveKills}</span></div>
                <div><span className="text-gray-400 text-sm">Damage:</span> <span className="font-bold ml-1">{liveDamage.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Kills" value={totalKills.toLocaleString()} />
          <StatCard title="K/D Ratio" value={kdRatio.toFixed(2)} />
          <StatCard title="Avg Damage" value={avgDamage.toLocaleString()} />
          <StatCard title="Win Rate" value={`${winRate}%`} />
        </div>

        {/* Recent Matches */}
        <section className="glass-card">
          <h3 className="text-xl font-bold mb-4">Recent Matches</h3>
          <div className="space-y-4">
            {recentMatches.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No matches tracked yet. Launch Apex Legends to start!</p>
            ) : (
              recentMatches.slice(0, 10).map((match) => (
                <div key={match.matchId} className="flex items-center justify-between p-4 bg-white bg-opacity-5 rounded-lg border border-white border-opacity-5">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                      match.isWin ? 'bg-yellow-500 bg-opacity-20 text-yellow-400' : 'bg-apex-cyan bg-opacity-20 text-apex-cyan'
                    }`}>
                      #{match.placement || '—'}
                    </div>
                    <div>
                      <div className="font-bold">
                        {match.gameMode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — {match.mapName}
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(match.timestamp).toLocaleString()} &bull; {LEGENDS[match.legend]?.displayName ?? match.legend}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-8 text-right">
                    <div>
                      <div className="text-sm text-gray-400">Kills</div>
                      <div className="font-bold">{match.kills}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Damage</div>
                      <div className="font-bold">{match.damage.toLocaleString()}</div>
                    </div>
                    {match.weaponKills.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-400">Top Weapon</div>
                        <div className="font-bold text-apex-cyan">
                          {WEAPON_MAP[match.weaponKills[0].weaponName]?.display ?? match.weaponKills[0].weaponName}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="glass-card">
    <div className="text-gray-400 text-sm mb-1">{title}</div>
    <div className="text-3xl font-bold font-mono">{value}</div>
  </div>
);

export default App;
```

- [ ] **Step 3: Update src/overlay/index.tsx to initialize stores**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../index.css';
import { useLiveStore } from '../stores/liveStore';

useLiveStore.getState().init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Update src/overlay/App.tsx to use live store**

```tsx
import React from 'react';
import { useLiveStore } from '../stores/liveStore';
import { WEAPON_MAP } from '../shared/weapon-map';
import { LEGENDS } from '../shared/legend-map';

const App: React.FC = () => {
  const { isLive, kills, damage, squadKills, teamsLeft, legend, mapName, weaponKills, matchState } = useLiveStore();

  if (!isLive && matchState === 'idle') {
    return (
      <div className="p-4 select-none">
        <div className="bg-apex-dark bg-opacity-60 backdrop-blur-md border border-white border-opacity-10 rounded-lg px-3 py-2">
          <span className="text-[10px] text-gray-500 tracking-widest uppercase">ApexPulse — Waiting for match</span>
        </div>
      </div>
    );
  }

  const sortedWeapons = Object.entries(weaponKills)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="p-4 select-none">
      <div className="bg-apex-dark bg-opacity-80 backdrop-blur-md border border-apex-cyan border-opacity-30 rounded-lg overflow-hidden shadow-2xl">
        <div className="bg-apex-cyan bg-opacity-20 px-3 py-1 flex justify-between items-center border-b border-apex-cyan border-opacity-20">
          <span className="text-[10px] font-bold tracking-widest text-apex-cyan uppercase">▶ Live Match</span>
          <span className="text-[10px] text-gray-300">{mapName ?? '—'}</span>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs text-gray-400">{legend ? LEGENDS[legend]?.displayName ?? legend : '—'}</div>
              <div className="text-2xl font-bold leading-none">{kills} Kill{kills !== 1 ? 's' : ''}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Damage</div>
              <div className="text-xl font-bold leading-none text-apex-cyan">{damage.toLocaleString()}</div>
            </div>
          </div>

          <div className="h-1 bg-white bg-opacity-10 rounded-full overflow-hidden">
            <div
              className="h-full bg-apex-cyan shadow-[0_0_8px_rgba(0,229,255,0.5)]"
              style={{ width: `${Math.min((damage / 2000) * 100, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white bg-opacity-5 p-2 rounded">
              <span className="text-gray-400">Squad Kills:</span>
              <span className="ml-1 font-bold text-white">{squadKills}</span>
            </div>
            <div className="bg-white bg-opacity-5 p-2 rounded">
              <span className="text-gray-400">Teams:</span>
              <span className="ml-1 font-bold text-white">{teamsLeft > 0 ? teamsLeft : '—'}</span>
            </div>
          </div>

          {sortedWeapons.length > 0 && (
            <div className="space-y-1">
              {sortedWeapons.map(([weapon, count]) => (
                <div key={weapon} className="flex justify-between text-[11px]">
                  <span className="text-gray-400">{WEAPON_MAP[weapon]?.display ?? weapon}</span>
                  <span className="font-bold">{count} Kill{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
```

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/ src/overlay/
git commit -m "feat: connect dashboard and overlay to real data via Zustand stores"
```

---

## Task 12: Build Verification

- [ ] **Step 1: Run webpack build**

```bash
cd G:\Projects\Apex && npm run build
```

Expected: Build succeeds with 3 bundles (background.js, dashboard.js, overlay.js) in dist/.

- [ ] **Step 2: Fix any TypeScript or build errors**

Iterate until `npm run build` passes cleanly.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve build errors, clean up types"
```
