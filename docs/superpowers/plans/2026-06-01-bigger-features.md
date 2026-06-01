# Bigger Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add match detail view, season tracker, death heatmap, website screenshots, and Discord bot /compare command.

**Architecture:** Five independent features. Each can be built and shipped separately. Tasks 1-3 are app features, Task 4 is website, Task 5 is Discord bot.

**Tech Stack:** React, Tailwind, Recharts, SQLite, Next.js, discord.js

---

### Task 1: Match Detail View

When a user clicks a match in the History page, expand it into a full detailed breakdown instead of the current minimal expansion.

**Files:**
- Modify: `src/dashboard/pages/HistoryPage.tsx`
- Create: `src/dashboard/components/MatchDetail.tsx`

**Current state:** History page shows match cards that expand slightly on click. The `MatchRecord` already contains all the data we need — weapon kills, teammates, headshots, bodyshots, RP change, duration, squad kills.

**Detail view should show:**
- Full-width expanded panel below the match card
- **Performance row:** Kills, Deaths (1 if not win), Assists, Knockdowns, Damage, Survival Time
- **Weapon breakdown:** Table of weapons used with kills and knockdowns per weapon
- **Squad summary:** Teammate names and legends (if available)
- **Ranked info:** RP before, RP after, RP change (if ranked match)
- **Headshot ratio:** X headshots / Y total kills = Z% for this match
- **Match metadata:** Match ID, data source, duration formatted as Xm Ys

- [ ] **Step 1: Create MatchDetail component**

Build `src/dashboard/components/MatchDetail.tsx` that receives a `MatchRecord` and renders the full breakdown. Use a grid layout: left column for core stats, right column for weapons and squad.

- [ ] **Step 2: Integrate into HistoryPage**

Replace the current inline expansion in HistoryPage with the MatchDetail component. When a match card is clicked, render `<MatchDetail match={selectedMatch} />` below it. Only one match expanded at a time.

- [ ] **Step 3: Build and commit**

```bash
npx cross-env NODE_ENV=production npx webpack --config webpack.config.js
git add src/dashboard/pages/HistoryPage.tsx src/dashboard/components/MatchDetail.tsx
git commit -m "feat: add detailed match breakdown view in History"
```

---

### Task 2: Season Tracker

Track stats per ranked season. Show a dedicated section on the Stats page with season-scoped data.

**Files:**
- Modify: `src/background/database.ts` (add season-scoped queries)
- Create: `src/shared/seasons.ts` (season date ranges)
- Modify: `src/stores/matchStore.ts` (add season stats)
- Modify: `src/main/main.ts` (broadcast season stats)
- Modify: `src/dashboard/pages/StatsPage.tsx` (add season section)

**Season data structure:**
```typescript
interface SeasonInfo {
  id: string;        // e.g. "s22"
  name: string;      // e.g. "Season 22"
  startDate: number; // epoch ms
  endDate: number;   // epoch ms
}
```

**Database queries needed:**
- `getSeasonMatches(startDate, endDate)` — all matches in date range
- `getSeasonRpProgress(startDate, endDate)` — RP over time for the season
- `getSeasonStats(startDate, endDate)` — aggregate kills/damage/wins/matches for date range

**UI on Stats page:**
- Season selector dropdown (current season, previous seasons)
- Season stat cards: Matches, Kills, K/D, Win Rate, RP Start → RP Current, RP gained
- RP progression line chart across the season
- Placement distribution bar chart (1st, 2nd-3rd, 4th-5th, 6th-10th, 11th+)

- [ ] **Step 1: Create seasons.ts with season date ranges**

Hardcode known Apex Legends season start/end dates. Update as new seasons launch.

- [ ] **Step 2: Add season-scoped database queries**

Add `getMatchesInRange(start, end)`, `getStatsInRange(start, end)`, `getRpProgressInRange(start, end)` to database.ts.

- [ ] **Step 3: Wire into store and broadcast**

Add `seasonStats` to matchStore, compute on `broadcastFullState`.

- [ ] **Step 4: Build season section on Stats page**

Season dropdown + stat cards + RP progression chart + placement distribution.

- [ ] **Step 5: Build and commit**

```bash
git add src/shared/seasons.ts src/background/database.ts src/stores/matchStore.ts src/main/main.ts src/dashboard/pages/StatsPage.tsx
git commit -m "feat: add season tracker with RP progression and placement distribution"
```

---

### Task 3: Death Heatmap from GEP Location Data

Visualize where you die most on each map using the location data GEP already provides.

**Files:**
- Modify: `src/background/database.ts` (store death locations)
- Modify: `src/background/match-tracker.ts` (capture location on death)
- Create: `src/dashboard/components/DeathHeatmap.tsx` (canvas-based heatmap overlay)
- Modify: `src/dashboard/pages/StatsPage.tsx` or create `src/dashboard/pages/HeatmapPage.tsx`
- Create: `public/maps/` (map background images for Kings Canyon, World's Edge, Olympus, Storm Point, Broken Moon, E-District)

**How it works:**
1. GEP sends location updates (`x, y, z` coordinates) throughout the match
2. `handleDeath()` in match-tracker already fires on death — capture the last known location
3. Store `death_x, death_y, death_z, map_name` in a new `death_locations` table (or columns on matches)
4. Query deaths grouped by map
5. Render as dots on a map background image, with opacity/color based on density

**Data pipeline:**
- `handleLocationUpdate` already receives `(x, y, z)` — currently a no-op. Store the latest position.
- On `handleDeath()`, save the current position + map name to the database.
- Query: `SELECT death_x, death_y, map_name FROM matches WHERE death_x IS NOT NULL AND map_name = ?`

**Heatmap rendering:**
- HTML Canvas overlay on top of a map background image
- Each death = a radial gradient dot (red-orange)
- Cluster nearby deaths for intensity
- Map selector dropdown to switch between maps

**Map images:**
- Need top-down map images for each Apex map
- These can be sourced from the Apex Legends wiki or community resources
- Coordinate mapping: GEP coordinates → pixel positions on the map image (requires a calibration step per map)

**Note:** The coordinate-to-pixel mapping is the hardest part. GEP uses in-game world coordinates that need to be mapped to 2D image positions. This requires known reference points per map. Start with one map (Kings Canyon) and calibrate, then extend to others.

- [ ] **Step 1: Store last known location in match-tracker**

Update `handleLocationUpdate` to store the latest position. On `handleDeath`, save it.

- [ ] **Step 2: Add death location columns to matches table**

```sql
ALTER TABLE matches ADD COLUMN death_x REAL;
ALTER TABLE matches ADD COLUMN death_y REAL;
ALTER TABLE matches ADD COLUMN death_z REAL;
```

- [ ] **Step 3: Create DeathHeatmap component**

Canvas-based component that renders dots on a map image.

- [ ] **Step 4: Add map selector and integrate into Stats or new page**

- [ ] **Step 5: Calibrate coordinate mapping for at least Kings Canyon**

- [ ] **Step 6: Build and commit**

---

### Task 4: Website Screenshots / Mockups

Add real app screenshots to the landing page to show what ApexPulse looks like.

**Files:**
- Add: `public/screenshots/` (4-6 PNG screenshots)
- Modify: `app/page.tsx` (add screenshot carousel/gallery section)

**Screenshots needed:**
1. Dashboard Home page with stats populated
2. Live overlay during a match
3. Legend analytics table
4. Stats page with headshot diagram + ranked progress
5. Map rotation page
6. Settings page (dark + light theme)

**UI:** Horizontal scroll gallery or 2-column grid between the Features section and Privacy callout. Each screenshot in a glass-card frame with a subtle border and caption.

- [ ] **Step 1: Take/prepare screenshots (manual — need app running with data)**
- [ ] **Step 2: Add screenshot gallery section to landing page**
- [ ] **Step 3: Optimize images (webp, lazy load)**
- [ ] **Step 4: Build and commit**

---

### Task 5: Discord Bot /compare Command

Side-by-side player comparison in a Discord embed.

**Files:**
- Modify: `discord-bot/bot.js`

**Command:** `/compare player1 player2 [platform]`

**Embed layout:**
```
┌─────────────────────────────────┐
│     Player1  vs  Player2        │
├────────────┬────────────────────┤
│ Level: 385 │ Level: 210         │
│ Kills: 12K │ Kills: 5.4K       │
│ Damage: 4M │ Damage: 1.8M      │
│ Wins: 800  │ Wins: 320         │
│ K/D: 2.1   │ K/D: 1.4          │
│ Rank: Dia4 │ Rank: Plat2       │
│ RP: 12031  │ RP: 8420          │
└────────────┴────────────────────┘
```

Uses the same `apiGet('/bridge', ...)` call, two requests in parallel.

- [ ] **Step 1: Add /compare slash command definition**

```javascript
new SlashCommandBuilder()
  .setName('compare')
  .setDescription('Compare two players side by side')
  .addStringOption(opt => opt.setName('player1').setDescription('First player').setRequired(true))
  .addStringOption(opt => opt.setName('player2').setDescription('Second player').setRequired(true))
  .addStringOption(opt => opt.setName('platform').setDescription('Platform').addChoices(...))
```

- [ ] **Step 2: Add handleCompare function**

Fetch both players in parallel with `Promise.all`. Build a side-by-side embed with inline fields.

- [ ] **Step 3: Deploy to VM**

```bash
scp discord-bot/bot.js tristin@10.0.0.33:~/apexpulse-bot/bot.js
ssh tristin@10.0.0.33 "pm2 restart apexpulse-bot"
```

- [ ] **Step 4: Test and commit**

---

### Execution Order

1. **Task 5** (Discord /compare) — quickest, one file, immediate value
2. **Task 1** (Match detail view) — high user value, straightforward UI
3. **Task 4** (Website screenshots) — needs app running with data, partially manual
4. **Task 2** (Season tracker) — moderate complexity, needs season date data
5. **Task 3** (Death heatmap) — most complex, needs map images and coordinate calibration

Tasks 1 and 5 are independent and can be parallelized. Task 4 depends on having real app screenshots. Tasks 2 and 3 are independent of each other.
