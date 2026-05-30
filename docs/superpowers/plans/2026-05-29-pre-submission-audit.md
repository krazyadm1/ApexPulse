# Pre-Submission Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catch every remaining bug, crash path, and UI issue before submitting to Overwolf for GEP dev access — zero regressions, zero crashes, zero visual glitches.

**Architecture:** 8 independent audit tasks, each targeting one subsystem. Each task reads the code, identifies bugs, fixes them, and verifies the build compiles. A final task does a full build + package + smoke test.

**Tech Stack:** TypeScript, Electron (ow-electron), React, Zustand, Tailwind v4, better-sqlite3

---

## Audit Strategy

Overwolf will evaluate:
1. **Does it crash?** — unhandled exceptions, null access, missing modules
2. **Does GEP integration look correct?** — event handlers, feature registration, callback wiring
3. **Is the UI functional?** — pages render, navigation works, no broken layouts
4. **Does it follow ow-electron patterns?** — preload isolation, IPC channels, CMP compliance

Each task below audits one of these areas and fixes anything found.

---

### Task 1: Crash Path Audit — Main Process

**Files:**
- Read: `src/main/main.ts`
- Read: `src/background/auth/auth-server.ts`
- Read: `src/background/liveapi-client.ts`

Audit every code path in the main process for unhandled exceptions that could crash the app on startup or during runtime.

- [ ] **Step 1: Check all `require()` calls are wrapped**

Read `src/main/main.ts`. Find every `require()` call (used for `fs` in `loadSettings`, `saveSettings`, `loadOverlayPosition`, `saveOverlayPosition`). Verify each is inside a try/catch. If any `require('fs')` call is at module level (outside a function), it could crash if the module isn't available.

- [ ] **Step 2: Verify auth-server.ts handles port conflicts gracefully**

Read `src/background/auth/auth-server.ts`. Verify:
- `server.on('error', ...)` handler exists and catches `EADDRINUSE`
- The server doesn't crash the app if port 3847 is already in use
- `stopAuthServer()` checks `if (server)` before calling `server.close()`

- [ ] **Step 3: Verify liveapi-client.ts handles ws module missing**

Read `src/background/liveapi-client.ts`. The `ws` module is imported at the top level via `import { WebSocketServer } from 'ws'`. If the `ws` module is missing from the packaged app, this import will throw at module load time, BEFORE the try/catch in `startLiveApiServer()`. Verify: is `ws` in both `build.files` AND `externals` in webpack config? If the import throws, does main.ts handle it?

Fix if needed: wrap the import in a lazy require inside `startLiveApiServer()`:
```typescript
export function startLiveApiServer(): void {
  if (wss) return;
  try {
    const { WebSocketServer: WsServer } = require('ws');
    wss = new WsServer({ port: LIVEAPI_PORT, host: '127.0.0.1' });
    // ... rest of setup
```

- [ ] **Step 4: Check initApp() for unhandled async errors**

Read `src/main/main.ts` `initApp()`. It's an async function called from `app.whenReady().then(initApp)`. If `initApp` throws, the `.then()` chain has no `.catch()`. Add one:
```typescript
app.whenReady().then(initApp).catch(err => {
  console.error('[ApexPulse] Fatal init error:', err);
});
```

- [ ] **Step 5: Build and verify**

Run: `npm run build:prod`
Expected: 0 errors.

- [ ] **Step 6: Commit if changes were made**

```
fix: harden main process against startup crashes
```

---

### Task 2: GEP Integration Audit

**Files:**
- Read: `src/background/gep-manager.ts`
- Read: `src/main/main.ts` (registerCallbacks section)
- Read: `src/shared/types.ts` (GEP types)

Audit the GEP integration for correctness — this is what Overwolf will test first.

- [ ] **Step 1: Verify all GEP_FEATURES are handled**

Read `src/background/gep-manager.ts`. The `GEP_FEATURES` array lists features requested from GEP. Verify that `handleInfoUpdate` has a `case` for each feature in the array:
- `gep_internal` — no handler needed (internal)
- `me` — should handle player name
- `team` — should handle teammate updates and legend select
- `kill` — should handle kills (via game events, not info updates)
- `damage` — should handle total damage
- `death` — should handle death events (via game events)
- `revive` — should handle revive events (via game events)
- `match_state` — should handle active/inactive
- `game_info` — should handle player info
- `match_info` — should handle game_mode, tabs, map_name
- `inventory` — should handle weapons
- `location` — should handle location
- `match_summary` — should handle end-of-match summary
- `roster` — should handle roster players
- `rank` — check if handled (may not have a handler)
- `kill_feed` — should be handled via game events

Report any features that are registered but never handled.

- [ ] **Step 2: Verify GEP callback interface matches match-tracker**

Read the `GepEventCallback` type definition and compare every callback function to the corresponding handler in `src/background/match-tracker.ts`. Verify:
- Parameter types match (e.g., `onKill(kills: number)` matches `handleKill(totalKills: number)`)
- No callbacks are wired to the wrong handler in `main.ts`
- All callbacks in the type are registered in `main.ts`'s `registerCallbacks({...})` block

- [ ] **Step 3: Verify GEP game detection and feature registration**

In `setupGepListeners`, verify:
- `game-detected` event checks `gameId === APEX_GAME_ID` (21566)
- `event.enable()` is called to start tracking
- `setFeatures()` is called after game detection
- Retry logic works (retries up to `MAX_RETRIES` times with `RETRY_DELAY_MS`)
- `game-exit` event cleans up buffers and notifies game not running

- [ ] **Step 4: Verify the `rank` feature is handled or harmless**

Search `handleInfoUpdate` for a `case 'rank'` block. If missing, GEP will send rank info updates that are silently ignored. This is fine (no crash) but we should either add a handler or remove `'rank'` from `GEP_FEATURES` to avoid requesting data we don't use.

- [ ] **Step 5: Build and verify**

Run: `npm run build:prod`
Expected: 0 errors.

- [ ] **Step 6: Commit if changes were made**

```
fix: GEP integration audit fixes
```

---

### Task 3: IPC Channel Audit

**Files:**
- Read: `src/main/preload.ts`
- Read: `src/main/main.ts` (IPC handlers)
- Read: `src/background/messaging.ts` (channelMap)
- Read: `src/shared/types.ts` (MessageType)

Verify every IPC channel is consistent across preload whitelist, main process handlers, messaging bridge, and type definitions.

- [ ] **Step 1: Cross-reference send channels**

List every channel in preload's `send` whitelist. For each, verify there's a corresponding `ipcMain.on()` or `ipcMain.handle()` in `main.ts`. Report any dead channels (whitelisted but no handler) or missing channels (handler exists but not whitelisted).

- [ ] **Step 2: Cross-reference receive channels**

List every channel in preload's `on` whitelist. For each, verify it's in the `channelMap` in `messaging.ts` AND has a corresponding `MessageType` in `types.ts`. Report mismatches.

- [ ] **Step 3: Cross-reference invoke channels**

List every channel in preload's `invoke` whitelist. For each, verify there's a corresponding `ipcMain.handle()` in `main.ts`. Verify the handlers return values (not void) since invoke expects a return.

- [ ] **Step 4: Check for channels used but not whitelisted**

Search all `.tsx` files in `src/dashboard/` for `api.send(`, `api.on(`, `api.invoke(` calls. Extract the channel names used. Compare against the preload whitelists. Report any channels used by the renderer but not in the whitelist.

- [ ] **Step 5: Fix any mismatches found**

Apply fixes. Remove dead channels, add missing ones, fix type mismatches.

- [ ] **Step 6: Build and verify**

Run: `npm run build:prod`
Expected: 0 errors.

- [ ] **Step 7: Commit if changes were made**

```
fix: IPC channel consistency audit
```

---

### Task 4: UI Rendering Audit — All Pages

**Files:**
- Read all files in `src/dashboard/pages/`
- Read: `src/dashboard/App.tsx`
- Read: `src/dashboard/components/`

Verify every page renders without crashes when data is empty/null (the initial state before GEP provides data).

- [ ] **Step 1: HomePage — empty state**

Read `src/dashboard/pages/HomePage.tsx`. Verify:
- Renders correctly when `totalMatches === 0` and `profile.hasData === false` (no API data yet)
- Renders correctly when `profile.hasData === true` (API data loaded)
- The `recentMatches.slice(0, 10).map(...)` handles empty array
- StatCard renders with value "0" or "N/A" without crashing
- Profile rank section only renders when `profile.rank` exists (conditional rendering)

- [ ] **Step 2: StatsPage — empty state**

Read `src/dashboard/pages/StatsPage.tsx`. Verify:
- All stat cards show valid values when `totalMatches === 0`
- Charts show `EmptyChart` placeholder when no data
- Time range filter buttons don't overlap (verify `border border-transparent` on unselected, slash opacity on selected)
- Heirloom pack tracker renders with count 0

- [ ] **Step 3: WeaponsPage — empty state**

Read `src/dashboard/pages/WeaponsPage.tsx`. Verify:
- Empty state shows when `weaponStats.length === 0` AND no API mastery data
- API fallback view shows when `weaponStats.length === 0` AND `weaponMastery.length > 0`
- No `bg-opacity-*` or `border-opacity-*` classes remain

- [ ] **Step 4: LegendsPage — empty state**

Read `src/dashboard/pages/LegendsPage.tsx`. Verify:
- Empty state shows when no local stats AND no API legend data
- API fallback renders legend cards with icons
- Class filter buttons work on both local and API data views

- [ ] **Step 5: MapsPage — empty and loaded states**

Read `src/dashboard/pages/MapsPage.tsx`. Verify:
- Empty state shows when `rotation === null` (before API data arrives)
- Map cards render correctly when rotation data is present
- Countdown timer ticks and doesn't go negative
- Crafting section uses `formatCraftingItemName()` — not raw internal names
- Server status indicator uses nested object check (not flat)
- No duplicate `request-state` send call

- [ ] **Step 6: HistoryPage — empty state**

Read `src/dashboard/pages/HistoryPage.tsx`. Verify:
- Empty state message shows when no matches
- Timestamp is NOT multiplied by 1000
- PlacementBadge handles placement 0 gracefully (shows "?" not "#0")

- [ ] **Step 7: FaqPage, ConsentPage, WelcomePage, SettingsPage — render check**

Quickly scan each for obvious issues:
- Missing imports
- Broken JSX (unclosed tags)
- Hardcoded URLs that should be constants

- [ ] **Step 8: App.tsx — FTUE flow**

Read `src/dashboard/App.tsx`. Verify:
- Onboarding step state machine is correct: consent → welcome → login → link → apikey → done
- Each step renders the correct page component
- Skipping steps works (skip login → done, skip apikey → done)
- Error toast renders and auto-dismisses
- Post-match summary renders in bottom corner
- Rating prompt only triggers after 5 matches

- [ ] **Step 9: Fix any issues found**

- [ ] **Step 10: Build and verify**

Run: `npm run build:prod`
Expected: 0 errors.

- [ ] **Step 11: Commit if changes were made**

```
fix: UI rendering audit fixes
```

---

### Task 5: Database Schema Audit

**Files:**
- Read: `src/background/database.ts`

Verify the database schema, queries, and data flow are correct.

- [ ] **Step 1: Verify table creation**

Read the `initDatabase()` function. Check every `CREATE TABLE IF NOT EXISTS` statement:
- `matches` table has all columns that `insertMatch()` writes to
- `match_weapons` table has all columns that weapon inserts use
- `match_teammates` table has all columns that teammate inserts use
- `sessions` table has all columns that `upsertSession()` uses
- `user_accounts` table has all columns that auth uses
- `profile_snapshots` table has all required columns

- [ ] **Step 2: Verify insertMatch writes match the schema**

Read `insertMatch()`. Count the `?` placeholders in the INSERT statement. Verify the count matches the number of values passed in `.run(...)`. A mismatch = silent data loss or crash.

- [ ] **Step 3: Verify dbRowToMatchRecord mapping**

Read `dbRowToMatchRecord()`. Verify every field in `MatchRecord` is populated from the DB row. Check that JSON.parse calls for `weapon_kills`, `weapon_knockdowns`, `loadout_final`, `teammates` have try/catch (malformed JSON in DB would crash).

- [ ] **Step 4: Verify upsertUserAccount**

Read `upsertUserAccount()`. The audit found it interpolates column names from `Object.keys(partial)` directly into SQL. Verify the input only comes from internal code (auth-manager, steam-auth, discord-auth) and never from user-provided data via IPC.

- [ ] **Step 5: Fix any issues found**

- [ ] **Step 6: Build and verify**

Run: `npm run build:prod`

- [ ] **Step 7: Commit if changes were made**

```
fix: database schema audit fixes
```

---

### Task 6: Tailwind v4 Sweep — All Files

**Files:**
- All `.tsx` files in `src/dashboard/`

Do a definitive sweep for ALL remaining Tailwind v3 opacity patterns. This has been an ongoing issue with the linter reverting fixes.

- [ ] **Step 1: Search for all v3 opacity classes**

Run this search across ALL `.tsx` files in `src/dashboard/`:
```
grep -rn "bg-opacity-\|border-opacity-\|text-opacity-" src/dashboard/
```

List every match with file, line number, and the full class string.

- [ ] **Step 2: Fix every occurrence**

For each match:
- `bg-{color} bg-opacity-{N}` → `bg-{color}/{N}`
- `border-{color} border-opacity-{N}` → `border-{color}/{N}`  
- `text-{color} text-opacity-{N}` → `text-{color}/{N}`
- `hover:bg-opacity-{N}` → `hover:opacity-{N}` (when bg color is already set)

- [ ] **Step 3: Also check `.ts` files**

Search `src/` for opacity patterns in any TypeScript files that might generate class names dynamically.

- [ ] **Step 4: Build and verify**

Run: `npm run build:prod`

- [ ] **Step 5: Commit**

```
fix: eliminate all remaining Tailwind v3 opacity classes
```

---

### Task 7: Overwolf-Specific Compliance Check

**Files:**
- Read: `src/main/main.ts` (CMP, DEV endpoint)
- Read: `src/shared/constants.ts`
- Read: `package.json`
- Read: `build/uninstaller.nsh`

Verify Overwolf-specific requirements are met.

- [ ] **Step 1: CMP (Consent Management Platform)**

Read `initCmp()` in `main.ts`. Verify:
- `app.overwolf.isCMPRequired()` is called
- `app.overwolf.openCMPWindow()` is called if required
- The function has try/catch and doesn't crash if `app.overwolf` is undefined
- CMP is called BEFORE creating windows

- [ ] **Step 2: DEV vs PROD GEP endpoint**

Search `main.ts` for `owepm-packages-url`. Verify:
- It's ONLY set when `OW_DEV === 'true'`
- In production builds (no env var), the QA endpoint is NOT used
- The condition is checked BEFORE `app.whenReady()`

- [ ] **Step 3: App metadata**

Read `package.json`. Verify:
- `appId` is set to something reasonable (not a placeholder)
- `productName` is "ApexPulse"
- `author` is set
- No development-only settings leak into production config

- [ ] **Step 4: Uninstaller**

Read `build/uninstaller.nsh`. Verify:
- The survey URL is a valid URL (not a placeholder)
- The NSIS macro syntax is correct

- [ ] **Step 5: Window management**

Verify in `main.ts`:
- `setWindowOpenHandler` is set on dashboard window to open external links in browser (not in-app)
- Overlay window has `contextIsolation: true` and `nodeIntegration: false`
- Dashboard window has the same security settings

- [ ] **Step 6: Fix any issues found**

- [ ] **Step 7: Build and verify**

Run: `npm run build:prod`

- [ ] **Step 8: Commit if changes were made**

```
fix: Overwolf compliance audit fixes
```

---

### Task 8: Final Build, Package, and Smoke Test

**Files:**
- None (build verification only)

- [ ] **Step 1: Clean build**

```bash
npm run build:prod
```
Expected: 0 errors, only size warnings.

- [ ] **Step 2: Package**

```bash
npm run pack
```
Expected: `dist/win-unpacked/ApexPulse.exe` produced without errors.

- [ ] **Step 3: Verify package contents**

Check that these exist in `dist/win-unpacked/`:
- `ApexPulse.exe`
- `resources/app.asar`
- `resources/app.asar.unpacked/node_modules/better-sqlite3/`

- [ ] **Step 4: Verify no sensitive files in package**

Check that these are NOT in the packaged output:
- `.env` files
- `src/` directory (source should not be in dist)
- `node_modules/.cache/`
- Any `.map` files (should not exist in production mode)

- [ ] **Step 5: Launch and verify basic functionality**

Launch `dist/win-unpacked/ApexPulse.exe`:
1. App window opens without crash
2. Tray icon appears
3. Closing window minimizes to tray (doesn't quit)
4. Right-click tray → Quit actually exits
5. All navigation tabs render (Home, Stats, Weapons, Legends, History, Maps, FAQ, Settings)
6. Maps page shows map rotation data (API is working)
7. Home page shows career stats from API
8. Settings page shows API key field, LiveAPI instructions, Discord link
9. No error toasts appear on fresh start

- [ ] **Step 6: Commit final state**

```
chore: pre-submission audit complete — ready for Overwolf review
```

---

## Summary

| Task | Subsystem | What |
|------|-----------|------|
| 1 | Main process | Crash paths, unhandled errors, module loading |
| 2 | GEP | Feature handlers, callback wiring, game detection |
| 3 | IPC | Channel consistency across preload/main/messaging/types |
| 4 | UI | All pages render in empty and loaded states |
| 5 | Database | Schema matches queries, no SQL issues |
| 6 | Tailwind | Definitive v3→v4 opacity class sweep |
| 7 | Overwolf | CMP, DEV endpoint, metadata, security |
| 8 | Build | Clean build, package, smoke test |

## What This Does NOT Cover

- **GEP live testing** — requires Overwolf dev access (what we're submitting for)
- **LiveAPI event flow** — confirmed public servers don't emit events
- **Pack detector** — disabled, needs renderer-side reimplementation
- **Steam/Discord OAuth end-to-end** — requires API keys not yet configured
