# LiveAPI WebSocket Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Apex Legends' built-in LiveAPI WebSocket as the primary real-time data source, giving ApexPulse per-match tracking (kills, deaths, damage, weapons, abilities) without waiting for Overwolf GEP approval.

**Architecture:** ApexPulse runs a local WebSocket server on port 7777. The user adds a Steam launch option once. When Apex starts, it connects to our WS server and streams JSON events for the entire match. A new `liveapi-client.ts` module receives these events and translates them into the same callback interface that `gep-manager.ts` uses, so the rest of the app (match-tracker, session-manager, UI) works unchanged. GEP remains as a fallback when running under the Overwolf platform.

**Tech Stack:** Node.js `ws` package for WebSocket server, JSON mode (no protobuf needed), existing match-tracker callback interface.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/background/liveapi-client.ts` | Create | WebSocket server + LiveAPI JSON event parser + callback dispatch |
| `src/shared/liveapi-types.ts` | Create | TypeScript types for all LiveAPI JSON events |
| `src/main/main.ts` | Modify | Start LiveAPI alongside GEP, detect game via LiveAPI `Init` event |
| `src/shared/constants.ts` | Modify | Add `LIVEAPI_PORT` constant |
| `src/shared/types.ts` | Modify | Add `deaths` field to `LiveMatchData`, add `totalTeams` |
| `src/background/match-tracker.ts` | Modify | Track actual death count from LiveAPI `PlayerDowned`/`PlayerKilled` events |
| `src/dashboard/pages/SettingsPage.tsx` | Modify | Add LiveAPI setup instructions and status indicator |
| `package.json` | Modify | Add `ws` dependency |

---

### Task 1: Add `ws` Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install ws package**

```bash
npm install ws
npm install -D @types/ws
```

- [ ] **Step 2: Commit**

```
chore: add ws dependency for LiveAPI WebSocket server
```

---

### Task 2: Define LiveAPI Event Types

**Files:**
- Create: `src/shared/liveapi-types.ts`
- Modify: `src/shared/constants.ts`

- [ ] **Step 1: Add LIVEAPI_PORT constant**

In `src/shared/constants.ts`, add:

```typescript
export const LIVEAPI_PORT = 7777;
```

- [ ] **Step 2: Create LiveAPI type definitions**

Create `src/shared/liveapi-types.ts`:

```typescript
export interface LiveApiPlayer {
  name: string;
  teamId: number;
  pos: { x: number; y: number; z: number };
  angles: { x: number; y: number; z: number };
  currentHealth: number;
  maxHealth: number;
  shieldHealth: number;
  shieldMaxHealth: number;
  nucleusHash: string;
  hardwareName: string;
  teamName: string;
  squadIndex: number;
  character: string;
  skin: string;
}

export interface LiveApiMatchSetup {
  timestamp: string;
  category: string;
  map: string;
  playlistName: string;
  playlistDesc: string;
  datacenter: { name: string };
  aimAssistOn: boolean;
  anonymousMode: boolean;
  serverId: string;
}

export interface LiveApiGameStateChanged {
  timestamp: string;
  category: string;
  state: string;
}

export interface LiveApiCharacterSelected {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
}

export interface LiveApiPlayerDamaged {
  timestamp: string;
  category: string;
  attacker: LiveApiPlayer;
  victim: LiveApiPlayer;
  weapon: string;
  damageInflicted: number;
}

export interface LiveApiPlayerKilled {
  timestamp: string;
  category: string;
  attacker: LiveApiPlayer;
  victim: LiveApiPlayer;
  awardedTo: LiveApiPlayer;
  weapon: string;
}

export interface LiveApiPlayerDowned {
  timestamp: string;
  category: string;
  attacker: LiveApiPlayer;
  victim: LiveApiPlayer;
  weapon: string;
}

export interface LiveApiPlayerAssist {
  timestamp: string;
  category: string;
  assistant: LiveApiPlayer;
  victim: LiveApiPlayer;
  weapon: string;
}

export interface LiveApiSquadEliminated {
  timestamp: string;
  category: string;
  players: LiveApiPlayer[];
  placement: number;
}

export interface LiveApiPlayerStatChanged {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  statName: string;
  newValue: number;
}

export interface LiveApiPlayerRevive {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  revived: LiveApiPlayer;
}

export interface LiveApiPlayerRespawnTeam {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  respawnedTeammates: LiveApiPlayer[];
}

export interface LiveApiWeaponSwitched {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  oldWeapon: string;
  newWeapon: string;
}

export interface LiveApiPlayerAbilityUsed {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  linkedEntity: string;
}

export interface LiveApiInventoryPickUp {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  item: string;
  quantity: number;
}

export interface LiveApiInventoryDrop {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  item: string;
  quantity: number;
}

export interface LiveApiMatchStateEnd {
  timestamp: string;
  category: string;
  state: string;
  winners: LiveApiPlayer[];
}

export interface LiveApiRingStartClosing {
  timestamp: string;
  category: string;
  stage: number;
  center: { x: number; y: number; z: number };
  currentRadius: number;
  endRadius: number;
  shrinkDuration: number;
}

export interface LiveApiInit {
  timestamp: string;
  category: string;
  gameVersion: string;
  apiVersion: { major_num: number; minor_num: number; build_stamp: number };
  platform: string;
}

export interface LiveApiPlayerConnected {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
}

export interface LiveApiPlayerDisconnected {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  canReconnect: boolean;
  isAlive: boolean;
}

export type LiveApiEventType =
  | 'Init'
  | 'MatchSetup'
  | 'GameStateChanged'
  | 'CharacterSelected'
  | 'MatchStateEnd'
  | 'PlayerDamaged'
  | 'PlayerKilled'
  | 'PlayerDowned'
  | 'PlayerAssist'
  | 'PlayerStatChanged'
  | 'PlayerRevive'
  | 'PlayerRespawnTeam'
  | 'PlayerConnected'
  | 'PlayerDisconnected'
  | 'SquadEliminated'
  | 'WeaponSwitched'
  | 'PlayerAbilityUsed'
  | 'InventoryPickUp'
  | 'InventoryDrop'
  | 'InventoryUse'
  | 'RingStartClosing'
  | 'RingFinishedClosing'
  | 'ObserverSwitched';
```

- [ ] **Step 3: Commit**

```
feat: add LiveAPI event type definitions and port constant
```

---

### Task 3: Implement LiveAPI WebSocket Server

**Files:**
- Create: `src/background/liveapi-client.ts`

This is the core module. It runs a WebSocket server, parses incoming JSON events from Apex, identifies the local player, and dispatches events through the same callback interface that `gep-manager.ts` uses.

- [ ] **Step 1: Create the LiveAPI client module**

Create `src/background/liveapi-client.ts`:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { LIVEAPI_PORT } from '../shared/constants';
import { normalizeWeaponName, normalizeLegendName, parseGameMode } from '../shared/utils';
import { GepKillFeedEvent, GepMatchSummary, GepTeamMember, MatchState, GepRosterPlayer } from '../shared/types';
import {
  LiveApiPlayer,
  LiveApiInit,
  LiveApiMatchSetup,
  LiveApiGameStateChanged,
  LiveApiCharacterSelected,
  LiveApiPlayerDamaged,
  LiveApiPlayerKilled,
  LiveApiPlayerDowned,
  LiveApiPlayerAssist,
  LiveApiPlayerStatChanged,
  LiveApiPlayerRevive,
  LiveApiPlayerRespawnTeam,
  LiveApiSquadEliminated,
  LiveApiWeaponSwitched,
  LiveApiMatchStateEnd,
} from '../shared/liveapi-types';

type LiveApiCallbacks = {
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
  onGameRunning: (running: boolean) => void;
};

let wss: WebSocketServer | null = null;
let callbacks: LiveApiCallbacks | null = null;
let localPlayerName = '';
let connected = false;

let matchKills = 0;
let matchAssists = 0;
let matchKnockdowns = 0;
let matchDamage = 0;
let matchTeammates: Map<string, GepTeamMember> = new Map();
let matchRoster: Map<number, GepRosterPlayer[]> = new Map();
let matchTotalTeams = 0;
let matchPlacement = 0;
let matchSquadKills = 0;
let localTeamId = 0;

function resetMatchState(): void {
  matchKills = 0;
  matchAssists = 0;
  matchKnockdowns = 0;
  matchDamage = 0;
  matchTeammates.clear();
  matchRoster.clear();
  matchTotalTeams = 0;
  matchPlacement = 0;
  matchSquadKills = 0;
  localTeamId = 0;
}

function isLocalPlayer(player: LiveApiPlayer): boolean {
  if (!localPlayerName) return false;
  return player.name === localPlayerName;
}

function isTeammate(player: LiveApiPlayer): boolean {
  return localTeamId > 0 && player.teamId === localTeamId;
}

export function registerLiveApiCallbacks(cbs: LiveApiCallbacks): void {
  callbacks = cbs;
}

export function isLiveApiConnected(): boolean {
  return connected;
}

export function startLiveApiServer(): void {
  if (wss) return;

  try {
    wss = new WebSocketServer({ port: LIVEAPI_PORT, host: '127.0.0.1' });

    wss.on('connection', (ws: WebSocket) => {
      console.log('[LiveAPI] Game connected');
      connected = true;

      ws.on('message', (raw: Buffer | string) => {
        try {
          const text = typeof raw === 'string' ? raw : raw.toString('utf8');
          const event = JSON.parse(text);
          handleLiveApiEvent(event);
        } catch (err) {
          console.error('[LiveAPI] Failed to parse event:', err);
        }
      });

      ws.on('close', () => {
        console.log('[LiveAPI] Game disconnected');
        connected = false;
        callbacks?.onGameRunning(false);
      });

      ws.on('error', (err) => {
        console.error('[LiveAPI] WebSocket error:', err);
      });
    });

    wss.on('error', (err) => {
      console.error('[LiveAPI] Server error:', err);
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.warn(`[LiveAPI] Port ${LIVEAPI_PORT} is already in use`);
      }
    });

    wss.on('listening', () => {
      console.log(`[LiveAPI] WebSocket server listening on ws://127.0.0.1:${LIVEAPI_PORT}`);
    });
  } catch (err) {
    console.error('[LiveAPI] Failed to start server:', err);
  }
}

export function stopLiveApiServer(): void {
  if (wss) {
    wss.close();
    wss = null;
    connected = false;
  }
}

function handleLiveApiEvent(event: Record<string, unknown>): void {
  if (!callbacks) return;

  const type = detectEventType(event);
  if (!type) return;

  try {
    switch (type) {
      case 'Init': {
        const e = event as unknown as LiveApiInit;
        console.log(`[LiveAPI] Init — game v${e.gameVersion}, platform: ${e.platform}`);
        callbacks.onGameRunning(true);
        break;
      }

      case 'MatchSetup': {
        const e = event as unknown as LiveApiMatchSetup;
        callbacks.onMapDetected(e.map);
        callbacks.onGameModeDetected(e.playlistName);
        resetMatchState();
        break;
      }

      case 'GameStateChanged': {
        const e = event as unknown as LiveApiGameStateChanged;
        if (e.state === 'Playing' || e.state === 'playing') {
          callbacks.onMatchStateChange('active');
        } else if (e.state === 'Postmatch' || e.state === 'postmatch' || e.state === 'Resolution' || e.state === 'resolution') {
          callbacks.onMatchStateChange('inactive');
          callbacks.onMatchSummary({
            rank: matchPlacement,
            teams: matchTotalTeams,
            squadKills: matchSquadKills,
          });
        }
        break;
      }

      case 'CharacterSelected': {
        const e = event as unknown as LiveApiCharacterSelected;
        if (isLocalPlayer(e.player)) {
          callbacks.onLegendDetected(normalizeLegendName(e.player.character));
        }
        if (e.player.teamId > 0) {
          const roster: GepRosterPlayer = {
            name: e.player.name,
            teamId: e.player.teamId,
            platform: e.player.hardwareName || 'PC',
            isTeammate: isTeammate(e.player),
          };
          if (!matchRoster.has(e.player.teamId)) {
            matchRoster.set(e.player.teamId, []);
          }
          matchRoster.get(e.player.teamId)!.push(roster);
          matchTotalTeams = matchRoster.size;
        }
        break;
      }

      case 'PlayerConnected': {
        const e = event as unknown as { player: LiveApiPlayer };
        if (isLocalPlayer(e.player)) {
          localTeamId = e.player.teamId;
        }
        if (e.player.teamId === localTeamId && !isLocalPlayer(e.player)) {
          matchTeammates.set(e.player.name, {
            name: e.player.name,
            legend: normalizeLegendName(e.player.character),
            platform: e.player.hardwareName || 'PC',
            state: 'alive',
          });
          callbacks.onTeamUpdate(Array.from(matchTeammates.values()));
        }
        break;
      }

      case 'PlayerDamaged': {
        const e = event as unknown as LiveApiPlayerDamaged;
        if (isLocalPlayer(e.attacker)) {
          matchDamage += e.damageInflicted;
          callbacks.onDamage(matchDamage);
          callbacks.onKillFeed({
            attackerName: e.attacker.name,
            victimName: e.victim.name,
            weaponName: normalizeWeaponName(e.weapon),
            action: 'knockdown',
          });
        }
        break;
      }

      case 'PlayerKilled': {
        const e = event as unknown as LiveApiPlayerKilled;
        if (isLocalPlayer(e.awardedTo)) {
          matchKills++;
          callbacks.onKill(matchKills);
          callbacks.onKillFeed({
            attackerName: e.awardedTo.name,
            victimName: e.victim.name,
            weaponName: normalizeWeaponName(e.weapon),
            action: 'kill',
          });
        } else if (isTeammate(e.awardedTo)) {
          matchSquadKills++;
          callbacks.onKillFeed({
            attackerName: e.awardedTo.name,
            victimName: e.victim.name,
            weaponName: normalizeWeaponName(e.weapon),
            action: 'kill',
          });
        }
        if (isLocalPlayer(e.victim)) {
          callbacks.onDeath();
        }
        if (matchTeammates.has(e.victim.name)) {
          matchTeammates.set(e.victim.name, {
            ...matchTeammates.get(e.victim.name)!,
            state: 'dead',
          });
          callbacks.onTeamUpdate(Array.from(matchTeammates.values()));
        }
        break;
      }

      case 'PlayerDowned': {
        const e = event as unknown as LiveApiPlayerDowned;
        if (isLocalPlayer(e.attacker)) {
          matchKnockdowns++;
          callbacks.onKnockdown(matchKnockdowns);
          callbacks.onKillFeed({
            attackerName: e.attacker.name,
            victimName: e.victim.name,
            weaponName: normalizeWeaponName(e.weapon),
            action: 'knockdown',
          });
        }
        if (matchTeammates.has(e.victim.name)) {
          matchTeammates.set(e.victim.name, {
            ...matchTeammates.get(e.victim.name)!,
            state: 'knocked',
          });
          callbacks.onTeamUpdate(Array.from(matchTeammates.values()));
        }
        break;
      }

      case 'PlayerAssist': {
        const e = event as unknown as LiveApiPlayerAssist;
        if (isLocalPlayer(e.assistant)) {
          matchAssists++;
          callbacks.onAssist(matchAssists);
        }
        break;
      }

      case 'PlayerStatChanged': {
        const e = event as unknown as LiveApiPlayerStatChanged;
        if (isLocalPlayer(e.player)) {
          switch (e.statName) {
            case 'kills': matchKills = e.newValue; callbacks.onKill(matchKills); break;
            case 'knockdowns': matchKnockdowns = e.newValue; callbacks.onKnockdown(matchKnockdowns); break;
            case 'revivesGiven': callbacks.onRevive(); break;
          }
        }
        break;
      }

      case 'PlayerRevive': {
        const e = event as unknown as LiveApiPlayerRevive;
        if (isLocalPlayer(e.player)) {
          callbacks.onRevive();
        }
        if (matchTeammates.has(e.revived.name)) {
          matchTeammates.set(e.revived.name, {
            ...matchTeammates.get(e.revived.name)!,
            state: 'alive',
          });
          callbacks.onTeamUpdate(Array.from(matchTeammates.values()));
        }
        break;
      }

      case 'SquadEliminated': {
        const e = event as unknown as LiveApiSquadEliminated;
        const isLocalSquad = e.players.some(p => isLocalPlayer(p));
        if (isLocalSquad) {
          matchPlacement = e.placement;
        }
        break;
      }

      case 'MatchStateEnd': {
        const e = event as unknown as LiveApiMatchStateEnd;
        const localWon = e.winners?.some(p => isLocalPlayer(p));
        if (localWon) {
          matchPlacement = 1;
        }
        break;
      }

      case 'WeaponSwitched': {
        const e = event as unknown as LiveApiWeaponSwitched;
        if (isLocalPlayer(e.player)) {
          const weapons = [e.newWeapon];
          if (e.oldWeapon) weapons.push(e.oldWeapon);
          callbacks.onInventoryUpdate(weapons.map(normalizeWeaponName));
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[LiveAPI] Error handling ${type}:`, err);
  }
}

function detectEventType(event: Record<string, unknown>): string | null {
  if (event.type) return String(event.type);
  if (event.gameMessage && typeof event.gameMessage === 'object') {
    const msg = event.gameMessage as Record<string, unknown>;
    if (msg['@type']) {
      const typeName = String(msg['@type']);
      return typeName.split('.').pop() ?? null;
    }
  }
  if (event.gameVersion !== undefined) return 'Init';
  if (event.playlistName !== undefined) return 'MatchSetup';
  if (event.damageInflicted !== undefined && event.weapon !== undefined && event.awardedTo !== undefined) return 'PlayerKilled';
  if (event.damageInflicted !== undefined && event.weapon !== undefined) return 'PlayerDamaged';
  if (event.state !== undefined && event.winners !== undefined) return 'MatchStateEnd';
  if (event.state !== undefined && !event.player) return 'GameStateChanged';
  if (event.statName !== undefined) return 'PlayerStatChanged';
  if (event.player !== undefined && event.character !== undefined) return 'CharacterSelected';
  if (event.oldWeapon !== undefined) return 'WeaponSwitched';
  if (event.assistant !== undefined) return 'PlayerAssist';
  if (event.revived !== undefined) return 'PlayerRevive';
  if (event.placement !== undefined && event.players !== undefined) return 'SquadEliminated';
  if (event.awardedTo !== undefined) return 'PlayerKilled';

  return null;
}
```

- [ ] **Step 2: Commit**

```
feat: implement LiveAPI WebSocket server with full event handling
```

---

### Task 4: Wire LiveAPI Into Main Process

**Files:**
- Modify: `src/main/main.ts`

The LiveAPI server starts alongside GEP. Both can coexist — GEP is for when running as an Overwolf app, LiveAPI is for standalone/Steam.

- [ ] **Step 1: Add LiveAPI imports**

Add to the top of `src/main/main.ts`:

```typescript
import { startLiveApiServer, stopLiveApiServer, registerLiveApiCallbacks, isLiveApiConnected } from '../background/liveapi-client';
```

- [ ] **Step 2: Register LiveAPI callbacks in initApp**

After the existing `registerCallbacks({ ... })` block for GEP, add:

```typescript
registerLiveApiCallbacks({
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
  onRosterUpdate: (players) => {
    processRoster(players);
  },
  onPlayerNameDetected: async (name: string) => {
    setPlayerName(name);
    await handlePlayerDetected(name);
  },
  onGameModeDetected: (mode: string) => {
    handleGameModeDetected(mode);
    currentGameMode = parseGameMode(mode);
  },
  onMapDetected: handleMapDetected,
  onLegendDetected: handleLegendDetected,
  onGameRunning: (running) => {
    logToRenderer('LiveAPI game running change: ' + running);
    broadcast('game-running-update', { running });
  },
});

startLiveApiServer();
```

- [ ] **Step 3: Add LiveAPI cleanup to before-quit**

In the `before-quit` handler, add `stopLiveApiServer()`.

- [ ] **Step 4: Build and verify**

Run: `npm run build:prod`
Expected: Compiles successfully.

- [ ] **Step 5: Commit**

```
feat: wire LiveAPI server into main process alongside GEP
```

---

### Task 5: Set Local Player Name from LiveAPI Events

**Files:**
- Modify: `src/background/liveapi-client.ts`

The LiveAPI doesn't send the local player's name directly in the `Init` event. The local player is identified when `CharacterSelected` fires — the local player's name is the one whose `character` matches the user's selection. However, the simplest approach is to use the existing player name from the Origin resolver or API profile.

- [ ] **Step 1: Add a setLocalPlayerName export**

Add to `src/background/liveapi-client.ts`:

```typescript
export function setLocalPlayerName(name: string): void {
  localPlayerName = name;
}
```

- [ ] **Step 2: Wire it up in main.ts**

In `main.ts`, after `startLiveApiServer()`, add logic to set the player name when it's detected:

```typescript
import { setLocalPlayerName } from '../background/liveapi-client';
```

Update the `onPlayerNameDetected` callback to also set it for LiveAPI:

```typescript
onPlayerNameDetected: async (name: string) => {
  setPlayerName(name);
  setLocalPlayerName(name);
  await handlePlayerDetected(name);
},
```

Also set it in the GEP callbacks' `onPlayerNameDetected` so LiveAPI gets the name from GEP if detected there first:

In the GEP `registerCallbacks` block, update:
```typescript
onPlayerNameDetected: async (name: string) => {
  setPlayerName(name);
  setLocalPlayerName(name);
  await handlePlayerDetected(name);
},
```

- [ ] **Step 3: Commit**

```
feat: sync local player name between GEP and LiveAPI
```

---

### Task 6: Add Death Tracking to Match Tracker

**Files:**
- Modify: `src/background/match-tracker.ts`
- Modify: `src/shared/types.ts`

Currently `handleDeath()` is a no-op. With LiveAPI, we get actual death events. Track them.

- [ ] **Step 1: Add deaths field to LiveMatchData**

In `src/shared/types.ts`, add `deaths: number;` to the `LiveMatchData` interface:

```typescript
export interface LiveMatchData {
  state: TrackerState;
  matchStartTime: number | null;
  gameMode: GameMode | null;
  mapName: string | null;
  legend: string | null;
  kills: number;
  deaths: number;
  assists: number;
  knockdowns: number;
  damage: number;
  squadKills: number;
  teamsLeft: number;
  totalTeams: number;
  teammates: GepTeamMember[];
  weaponKills: Record<string, number>;
  weaponKnockdowns: Record<string, number>;
  inventory: string[];
  placement: number | null;
  rpEstimate: number | null;
}
```

- [ ] **Step 2: Update createEmptyLiveData**

In `src/background/match-tracker.ts`, add `deaths: 0` and `totalTeams: 0` to `createEmptyLiveData()`.

- [ ] **Step 3: Update handleDeath**

```typescript
export function handleDeath(): void {
  if (live.state !== 'in_match') return;
  live.deaths++;
  broadcastLiveUpdate(live);
}
```

- [ ] **Step 4: Use actual deaths for K/D in finalizeMatch (future)**

In the `MatchRecord`, deaths aren't stored yet (the DB uses matches-minus-wins as proxy). For now, `deaths` is tracked live for the overlay/dashboard but the database schema would need a migration to store it. That's a separate task.

- [ ] **Step 5: Commit**

```
feat: track actual death count from LiveAPI/GEP death events
```

---

### Task 7: Add LiveAPI Setup Instructions to Settings

**Files:**
- Modify: `src/dashboard/pages/SettingsPage.tsx`

Users need to add a Steam launch option once. Show instructions and LiveAPI connection status.

- [ ] **Step 1: Add a LiveAPI section to SettingsPage**

Add a new section after the API key section in SettingsPage:

```tsx
{/* LiveAPI Setup */}
<SettingsSection title="Live Match Tracking" description="Connect directly to Apex Legends for real-time match data">
  <div className="space-y-3">
    <p className="text-white/60 text-sm">
      Add this to your Steam launch options for Apex Legends:
    </p>
    <code className="block bg-black/30 text-apex-cyan px-4 py-3 rounded-lg text-sm font-mono select-all break-all">
      +cl_liveapi_enabled 1 +cl_liveapi_ws_servers "ws://127.0.0.1:7777" +cl_liveapi_use_protobuf 0
    </code>
    <p className="text-white/40 text-xs">
      Steam → Library → Apex Legends → Right-click → Properties → Launch Options
    </p>
  </div>
</SettingsSection>
```

- [ ] **Step 2: Commit**

```
feat: add LiveAPI setup instructions to Settings page
```

---

### Task 8: Add `ws` to Webpack Externals

**Files:**
- Modify: `webpack.config.js`

The `ws` package is a native Node.js module and must not be bundled by webpack.

- [ ] **Step 1: Add ws to externals**

In `webpack.config.js`, find the `externals` array/object in the main process config and add `'ws'`. If there's an externals pattern for node modules, ensure `ws` is included. For example:

```javascript
externals: {
  'better-sqlite3': 'commonjs better-sqlite3',
  'ws': 'commonjs ws',
},
```

- [ ] **Step 2: Add ws to electron-builder files**

In `package.json` under `build.files`, add:

```json
"node_modules/ws/**/*"
```

- [ ] **Step 3: Build and verify**

Run: `npm run build:prod && npm run pack`
Expected: Compiles and packages successfully.

- [ ] **Step 4: Commit**

```
chore: add ws to webpack externals and builder files
```

---

### Task 9: Final Integration Test

**Files:**
- No new files

- [ ] **Step 1: Build production**

Run: `npm run build:prod`
Expected: 0 errors.

- [ ] **Step 2: Package**

Run: `npm run pack`
Expected: `dist/win-unpacked/ApexPulse.exe` produced.

- [ ] **Step 3: Verify Steam launch option**

Add to Apex Legends Steam launch options:
```
+cl_liveapi_enabled 1 +cl_liveapi_ws_servers "ws://127.0.0.1:7777" +cl_liveapi_use_protobuf 0
```

- [ ] **Step 4: Run ApexPulse, then launch Apex**

1. Start `dist/win-unpacked/ApexPulse.exe`
2. Launch Apex Legends via Steam
3. Enter a match
4. Verify: kills, damage, knockdowns, death events appear in real-time on dashboard
5. Verify: match saves to history after game ends

- [ ] **Step 5: Commit**

```
feat: LiveAPI integration complete — real-time match tracking via WebSocket
```

---

## Summary

| Task | What |
|------|------|
| 1 | Add `ws` npm dependency |
| 2 | Define all LiveAPI event types + port constant |
| 3 | Core WebSocket server + event parser + callback dispatch |
| 4 | Wire into main.ts alongside GEP |
| 5 | Sync local player name between data sources |
| 6 | Track actual death count |
| 7 | Settings page setup instructions |
| 8 | Webpack/builder config for `ws` |
| 9 | Final build + integration test |

## How GEP and LiveAPI Coexist

- Both register the same callback interface
- GEP fires when running under Overwolf platform (app store distribution)
- LiveAPI fires when user has Steam launch option set (standalone)
- If both fire simultaneously, match-tracker's guards prevent double-counting (e.g., `state === 'active' && live.state !== 'in_match'`)
- LiveAPI provides richer data (per-damage events, abilities, weapon switches) that GEP doesn't have
