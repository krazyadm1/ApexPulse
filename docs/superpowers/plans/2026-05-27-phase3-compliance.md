# Phase 3 Overwolf Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ApexPulse pass all Overwolf Phase 3 pre-submission checklist requirements.

**Architecture:** Seven independent compliance items need fixing: (1) legal docs + consent in FTUE, (2) CMP integration via Overwolf's CMP SDK, (3) code signing config for electron-builder, (4) production webpack builds, (5) game compliance for ranked overlay hiding, (6) app store listing assets placeholder structure, (7) monetization-ready ad slot placeholders. Each task is self-contained.

**Tech Stack:** React/TypeScript, Electron (ow-electron), electron-builder, webpack, Overwolf CMP SDK

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/types.ts` | Modify | Add `consentAccepted` to `AppSettings` |
| `src/shared/constants.ts` | Modify | Add legal URLs, default consent state |
| `src/dashboard/pages/ConsentPage.tsx` | Create | FTUE consent gate with ToS/Privacy links |
| `src/dashboard/App.tsx` | Modify | Insert consent step into onboarding flow |
| `src/main/main.ts` | Modify | Add ranked-mode overlay auto-hide logic |
| `src/main/preload.ts` | Modify | Add `open-external` to valid channels |
| `webpack.config.js` | Modify | Production mode, strip source maps |
| `package.json` | Modify | Add code signing fields, build scripts |
| `assets/store/` | Create | Directory structure for store listing assets |
| `LEGAL.md` | Create | Placeholder legal docs with TODOs |

---

### Task 1: Legal Compliance — Consent Page in FTUE

The installer is `oneClick: true` so there's no install-time consent prompt. Instead, add a consent gate as the very first FTUE step before login.

**Files:**
- Modify: `src/shared/types.ts:350-359` (add `consentAccepted` to `AppSettings`)
- Modify: `src/shared/constants.ts:29-38` (add default + legal URLs)
- Create: `src/dashboard/pages/ConsentPage.tsx`
- Modify: `src/dashboard/App.tsx:31-77` (add consent step before login)

- [ ] **Step 1: Add consent field to AppSettings and constants**

In `src/shared/types.ts`, add `consentAccepted` to `AppSettings`:

```typescript
export interface AppSettings {
  apiKey: string;
  overlayEnabled: boolean;
  overlayPosition: { top: number; left: number };
  overlayOpacity: number;
  overlayHotkey: string;
  autoDetectOrigin: boolean;
  pollIntervalMs: number;
  sessionTimeoutMs: number;
  consentAccepted: boolean;
}
```

In `src/shared/constants.ts`, add legal URLs and update default settings:

```typescript
export const LEGAL_URLS = {
  termsOfUse: 'https://apexpulse.gg/terms',
  privacyPolicy: 'https://apexpulse.gg/privacy',
} as const;

export const DEFAULT_SETTINGS: import('./types').AppSettings = {
  apiKey: '',
  overlayEnabled: true,
  overlayPosition: { top: 10, left: 10 },
  overlayOpacity: 0.8,
  overlayHotkey: 'Shift+F1',
  autoDetectOrigin: true,
  pollIntervalMs: API_POLL_INTERVAL_MS,
  sessionTimeoutMs: SESSION_TIMEOUT_MS,
  consentAccepted: false,
};
```

> **NOTE:** The URLs `apexpulse.gg/terms` and `apexpulse.gg/privacy` are placeholders. Before submission, you MUST host real Terms of Use and Privacy Policy documents at publicly accessible URLs that do not require login. These documents must accurately describe data collection (local SQLite DB, API calls to apexlegendsapi.com, Steam/Discord OAuth), storage (local filesystem via `app.getPath('userData')`), and usage. Overwolf will reject the submission if these URLs are dead or require authentication.

- [ ] **Step 2: Create ConsentPage component**

Create `src/dashboard/pages/ConsentPage.tsx`:

```tsx
import React, { useState } from 'react';
import { LEGAL_URLS } from '../../shared/constants';

interface ConsentPageProps {
  onAccept: () => void;
}

const ConsentPage: React.FC<ConsentPageProps> = ({ onAccept }) => {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex items-center justify-center h-screen bg-apex-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-apex-cyan tracking-tighter mb-2">APEX PULSE</h1>
          <p className="text-gray-400">Before we get started</p>
        </div>

        <div className="bg-apex-navy border border-white/10 rounded-lg p-6 space-y-4">
          <p className="text-white/80 text-sm leading-relaxed">
            ApexPulse stores your match data locally on your computer. We use the
            Apex Legends Status API to fetch your profile stats and map rotations.
            No personal data is sent to our servers.
          </p>

          <div className="flex flex-col gap-2 text-sm">
            <a
              href={LEGAL_URLS.termsOfUse}
              target="_blank"
              rel="noopener noreferrer"
              className="text-apex-cyan hover:underline"
            >
              Terms of Use
            </a>
            <a
              href={LEGAL_URLS.privacyPolicy}
              target="_blank"
              rel="noopener noreferrer"
              className="text-apex-cyan hover:underline"
            >
              Privacy Policy
            </a>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none pt-2 border-t border-white/10">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 accent-apex-cyan"
            />
            <span className="text-white/70 text-sm">
              I have read and agree to the Terms of Use and Privacy Policy
            </span>
          </label>
        </div>

        <button
          onClick={onAccept}
          disabled={!checked}
          className={`w-full mt-6 font-bold px-6 py-3 rounded-lg transition-colors ${
            checked
              ? 'bg-apex-cyan text-apex-dark hover:opacity-90'
              : 'bg-white/10 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default ConsentPage;
```

- [ ] **Step 3: Wire ConsentPage into FTUE flow in App.tsx**

In `src/dashboard/App.tsx`, add consent as the first onboarding step:

1. Import `ConsentPage`:
```typescript
import ConsentPage from './pages/ConsentPage';
```

2. Change the `onboardStep` type and initial value:
```typescript
const [onboardStep, setOnboardStep] = useState<'consent' | 'login' | 'link' | 'apikey' | 'done'>(
  setupComplete ? 'done' : 'consent'
);
```

3. Add the consent handler:
```typescript
const handleConsent = () => {
  const api = (window as unknown as { apexPulse?: { send: (ch: string, data?: unknown) => void } }).apexPulse;
  if (api) api.send('update-settings', { consentAccepted: true });
  setOnboardStep('login');
};
```

4. Add the consent render block before the login check:
```tsx
if (onboardStep === 'consent') {
  return <ConsentPage onAccept={handleConsent} />;
}
```

- [ ] **Step 4: Update settingsStore to include consentAccepted**

In `src/stores/settingsStore.ts`, add `consentAccepted` to the localStorage persistence list (line ~35):

```typescript
localStorage.setItem('apexpulse_settings', JSON.stringify({
  apiKey: updated.apiKey,
  overlayEnabled: updated.overlayEnabled,
  overlayPosition: updated.overlayPosition,
  overlayOpacity: updated.overlayOpacity,
  overlayHotkey: updated.overlayHotkey,
  autoDetectOrigin: updated.autoDetectOrigin,
  pollIntervalMs: updated.pollIntervalMs,
  sessionTimeoutMs: updated.sessionTimeoutMs,
  consentAccepted: updated.consentAccepted,
}));
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/constants.ts src/dashboard/pages/ConsentPage.tsx src/dashboard/App.tsx src/stores/settingsStore.ts
git commit -m "feat: add legal consent gate to FTUE onboarding flow"
```

---

### Task 2: CMP Integration

Overwolf requires a Consent Management Platform integration. Review the Overwolf CMP documentation to determine which SDK to use. This task creates the integration point.

**Files:**
- Modify: `src/main/main.ts` (initialize CMP)
- Modify: `src/main/preload.ts` (expose CMP channel if needed)

- [ ] **Step 1: Research Overwolf CMP requirements**

Read the Overwolf CMP documentation at their developer portal. Determine:
- Which CMP SDK they provide or recommend for Electron apps
- Whether it's an npm package or a script tag
- What initialization looks like

> **NOTE:** Overwolf's CMP requirements may be satisfied differently for Electron apps vs Overwolf-native apps. Check the ow-electron specific CMP docs. If Overwolf provides a built-in CMP via ow-electron's APIs (similar to how `app.overwolf.packages` works), use that. Otherwise, integrate a third-party CMP like Google's Funding Choices or OneTrust.

- [ ] **Step 2: Install CMP dependency**

```bash
npm install <overwolf-cmp-package>
```

(Package name depends on Step 1 findings.)

- [ ] **Step 3: Initialize CMP in main process**

In `src/main/main.ts`, add CMP initialization in `initApp()` after the app is ready but before creating windows:

```typescript
// CMP initialization — exact API depends on Overwolf's CMP SDK
// This must be called before showing any UI
async function initCmp(): Promise<void> {
  try {
    // Implementation depends on Overwolf CMP docs
    console.log('[ApexPulse] CMP initialized');
  } catch (e) {
    console.warn('[ApexPulse] CMP init failed:', e);
  }
}
```

Call it in `initApp()`:
```typescript
await initCmp();
```

- [ ] **Step 4: Commit**

```bash
git add src/main/main.ts package.json package-lock.json
git commit -m "feat: integrate Overwolf CMP SDK"
```

---

### Task 3: Code Signing Configuration

Mandatory for Overwolf app store distribution. This configures electron-builder to sign the Windows executable.

**Files:**
- Modify: `package.json:70-77` (add signing config to `build.win`)

- [ ] **Step 1: Add code signing config to package.json**

Update the `build.win` section in `package.json`:

```json
"win": {
  "target": "nsis",
  "icon": "assets/icons/icon.png",
  "signingHashAlgorithms": ["sha256"],
  "sign": null
}
```

> **NOTE:** For actual signing, you need a code signing certificate. Options:
> - **Cheapest:** SSL.com EV code signing certificate (~$350/year) — required for SmartScreen reputation
> - **Alternative:** DigiCert, Sectigo, GlobalSign
>
> Once you have the certificate, set these environment variables in your CI/build environment:
> ```
> CSC_LINK=path/to/certificate.pfx
> CSC_KEY_PASSWORD=your-certificate-password
> ```
>
> electron-builder will automatically pick these up. Do NOT commit certificate files or passwords to git.

- [ ] **Step 2: Add production build script to package.json**

Add a `dist:signed` script:

```json
"scripts": {
  "build": "webpack",
  "build:prod": "webpack --mode production",
  "start": "ow-electron dist/main.js",
  "pack": "electron-builder --dir",
  "dist": "electron-builder",
  "dist:signed": "electron-builder --win --publish never"
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add code signing config and production build script"
```

---

### Task 4: Production Webpack Configuration

The current webpack config uses `mode: 'development'` and full source maps everywhere. For release, switch to production mode and use safer source maps.

**Files:**
- Modify: `webpack.config.js`

- [ ] **Step 1: Make webpack mode configurable via NODE_ENV**

Replace the hardcoded `mode: 'development'` in all three configs in `webpack.config.js`:

```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

const mainConfig = {
  mode: isProd ? 'production' : 'development',
  target: 'electron-main',
  entry: { main: './src/main/main.ts' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    '@overwolf/ow-electron': 'commonjs @overwolf/ow-electron',
    'tesseract.js': 'commonjs tesseract.js',
  },
  node: { __dirname: false, __filename: false },
  devtool: isProd ? false : 'source-map',
};

const preloadConfig = {
  mode: isProd ? 'production' : 'development',
  target: 'electron-preload',
  entry: { preload: './src/main/preload.ts' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  resolve: { extensions: ['.ts', '.js'] },
  devtool: isProd ? false : 'source-map',
};

const rendererConfig = {
  mode: isProd ? 'production' : 'development',
  target: 'web',
  entry: {
    dashboard: './src/dashboard/index.tsx',
    overlay: './src/overlay/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dashboard.html',
      filename: 'dashboard.html',
      chunks: ['dashboard'],
    }),
    new HtmlWebpackPlugin({
      template: './overlay.html',
      filename: 'overlay.html',
      chunks: ['overlay'],
    }),
    new CopyPlugin({
      patterns: [
        { from: 'assets', to: 'assets', noErrorOnMissing: true },
      ],
    }),
  ],
  devtool: isProd ? false : 'source-map',
};

module.exports = [mainConfig, preloadConfig, rendererConfig];
```

- [ ] **Step 2: Update build scripts in package.json**

Ensure the prod build script sets `NODE_ENV`:

```json
"build:prod": "cross-env NODE_ENV=production webpack"
```

Install cross-env:
```bash
npm install --save-dev cross-env
```

- [ ] **Step 3: Verify production build works**

```bash
npm run build:prod
```

Expected: Build completes with no errors, output in `dist/` is minified.

- [ ] **Step 4: Commit**

```bash
git add webpack.config.js package.json package-lock.json
git commit -m "feat: production webpack config with minification and no source maps"
```

---

### Task 5: Game Compliance — Hide Overlay in Ranked

Apex Legends has specific compliance requirements. The overlay must not provide competitive advantage in ranked modes. The safest approach: auto-hide the overlay when a ranked match starts.

**Files:**
- Modify: `src/main/main.ts:298-306` (add ranked detection to match state handler)

- [ ] **Step 1: Track current game mode in main process**

In `src/main/main.ts`, add a module-level variable and update the game mode callback:

Add near the top with other `let` declarations (around line 24):
```typescript
let currentGameMode: string | null = null;
```

In the `registerCallbacks` block inside `initApp()`, update `onGameModeDetected`:
```typescript
onGameModeDetected: (mode: string) => {
  handleGameModeDetected(mode);
  currentGameMode = mode;
},
```

- [ ] **Step 2: Auto-hide overlay during ranked matches**

Update the `onMatchStateChange` callback in `initApp()`:

```typescript
onMatchStateChange: (state) => {
  handleMatchStateChange(state);
  if (state === 'active') {
    stopScanning();
    const isRanked = currentGameMode === 'ranked_br';
    if (isRanked && overlayWindow?.isVisible()) {
      overlayWindow.hide();
      broadcast('overlay-auto-hidden', { reason: 'ranked' });
    }
  } else {
    startScanning();
  }
},
```

- [ ] **Step 3: Commit**

```bash
git add src/main/main.ts
git commit -m "feat: auto-hide overlay during ranked matches for game compliance"
```

---

### Task 6: App Store Listing Assets Structure

Create the directory structure and a manifest for required store assets. The actual images need to be designed, but the structure and requirements should be documented.

**Files:**
- Create: `assets/store/README.txt`

- [ ] **Step 1: Create store assets directory with requirements doc**

Create `assets/store/README.txt`:

```
ApexPulse - Overwolf App Store Listing Assets
==============================================

Required assets for Overwolf web app store submission.
All images should be PNG format.

REQUIRED:
- icon-256.png        (256x256 app icon)
- tile-400x225.png    (400x225 store tile)
- screenshot-1.png    (1280x720 or 1920x1080 app screenshot - dashboard)
- screenshot-2.png    (1280x720 or 1920x1080 app screenshot - in-game overlay)
- screenshot-3.png    (1280x720 or 1920x1080 app screenshot - stats page)

RECOMMENDED:
- description.txt     (Short and long description for store listing)
- banner-1200x300.png (1200x300 promotional banner)

NOTE: Electron apps are only available in the web-based app store.
Customer reviews are not visible in the Overwolf App webstore.
```

- [ ] **Step 2: Create store description draft**

Create `assets/store/description.txt`:

```
SHORT DESCRIPTION (max 150 chars):
Real-time Apex Legends match tracking with live overlay, detailed weapon stats, and heirloom pack counter.

LONG DESCRIPTION:
ApexPulse is the Apex Legends companion that works. Track every match automatically with GEP-powered game event detection — kills, damage, placement, weapons, and legends are all captured in real-time.

Features:
- Live in-game overlay showing current match stats
- Detailed match history with per-weapon and per-legend breakdowns
- Real-time map rotation and server status
- Heirloom pack tracker with auto-detection
- Lobby intel with player stats lookup
- Session tracking to monitor your daily performance
- All data stored locally — your stats never leave your machine

Supports Steam and Discord sign-in, or just launch Apex and we'll detect your account automatically.
```

- [ ] **Step 3: Commit**

```bash
git add assets/store/
git commit -m "docs: add app store listing asset requirements and description draft"
```

---

### Task 7: Monetization Readiness

Even if not monetizing at launch, Overwolf recommends designing ad slot locations. Add a placeholder component and identify where ads would go without actually showing ads.

**Files:**
- Create: `src/dashboard/components/AdSlot.tsx`

- [ ] **Step 1: Create AdSlot placeholder component**

Create `src/dashboard/components/AdSlot.tsx`:

```tsx
import React from 'react';

interface AdSlotProps {
  size: '300x250' | '728x90' | '160x600';
  className?: string;
}

const AdSlot: React.FC<AdSlotProps> = ({ size, className = '' }) => {
  const [width, height] = size.split('x').map(Number);

  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <div
      className={className}
      style={{ width, height }}
      data-ad-slot={size}
    />
  );
};

export default AdSlot;
```

> **NOTE:** This is a no-op placeholder. When you're ready to monetize:
> 1. Review Overwolf's monetization docs and ad SDK
> 2. Replace the empty div with Overwolf's ad component
> 3. Recommended placements in ApexPulse:
>    - **300x250** in the sidebar below nav (dashboard)
>    - **728x90** at the bottom of stats/history pages
>    - **NEVER** in the in-game overlay (compliance violation)
> 4. Ensure ads follow Overwolf's advertising size and placement policy

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/components/AdSlot.tsx
git commit -m "feat: add monetization-ready ad slot placeholder component"
```

---

## Summary of External Actions Required (Not Code)

These items cannot be solved with code alone and need manual action before Overwolf submission:

| Action | Priority | Details |
|--------|----------|---------|
| **Write Terms of Use** | BLOCKER | Host at a public URL. Must cover data collection, local storage, API usage. |
| **Write Privacy Policy** | BLOCKER | Host at a public URL. Must describe what data is collected (match stats, API key, Origin/Steam/Discord accounts), how it's stored (local SQLite), and that nothing is sent to your servers. |
| **Purchase code signing certificate** | BLOCKER | EV cert recommended for SmartScreen. ~$350/yr from SSL.com or similar. |
| **Create store listing screenshots** | BLOCKER | Run the app, take 3+ high-quality screenshots at 1920x1080. |
| **Check Overwolf CMP docs** | BLOCKER | Determine exact CMP SDK for ow-electron apps. Task 2 is a skeleton until this is known. |
| **Review Apex compliance page** | HIGH | Check Overwolf's Apex Legends-specific compliance rules to confirm ranked overlay hiding is sufficient. |
| **Register domain** | MEDIUM | `apexpulse.gg` or similar for hosting legal docs. Can use GitHub Pages. |
