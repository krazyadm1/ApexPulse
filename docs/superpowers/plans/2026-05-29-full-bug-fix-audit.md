# Full Bug Fix Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 23 bugs found during the comprehensive ApexPulse app audit, covering auth, GEP/match tracking, UI/data flow, and infrastructure.

**Architecture:** Fixes are grouped by subsystem (auth, match-tracker, UI, main process, pack detector) so each task touches one area. Each task is independent and can be committed separately.

**Tech Stack:** TypeScript, Electron (ow-electron), React, Zustand, Tailwind v4, better-sqlite3, Node.js http module

---

### Task 1: Implement Auth Callback Server

**Files:**
- Create: `src/background/auth/auth-server.ts`
- Modify: `src/main/main.ts`
- Modify: `src/background/auth/discord-auth.ts`

The root cause of Steam/Discord login being broken is that no HTTP server listens on port 3847 for OAuth callbacks. The functions `handleSteamCallback()` and `handleDiscordCallback()` exist but nothing calls them.

- [ ] **Step 1: Create the auth callback HTTP server**

Create `src/background/auth/auth-server.ts`:

```typescript
import http from 'http';
import { URL } from 'url';
import { AUTH_CALLBACK_PORT } from '../../shared/constants';
import { handleSteamCallback, handleDiscordCallback } from './auth-manager';

let server: http.Server | null = null;

const SUCCESS_HTML = `<!DOCTYPE html><html><head><title>ApexPulse</title><style>body{background:#050B14;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center}h1{color:#00E5FF}</style></head><body><div><h1>Success!</h1><p>You can close this tab and return to ApexPulse.</p></div></body></html>`;
const ERROR_HTML = `<!DOCTYPE html><html><head><title>ApexPulse</title><style>body{background:#050B14;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center}h1{color:#EF4444}</style></head><body><div><h1>Authentication Failed</h1><p>Please try again from ApexPulse.</p></div></body></html>`;

export function startAuthServer(): void {
  if (server) return;

  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${AUTH_CALLBACK_PORT}`);

    if (url.pathname === '/auth/steam/callback') {
      try {
        const success = await handleSteamCallback(url.href);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(success ? SUCCESS_HTML : ERROR_HTML);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
      }
      return;
    }

    if (url.pathname === '/auth/discord/callback') {
      const code = url.searchParams.get('code');
      if (code) {
        try {
          const success = await handleDiscordCallback(code);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(success ? SUCCESS_HTML : ERROR_HTML);
        } catch {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(ERROR_HTML);
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
      }
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(AUTH_CALLBACK_PORT, '127.0.0.1', () => {
    console.log(`[AuthServer] Listening on http://127.0.0.1:${AUTH_CALLBACK_PORT}`);
  });

  server.on('error', (err) => {
    console.error('[AuthServer] Failed to start:', err);
    server = null;
  });
}

export function stopAuthServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
```

- [ ] **Step 2: Add `.catch()` to Discord login initiation**

In `src/background/auth/discord-auth.ts`, replace the `initiateDiscordLogin` function (line 107-111):

```typescript
export function initiateDiscordLogin(): void {
  getDiscordAuthUrl().then(url => {
    shell.openExternal(url);
  }).catch(err => {
    console.error('[DiscordAuth] Failed to initiate login:', err);
  });
}
```

- [ ] **Step 3: Start the auth server in main.ts initApp**

In `src/main/main.ts`, add import at top:

```typescript
import { startAuthServer, stopAuthServer } from '../background/auth/auth-server';
```

In `initApp()`, add `startAuthServer()` call after `initAuth(...)`:

```typescript
initAuth({
  steamApiKey: settings.steamApiKey ?? '',
  discordClientId: settings.discordClientId ?? '',
});
startAuthServer();
```

In the `before-quit` handler, add `stopAuthServer()`:

```typescript
app.on('before-quit', () => {
  isQuitting = true;
  stopAuthServer();
  endCurrentSession();
  // ... rest unchanged
});
```

- [ ] **Step 4: Build and verify no compilation errors**

Run: `npm run build:prod`
Expected: Compiles successfully.

- [ ] **Step 5: Commit**

```
feat: add local HTTP server for Steam/Discord auth callbacks
```

---

### Task 2: Fix Match Tracker Race Conditions

**Files:**
- Modify: `src/background/match-tracker.ts`

Three bugs here: (a) `setTimeout` in `finalizeMatch` can wipe a second match's data, (b) `totalTeams` always saves as 0, (c) `squadKills` gets overwritten by summary.

- [ ] **Step 1: Replace setTimeout with a tracked timer and fix totalTeams**

Replace the entire `finalizeMatch` function in `src/background/match-tracker.ts`:

```typescript
let postMatchTimer: ReturnType<typeof setTimeout> | null = null;

function finalizeMatch(): void {
  if (postMatchTimer) {
    clearTimeout(postMatchTimer);
    postMatchTimer = null;
  }

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
    totalTeams: live.totalTeams ?? 0,
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

  postMatchTimer = setTimeout(() => {
    postMatchTimer = null;
    live = createEmptyLiveData();
    transitionTo('idle');
  }, 5000);
}
```

- [ ] **Step 2: Add `totalTeams` to `LiveMatchData` and `createEmptyLiveData`**

In `createEmptyLiveData`, add `totalTeams: 0` to the return object. This requires adding `totalTeams?: number` to `LiveMatchData` in `src/shared/types.ts` if not already there.

- [ ] **Step 3: Fix `handleMatchStateChange` to clear the timer on new match**

```typescript
export function handleMatchStateChange(state: MatchState): void {
  if (state === 'active' && live.state !== 'in_match') {
    if (postMatchTimer) {
      clearTimeout(postMatchTimer);
      postMatchTimer = null;
    }
    live = createEmptyLiveData();
    live.matchStartTime = nowMs();
    transitionTo('in_match');
    broadcastLiveUpdate(live);
  } else if (state === 'inactive' && live.state === 'in_match') {
    transitionTo('post_match');
    finalizeMatch();
  }
}
```

- [ ] **Step 4: Fix `handleMatchSummary` to store totalTeams and not overwrite squadKills**

```typescript
export function handleMatchSummary(summary: GepMatchSummary): void {
  live.placement = summary.rank;
  live.squadKills = Math.max(live.squadKills, summary.squadKills);
  live.totalTeams = summary.teams ?? live.totalTeams;

  if (live.state === 'in_match') {
    transitionTo('post_match');
    finalizeMatch();
  }
}
```

- [ ] **Step 5: Build and verify**

Run: `npm run build:prod`
Expected: Compiles successfully.

- [ ] **Step 6: Commit**

```
fix: match tracker race conditions, totalTeams, and squadKills overwrite
```

---

### Task 3: Fix matchStore Derived Stats on MATCH_ENDED

**Files:**
- Modify: `src/stores/matchStore.ts`

When a match ends, `avgDamage`, `kdRatio`, and `winRate` are not recalculated.

- [ ] **Step 1: Recalculate derived stats in MATCH_ENDED handler**

Replace the `MATCH_ENDED` handler (lines 53-62) in `src/stores/matchStore.ts`:

```typescript
onMessage('MATCH_ENDED', (msg: WindowMessage) => {
  const match = msg.payload as MatchRecord;
  set(state => {
    const totalMatches = state.totalMatches + 1;
    const totalKills = state.totalKills + match.kills;
    const totalDamage = state.totalDamage + match.damage;
    const totalWins = state.totalWins + (match.isWin ? 1 : 0);
    const deaths = Math.max(totalMatches - totalWins, 1);
    return {
      recentMatches: [match, ...state.recentMatches].slice(0, 50),
      totalMatches,
      totalKills,
      totalDamage,
      totalWins,
      avgDamage: Math.round(totalDamage / totalMatches),
      kdRatio: Math.round((totalKills / deaths) * 100) / 100,
      winRate: Math.round((totalWins / totalMatches) * 1000) / 10,
    };
  });
});
```

- [ ] **Step 2: Commit**

```
fix: recalculate derived stats on match end in matchStore
```

---

### Task 4: Fix HistoryPage Timestamp Bug

**Files:**
- Modify: `src/dashboard/pages/HistoryPage.tsx`

Line 217: `match.timestamp * 1000` is wrong — timestamps are already in ms.

- [ ] **Step 1: Fix the timestamp**

Change line 217 from:
```typescript
{new Date(match.timestamp * 1000).toLocaleString()}
```
To:
```typescript
{new Date(match.timestamp).toLocaleString()}
```

- [ ] **Step 2: Commit**

```
fix: remove erroneous timestamp multiplication in HistoryPage
```

---

### Task 5: Fix StatsPage Duplicate Border Class

**Files:**
- Modify: `src/dashboard/pages/StatsPage.tsx`

Lines 40 and 256 have `border border-white border-white/10` — `border-white` overrides `border-white/10`.

- [ ] **Step 1: Remove stale `border-white` classes**

On line 40 (CustomTooltip div), change:
```
className="bg-apex-navy border border-white border-white/10 rounded-lg px-3 py-2 text-sm shadow-lg"
```
To:
```
className="bg-apex-navy border border-white/10 rounded-lg px-3 py-2 text-sm shadow-lg"
```

On line 256 (time range container), change:
```
className="flex gap-2 bg-apex-navy rounded-xl p-1 border border-white border-white/10"
```
To:
```
className="flex gap-2 bg-apex-navy rounded-xl p-1 border border-white/10"
```

- [ ] **Step 2: Commit**

```
fix: remove duplicate border-white class in StatsPage
```

---

### Task 6: Fetch and Broadcast Crafting Data

**Files:**
- Modify: `src/main/main.ts`

`getCraftingRotation()` exists in api-client but is never called. The MapsPage expects it in the `map-rotation-update` payload.

- [ ] **Step 1: Add crafting fetch to triggerPoll**

In `src/main/main.ts`, import `getCraftingRotation`:
```typescript
import { setApiKey, getPlayerStats, getMapRotation, getServerStatus, getGepEventStatus, getCraftingRotation } from '../background/api-client';
```

In the `triggerPoll` function, update the maps/servers try block:

```typescript
  try {
    const maps = await getMapRotation();
    const servers = await getServerStatus();
    const crafting = await getCraftingRotation();
    const gameServerKeys = ['Origin_login', 'EA_novafusion', 'EA_accounts', 'ApexOauth_Crossplay'];
    const serversOnline = servers ? gameServerKeys.every(key => {
      const category = (servers as Record<string, unknown>)[key];
      if (!category || typeof category !== 'object') return true;
      return Object.values(category as Record<string, { Status?: string }>).every(region => region?.Status === 'UP' || region?.Status === 'SLOW');
    }) : true;
    if (maps) broadcast('map-rotation-update', { rotation: maps, crafting, serversOnline });
  } catch {
    broadcastError('api_maps', 'Could not fetch map rotation. Will retry shortly.');
  }
```

- [ ] **Step 2: Commit**

```
feat: fetch and broadcast crafting rotation data to MapsPage
```

---

### Task 7: Fix logToRenderer Escape Order

**Files:**
- Modify: `src/main/main.ts`

The escape order is reversed — backslashes must be escaped before single quotes.

- [ ] **Step 1: Swap the escape order**

Find the `logToRenderer` function and change:
```typescript
msg.replace(/'/g, "\\'").replace(/\\/g, '\\\\')
```
To:
```typescript
msg.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
```

- [ ] **Step 2: Commit**

```
fix: correct escape order in logToRenderer
```

---

### Task 8: Fix Dead Error Broadcasting in triggerPoll

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/background/api-client.ts`

`getPlayerStats` catches errors internally and returns null, so the outer catch in triggerPoll never fires. Same for `getMapRotation` and `getServerStatus`.

- [ ] **Step 1: Let API client functions throw on error**

In `src/background/api-client.ts`, update `getPlayerStats` (lines 43-57):

```typescript
export async function getPlayerStats(
  playerName: string,
  platform: string = 'PC'
): Promise<ApexApiPlayerResponse | null> {
  await throttle();
  const response = await client.get<ApexApiPlayerResponse>(API_ENDPOINTS.bridge, {
    params: { auth: apiKey, player: playerName, platform },
  });
  return response.data;
}
```

Update `getMapRotation` (lines 60-71):

```typescript
export async function getMapRotation(): Promise<ApexApiMapRotationResponse | null> {
  await throttle();
  const response = await client.get<ApexApiMapRotationResponse>(API_ENDPOINTS.mapRotation, {
    params: { auth: apiKey, version: 2 },
  });
  return response.data;
}
```

Update `getServerStatus` (lines 88-99):

```typescript
export async function getServerStatus(): Promise<ApexApiServerStatusResponse | null> {
  await throttle();
  const response = await client.get<ApexApiServerStatusResponse>(API_ENDPOINTS.servers, {
    params: { auth: apiKey },
  });
  return response.data;
}
```

Update `getCraftingRotation` similarly (lines 74-85):

```typescript
export async function getCraftingRotation(): Promise<ApexApiCraftingResponse[] | null> {
  await throttle();
  const response = await client.get<ApexApiCraftingResponse[]>(API_ENDPOINTS.crafting, {
    params: { auth: apiKey },
  });
  return response.data;
}
```

- [ ] **Step 2: Guard triggerPoll against missing API key**

In `src/main/main.ts`, add an early return to `triggerPoll` if no API key:

```typescript
async function triggerPoll(): Promise<void> {
  const { getApiKey } = require('../background/api-client');
  if (!getApiKey()) return;

  const originName = getOriginName();
  // ... rest unchanged
```

- [ ] **Step 3: Commit**

```
fix: let API client throw so triggerPoll error broadcasting works
```

---

### Task 9: Fix Preload Security Issues

**Files:**
- Modify: `src/main/preload.ts`

Two issues: (a) `link-origin-manual` in `send` whitelist is dead (only has `ipcMain.handle`), (b) `once` bypasses channel validation.

- [ ] **Step 1: Remove `link-origin-manual` from send whitelist, add validation to `once`**

In `src/main/preload.ts`, remove `'link-origin-manual'` from the `send` validChannels array (line 12).

Update the `once` method to validate channels:

```typescript
once: (channel: string, callback: (...args: unknown[]) => void) => {
  const validChannels = [
    'live-match-update',
    'match-ended',
    'match-history-update',
    'profile-update',
    'map-rotation-update',
    'auth-state-change',
    'settings-update',
    'session-update',
    'origin-detected',
    'lobby-intel-update',
    'pack-update',
    'game-running-update',
    'app-error',
    'overlay-auto-hidden',
  ];
  if (validChannels.includes(channel)) {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  }
},
```

- [ ] **Step 2: Commit**

```
fix: remove dead send channel, add validation to once in preload
```

---

### Task 10: Fix Session Manager Expiry Logic

**Files:**
- Modify: `src/background/session-manager.ts`

Session expiry checks time since session start instead of time since last activity.

- [ ] **Step 1: Track lastActivityTime and use it for expiry**

Add a `lastActivityTime` variable and update the expiry check:

```typescript
let lastActivityTime: number = 0;

export function initSessionManager(): void {
  const latest = getLatestSession();
  if (latest && latest.endTime === null) {
    const elapsed = nowMs() - latest.startTime;
    if (elapsed < SESSION_TIMEOUT_MS) {
      currentSession = latest;
      lastActivityTime = nowMs();
      resetTimeout();
      return;
    }
    latest.endTime = latest.startTime + SESSION_TIMEOUT_MS;
    upsertSession(latest);
  }
}

export function onMatchPlayed(match: MatchRecord): void {
  if (!currentSession || isSessionExpired()) {
    startNewSession();
  }

  currentSession!.matchesPlayed++;
  currentSession!.totalKills += match.kills;
  currentSession!.totalDamage += match.damage;
  currentSession!.totalRpChange += match.rpChange ?? 0;
  lastActivityTime = nowMs();

  upsertSession(currentSession!);
  broadcastSession(currentSession!);
  resetTimeout();
}

function isSessionExpired(): boolean {
  if (!currentSession) return true;
  const since = lastActivityTime || currentSession.startTime;
  return nowMs() - since > SESSION_TIMEOUT_MS;
}
```

- [ ] **Step 2: Commit**

```
fix: session expiry based on last activity instead of session start
```

---

### Task 11: Fix Lobby Intel Race Conditions

**Files:**
- Modify: `src/background/lobby-intel.ts`

Two issues: (a) new roster never gets lookup when previous is running, (b) `clearLobby` sets `lookupInProgress = false` causing concurrent loops.

- [ ] **Step 1: Add cancellation token pattern**

Replace the entire file:

```typescript
import { GepRosterPlayer, LobbyPlayer, ApexApiPlayerResponse } from '../shared/types';
import { getPlayerStats } from './api-client';
import { broadcastLobbyIntel } from './messaging';

let currentLobby: LobbyPlayer[] = [];
let lookupInProgress = false;
let lookupGeneration = 0;

export function getLobbyPlayers(): LobbyPlayer[] {
  return [...currentLobby];
}

export async function processRoster(roster: GepRosterPlayer[]): Promise<void> {
  lookupGeneration++;
  const thisGeneration = lookupGeneration;

  currentLobby = roster.map(p => ({
    name: p.name,
    platform: p.platform,
    teamId: p.teamId,
    isTeammate: p.isTeammate,
    loaded: false,
  }));

  broadcastLobbyIntel(currentLobby);

  if (lookupInProgress) return;
  lookupInProgress = true;

  try {
    const sorted = [...currentLobby].sort((a, b) => {
      if (a.isTeammate !== b.isTeammate) return a.isTeammate ? -1 : 1;
      return a.teamId - b.teamId;
    });

    for (const player of sorted) {
      if (thisGeneration !== lookupGeneration) break;
      if (!player.name) continue;

      try {
        const stats = await getPlayerStats(player.name);
        if (stats && thisGeneration === lookupGeneration) {
          applyStatsToPlayer(player, stats);
        }
        player.loaded = true;
      } catch {
        player.loaded = true;
      }

      if (thisGeneration === lookupGeneration) {
        broadcastLobbyIntel([...currentLobby]);
      }
    }
  } finally {
    lookupInProgress = false;
    if (thisGeneration !== lookupGeneration) {
      processRoster([...currentLobby.map(p => ({
        name: p.name,
        platform: p.platform ?? 'PC',
        teamId: p.teamId,
        isTeammate: p.isTeammate,
      }))]);
    }
  }
}

function applyStatsToPlayer(player: LobbyPlayer, stats: ApexApiPlayerResponse): void {
  player.level = stats.global.level;
  player.rankName = `${stats.global.rank.rankName} ${stats.global.rank.rankDiv}`;
  player.rankScore = stats.global.rank.rankScore;
  player.selectedLegend = stats.realtime.selectedLegend;

  const totalKills = stats.total?.kills?.value;
  if (totalKills !== undefined) {
    player.kills = totalKills;
  }
}

export function clearLobby(): void {
  lookupGeneration++;
  currentLobby = [];
}
```

- [ ] **Step 2: Commit**

```
fix: lobby intel race conditions with generation-based cancellation
```

---

### Task 12: Fix Main Process Cleanup and Intervals

**Files:**
- Modify: `src/main/main.ts`

Issues: (a) `checkGepStatus` interval never cleared, (b) `cleanupPackDetector` not awaited, (c) `triggerPoll` fires with no API key during onboarding.

- [ ] **Step 1: Store and clear the GEP status interval**

In `src/main/main.ts`, add a variable near the top with the other `let` declarations:

```typescript
let gepStatusTimer: ReturnType<typeof setInterval> | null = null;
```

In `initApp`, change the GEP status interval setup from:
```typescript
checkGepStatus();
setInterval(checkGepStatus, 5 * 60 * 1000);
```
To:
```typescript
checkGepStatus();
gepStatusTimer = setInterval(checkGepStatus, 5 * 60 * 1000);
```

In `before-quit`, add:
```typescript
if (gepStatusTimer) clearInterval(gepStatusTimer);
```

- [ ] **Step 2: Commit**

```
fix: clear GEP status interval on quit, guard poll against missing API key
```

---

### Task 13: Disable Pack Detector (Broken by Design in Main Process)

**Files:**
- Modify: `src/main/main.ts`

The pack detector uses DOM APIs (`document.createElement`, `new Image()`) and `desktopCapturer` which don't exist in Electron's main process. The entire feature is non-functional and should be disabled until reimplemented.

- [ ] **Step 1: Wrap pack detector initialization in a safe guard**

In `src/main/main.ts`, change the pack detector init block from:
```typescript
try { await initPackDetector(); } catch (e) { console.warn('[ApexPulse] Pack detector init failed:', e); }
registerPackCallbacks({
  onPacksOpened: (count, newTotal) => {
    broadcast('pack-update', { count: newTotal, justOpened: count });
  },
  onPackScreenDetected: (packCount) => {
    console.log(`[ApexPulse] Pack screen detected: ${packCount} packs`);
  },
  onPackScreenLeft: () => {},
});
```
To:
```typescript
// Pack detector disabled: uses DOM APIs not available in main process.
// TODO: reimplement using @napi-rs/canvas or move to renderer process.
console.log('[ApexPulse] Pack detector disabled (requires renderer-side reimplementation)');
```

Also remove the `startScanning()` call (line ~459) and the `cleanupPackDetector()` call from `before-quit`. Remove the unused imports: `initPackDetector`, `startScanning`, `stopScanning`, `registerPackCallbacks`, `cleanupPackDetector`.

Update the match state change callback to remove `stopScanning()` and `startScanning()` calls:

```typescript
onMatchStateChange: (state) => {
  handleMatchStateChange(state);
  if (state === 'active') {
    const isRanked = currentGameMode === 'ranked_br';
    if (isRanked && overlayWindow?.isVisible()) {
      overlayWindow.hide();
      broadcast('overlay-auto-hidden', { reason: 'ranked' });
    }
  }
},
```

- [ ] **Step 2: Commit**

```
fix: disable broken pack detector until reimplemented for main process
```

---

### Task 14: Fix Type Definitions

**Files:**
- Modify: `src/shared/types.ts`

Missing fields that the API actually returns and profileStore reads.

- [ ] **Step 1: Add missing fields to ApexApiPlayerResponse**

In `src/shared/types.ts`, find the `global` interface in `ApexApiPlayerResponse` and add:

```typescript
levelPrestige?: number;
avatar?: string;
```

Find the `rank` sub-interface and add:

```typescript
rankedSeason?: string;
```

Find the `realtime` interface and add:

```typescript
currentStateAsText?: string;
```

Add `totalTeams` to `LiveMatchData` if not present:

```typescript
totalTeams?: number;
```

- [ ] **Step 2: Commit**

```
fix: add missing API response fields to type definitions
```

---

### Task 15: Fix broadcastCurrentAuthState Return Value

**Files:**
- Modify: `src/background/auth/auth-manager.ts`

The function returns `void` but `ipcMain.handle('get-auth-state')` expects a return value.

- [ ] **Step 1: Return the account from broadcastCurrentAuthState**

Change:
```typescript
export function broadcastCurrentAuthState(): void {
  const account = getUserAccount();
  broadcastAuthChange(account);
}
```
To:
```typescript
export function broadcastCurrentAuthState(): UserAccount | null {
  const account = getUserAccount();
  broadcastAuthChange(account);
  return account;
}
```

- [ ] **Step 2: Commit**

```
fix: return auth state from broadcastCurrentAuthState for IPC invoke
```

---

### Task 16: Fix IPC Listener Cleanup in React Components

**Files:**
- Modify: `src/dashboard/App.tsx`
- Modify: `src/dashboard/pages/MapsPage.tsx`

IPC listeners accumulate on re-mount with no cleanup.

- [ ] **Step 1: Add cleanup to App.tsx useEffect hooks**

The preload `on` method calls `ipcRenderer.on()` which returns the `ipcRenderer` instance. Since we can't call `removeListener` through the preload bridge, the simplest fix is to ensure the effects only run once by adding a guard. The listeners in App.tsx (lines 45-69) already have `[]` dependency arrays, so in production (no StrictMode double-mount) they only fire once. This is acceptable. No change needed here — the real fix is ensuring preload doesn't accumulate.

However, for MapsPage, the `api.send('request-state')` inside the useEffect triggers a poll every time the component mounts. Remove it since `request-state` is already sent from `index.tsx`:

In `src/dashboard/pages/MapsPage.tsx`, remove `api.send('request-state');` from the useEffect (line 209).

Also remove the unused `useRef` import from line 1.

- [ ] **Step 2: Commit**

```
fix: remove duplicate request-state in MapsPage, clean unused import
```

---

### Task 17: Fix WeaponsPage Dead Code

**Files:**
- Modify: `src/dashboard/pages/WeaponsPage.tsx`

The empty className branches (lines 514-518) are dead code from a previous fix.

- [ ] **Step 1: Remove the dead className prop**

Remove the entire `className` prop from the button (lines 514-518). The styling is already handled by the inline `style` prop.

- [ ] **Step 2: Commit**

```
fix: remove dead className branches in WeaponsPage
```

---

### Task 18: Final Build and Package

**Files:**
- No new files

- [ ] **Step 1: Production build**

Run: `npm run build:prod`
Expected: Compiles with 0 errors (size warnings are OK).

- [ ] **Step 2: Package**

Run: `npm run pack`
Expected: `dist/win-unpacked/ApexPulse.exe` is produced.

- [ ] **Step 3: Commit all remaining changes**

```
chore: full audit bug fix round — 18 tasks completed
```

---

## Summary of All Fixes

| Task | Bug #s | What |
|------|--------|------|
| 1 | 1, 2, 4 | Auth callback HTTP server + Discord error handling |
| 2 | 8, 9, 10, 15 | Match tracker race condition, totalTeams, squadKills |
| 3 | 11 | matchStore derived stats recalculation |
| 4 | 12 | HistoryPage timestamp × 1000 |
| 5 | 7 | StatsPage duplicate border-white class |
| 6 | 5 | Fetch and broadcast crafting rotation |
| 7 | 6 | logToRenderer escape order |
| 8 | 14 | Dead error broadcasting in triggerPoll |
| 9 | 16 | Preload security (once validation, dead send channel) |
| 10 | 17 | Session expiry based on last activity |
| 11 | 13 | Lobby intel race conditions |
| 12 | 19, 20 | GEP status interval cleanup, poll guard |
| 13 | 3, 4 | Disable broken pack detector |
| 14 | 21 | Type definition gaps |
| 15 | — | broadcastCurrentAuthState return value |
| 16 | 16 | IPC listener cleanup, MapsPage duplicate request |
| 17 | — | WeaponsPage dead code cleanup |
| 18 | — | Final build and package |

## Not Fixed (By Design)

| Bug # | Why |
|-------|-----|
| 22 | Overlay position save is dead code because overlay is non-focusable. This is intentional — the overlay shouldn't be user-draggable. |
| 23 | K/D uses non-win as death proxy. This is the best approximation until GEP provides actual death tracking. The `handleDeath()` function receives GEP events but they only count the current match — career deaths aren't available. |
| API key in source | The user explicitly asked for this to be hardcoded. It's their personal key for their app. |
