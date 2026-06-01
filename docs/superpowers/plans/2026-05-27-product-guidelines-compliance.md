# Product Guidelines Compliance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining Overwolf Product Guidelines compliance issues found in audit.

**Architecture:** Fourteen independent tasks covering: DEV flag removal (critical blocker), reassignable hotkeys, user-facing error states, empty states, FAQ section, GEP event status checking, welcome/intro screen, tooltips, post-match summary, rating prompt, coach marks, second screen auto-launch, and uninstall survey. Each task is self-contained.

**Tech Stack:** React/TypeScript, Electron (ow-electron), Tailwind CSS, Zustand

---

## Audit Summary

| Issue | Severity | Task |
|-------|----------|------|
| DEV environment QA URL hardcoded in main.ts — **will break PROD release** | CRITICAL | Task 1 |
| Hotkey not reassignable — guidelines say "provide a method of reassigning" | HIGH | Task 2 |
| No user-facing error communication — API/GEP/network failures are silent | HIGH | Task 3 |
| WeaponsPage and MapsPage missing empty states | MEDIUM | Task 4 |
| No FAQ section — recommended for support | MEDIUM | Task 5 |
| No GEP event status checking — recommended for service disruptions | MEDIUM | Task 6 |
| No welcome/intro screen — FTUE should showcase features | MEDIUM | Task 7 |
| No tooltips on complex UI elements | LOW | Task 8 |
| No post-match summary popup | LOW | Task 9 |
| No rating prompt after engagement | LOW | Task 10 |
| No coach marks for first-time feature discovery | LOW | Task 11 |
| Second screen overlay doesn't auto-launch | LOW | Task 12 |
| No uninstall survey | LOW | Task 13 |

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/main/main.ts` | Modify | Remove DEV flag, add hotkey reassignment IPC, add error broadcast |
| `src/main/preload.ts` | Modify | Add hotkey channels |
| `src/shared/types.ts` | Modify | Add hotkey to AppSettings if needed |
| `src/stores/settingsStore.ts` | Modify | Handle hotkey updates |
| `src/dashboard/pages/SettingsPage.tsx` | Modify | Reassignable hotkey UI, FAQ link |
| `src/dashboard/pages/WeaponsPage.tsx` | Modify | Add empty state |
| `src/dashboard/pages/MapsPage.tsx` | Modify | Add empty state for API errors |
| `src/dashboard/pages/WelcomePage.tsx` | Create | Feature showcase intro screen |
| `src/dashboard/pages/FaqPage.tsx` | Create | FAQ section |
| `src/dashboard/App.tsx` | Modify | Add welcome step, FAQ nav, error toast, post-match toast, rating prompt |
| `src/dashboard/components/Tooltip.tsx` | Create | Reusable tooltip wrapper component |
| `src/dashboard/components/PostMatchSummary.tsx` | Create | Post-match stats popup |
| `src/dashboard/components/RatingPrompt.tsx` | Create | Rating prompt modal |
| `src/dashboard/components/CoachMark.tsx` | Create | Dismissible coach mark component |

---

### Task 1: Remove DEV Environment Flag (CRITICAL)

**This is a release blocker.** Line 401 of `main.ts` hardcodes the QA/DEV packages URL. The Overwolf docs explicitly say: "you need to remove the command line argument `--owepm-packages-url` from your app" before going to PROD.

**Files:**
- Modify: `src/main/main.ts:401`

- [ ] **Step 1: Condition the DEV flag on an environment variable**

Replace line 401:

```typescript
(app as any).commandLine.appendSwitch('owepm-packages-url', 'https://electronapi-qa.overwolf.com/packages');
```

With:

```typescript
if (process.env.OW_DEV === 'true') {
  (app as any).commandLine.appendSwitch('owepm-packages-url', 'https://electronapi-qa.overwolf.com/packages');
}
```

This way the QA endpoint is only used when explicitly running with `OW_DEV=true`. Production builds will use the default PROD endpoint.

- [ ] **Step 2: Add a dev start script to package.json**

Add to scripts:

```json
"start:dev": "cross-env OW_DEV=true ow-electron dist/main.js"
```

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/main/main.ts package.json
git commit -m "fix: condition GEP DEV endpoint on OW_DEV env var — remove for PROD"
```

---

### Task 2: Reassignable Hotkeys

The guidelines explicitly state: "You should provide users a method to assign/reassign their hotkeys directly from within your app." Currently the hotkey is hardcoded as `Shift+F1` in `main.ts:181` via `globalShortcut.register` and displayed read-only in Settings.

**Files:**
- Modify: `src/main/main.ts` (hotkey registration, IPC handler)
- Modify: `src/main/preload.ts` (add channel)
- Modify: `src/shared/types.ts` (already has `overlayHotkey` in AppSettings)
- Modify: `src/dashboard/pages/SettingsPage.tsx` (editable hotkey UI)

- [ ] **Step 1: Make hotkey registration use saved settings**

In `src/main/main.ts`, update `registerHotkeys()` to use the saved hotkey instead of hardcoded `Shift+F1`:

```typescript
function registerHotkeys(): void {
  const settings = loadSettings();
  const hotkey = settings.overlayHotkey || 'Shift+F1';
  
  globalShortcut.unregisterAll();
  
  const success = globalShortcut.register(hotkey, () => {
    if (!overlayWindow) return;
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
    }
  });
  
  if (!success) {
    console.warn(`[ApexPulse] Failed to register hotkey: ${hotkey}`);
  }
}
```

- [ ] **Step 2: Add IPC handler for hotkey changes**

In `setupIpcHandlers()` inside `main.ts`, update the `update-settings` handler to re-register hotkeys when the hotkey changes:

```typescript
ipcMain.on('update-settings', (_event: unknown, ...args: unknown[]) => {
  const settings = args[0] as Partial<AppSettings>;
  saveSettings(settings);
  if (settings.apiKey !== undefined) {
    setApiKey(settings.apiKey);
    startPolling(settings.pollIntervalMs ?? API_POLL_INTERVAL_MS);
  }
  if (settings.overlayHotkey !== undefined) {
    registerHotkeys();
  }
  broadcast('settings-update', settings);
});
```

- [ ] **Step 3: Make hotkey editable in SettingsPage**

In `src/dashboard/pages/SettingsPage.tsx`, replace the read-only hotkey display with an editable input that captures key combinations:

Replace the hotkey section (the `<div>` with "Toggle Overlay Hotkey") with:

```tsx
{/* Hotkey reassignment */}
<div className="flex flex-col gap-2">
  <div className="flex items-center justify-between">
    <span className="text-white/60 text-sm font-mono">Toggle Overlay Hotkey</span>
    <div className="flex items-center gap-2">
      <button
        onKeyDown={(e) => {
          e.preventDefault();
          const parts: string[] = [];
          if (e.ctrlKey) parts.push('Ctrl');
          if (e.shiftKey) parts.push('Shift');
          if (e.altKey) parts.push('Alt');
          const key = e.key;
          if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
            parts.push(key.length === 1 ? key.toUpperCase() : key);
            const combo = parts.join('+');
            updateSettings({ overlayHotkey: combo });
          }
        }}
        className="bg-apex-dark border border-white/20 rounded px-4 py-1.5 text-apex-cyan font-mono text-sm tracking-widest focus:border-apex-cyan focus:outline-none focus:ring-1 focus:ring-apex-cyan cursor-pointer min-w-[120px] text-center"
        title="Click and press a key combination to reassign"
      >
        {overlayHotkey || 'Not set'}
      </button>
      <span className="text-white/30 text-xs">Click & press new keys</span>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Verify compilation**

Run: `npx webpack`

- [ ] **Step 5: Commit**

```bash
git add src/main/main.ts src/dashboard/pages/SettingsPage.tsx
git commit -m "feat: make overlay hotkey reassignable from Settings"
```

---

### Task 3: User-Facing Error Communication

The guidelines say: "identify the most common potential failure points in your app and implement targeted error or status messages." Currently all errors are console.log only. Users see nothing when the API fails, GEP can't connect, or network is down.

**Files:**
- Modify: `src/main/main.ts` (broadcast errors to renderer)
- Modify: `src/main/preload.ts` (add error channel)
- Modify: `src/dashboard/App.tsx` (show error toast)

- [ ] **Step 1: Add error broadcast channel to preload**

In `src/main/preload.ts`, add `'app-error'` to the `validChannels` array in the `on` method:

```typescript
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
  'overlay-auto-hidden',
  'app-error',
];
```

- [ ] **Step 2: Broadcast errors from main process**

In `src/main/main.ts`, add a helper function:

```typescript
function broadcastError(code: string, message: string): void {
  broadcast('app-error', { code, message, timestamp: Date.now() });
}
```

Then add error broadcasts to key failure points:

In `startPolling` — the `poll` function, wrap the API calls:

```typescript
const poll = async () => {
  const originName = getOriginName();
  if (!originName) return;

  try {
    const stats = await getPlayerStats(originName);
    if (stats) broadcast('profile-update', stats);
  } catch {
    broadcastError('api_stats', 'Could not fetch player stats. Check your API key and connection.');
  }

  try {
    const maps = await getMapRotation();
    const servers = await getServerStatus();
    const serversOnline = servers ? Object.values(servers).every(r => r.Status === 'UP') : true;
    if (maps) broadcast('map-rotation-update', { rotation: maps, serversOnline });
  } catch {
    broadcastError('api_maps', 'Could not fetch map rotation. Will retry shortly.');
  }
};
```

In `initApp` — after GEP init, broadcast if GEP is unavailable:

```typescript
const gepStatus = {
  overwolf: !!owApp.overwolf,
  packages: !!owApp.overwolf?.packages,
  gep: !!owApp.overwolf?.packages?.gep,
};
if (!gepStatus.gep) {
  setTimeout(() => {
    broadcastError('gep_unavailable', 'Game events not available. Live tracking requires the Overwolf platform.');
  }, 3000);
}
```

- [ ] **Step 3: Add error toast component to App.tsx**

In `src/dashboard/App.tsx`, add a simple error toast that auto-dismisses:

Add state and listener at the top of the `App` component:

```typescript
const [errorToast, setErrorToast] = useState<string | null>(null);

React.useEffect(() => {
  const api = (window as unknown as { apexPulse?: { on: (ch: string, cb: (...args: unknown[]) => void) => void } }).apexPulse;
  if (!api) return;
  api.on('app-error', (data: unknown) => {
    const err = data as { message: string };
    setErrorToast(err.message);
    setTimeout(() => setErrorToast(null), 8000);
  });
}, []);
```

Add the toast render right inside the main layout div, at the top:

```tsx
{errorToast && (
  <div className="fixed top-4 right-4 z-50 max-w-sm bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 flex items-start gap-3 shadow-lg">
    <span className="shrink-0 mt-0.5">!</span>
    <span>{errorToast}</span>
    <button onClick={() => setErrorToast(null)} className="shrink-0 text-red-400/60 hover:text-red-400 ml-auto">&times;</button>
  </div>
)}
```

- [ ] **Step 4: Verify compilation**

Run: `npx webpack`

- [ ] **Step 5: Commit**

```bash
git add src/main/main.ts src/main/preload.ts src/dashboard/App.tsx
git commit -m "feat: broadcast user-facing error toasts for API/GEP failures"
```

---

### Task 4: Empty States for WeaponsPage and MapsPage

The guidelines emphasize empty states for all screens. WeaponsPage has no empty state when there's no weapon data. MapsPage has no empty state when the API fails or no key is configured.

**Files:**
- Modify: `src/dashboard/pages/WeaponsPage.tsx`
- Modify: `src/dashboard/pages/MapsPage.tsx`

- [ ] **Step 1: Add empty state to WeaponsPage**

In `src/dashboard/pages/WeaponsPage.tsx`, find where the weapon data table is rendered. If `weaponStats` (from `useMatchStore`) is empty, show an empty state before the table:

Add after the page header, before the table/chart content:

```tsx
{weaponData.length === 0 && (
  <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
    <div className="text-4xl mb-4 opacity-40">🔫</div>
    <p className="text-white font-mono font-semibold text-base">No weapon data yet</p>
    <p className="text-white/40 text-sm mt-1">Play some matches and your weapon stats will appear here.</p>
  </div>
)}
```

- [ ] **Step 2: Add empty/error state to MapsPage**

In `src/dashboard/pages/MapsPage.tsx`, check if map rotation data is null/empty. If so, show a helpful empty state:

```tsx
{!rotation && (
  <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
    <div className="text-4xl mb-4 opacity-40">🗺️</div>
    <p className="text-white font-mono font-semibold text-base">Map rotation unavailable</p>
    <p className="text-white/40 text-sm mt-1">
      {apiKey ? 'Could not fetch map data. Will retry automatically.' : 'Add your API key in Settings to see map rotations.'}
    </p>
  </div>
)}
```

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/pages/WeaponsPage.tsx src/dashboard/pages/MapsPage.tsx
git commit -m "feat: add empty states to WeaponsPage and MapsPage"
```

---

### Task 5: FAQ Page

The guidelines say an FAQ section is essential for in-app support: "Instant user support — users can find answers without needing to contact customer support."

**Files:**
- Create: `src/dashboard/pages/FaqPage.tsx`
- Modify: `src/dashboard/App.tsx` (add to nav)

- [ ] **Step 1: Create FaqPage component**

Create `src/dashboard/pages/FaqPage.tsx` with collapsible FAQ items:

```tsx
import React, { useState } from 'react';

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left hover:text-apex-cyan transition-colors"
      >
        <span className="text-white/90 text-sm font-medium pr-4">{question}</span>
        <span className="text-white/40 shrink-0 text-lg">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="pb-4 text-white/50 text-sm leading-relaxed">{answer}</div>
      )}
    </div>
  );
}

const FAQ_ITEMS: FaqItemProps[] = [
  {
    question: 'How does ApexPulse track my matches?',
    answer: 'ApexPulse uses the Overwolf Game Events Provider (GEP) to detect game events in real time. When Apex Legends is running, GEP captures kills, damage, placement, and other match data automatically.',
  },
  {
    question: 'Do I need an API key?',
    answer: 'An API key from apexlegendsapi.com is optional but recommended. It enables player profile stats, map rotations, and server status on the dashboard. Without it, live match tracking still works via GEP.',
  },
  {
    question: 'Is my data sent to any server?',
    answer: 'No. All match data, settings, and account info are stored locally on your computer in a SQLite database. The only external calls are to the Apex Legends Status API (for stats/maps) and Steam/Discord (for optional login).',
  },
  {
    question: 'Why isn\'t the overlay showing?',
    answer: 'Press Shift+F1 (or your custom hotkey) to toggle the overlay. Make sure Apex Legends is running and the overlay is enabled in Settings. If Apex is running as administrator, ApexPulse may also need to run as admin.',
  },
  {
    question: 'Why are my stats not updating?',
    answer: 'Stats come from the Overwolf GEP service. If the service is temporarily down due to a game update, stats may not track. Check your internet connection and ensure Apex is running in fullscreen borderless or windowed mode.',
  },
  {
    question: 'How does the heirloom pack tracker work?',
    answer: 'ApexPulse uses screen capture and OCR to detect when you open Apex Packs. It only scans a small area of the screen and only while you\'re not in a match. You can also manually set your pack count in Settings.',
  },
  {
    question: 'Can I get banned for using ApexPulse?',
    answer: 'No. ApexPulse runs on the Overwolf platform, which is approved by Respawn Entertainment. The app only reads game data — it never modifies game files or injects code.',
  },
  {
    question: 'How do I report a bug?',
    answer: 'Head to the #support channel in our Discord server. You can join from the sidebar or from Settings > Community & Support.',
  },
];

export default function FaqPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-white font-bold text-2xl tracking-wide">FAQ</h1>
        <p className="text-white/40 text-sm mt-1">Frequently asked questions about ApexPulse</p>
      </div>

      <div className="glass-card p-6">
        {FAQ_ITEMS.map((item, i) => (
          <FaqItem key={i} question={item.question} answer={item.answer} />
        ))}
      </div>

      <div className="glass-card p-6 flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">Still have questions?</p>
          <p className="text-white/40 text-xs">Get help from the community</p>
        </div>
        <a
          href="https://discord.gg/Pfd6ScNaSW"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] font-bold px-5 py-2 rounded-lg hover:bg-[#5865F2]/20 text-sm"
        >
          Join Discord
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add FAQ to navigation in App.tsx**

In `src/dashboard/App.tsx`:

1. Import: `import FaqPage from './pages/FaqPage';`
2. Add `'FAQ'` to the `Page` type: `type Page = 'Home' | 'Stats' | 'Weapons' | 'Legends' | 'History' | 'Maps' | 'FAQ' | 'Settings';`
3. Add to `NAV_ITEMS` array (before Settings): `const NAV_ITEMS: Page[] = ['Home', 'Stats', 'Weapons', 'Legends', 'History', 'Maps', 'FAQ', 'Settings'];`
4. Add to `PAGE_COMPONENTS`: `FAQ: FaqPage,`

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/pages/FaqPage.tsx src/dashboard/App.tsx
git commit -m "feat: add FAQ page with common questions and Discord support link"
```

---

### Task 6: GEP Event Status Checking

The guidelines say: "integrate Event Status Endpoints into your app" to monitor event health and communicate disruptions. Overwolf provides a public API for this.

**Files:**
- Modify: `src/background/api-client.ts` (add status endpoint call)
- Modify: `src/main/main.ts` (check status periodically, broadcast warnings)

- [ ] **Step 1: Add GEP status check to api-client**

In `src/background/api-client.ts`, add a function to check GEP event status:

```typescript
export async function getGepEventStatus(): Promise<Record<string, string> | null> {
  try {
    const response = await axios.get('https://game-events-status.overwolf.com/gamestatus/21566_prod', {
      timeout: 5000,
    });
    return response.data;
  } catch {
    return null;
  }
}
```

Note: The exact Overwolf event status API URL may vary. The pattern is typically `https://game-events-status.overwolf.com/gamestatus/{gameId}_prod`. Check Overwolf's docs for the current endpoint.

- [ ] **Step 2: Add periodic status check in main.ts**

In `src/main/main.ts`, import `getGepEventStatus` and add a status check in the polling loop or as a separate interval:

```typescript
async function checkGepStatus(): Promise<void> {
  try {
    const { getGepEventStatus } = require('../background/api-client');
    const status = await getGepEventStatus();
    if (status && typeof status === 'object') {
      const downFeatures = Object.entries(status)
        .filter(([, v]) => v !== 'good' && v !== 'up')
        .map(([k]) => k);
      if (downFeatures.length > 0) {
        broadcastError('gep_status', `Some game events may be unavailable: ${downFeatures.join(', ')}. This is a known issue and will be resolved.`);
      }
    }
  } catch { /* ignore */ }
}
```

Call it once during `initApp()` after GEP init, and optionally on a longer interval (e.g., every 5 minutes).

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/background/api-client.ts src/main/main.ts
git commit -m "feat: check GEP event status and warn users of service disruptions"
```

---

### Task 7: Welcome/Intro Screen in FTUE

The guidelines say: "An app introduction is a simple welcome screen that presents the app's core value added proposition and main features." Currently the FTUE goes Consent -> Login -> Link -> API Key. A welcome screen should come after consent but before login.

**Files:**
- Create: `src/dashboard/pages/WelcomePage.tsx`
- Modify: `src/dashboard/App.tsx` (add welcome step)

- [ ] **Step 1: Create WelcomePage component**

Create `src/dashboard/pages/WelcomePage.tsx`:

```tsx
import React from 'react';

interface WelcomePageProps {
  onContinue: () => void;
}

const FEATURES = [
  { icon: '📊', title: 'Live Match Tracking', desc: 'Kills, damage, and placement captured in real-time via GEP' },
  { icon: '🎯', title: 'Weapon & Legend Stats', desc: 'See which weapons and legends give you the best results' },
  { icon: '🗺️', title: 'Map Rotations', desc: 'Current and upcoming maps for BR and Ranked at a glance' },
  { icon: '👁️', title: 'In-Game Overlay', desc: 'Live stats overlay — toggle with a hotkey during matches' },
  { icon: '🔍', title: 'Lobby Intel', desc: 'Scout player stats in your lobby before the match starts' },
  { icon: '📦', title: 'Heirloom Tracker', desc: 'Auto-detect pack openings and track your progress to 500' },
];

const WelcomePage: React.FC<WelcomePageProps> = ({ onContinue }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-apex-dark p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-apex-cyan tracking-tighter mb-2">APEX PULSE</h1>
          <p className="text-gray-400">The Apex Legends tracker that actually works.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-apex-navy border border-white/10 rounded-lg p-4">
              <div className="text-xl mb-2">{f.icon}</div>
              <div className="text-white text-sm font-semibold mb-1">{f.title}</div>
              <div className="text-white/40 text-xs leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onContinue}
          className="w-full bg-apex-cyan text-apex-dark font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-colors"
        >
          Get Started
        </button>

        <p className="text-center text-gray-600 text-xs mt-4">
          All your data stays local. No account required.
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;
```

- [ ] **Step 2: Wire WelcomePage into FTUE in App.tsx**

In `src/dashboard/App.tsx`:

1. Import: `import WelcomePage from './pages/WelcomePage';`
2. Update `onboardStep` type: `'consent' | 'welcome' | 'login' | 'link' | 'apikey' | 'done'`
3. Update `handleConsent` to go to `'welcome'` instead of `'login'`:
   ```typescript
   const handleConsent = () => {
     const api = (window as unknown as { apexPulse?: { send: (ch: string, data?: unknown) => void } }).apexPulse;
     if (api) api.send('update-settings', { consentAccepted: true });
     setOnboardStep('welcome');
   };
   ```
4. Add handler: `const handleWelcomeContinue = () => setOnboardStep('login');`
5. Add render block after consent, before login:
   ```tsx
   if (onboardStep === 'welcome') {
     return <WelcomePage onContinue={handleWelcomeContinue} />;
   }
   ```

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/pages/WelcomePage.tsx src/dashboard/App.tsx
git commit -m "feat: add welcome/intro screen to FTUE showcasing app features"
```

---

### Task 8: Tooltips on Complex UI Elements

The guidelines say: "tooltips help users understand complex features without overwhelming them with on-screen text." Add a reusable tooltip component and apply it to non-obvious UI elements.

**Files:**
- Create: `src/dashboard/components/Tooltip.tsx`
- Modify: `src/dashboard/pages/StatsPage.tsx` (add tooltips to chart labels)
- Modify: `src/dashboard/pages/SettingsPage.tsx` (add tooltips to settings)
- Modify: `src/dashboard/pages/HomePage.tsx` (add tooltip to K/D ratio)

- [ ] **Step 1: Create Tooltip component**

Create `src/dashboard/components/Tooltip.tsx`:

```tsx
import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-apex-navy border border-white/10 rounded-lg text-xs text-white/80 whitespace-nowrap shadow-lg pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-apex-navy" />
        </span>
      )}
    </span>
  );
};

export default Tooltip;
```

- [ ] **Step 2: Add tooltips to key UI elements**

Add tooltips to elements that aren't immediately obvious. Examples:

In `HomePage.tsx`, wrap the K/D stat card title:
```tsx
<Tooltip text="Total kills divided by total deaths">
  <span>K/D Ratio</span>
</Tooltip>
```

In `SettingsPage.tsx`, add a tooltip to the overlay opacity label:
```tsx
<Tooltip text="How transparent the overlay appears over your game">
  <span>Overlay Opacity</span>
</Tooltip>
```

In `SettingsPage.tsx`, add a tooltip to the API key label:
```tsx
<Tooltip text="Free key from apexlegendsapi.com — enables profile stats and map rotations">
  <span>Apex Legends API Key</span>
</Tooltip>
```

Import Tooltip in each file:
```typescript
import Tooltip from '../components/Tooltip'; // or '../../components/Tooltip' for pages
```

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/Tooltip.tsx src/dashboard/pages/HomePage.tsx src/dashboard/pages/SettingsPage.tsx
git commit -m "feat: add reusable Tooltip component and apply to key UI elements"
```

---

### Task 9: Post-Match Summary Popup

The guidelines say: "Enhance the user's post game experience with your app by incorporating a comprehensive post-game summary." Show a brief post-match toast/card on the dashboard when a match ends.

**Files:**
- Create: `src/dashboard/components/PostMatchSummary.tsx`
- Modify: `src/dashboard/App.tsx` (listen for match-ended, show popup)

- [ ] **Step 1: Create PostMatchSummary component**

Create `src/dashboard/components/PostMatchSummary.tsx`:

```tsx
import React from 'react';
import { MatchRecord } from '../../shared/types';
import { LEGENDS } from '../../shared/legend-map';

interface PostMatchSummaryProps {
  match: MatchRecord;
  onDismiss: () => void;
}

const PostMatchSummary: React.FC<PostMatchSummaryProps> = ({ match, onDismiss }) => {
  const isWin = match.placement === 1;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-apex-navy border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
      <div className={`px-4 py-2 flex items-center justify-between ${isWin ? 'bg-yellow-500/20' : 'bg-apex-cyan/10'}`}>
        <span className={`text-sm font-bold ${isWin ? 'text-yellow-400' : 'text-apex-cyan'}`}>
          {isWin ? 'CHAMPION!' : 'Match Complete'}
        </span>
        <button onClick={onDismiss} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-xs">
            {LEGENDS[match.legend]?.displayName ?? match.legend} &bull; {match.mapName}
          </span>
          <span className={`font-bold text-lg ${isWin ? 'text-yellow-400' : 'text-apex-cyan'}`}>
            #{match.placement || '?'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-lg py-2">
            <div className="text-white font-bold text-lg">{match.kills}</div>
            <div className="text-white/40 text-[10px] uppercase">Kills</div>
          </div>
          <div className="bg-white/5 rounded-lg py-2">
            <div className="text-white font-bold text-lg">{match.damage.toLocaleString()}</div>
            <div className="text-white/40 text-[10px] uppercase">Damage</div>
          </div>
          <div className="bg-white/5 rounded-lg py-2">
            <div className="text-white font-bold text-lg">{match.assists}</div>
            <div className="text-white/40 text-[10px] uppercase">Assists</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostMatchSummary;
```

- [ ] **Step 2: Wire into App.tsx**

In `src/dashboard/App.tsx`:

1. Import: `import PostMatchSummary from './components/PostMatchSummary';`
2. Import: `import { MatchRecord } from '../shared/types';`
3. Add state: `const [lastMatch, setLastMatch] = useState<MatchRecord | null>(null);`
4. Add listener in the existing `useEffect` (or a new one):
   ```typescript
   React.useEffect(() => {
     const api = (window as unknown as { apexPulse?: { on: (ch: string, cb: (...args: unknown[]) => void) => void } }).apexPulse;
     if (!api) return;
     api.on('match-ended', (data: unknown) => {
       setLastMatch(data as MatchRecord);
       setTimeout(() => setLastMatch(null), 15000);
     });
   }, []);
   ```
5. Add render inside the main layout div:
   ```tsx
   {lastMatch && <PostMatchSummary match={lastMatch} onDismiss={() => setLastMatch(null)} />}
   ```

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/PostMatchSummary.tsx src/dashboard/App.tsx
git commit -m "feat: show post-match summary popup when a match ends"
```

---

### Task 10: Rating Prompt

The guidelines say: "Wait until a user has had at least 3-5 meaningful interactions with the app before asking for a review. Prompt at the right moment." Show a rating prompt after the user has played 5+ tracked matches.

**Files:**
- Create: `src/dashboard/components/RatingPrompt.tsx`
- Modify: `src/dashboard/App.tsx` (show after match threshold)

- [ ] **Step 1: Create RatingPrompt component**

Create `src/dashboard/components/RatingPrompt.tsx`:

```tsx
import React, { useState } from 'react';

interface RatingPromptProps {
  onDismiss: () => void;
}

const RatingPrompt: React.FC<RatingPromptProps> = ({ onDismiss }) => {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    localStorage.setItem('apexpulse_rated', 'true');
    if (rating >= 4) {
      setSubmitted(true);
    } else {
      window.open('https://discord.gg/Pfd6ScNaSW', '_blank');
      onDismiss();
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-apex-navy border border-white/10 rounded-xl p-6 max-w-sm text-center shadow-2xl">
          <div className="text-3xl mb-3">🎉</div>
          <p className="text-white font-bold mb-2">Thanks for the love!</p>
          <p className="text-white/50 text-sm mb-4">If you want to support us, tell your squad about ApexPulse.</p>
          <button onClick={onDismiss} className="bg-apex-cyan text-apex-dark font-bold px-6 py-2 rounded-lg">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-apex-navy border border-white/10 rounded-xl p-6 max-w-sm shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-white font-bold">Enjoying ApexPulse?</h3>
          <button onClick={onDismiss} className="text-white/40 hover:text-white">&times;</button>
        </div>
        <p className="text-white/50 text-sm mb-4">You've tracked a few matches now. How are we doing?</p>

        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-2xl transition-transform hover:scale-110 ${
                star <= rating ? 'text-yellow-400' : 'text-white/20'
              }`}
            >
              ★
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 border border-white/10 px-4 py-2 rounded-lg text-white/60 text-sm hover:bg-white/5"
          >
            Not now
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className={`flex-1 font-bold px-4 py-2 rounded-lg text-sm ${
              rating > 0 ? 'bg-apex-cyan text-apex-dark' : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingPrompt;
```

- [ ] **Step 2: Show rating prompt after 5 matches**

In `src/dashboard/App.tsx`:

1. Import: `import RatingPrompt from './components/RatingPrompt';`
2. Add state: `const [showRating, setShowRating] = useState(false);`
3. In the `match-ended` listener (from Task 9), add a check after `setLastMatch`:
   ```typescript
   const matchCount = parseInt(localStorage.getItem('apexpulse_match_count') || '0', 10) + 1;
   localStorage.setItem('apexpulse_match_count', String(matchCount));
   const alreadyRated = localStorage.getItem('apexpulse_rated');
   if (matchCount === 5 && !alreadyRated) {
     setTimeout(() => setShowRating(true), 16000);
   }
   ```
4. Add render:
   ```tsx
   {showRating && <RatingPrompt onDismiss={() => setShowRating(false)} />}
   ```

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/RatingPrompt.tsx src/dashboard/App.tsx
git commit -m "feat: show rating prompt after 5 tracked matches"
```

---

### Task 11: Coach Marks for First-Time Feature Discovery

The guidelines say: "Coach marks are contextual hints that appear throughout your app to explain features interactively." Show one-time tips the first time a user visits key pages.

**Files:**
- Create: `src/dashboard/components/CoachMark.tsx`
- Modify: `src/dashboard/pages/HomePage.tsx` (coach mark on first visit)
- Modify: `src/dashboard/pages/StatsPage.tsx` (coach mark on first visit)

- [ ] **Step 1: Create CoachMark component**

Create `src/dashboard/components/CoachMark.tsx`:

```tsx
import React, { useState, useEffect } from 'react';

interface CoachMarkProps {
  id: string;
  message: string;
  children: React.ReactNode;
}

const CoachMark: React.FC<CoachMarkProps> = ({ id, message, children }) => {
  const storageKey = `apexpulse_coach_${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  return (
    <div className="relative">
      {children}
      {visible && (
        <div className="absolute z-40 top-full left-0 mt-2 w-64 bg-apex-cyan/10 border border-apex-cyan/30 rounded-lg p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <span className="text-apex-cyan text-xs shrink-0 mt-0.5">TIP</span>
            <p className="text-white/80 text-xs leading-relaxed flex-1">{message}</p>
            <button onClick={dismiss} className="text-white/40 hover:text-white text-sm shrink-0">&times;</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachMark;
```

- [ ] **Step 2: Add coach marks to key pages**

In `HomePage.tsx`, wrap the "Launch Apex" button area:
```tsx
<CoachMark id="launch" message="Click here to launch Apex Legends via Steam. Once the game is running, ApexPulse will start tracking automatically.">
  {/* existing Launch Apex button */}
</CoachMark>
```

In `StatsPage.tsx`, wrap the time range selector:
```tsx
<CoachMark id="timerange" message="Filter your stats by time period. Play a few matches to see trends appear in the charts.">
  {/* existing time range buttons */}
</CoachMark>
```

Import in each file:
```typescript
import CoachMark from '../components/CoachMark'; // or '../../components/CoachMark'
```

- [ ] **Step 3: Verify compilation**

Run: `npx webpack`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/CoachMark.tsx src/dashboard/pages/HomePage.tsx src/dashboard/pages/StatsPage.tsx
git commit -m "feat: add dismissible coach marks for first-time feature discovery"
```

---

### Task 12: Second Screen Auto-Launch

The guidelines say: "Second screen windows should launch automatically." Over 30% of Overwolf users have multiple monitors. If a second screen is detected, auto-position the overlay there instead of the primary display edge.

**Files:**
- Modify: `src/main/main.ts` (detect second screen, position overlay)

- [ ] **Step 1: Update createOverlayWindow to prefer second screen**

In `src/main/main.ts`, update `createOverlayWindow()`:

```typescript
function createOverlayWindow(): void {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const secondaryDisplay = displays.find(d => d.id !== primaryDisplay.id);

  const targetDisplay = secondaryDisplay ?? primaryDisplay;
  const bounds = targetDisplay.workArea;

  const savedPos = loadOverlayPosition();

  overlayWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: savedPos?.x ?? bounds.x + bounds.width - 420,
    y: savedPos?.y ?? bounds.y + 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.setIgnoreMouseEvents(true);

  overlayWindow.on('moved', () => {
    if (overlayWindow) {
      const [x, y] = overlayWindow.getPosition();
      saveOverlayPosition(x, y);
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}
```

The key change: if a secondary display exists and no saved position is found, the overlay defaults to the secondary screen's right edge. If the user has previously positioned it (saved position), that takes priority.

- [ ] **Step 2: Verify compilation**

Run: `npx webpack`

- [ ] **Step 3: Commit**

```bash
git add src/main/main.ts
git commit -m "feat: auto-position overlay on secondary display when available"
```

---

### Task 13: Uninstall Survey

The guidelines say: "An effective uninstall survey allows you to capture honest, actionable feedback." Open a brief survey URL when the app is about to be uninstalled. Since we use NSIS, we can configure an uninstall page URL.

**Files:**
- Modify: `package.json` (NSIS uninstall config)

- [ ] **Step 1: Add uninstall survey URL to NSIS config**

In `package.json`, update the `nsis` section:

```json
"nsis": {
  "oneClick": true,
  "allowToChangeInstallationDirectory": false,
  "uninstallDisplayName": "ApexPulse",
  "runAfterFinish": false
}
```

And add an `afterAllArtifactBuild` or use electron-builder's built-in lifecycle. The simplest approach is to add an uninstall script that opens the survey URL.

Create `build/uninstaller.nsh`:

```nsh
!macro customUnInstall
  ExecShell "open" "https://forms.gle/YOUR_UNINSTALL_SURVEY_FORM_ID"
!macroend
```

Then in `package.json`, reference it:

```json
"nsis": {
  "oneClick": true,
  "allowToChangeInstallationDirectory": false,
  "uninstallDisplayName": "ApexPulse",
  "include": "build/uninstaller.nsh"
}
```

> **NOTE:** You need to create a Google Form (or Typeform, etc.) with 3-5 quick multiple-choice questions. Recommended questions from the Overwolf guidelines:
> - Primary reason for uninstalling (technical issues / not useful / too many ads / switching to alternative / just reinstalling)
> - Did you experience performance issues? (yes/no)
> - Would you return if issues were resolved? (yes/no)
> - Optional: email for follow-up
>
> Replace `YOUR_UNINSTALL_SURVEY_FORM_ID` with the actual form URL once created.

- [ ] **Step 2: Create the build directory and uninstaller script**

```bash
mkdir build
```

Create `build/uninstaller.nsh` with the content above (using a placeholder URL until the form is created).

- [ ] **Step 3: Commit**

```bash
git add package.json build/uninstaller.nsh
git commit -m "feat: open uninstall survey when user uninstalls ApexPulse"
```
