# ApexPulse Phase 2 — Login Flow, Lobby Intel, Overlay Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining features: first-run onboarding/login flow, pre-match lobby intel, and overlay polish (hotkey, position persistence, show/hide).

**Architecture:** Same Overwolf app. Login flow is a new page in the dashboard that gates access until EA name is resolved. Lobby intel runs in the background process and broadcasts player data to the overlay. Overlay polish uses Overwolf's hotkey API and window position persistence.

**Tech Stack:** TypeScript, React 19, Zustand, Overwolf APIs (hotkeys, windows), existing backend modules

---

## File Map

### New files:
```
src/dashboard/pages/LoginPage.tsx         # First-run welcome + login/link flow
src/dashboard/pages/LinkAccountPage.tsx   # EA/Origin name entry + validation
src/background/lobby-intel.ts             # Pre-match roster → API batch lookup
```

### Modified files:
```
src/dashboard/App.tsx                     # Gate behind login, show LoginPage first
src/stores/authStore.ts                   # Add setupComplete flag
src/background/background.ts             # Wire lobby intel, register hotkey
src/background/gep-manager.ts            # Route roster events to lobby intel
src/background/match-tracker.ts          # Forward roster to lobby intel
src/background/messaging.ts              # Add LOBBY_INTEL_UPDATE message type
src/shared/types.ts                      # Add LobbyPlayer, lobby message types
src/overlay/App.tsx                       # Add lobby intel display, hotkey toggle
src/stores/liveStore.ts                  # Add lobbyPlayers state
manifest.json                           # Add hotkey declaration
```

---

## Task 1: Extend Types for Lobby Intel

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add lobby intel types to src/shared/types.ts**

Append after the existing types:

```typescript
// === Lobby Intel Types ===

export interface LobbyPlayer {
  name: string;
  platform: string;
  teamId: number;
  isTeammate: boolean;
  // Populated from API lookup
  level?: number;
  rankName?: string;
  rankScore?: number;
  kills?: number;
  kd?: number;
  selectedLegend?: string;
  loaded: boolean;
}
```

Also add `'LOBBY_INTEL_UPDATE'` to the `MessageType` union:

```typescript
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
  | 'REQUEST_STATE'
  | 'LOBBY_INTEL_UPDATE';
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add LobbyPlayer type and LOBBY_INTEL_UPDATE message"
```

---

## Task 2: Lobby Intel Module

**Files:**
- Create: `src/background/lobby-intel.ts`

- [ ] **Step 1: Create src/background/lobby-intel.ts**

This module receives roster data from GEP, batches API lookups for each player, and broadcasts results.

```typescript
import { GepRosterPlayer, LobbyPlayer, ApexApiPlayerResponse } from '../shared/types';
import { getPlayerStats } from './api-client';
import { broadcastLobbyIntel } from './messaging';

let currentLobby: LobbyPlayer[] = [];
let lookupInProgress = false;

export function getLobbyPlayers(): LobbyPlayer[] {
  return [...currentLobby];
}

export async function processRoster(roster: GepRosterPlayer[]): Promise<void> {
  // Build initial lobby list from roster
  currentLobby = roster.map(p => ({
    name: p.name,
    platform: p.platform,
    teamId: p.teamId,
    isTeammate: p.isTeammate,
    loaded: false,
  }));

  // Broadcast immediately with basic roster info
  broadcastLobbyIntel(currentLobby);

  // Don't start a new lookup if one is already running
  if (lookupInProgress) return;
  lookupInProgress = true;

  try {
    // Batch lookup — process in chunks of 3 to stay within rate limits
    // Prioritize teammates first, then sort by team
    const sorted = [...currentLobby].sort((a, b) => {
      if (a.isTeammate !== b.isTeammate) return a.isTeammate ? -1 : 1;
      return a.teamId - b.teamId;
    });

    for (const player of sorted) {
      if (!player.name) continue;

      try {
        const stats = await getPlayerStats(player.name);
        if (stats) {
          applyStatsToPlayer(player, stats);
        }
        player.loaded = true;
      } catch {
        player.loaded = true; // Mark as loaded even on failure
      }

      // Broadcast after each player loads so UI updates progressively
      broadcastLobbyIntel([...currentLobby]);
    }
  } finally {
    lookupInProgress = false;
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
  currentLobby = [];
  lookupInProgress = false;
}
```

- [ ] **Step 2: Add broadcastLobbyIntel to messaging.ts**

In `src/background/messaging.ts`, add this function alongside the other broadcast helpers:

```typescript
export function broadcastLobbyIntel<T>(payload: T): void {
  broadcast({ type: 'LOBBY_INTEL_UPDATE', payload, timestamp: Date.now() });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/background/lobby-intel.ts src/background/messaging.ts
git commit -m "feat: lobby intel — roster API lookups with progressive loading"
```

---

## Task 3: Wire Lobby Intel into Background Controller

**Files:**
- Modify: `src/background/background.ts`

- [ ] **Step 1: Import and wire lobby intel**

Add import at top of background.ts:
```typescript
import { processRoster, clearLobby } from './lobby-intel';
```

In the `registerCallbacks` call, update the `onRosterUpdate` callback from `() => {}` to:
```typescript
onRosterUpdate: (players) => {
  processRoster(players);
},
```

In the `onMatchEnd` callback, add `clearLobby()` call:
```typescript
onMatchEnd((match) => {
  onMatchPlayed(match);
  clearLobby();
  this.broadcastFullState();
});
```

- [ ] **Step 2: Commit**

```bash
git add src/background/background.ts
git commit -m "feat: wire lobby intel to GEP roster events"
```

---

## Task 4: Update LiveStore with Lobby Data

**Files:**
- Modify: `src/stores/liveStore.ts`

- [ ] **Step 1: Add lobbyPlayers to liveStore**

Add `LobbyPlayer` import from types. Add to the interface:
```typescript
lobbyPlayers: LobbyPlayer[];
```

Add default in create:
```typescript
lobbyPlayers: [],
```

Add message listener in init():
```typescript
onMessage('LOBBY_INTEL_UPDATE', (msg: WindowMessage) => {
  const players = msg.payload as LobbyPlayer[];
  set({ lobbyPlayers: players });
});
```

Reset lobbyPlayers when match ends (in the existing MATCH_ENDED handler):
```typescript
onMessage('MATCH_ENDED', () => {
  set({ isLive: false, matchState: 'idle', lobbyPlayers: [] });
});
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/liveStore.ts
git commit -m "feat: add lobby players to live store"
```

---

## Task 5: Lobby Intel Overlay Display

**Files:**
- Modify: `src/overlay/App.tsx`

- [ ] **Step 1: Update overlay to show lobby intel**

Read the current overlay App.tsx first. Add lobbyPlayers to the destructured state from useLiveStore.

When `matchState === 'legend_select'` and lobbyPlayers has data, show a lobby intel panel instead of (or in addition to) the regular live stats:

```tsx
// After the existing live match display, add lobby intel section
{lobbyPlayers.length > 0 && matchState !== 'in_match' && (
  <div className="mt-2 bg-apex-dark bg-opacity-80 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
    <div className="px-3 py-1 border-b border-white/10">
      <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Lobby Intel</span>
    </div>
    <div className="max-h-64 overflow-y-auto">
      {lobbyPlayers
        .filter(p => !p.isTeammate)
        .slice(0, 20)
        .map((player, i) => (
          <div key={i} className="flex justify-between items-center px-3 py-1 text-[10px] border-b border-white/5">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-white truncate max-w-[100px]">{player.name}</span>
              {player.rankName && (
                <span className="text-gray-500 truncate">{player.rankName}</span>
              )}
            </div>
            <div className="flex space-x-3 text-gray-400 font-mono shrink-0">
              {player.loaded ? (
                <>
                  {player.level && <span>Lv{player.level}</span>}
                  {player.kills !== undefined && <span>{player.kills.toLocaleString()}K</span>}
                </>
              ) : (
                <span className="text-gray-600">...</span>
              )}
            </div>
          </div>
        ))}
    </div>
  </div>
)}
```

Also show teammate intel prominently when in legend_select:

```tsx
{lobbyPlayers.length > 0 && lobbyPlayers.filter(p => p.isTeammate).length > 0 && matchState !== 'in_match' && (
  <div className="mt-2 bg-apex-dark bg-opacity-80 backdrop-blur-md border border-apex-cyan/20 rounded-lg overflow-hidden">
    <div className="px-3 py-1 border-b border-apex-cyan/10">
      <span className="text-[10px] font-bold tracking-widest text-apex-cyan uppercase">Your Squad</span>
    </div>
    {lobbyPlayers.filter(p => p.isTeammate).map((tm, i) => (
      <div key={i} className="flex justify-between items-center px-3 py-1.5 text-[11px]">
        <span className="text-white font-medium">{tm.name}</span>
        <div className="flex space-x-3 text-gray-400 font-mono">
          {tm.loaded ? (
            <>
              {tm.level && <span>Lv{tm.level}</span>}
              {tm.rankName && <span>{tm.rankName}</span>}
              {tm.kills !== undefined && <span>{tm.kills.toLocaleString()}K</span>}
            </>
          ) : (
            <span className="text-gray-600">Loading...</span>
          )}
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/overlay/App.tsx
git commit -m "feat: lobby intel display in overlay — squad + enemy stats"
```

---

## Task 6: Overlay Hotkey & Position Persistence

**Files:**
- Modify: `manifest.json`
- Modify: `src/background/background.ts`
- Modify: `src/overlay/App.tsx`

- [ ] **Step 1: Add hotkey to manifest.json**

Add a `hotkeys` section inside `data`:

```json
"hotkeys": {
  "toggle_overlay": {
    "title": "Toggle Overlay",
    "action-type": "toggle",
    "default": "Shift+F1",
    "passthrough": true
  }
}
```

- [ ] **Step 2: Register hotkey handler in background.ts**

Add to the init() method, after the openDashboard() call:

```typescript
this.registerHotkeys();
```

Add the method to BackgroundController:

```typescript
private registerHotkeys(): void {
  overwolf.settings.hotkeys.onPressed.addListener((event: overwolf.settings.hotkeys.OnPressedEvent) => {
    if (event.name === 'toggle_overlay') {
      this.toggleOverlay();
    }
  });
}

private toggleOverlay(): void {
  overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
    if (!result.success) return;
    const windowId = result.window.id;
    if (result.window.isVisible) {
      overwolf.windows.hide(windowId, () => {});
    } else {
      overwolf.windows.restore(windowId, () => {});
    }
  });
}
```

- [ ] **Step 3: Add position persistence to overlay**

In the overlay App.tsx, add a useEffect that saves window position on move/resize and restores on mount:

```typescript
React.useEffect(() => {
  // Restore saved position
  const saved = localStorage.getItem('apexpulse_overlay_pos');
  if (saved) {
    try {
      const pos = JSON.parse(saved);
      overwolf.windows.getCurrentWindow((result) => {
        if (result.success) {
          overwolf.windows.changePosition(result.window.id, pos.left, pos.top, () => {});
        }
      });
    } catch {}
  }

  // Save position when window moves
  const savePosition = () => {
    overwolf.windows.getCurrentWindow((result) => {
      if (result.success) {
        const { left, top } = result.window;
        localStorage.setItem('apexpulse_overlay_pos', JSON.stringify({ left, top }));
      }
    });
  };

  // Periodic position save (Overwolf doesn't have a move event for in-game windows)
  const interval = setInterval(savePosition, 5000);
  return () => clearInterval(interval);
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add manifest.json src/background/background.ts src/overlay/App.tsx
git commit -m "feat: overlay hotkey toggle (Shift+F1) and position persistence"
```

---

## Task 7: Login/Onboarding Flow

**Files:**
- Create: `src/dashboard/pages/LoginPage.tsx`
- Create: `src/dashboard/pages/LinkAccountPage.tsx`
- Modify: `src/dashboard/App.tsx`
- Modify: `src/stores/authStore.ts`

- [ ] **Step 1: Update authStore with setupComplete flag**

In `src/stores/authStore.ts`, add:

```typescript
setupComplete: boolean;
```

Initialize as:
```typescript
setupComplete: false,
```

In init(), also check localStorage for setup state:
```typescript
const setupDone = localStorage.getItem('apexpulse_setup_complete');
if (setupDone === 'true') {
  set({ setupComplete: true });
}
```

Add to AUTH_STATE_CHANGE handler — if account has originName, mark setup complete:
```typescript
if (account?.originName) {
  localStorage.setItem('apexpulse_setup_complete', 'true');
  set({ setupComplete: true });
}
```

Add a completeSetup action:
```typescript
completeSetup: () => {
  localStorage.setItem('apexpulse_setup_complete', 'true');
  set({ setupComplete: true });
},
```

- [ ] **Step 2: Create src/dashboard/pages/LoginPage.tsx**

Welcome screen with login options:

```tsx
import React from 'react';

interface LoginPageProps {
  onLogin: (method: 'steam' | 'discord' | 'skip') => void;
  onManualLink: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onManualLink }) => {
  return (
    <div className="flex items-center justify-center h-screen bg-apex-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-apex-cyan tracking-tighter mb-2">APEX PULSE</h1>
          <p className="text-gray-400">The Apex Legends tracker that works.</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onLogin('steam')}
            className="w-full flex items-center justify-center gap-3 bg-apex-navy border border-white/10 rounded-lg px-6 py-3 hover:bg-white/5 transition-colors"
          >
            <span className="text-lg">🎮</span>
            <span className="font-medium">Sign in with Steam</span>
          </button>

          <button
            onClick={() => onLogin('discord')}
            className="w-full flex items-center justify-center gap-3 bg-apex-navy border border-white/10 rounded-lg px-6 py-3 hover:bg-white/5 transition-colors"
          >
            <span className="text-lg">💬</span>
            <span className="font-medium">Sign in with Discord</span>
          </button>

          <button
            onClick={onManualLink}
            className="w-full flex items-center justify-center gap-3 bg-apex-navy border border-white/10 rounded-lg px-6 py-3 hover:bg-white/5 transition-colors"
          >
            <span className="text-lg">🎯</span>
            <span className="font-medium">Enter EA/Origin Name Manually</span>
          </button>

          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={() => onLogin('skip')}
            className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/5 rounded-lg px-6 py-3 hover:bg-white/10 transition-colors text-gray-400"
          >
            <span>Skip — Just launch Apex and we'll detect your account</span>
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Your data stays local. No account needed.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
```

- [ ] **Step 3: Create src/dashboard/pages/LinkAccountPage.tsx**

Manual EA name entry with API validation:

```tsx
import React, { useState } from 'react';

interface LinkAccountPageProps {
  onLinked: () => void;
  onSkip: () => void;
}

const LinkAccountPage: React.FC<LinkAccountPageProps> = ({ onLinked, onSkip }) => {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleValidate = async () => {
    if (!name.trim()) return;
    setStatus('validating');
    setErrorMsg('');

    try {
      const bgWindow = overwolf.windows.getMainWindow();
      const linkFn = (bgWindow as unknown as { linkOriginManual?: (n: string) => Promise<boolean> }).linkOriginManual;
      if (linkFn) {
        const success = await linkFn(name.trim());
        if (success) {
          setStatus('success');
          setTimeout(onLinked, 1000);
        } else {
          setStatus('error');
          setErrorMsg('Could not find that EA/Origin name. Check spelling and try again.');
        }
      } else {
        setStatus('error');
        setErrorMsg('Background service not ready. Try again in a moment.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-apex-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Link Your EA Account</h2>
          <p className="text-gray-400">
            We need your EA/Origin username to pull your Apex Legends stats from the API.
          </p>
        </div>

        <div className="glass-card space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">EA/Origin Username</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              placeholder="Your EA ID"
              className="bg-apex-dark border border-white/10 rounded-lg px-4 py-3 text-white w-full focus:border-apex-cyan focus:outline-none text-lg"
              disabled={status === 'validating'}
            />
          </div>

          <p className="text-gray-500 text-xs">
            Not sure? Open the EA App, go to your Profile — your EA ID is shown at the top.
          </p>

          {status === 'error' && (
            <p className="text-red-400 text-sm">{errorMsg}</p>
          )}

          {status === 'success' && (
            <p className="text-green-400 text-sm font-medium">Account linked! Loading your stats...</p>
          )}

          <button
            onClick={handleValidate}
            disabled={status === 'validating' || !name.trim()}
            className="w-full bg-apex-cyan text-apex-dark font-bold px-6 py-3 rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'validating' ? 'Validating...' : 'Validate & Continue'}
          </button>
        </div>

        <div className="text-center mt-6">
          <div className="flex items-center gap-4 py-2 mb-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <p className="text-gray-400 text-sm mb-3">
            Launch Apex Legends and we'll detect your EA name automatically.
          </p>
          <button
            onClick={onSkip}
            className="text-apex-cyan text-sm hover:underline"
          >
            Skip for now — detect on next Apex launch
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkAccountPage;
```

- [ ] **Step 4: Update App.tsx to gate behind login**

Modify `src/dashboard/App.tsx` to show LoginPage/LinkAccountPage when setup isn't complete:

```tsx
import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import LoginPage from './pages/LoginPage';
import LinkAccountPage from './pages/LinkAccountPage';
import HomePage from './pages/HomePage';
import StatsPage from './pages/StatsPage';
import WeaponsPage from './pages/WeaponsPage';
import LegendsPage from './pages/LegendsPage';
import HistoryPage from './pages/HistoryPage';
import MapsPage from './pages/MapsPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'Home' | 'Stats' | 'Weapons' | 'Legends' | 'History' | 'Maps' | 'Settings';

const NAV_ITEMS: Page[] = ['Home', 'Stats', 'Weapons', 'Legends', 'History', 'Maps', 'Settings'];

const PAGE_COMPONENTS: Record<Page, React.FC> = {
  Home: HomePage,
  Stats: StatsPage,
  Weapons: WeaponsPage,
  Legends: LegendsPage,
  History: HistoryPage,
  Maps: MapsPage,
  Settings: SettingsPage,
};

const App: React.FC = () => {
  const { setupComplete, completeSetup } = useAuthStore();
  const [activePage, setActivePage] = useState<Page>('Home');
  const [onboardStep, setOnboardStep] = useState<'login' | 'link' | 'done'>(
    setupComplete ? 'done' : 'login'
  );

  // Handle login choice
  const handleLogin = (method: 'steam' | 'discord' | 'skip') => {
    if (method === 'skip') {
      completeSetup();
      setOnboardStep('done');
      return;
    }

    try {
      const bgWindow = overwolf.windows.getMainWindow();
      if (method === 'steam') {
        (bgWindow as unknown as { loginSteam?: () => void }).loginSteam?.();
      } else {
        (bgWindow as unknown as { loginDiscord?: () => void }).loginDiscord?.();
      }
    } catch {}

    // After OAuth redirect, user will need to link EA name
    setOnboardStep('link');
  };

  const handleLinked = () => {
    completeSetup();
    setOnboardStep('done');
  };

  const handleSkipLink = () => {
    completeSetup();
    setOnboardStep('done');
  };

  // Show onboarding if not complete
  if (onboardStep === 'login') {
    return <LoginPage onLogin={handleLogin} onManualLink={() => setOnboardStep('link')} />;
  }

  if (onboardStep === 'link') {
    return <LinkAccountPage onLinked={handleLinked} onSkip={handleSkipLink} />;
  }

  // Main app
  const ActiveComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="flex h-screen bg-apex-dark text-white">
      <aside className="w-64 bg-apex-navy border-r border-white/10 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-apex-cyan tracking-tighter cursor-pointer" onClick={() => setActivePage('Home')}>
            APEX PULSE
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              onClick={() => setActivePage(item)}
              className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                activePage === item ? 'bg-apex-cyan/10 text-apex-cyan' : 'hover:bg-white/5 text-gray-300'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="p-4 text-xs text-gray-600">
          ApexPulse v1.0.0
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <ActiveComponent />
      </main>
    </div>
  );
};

export default App;
```

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/pages/LoginPage.tsx src/dashboard/pages/LinkAccountPage.tsx src/dashboard/App.tsx src/stores/authStore.ts
git commit -m "feat: login/onboarding flow — Steam, Discord, manual EA entry, skip option"
```

---

## Task 8: Build Verification

- [ ] **Step 1: Run webpack build**

```bash
cd G:\Projects\Apex && npx webpack
```

Expected: Clean build with no errors.

- [ ] **Step 2: Fix any TypeScript errors**

Iterate until build passes.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve build errors from phase 2 features"
```
