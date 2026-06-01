# GEP Event Parsing Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken GEP info-update routing in `gep-manager.ts` so that game mode, map, team, roster, inventory, and location data are correctly parsed from ow-electron's `new-info-update` events.

**Architecture:** The root cause is that ow-electron's `new-info-update` fires individual `(feature, category, key, value)` tuples, but the current listener discards `data.key` and passes only `data.category` — making it impossible to distinguish which field updated. The fix rewrites the listener to pass `(feature, key, value)` directly, rewrites `handleInfoUpdate` to route by feature+key, and adds accumulation buffers with debounce for team/roster data (which fires one player at a time).

**Tech Stack:** TypeScript, Electron (ow-electron), Overwolf GEP

---

## Root Cause Analysis

Line 122 of `gep-manager.ts`:
```typescript
handleInfoUpdate({ feature: data.feature, info: { [data.category ?? data.feature]: data.value } });
```

ow-electron fires: `{ feature, category, key, value }` — one key-value pair per event.  
The code creates: `{ feature, info: { <category>: <value> } }` — the `key` is lost.

This breaks EVERY feature that uses the info-update path, because the handler tries to find specific keys (like `game_mode`, `tabs`, `teammate_0`, `roster_1`) in the data object, but the only key present is the category name.

### What works by accident
- `me.name` — works because category=`me` and the handler checks `data.me`
- Kill/assist/damage/death events — work via `new-game-event` path, not info-updates
- `match_start`/`match_end` — work via `new-game-event` path

### What is broken
| Feature | Key | Expected | Actual |
|---------|-----|----------|--------|
| `match_info` | `game_mode` | Detect ranked/BR/etc. | Silently dropped (wrong switch case + lost key) |
| `match_info` | `tabs` | Update kills/assists/damage | Silently dropped (key is `match_info` not `tabs`) |
| `match_info` | `map_name` | Detect current map | Silently dropped |
| `match_state` | `match_state` | Match active/inactive | No switch case for feature `match_state` |
| `team` | `teammate_X` | Track squad members | Dropped (key is `match_info` not `teammate_X`) |
| `team` | `legendSelect_X` | Detect local player legend | Not handled |
| `roster` | `roster_XX` | Lobby intel data | Dropped (key is `match_info` not `roster_XX`) |
| `inventory` | `weapons` | Current weapons | Dropped (key is `me` not `weapons`) |
| `location` | `location` | Player coordinates | Sends NaN (wrong object shape) |
| `damage` | `totalDamageDealt` | Total damage info-update | No switch case for feature `damage` |
| `game_info` | `player` | Player name (new format) | Dropped |

### Additional bug: game mode normalization
`main.ts` stores raw GEP value (`#PL_Ranked_Leagues`) in `currentGameMode` and compares `=== 'ranked_br'`. The `parseGameMode()` utility exists in `utils.ts` but isn't used in `main.ts`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/background/gep-manager.ts` | Rewrite | Fix listener, rewrite handler, add accumulation buffers |
| `src/main/main.ts` | Modify (1 line) | Normalize game mode before storing |

---

### Task 1: Rewrite GEP info-update handling

This is the core fix. Rewrite the `new-info-update` listener and `handleInfoUpdate` function to properly route by `(feature, key, value)`.

**Files:**
- Modify: `src/background/gep-manager.ts:120-233`

- [ ] **Step 1: Add helper function and accumulation buffers**

Add these above `setupGepListeners`, after the existing `safeParse` function (after line 57):

```typescript
function platformHwToString(hw: number | undefined): string {
  switch (hw) {
    case 7: return 'PC/Steam';
    case 2: return 'PC/Origin';
    case 1: return 'PS';
    case 9: return 'Switch';
    case 0: return 'Xbox';
    default: return 'PC';
  }
}

const teammateBuffer = new Map<string, GepTeamMember>();
const rosterBuffer = new Map<string, GepRosterPlayer>();
let rosterFlushTimer: ReturnType<typeof setTimeout> | null = null;
const ROSTER_DEBOUNCE_MS = 500;

function flushRoster(): void {
  if (!callbacks || rosterBuffer.size === 0) return;
  callbacks.onRosterUpdate(Array.from(rosterBuffer.values()));
}
```

- [ ] **Step 2: Change the `new-info-update` listener**

In `setupGepListeners`, replace lines 120-123:

```typescript
// OLD:
gep.on('new-info-update', (_event: any, gameId: number, data: any) => {
  if (gameId !== APEX_GAME_ID) return;
  handleInfoUpdate({ feature: data.feature, info: { [data.category ?? data.feature]: data.value } });
});
```

With:

```typescript
// NEW:
gep.on('new-info-update', (_event: any, gameId: number, data: any) => {
  if (gameId !== APEX_GAME_ID) return;
  handleInfoUpdate(data.feature, data.key, data.value);
});
```

- [ ] **Step 3: Rewrite `handleInfoUpdate` completely**

Replace the entire `handleInfoUpdate` function (lines 163-233) with:

```typescript
function handleInfoUpdate(feature: string, key: string, rawValue: unknown): void {
  if (!callbacks) return;

  try {
    switch (feature) {
      case 'me': {
        if (key === 'name') {
          if (typeof rawValue === 'string' && rawValue) {
            callbacks.onPlayerNameDetected(rawValue);
          }
        }
        break;
      }

      case 'game_info': {
        if (key === 'player') {
          const parsed = safeParse<{ player_name?: string }>(rawValue);
          if (parsed?.player_name) callbacks.onPlayerNameDetected(parsed.player_name);
        }
        break;
      }

      case 'match_info': {
        if (key === 'game_mode') {
          callbacks.onGameModeDetected(String(rawValue));
        } else if (key === 'tabs') {
          const tabs = safeParse<Record<string, number>>(rawValue);
          if (tabs) {
            if (tabs.kills !== undefined) callbacks.onKill(Number(tabs.kills));
            if (tabs.assists !== undefined) callbacks.onAssist(Number(tabs.assists));
            if (tabs.damage !== undefined) callbacks.onDamage(Number(tabs.damage));
            if (tabs.knockdowns !== undefined) callbacks.onKnockdown(Number(tabs.knockdowns));
          }
        } else if (key === 'map_name') {
          callbacks.onMapDetected(String(rawValue));
        }
        break;
      }

      case 'match_state': {
        if (key === 'match_state') {
          const state: MatchState = String(rawValue) === 'active' ? 'active' : 'inactive';
          callbacks.onMatchStateChange(state);
        }
        break;
      }

      case 'team': {
        if (key.startsWith('teammate')) {
          const tm = safeParse<{ name?: string; state?: string }>(rawValue);
          if (tm) {
            teammateBuffer.set(key, {
              name: tm.name ?? '',
              legend: '',
              platform: 'PC',
              state: (tm.state === 'knocked_out' ? 'knocked' : tm.state ?? 'alive') as GepTeamMember['state'],
            });
            callbacks.onTeamUpdate(Array.from(teammateBuffer.values()));
          }
        } else if (key.startsWith('legendSelect')) {
          const ls = safeParse<{ playerName?: string; legendName?: string; is_local?: boolean }>(rawValue);
          if (ls?.legendName) {
            if (ls.is_local) {
              callbacks.onLegendDetected(normalizeLegendName(ls.legendName));
            }
            for (const [tmKey, tm] of teammateBuffer) {
              if (tm.name === ls.playerName) {
                teammateBuffer.set(tmKey, { ...tm, legend: normalizeLegendName(ls.legendName) });
                callbacks.onTeamUpdate(Array.from(teammateBuffer.values()));
                break;
              }
            }
          }
        }
        break;
      }

      case 'inventory': {
        if (key === 'weapons') {
          const weapons = safeParse<Record<string, string>>(rawValue);
          if (weapons) {
            const items = Object.values(weapons).map(w => normalizeWeaponName(w));
            callbacks.onInventoryUpdate(items);
          }
        }
        break;
      }

      case 'location': {
        if (key === 'location') {
          const loc = safeParse<{ x: string | number; y: string | number; z: string | number }>(rawValue);
          if (loc) callbacks.onLocationUpdate(Number(loc.x), Number(loc.y), Number(loc.z));
        }
        break;
      }

      case 'roster': {
        if (key.startsWith('roster_')) {
          const p = safeParse<{ name?: string; team_id?: number; platform_hw?: number; isTeammate?: boolean }>(rawValue);
          if (p) {
            rosterBuffer.set(key, {
              name: p.name ?? '',
              teamId: Number(p.team_id ?? 0),
              platform: platformHwToString(p.platform_hw),
              isTeammate: Boolean(p.isTeammate),
            });
            if (rosterFlushTimer) clearTimeout(rosterFlushTimer);
            rosterFlushTimer = setTimeout(flushRoster, ROSTER_DEBOUNCE_MS);
          }
        }
        break;
      }

      case 'damage': {
        if (key === 'totalDamageDealt') {
          callbacks.onDamage(Number(rawValue));
        }
        break;
      }

      case 'match_summary': {
        if (key === 'match_summary') {
          const summary = safeParse<{ rank?: string | number; teams?: string | number; squadKills?: string | number }>(rawValue);
          if (summary) {
            callbacks.onMatchSummary({
              rank: Number(summary.rank ?? 0),
              teams: Number(summary.teams ?? 0),
              squadKills: Number(summary.squadKills ?? 0),
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error('[GEP] Error handling info update:', feature, key, error);
  }
}
```

- [ ] **Step 4: Clear buffers on match end and game exit**

Update the `cleanup` function (currently line 277-280) to also clear the buffers:

```typescript
export function cleanup(): void {
  callbacks = null;
  gepPackage = null;
  teammateBuffer.clear();
  rosterBuffer.clear();
  if (rosterFlushTimer) {
    clearTimeout(rosterFlushTimer);
    rosterFlushTimer = null;
  }
}
```

Also add buffer clearing in `setupGepListeners` inside the `game-exit` handler, so buffers reset between game sessions. After `gameRunningCallback?.(false);` (line 133), add:

```typescript
teammateBuffer.clear();
rosterBuffer.clear();
```

- [ ] **Step 5: Verify compilation**

Run: `npx webpack`
Expected: All three targets compile with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/background/gep-manager.ts
git commit -m "fix: rewrite GEP info-update handler to use (feature, key, value) routing

The ow-electron new-info-update event fires individual (feature, category,
key, value) tuples, but the handler was discarding data.key and using only
data.category. This silently broke game mode detection, map detection, team
updates, roster updates, inventory, and location tracking.

Rewrites handleInfoUpdate to route by feature+key, adds accumulation
buffers with debounce for roster data, and properly maps platform_hw codes."
```

---

### Task 2: Fix game mode normalization in main.ts

The ranked overlay hide checks `currentGameMode === 'ranked_br'`, but `onGameModeDetected` receives the raw GEP value like `#PL_Ranked_Leagues`. Must normalize before storing.

**Files:**
- Modify: `src/main/main.ts:2,336`

- [ ] **Step 1: Import parseGameMode and normalize currentGameMode**

At the top of `main.ts`, add `parseGameMode` to the import from `../shared/utils` (it's not currently imported there — there are no imports from utils in main.ts):

```typescript
import { parseGameMode } from '../shared/utils';
```

Then in the `registerCallbacks` block inside `initApp()`, update the `onGameModeDetected` callback. Currently it is:

```typescript
onGameModeDetected: (mode: string) => {
  handleGameModeDetected(mode);
  currentGameMode = mode;
},
```

Change to:

```typescript
onGameModeDetected: (mode: string) => {
  handleGameModeDetected(mode);
  currentGameMode = parseGameMode(mode);
},
```

This normalizes GEP values like `#PL_Ranked_Leagues` → `ranked_br`, making the ranked overlay check at line 318 (`currentGameMode === 'ranked_br'`) work correctly.

- [ ] **Step 2: Verify compilation**

Run: `npx webpack`
Expected: All three targets compile with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/main.ts
git commit -m "fix: normalize GEP game mode before storing for ranked overlay check"
```

---

## Verification Matrix

After both tasks, this is how each GEP feature should route:

| GEP Feature | Key | Handler Action | Previously |
|-------------|-----|---------------|------------|
| `me` | `name` | `onPlayerNameDetected(value)` | Worked by accident |
| `game_info` | `player` | `onPlayerNameDetected(parsed.player_name)` | Silently dropped |
| `match_info` | `game_mode` | `onGameModeDetected(value)` | Silently dropped |
| `match_info` | `tabs` | `onKill/onAssist/onDamage/onKnockdown` | Silently dropped |
| `match_info` | `map_name` | `onMapDetected(value)` | Silently dropped |
| `match_state` | `match_state` | `onMatchStateChange(state)` | No case existed |
| `team` | `teammate_X` | Accumulate → `onTeamUpdate(array)` | Silently dropped |
| `team` | `legendSelect_X` | `onLegendDetected` for local player | Not handled |
| `inventory` | `weapons` | `onInventoryUpdate([weapon0, weapon1])` | Silently dropped |
| `location` | `location` | `onLocationUpdate(x, y, z)` | Sent NaN values |
| `roster` | `roster_XX` | Accumulate + debounce → `onRosterUpdate(array)` | Silently dropped |
| `damage` | `totalDamageDealt` | `onDamage(value)` | No case existed |
| `match_summary` | `match_summary` | `onMatchSummary(parsed)` | No case existed |

Features that also fire as game-events (`kill`, `death`, `damage`, `match_state`, `kill_feed`, `match_summary`) continue to work through the `handleNewEvents` path as before — the info-update path now provides redundancy.
