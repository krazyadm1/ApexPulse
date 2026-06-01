# Polish, Settings, and Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the body diagram silhouette with an Apex firing range dummy SVG, add hardware acceleration toggle, build a light/dark theme system, and add a donation/support option with optional cosmetic perks for supporters.

**Architecture:** Five independent tasks. Task 1 is a quick SVG swap. Task 2 is a simple settings addition. Task 3 is the biggest — a CSS custom properties theme system touching every page. Task 4 adds a donation flow. Task 5 adds cosmetic supporter perks (accent color picker, overlay themes).

**Tech Stack:** React, Tailwind CSS, TypeScript, SVG, CSS custom properties

---

### Task 1: Firing Range Dummy SVG Silhouette

Replace the kindergarten-quality body silhouette with a traced SVG of the Apex Legends firing range dummy (the orange/white crash test target). Two hit zones highlighted: head (cyan glow) and body (teal glow). The dummy should be recognizable as the Apex target — angular armor panels, visor slit head, segmented limbs.

**Files:**
- Modify: `src/dashboard/components/BodyDiagram.tsx`

**Reference image:** `c:\Users\trist\OneDrive\Pictures\Screenshots 1\Screenshot 2026-05-31 213647.png` — the Apex Legends firing range dummy. Key features to capture:
- Oval/visor-slit head (not a circle — more like a motorcycle helmet shape)
- Broad angular shoulder armor plates
- Segmented torso with chest plate and belt line
- Forearm armor sections with visible joint gaps
- Thigh armor plates with knee joints
- Lower leg armor tapering to boots
- Hazard markers (yellow/black diamonds) on shoulders and thighs — render as small diamond shapes
- Overall stance: standing straight, arms slightly away from body, feet shoulder-width

The SVG should be monochrome (using the hit zone colors), not a full-color render. Think silhouette with enough detail to be recognizable.

- [ ] **Step 1: Create the firing range dummy SVG**

Replace the SVG in `src/dashboard/components/BodyDiagram.tsx` with a detailed traced SVG of the firing range dummy. The SVG should:

- Use a viewBox of `0 0 200 480` (same as current)
- Head zone: filled with `headColor` (cyan, opacity based on headshot %)
- Body zone (torso, arms, legs): filled with `bodyColor` (teal, opacity based on bodyshot %)
- Include recognizable Apex dummy features: helmet visor, shoulder plates, chest armor, segmented limbs, hazard diamonds
- Strokes should be subtle (`rgba(0,200,200,0.3)` range) — no harsh outlines

Key SVG elements to include:
```
Head: helmet shape with visor slit (horizontal line across face area)
Shoulders: wide angular plate shapes extending beyond torso width
Chest: segmented plate with center line
Belt: horizontal band at waist
Arms: upper arm cylinder → elbow joint gap → forearm plate → hand
Legs: thigh plate → knee joint gap → shin plate → boot
Hazard diamonds: 4 small rotated squares on shoulders and thighs
```

- [ ] **Step 2: Build and verify visually**

```bash
npx cross-env NODE_ENV=production npx webpack --config webpack.config.js
npm run start:dev
```

Navigate to Stats page and verify the dummy looks like the Apex firing range target, not a stick figure.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/components/BodyDiagram.tsx
git commit -m "fix: replace body silhouette with Apex firing range dummy SVG"
```

---

### Task 2: Hardware Acceleration Toggle

Add a toggle in Settings to enable/disable hardware acceleration. This controls Electron's GPU acceleration via `app.disableHardwareAcceleration()` — must be called before `app.whenReady()`.

**Files:**
- Modify: `src/shared/types.ts` (add `hardwareAcceleration` to `AppSettings`)
- Modify: `src/shared/constants.ts` (default: `true`)
- Modify: `src/main/main.ts` (read setting before app ready, call `app.disableHardwareAcceleration()` if false)
- Modify: `src/dashboard/pages/SettingsPage.tsx` (add toggle with restart warning)

- [ ] **Step 1: Add setting to types and constants**

In `src/shared/types.ts`, add to `AppSettings`:
```typescript
hardwareAcceleration: boolean;
```

In `src/shared/constants.ts`, add to `DEFAULT_SETTINGS`:
```typescript
hardwareAcceleration: true,
```

- [ ] **Step 2: Read setting before app ready in main.ts**

In `src/main/main.ts`, BEFORE the `app.whenReady()` call, add:
```typescript
// Must be called before app.whenReady()
const earlySettings = loadSettings();
if (earlySettings.hardwareAcceleration === false) {
  app.disableHardwareAcceleration();
}
```

This means `loadSettings()` needs to work before `initDatabase()` — it already does since it reads from a JSON file, not the database.

- [ ] **Step 3: Add toggle to SettingsPage**

Add in the Overlay Settings section (or a new "Performance" section):
```tsx
<ToggleRow
  label="Hardware Acceleration"
  checked={hardwareAcceleration}
  onChange={val => {
    updateSettings({ hardwareAcceleration: val });
    alert('Restart ApexPulse for this to take effect.');
  }}
/>
<span className="text-white/30 text-xs">Uses GPU for rendering. Disable if you experience visual glitches. Requires restart.</span>
```

Make sure `hardwareAcceleration` is destructured from `useSettingsStore()` and included in the `localStorage` persistence list in `settingsStore.ts`.

- [ ] **Step 4: Build and commit**

```bash
npx cross-env NODE_ENV=production npx webpack --config webpack.config.js
git add src/shared/types.ts src/shared/constants.ts src/main/main.ts src/dashboard/pages/SettingsPage.tsx src/stores/settingsStore.ts
git commit -m "feat: add hardware acceleration toggle in settings"
```

---

### Task 3: Dark / Light Theme System

Build a theme system using CSS custom properties. The app currently hardcodes dark colors everywhere — we need to extract those into CSS variables so a single toggle switches the entire theme.

**Files:**
- Create: `src/shared/themes.ts` (theme definitions)
- Modify: `src/shared/types.ts` (add `theme` to `AppSettings`)
- Modify: `src/shared/constants.ts` (default: `'dark'`)
- Modify: `src/dashboard/pages/SettingsPage.tsx` (theme toggle)
- Modify: `src/stores/settingsStore.ts` (persist + apply theme)
- Modify: `tailwind.config.js` or CSS entry (map CSS vars to Tailwind)
- Modify: Multiple pages/components (swap hardcoded colors for CSS var references)

**Theme color mapping:**

| Semantic Name | Dark Value | Light Value |
|---|---|---|
| `--bg-primary` | `#050B14` (apex-dark) | `#F5F5F7` |
| `--bg-secondary` | `#0A1628` (apex-navy) | `#FFFFFF` |
| `--bg-card` | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.03)` |
| `--text-primary` | `#FFFFFF` | `#1A1A1A` |
| `--text-secondary` | `rgba(255,255,255,0.6)` | `rgba(0,0,0,0.6)` |
| `--text-muted` | `rgba(255,255,255,0.3)` | `rgba(0,0,0,0.3)` |
| `--border` | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.1)` |
| `--accent` | `#00E5FF` (apex-cyan) | `#00B8D4` |
| `--sidebar-bg` | `#0A1628` | `#FFFFFF` |
| `--hover` | `rgba(0,229,255,0.04)` | `rgba(0,180,212,0.06)` |

- [ ] **Step 1: Create theme definitions**

Create `src/shared/themes.ts`:
```typescript
export type ThemeName = 'dark' | 'light';

export const THEMES: Record<ThemeName, Record<string, string>> = {
  dark: {
    '--bg-primary': '#050B14',
    '--bg-secondary': '#0A1628',
    '--bg-card': 'rgba(255,255,255,0.03)',
    '--text-primary': '#FFFFFF',
    '--text-secondary': 'rgba(255,255,255,0.6)',
    '--text-muted': 'rgba(255,255,255,0.3)',
    '--border': 'rgba(255,255,255,0.1)',
    '--accent': '#00E5FF',
    '--sidebar-bg': '#0A1628',
    '--hover': 'rgba(0,229,255,0.04)',
  },
  light: {
    '--bg-primary': '#F5F5F7',
    '--bg-secondary': '#FFFFFF',
    '--bg-card': 'rgba(0,0,0,0.03)',
    '--text-primary': '#1A1A1A',
    '--text-secondary': 'rgba(0,0,0,0.6)',
    '--text-muted': 'rgba(0,0,0,0.3)',
    '--border': 'rgba(0,0,0,0.1)',
    '--accent': '#00B8D4',
    '--sidebar-bg': '#FFFFFF',
    '--hover': 'rgba(0,180,212,0.06)',
  },
};

export function applyTheme(theme: ThemeName): void {
  const vars = THEMES[theme];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-theme', theme);
}
```

- [ ] **Step 2: Add theme to settings types and store**

In `AppSettings`, add: `theme: 'dark' | 'light'`
In `DEFAULT_SETTINGS`, add: `theme: 'dark'`
In `settingsStore.ts`, call `applyTheme()` on init and on update.

- [ ] **Step 3: Update Tailwind config / CSS to use CSS variables**

Add to the base CSS (or Tailwind config `extend.colors`):
```css
:root { /* dark defaults set by applyTheme() */ }

.glass-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  /* ... existing styles ... */
}
```

Map Tailwind colors:
```javascript
// tailwind.config.js extend.colors
'theme-bg': 'var(--bg-primary)',
'theme-bg2': 'var(--bg-secondary)',
'theme-text': 'var(--text-primary)',
'theme-text2': 'var(--text-secondary)',
'theme-muted': 'var(--text-muted)',
'theme-border': 'var(--border)',
'theme-accent': 'var(--accent)',
```

- [ ] **Step 4: Update all pages to use theme variables**

This is the bulk of the work. For each page/component, replace:
- `bg-apex-dark` → `bg-[var(--bg-primary)]`
- `bg-apex-navy` → `bg-[var(--bg-secondary)]`
- `text-white` → `text-[var(--text-primary)]`
- `text-white/60` → `text-[var(--text-secondary)]`
- `border-white/10` → `border-[var(--border)]`
- etc.

Files to update:
- `src/dashboard/App.tsx` (sidebar, main layout)
- `src/dashboard/pages/HomePage.tsx`
- `src/dashboard/pages/StatsPage.tsx`
- `src/dashboard/pages/WeaponsPage.tsx`
- `src/dashboard/pages/LegendsPage.tsx`
- `src/dashboard/pages/HistoryPage.tsx`
- `src/dashboard/pages/MapsPage.tsx`
- `src/dashboard/pages/SettingsPage.tsx`
- `src/dashboard/pages/FaqPage.tsx`
- All components in `src/dashboard/components/`

- [ ] **Step 5: Add theme toggle to Settings**

In SettingsPage, add a toggle or segmented control:
```tsx
<SectionCard title="Appearance">
  <div className="flex items-center justify-between">
    <span className="text-[var(--text-secondary)] text-sm">Theme</span>
    <div className="flex gap-2">
      <button onClick={() => updateSettings({ theme: 'dark' })}
        className={theme === 'dark' ? 'active-style' : 'inactive-style'}>
        Dark
      </button>
      <button onClick={() => updateSettings({ theme: 'light' })}
        className={theme === 'light' ? 'active-style' : 'inactive-style'}>
        Light
      </button>
    </div>
  </div>
</SectionCard>
```

- [ ] **Step 6: Build, test both themes, commit**

Test: toggle between dark and light, verify all pages look correct in both themes. Charts (Recharts) may need theme-aware tick/grid colors — pass them as props derived from current theme.

```bash
git add -A
git commit -m "feat: add dark/light theme system with CSS custom properties"
```

---

### Task 4: Donation / Support Button

Add a "Support ApexPulse" option. No paywall — all features stay free. This adds a Ko-fi or Buy Me a Coffee link and a supporter acknowledgment.

**Files:**
- Modify: `src/dashboard/App.tsx` (add support button to sidebar)
- Modify: `src/dashboard/pages/SettingsPage.tsx` (add support section)
- Modify: `src/shared/constants.ts` (add donation URL)

**Prerequisite:** Tristin needs to create a Ko-fi or Buy Me a Coffee page. The plan uses a placeholder URL.

- [ ] **Step 1: Add donation URL constant**

In `src/shared/constants.ts`:
```typescript
export const DONATION_URL = 'https://ko-fi.com/apexpulse'; // Replace with real URL
```

- [ ] **Step 2: Add support button to sidebar**

In `src/dashboard/App.tsx`, add above the Discord button in the sidebar:
```tsx
<a
  href={DONATION_URL}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center space-x-2 w-full px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm font-medium"
>
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
  <span>Support ApexPulse</span>
</a>
```

- [ ] **Step 3: Add support section to Settings**

In SettingsPage, add a section:
```tsx
<SectionCard title="Support ApexPulse">
  <p className="text-white/60 text-sm mb-3">
    ApexPulse is free and always will be. If it's helped your gameplay,
    consider buying me a coffee to keep development going.
  </p>
  <a href={DONATION_URL} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 px-4 py-2 rounded-lg hover:bg-amber-500/30 transition-colors text-sm font-medium">
    ❤ Support on Ko-fi
  </a>
</SectionCard>
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/App.tsx src/dashboard/pages/SettingsPage.tsx src/shared/constants.ts
git commit -m "feat: add donation/support button (Ko-fi)"
```

---

### Task 5: Supporter Cosmetic Perks (Optional / Future)

This is a stretch goal. If a supporter key/flag is added later (e.g., via Ko-fi webhook or manual entry), unlock cosmetic perks:

1. **Accent color picker** — let supporters change the app accent from cyan to any color
2. **Overlay themes** — 2-3 alternate overlay skins (minimal, compact, expanded)
3. **Supporter badge** — small heart or star icon next to app name in sidebar

**This task is intentionally left as design-only.** Implementation depends on:
- Whether you use Ko-fi webhooks, manual codes, or honor system
- How you want to gate it (API check, local code entry, etc.)

**Recommendation:** Start with an honor-system toggle in Settings ("I've donated") that unlocks accent color picker. No server validation needed. If people abuse it, they were never going to pay anyway — and the people who do donate feel appreciated.

- [ ] **Step 1: Add `isSupporterOverride` boolean to settings**
- [ ] **Step 2: Add accent color picker (only visible when supporter = true)**
- [ ] **Step 3: Apply accent color via CSS variable `--accent`**
- [ ] **Step 4: Commit**

---

### Execution Order

1. **Task 1** (firing range dummy SVG) — quick win, fixes the worst visual
2. **Task 2** (hardware acceleration) — quick settings addition
3. **Task 4** (donation button) — quick, gets the support flow in place
4. **Task 3** (dark/light theme) — biggest task, do last
5. **Task 5** (supporter perks) — stretch goal, depends on donation flow

Tasks 1, 2, and 4 are independent and can be parallelized. Task 3 should be done after everything else since it touches every file. Task 5 is optional.
