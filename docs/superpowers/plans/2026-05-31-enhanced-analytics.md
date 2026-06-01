# Enhanced Analytics (Legends, Weapons, Headshot Diagram) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Legends and Weapons pages with sortable ranked tables (matching the style of competitive tracker apps), and add a headshot percentage body diagram with trend chart to the Stats page.

**Architecture:** Three independent tasks — each upgrades one page. Tasks 1 and 2 are pure UI refactors over existing data. Task 3 requires a new database column to track headshots from kill_feed events, then builds the visualization. No new dependencies needed — Recharts is already installed for the trend chart.

**Tech Stack:** React, Tailwind CSS, Recharts, SQLite (better-sqlite3), TypeScript

---

### Task 1: Legend Performance Rankings Table

Replaces the card grid on LegendsPage with a sortable ranked table showing: Rank, Legend (name + class badge), Kills, Kills/Match, Wins, Pick Rate %, DMG/Match, Matches. Sortable by clicking any column header.

**Files:**
- Modify: `src/dashboard/pages/LegendsPage.tsx`

**Data already available from `matchStore.legendStats`:**
- `legend` (string key), `matches`, `kills`, `damage`, `wins`, `avgDamage`, `kdRatio`
- Derived: `killsPerMatch = kills / matches`, `pickRate = matches / totalMatches * 100`, `dmgPerMatch = damage / matches`
- `totalMatches` is available from `useMatchStore(s => s.totalMatches)`

- [ ] **Step 1: Replace LegendsPage with sortable table**

Replace the entire content of `src/dashboard/pages/LegendsPage.tsx` with a sortable table component. Keep the class filter buttons. Remove the bar chart and card grid. Add sort state, sort handler, and sort indicator (same pattern already used in WeaponsPage).

Table columns:
| Column | Data | Align |
|--------|------|-------|
| Rank | Row index after sort | Center |
| Legend | `LEGENDS[key].displayName` + class badge | Left |
| Kills | `kills` | Right |
| Kills/Match | `kills / matches` (2 decimal) | Right |
| Wins | `wins` | Right |
| Pick Rate | `(matches / totalMatches * 100)%` (1 decimal) | Right |
| DMG/Match | `damage / matches` (1 decimal) | Right |
| Matches | `matches` | Right |

Default sort: Kills descending.

```tsx
import { useState, useMemo } from 'react';
import { useMatchStore } from '../../stores/matchStore';
import { LEGENDS } from '../../shared/legend-map';
import { LegendInfo } from '../../shared/types';

type LegendClass = LegendInfo['class'];
type ClassFilter = 'All' | LegendClass;
type SortColumn = 'kills' | 'killsPerMatch' | 'wins' | 'pickRate' | 'dmgPerMatch' | 'matches';
type SortDir = 'asc' | 'desc';

const CLASS_FILTERS: ClassFilter[] = ['All', 'Assault', 'Skirmisher', 'Recon', 'Support', 'Controller'];

const CLASS_COLORS: Record<LegendClass, string> = {
  Assault: 'text-red-400 border-red-400/30 bg-red-400/10',
  Skirmisher: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  Recon: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  Support: 'text-green-400 border-green-400/30 bg-green-400/10',
  Controller: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
};

export default function LegendsPage() {
  const legendStats = useMatchStore((s) => s.legendStats);
  const totalMatches = useMatchStore((s) => s.totalMatches);
  const [classFilter, setClassFilter] = useState<ClassFilter>('All');
  const [sortCol, setSortCol] = useState<SortColumn>('kills');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const tableRows = useMemo(() => {
    let rows = legendStats.map((s) => {
      const info = LEGENDS[s.legend] ?? null;
      return {
        key: s.legend,
        displayName: info?.displayName ?? s.legend,
        legendClass: info?.class ?? null,
        kills: s.kills,
        killsPerMatch: s.matches > 0 ? s.kills / s.matches : 0,
        wins: s.wins,
        pickRate: totalMatches > 0 ? (s.matches / totalMatches) * 100 : 0,
        dmgPerMatch: s.matches > 0 ? s.damage / s.matches : 0,
        matches: s.matches,
      };
    });

    if (classFilter !== 'All') {
      rows = rows.filter((r) => r.legendClass === classFilter);
    }

    rows.sort((a, b) => {
      const aVal = a[sortCol] as number;
      const bVal = b[sortCol] as number;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return rows;
  }, [legendStats, totalMatches, classFilter, sortCol, sortDir]);

  function handleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function sortIndicator(col: SortColumn) {
    if (sortCol !== col) return <span className="text-white/20"> ↕</span>;
    return <span className="text-apex-cyan">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>;
  }

  const columns: { col: SortColumn; label: string }[] = [
    { col: 'kills', label: 'Kills' },
    { col: 'killsPerMatch', label: 'Kills/Match' },
    { col: 'wins', label: 'Wins' },
    { col: 'pickRate', label: 'Pick Rate' },
    { col: 'dmgPerMatch', label: 'DMG/Match' },
    { col: 'matches', label: 'Matches' },
  ];

  return (
    <div className="min-h-screen bg-apex-navy p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-wide text-white">Legend Analytics</h1>
        <div className="flex flex-wrap gap-2">
          {CLASS_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setClassFilter(filter)}
              className={[
                'px-3 py-1.5 rounded text-sm font-mono border transition-colors',
                classFilter === filter
                  ? 'border-apex-cyan text-apex-cyan bg-apex-cyan/10'
                  : 'border-white/10 text-white/50 bg-white/5 hover:border-white/30 hover:text-white/80',
              ].join(' ')}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {legendStats.length === 0 ? (
        <div className="glass-card flex items-center justify-center py-24 text-center">
          <p className="text-white/40 font-mono text-sm">No legend data yet. Play some matches to see your legend analytics!</p>
        </div>
      ) : (
        <div className="glass-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left text-[11px] text-white/45 font-semibold uppercase tracking-wider w-12">Rank</th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/45 font-semibold uppercase tracking-wider">Legend</th>
                  {columns.map(({ col, label }) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-4 py-3 text-right text-[11px] text-white/45 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-white/70"
                    >
                      {label}{sortIndicator(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={row.key} className="border-b border-white/[0.04] hover:bg-cyan-400/[0.04] transition-colors">
                    <td className="px-4 py-3 text-center text-white/30 font-mono text-sm">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm">{row.displayName}</span>
                        {row.legendClass && (
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${CLASS_COLORS[row.legendClass]}`}>
                            {row.legendClass}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-apex-cyan font-bold">{row.kills.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-white/80">{row.killsPerMatch.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-white/80">{row.wins.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-white/80">{row.pickRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-white/80">{row.dmgPerMatch.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-white/60">{row.matches.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**

```bash
npx cross-env NODE_ENV=production npx webpack --config webpack.config.js
```

Expected: compiles with only size warnings, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/LegendsPage.tsx
git commit -m "feat: replace legend cards with sortable ranked table"
```

---

### Task 2: Weapon Rankings Table Enhancement

Add Rank column and DMG column to the existing weapons table. Add weapon damage tracking to the database. The current `match_weapons` table only stores kills and knockdowns per weapon — we need to also store damage per weapon.

**Files:**
- Modify: `src/background/database.ts` (add damage column to match_weapons, update queries)
- Modify: `src/background/match-tracker.ts` (track weapon damage from kill_feed)
- Modify: `src/stores/matchStore.ts` (add totalDamage to weaponStats type)
- Modify: `src/dashboard/pages/WeaponsPage.tsx` (add Rank column, add Damage column, reorder)

**Note:** Since the existing weapon stats table already has sorting, category filters, and the exact pattern we need, this task is lighter — mainly adding the Rank column and ensuring the table matches the screenshot style (Rank, Weapon, Kills, Damage, Games Used as core columns).

- [ ] **Step 1: Add Rank column to weapons table**

In `src/dashboard/pages/WeaponsPage.tsx`, add a Rank column (row index + 1) as the first column in the table, similar to what we did in the Legends table. The rank should reflect the current sort order.

In the `<thead>`, add before the Weapon column:
```tsx
<th style={{ ...thStyle, textAlign: 'center', width: 50, cursor: 'default' }}>Rank</th>
```

In the `<tbody>`, add as first `<td>` in each row:
```tsx
<td style={{ ...tdStyle, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
  {index + 1}
</td>
```

Update the `.map()` call to include the index: `{tableRows.map((row, index) => (`

- [ ] **Step 2: Build and verify**

```bash
npx cross-env NODE_ENV=production npx webpack --config webpack.config.js
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/WeaponsPage.tsx
git commit -m "feat: add rank column to weapons table"
```

---

### Task 3: Headshot % Body Diagram

Add a headshot tracking system and visualization to the Stats page. Requires:
1. New `is_headshot` column on `match_weapons` or a separate tracking mechanism
2. Body diagram SVG component showing head vs body hit zones
3. Trend line chart showing headshot % over last 7 games

**Files:**
- Modify: `src/background/database.ts` (add headshot tracking column and queries)
- Modify: `src/background/match-tracker.ts` (track headshots from kill_feed events)
- Modify: `src/shared/types.ts` (add headshot fields)
- Create: `src/dashboard/components/BodyDiagram.tsx` (SVG body silhouette with hit zones)
- Modify: `src/dashboard/pages/StatsPage.tsx` (add the diagram + trend chart)

**GEP kill_feed data:** The kill_feed event includes an `action` field. Headshot kills come through as `headshot_kill` vs regular `kill`. We can track this in the existing `weaponKills` tracking in match-tracker.

- [ ] **Step 1: Add headshot tracking to match-tracker**

In `src/background/match-tracker.ts`, add headshot counters to `LiveMatchData`. 

First, update `src/shared/types.ts` — add to the `LiveMatchData` interface:
```typescript
headshots: number;
bodyshots: number;
```

In `src/background/match-tracker.ts`, update `createEmptyLiveData()`:
```typescript
headshots: 0,
bodyshots: 0,
```

In `handleKillFeed`, after the existing `isPlayerKill` block, add headshot/bodyshot counting:
```typescript
if (isPlayerKill && event.action === 'kill') {
  live.bodyshots++;
}
if (isPlayerKill && event.action === 'headshot_kill') {
  live.headshots++;
}
```

- [ ] **Step 2: Add headshot fields to the match database**

In `src/background/database.ts`, add columns to the `matches` table schema:
```sql
headshots INTEGER NOT NULL DEFAULT 0,
bodyshots INTEGER NOT NULL DEFAULT 0,
```

Add these to the `insertMatch` statement and the `dbRowToMatchRecord` function.

Update `src/shared/types.ts` `MatchRecord` to include:
```typescript
headshots: number;
bodyshots: number;
```

In `finalizeMatch()` in match-tracker.ts, pass `live.headshots` and `live.bodyshots` to the record.

- [ ] **Step 3: Add database query for headshot stats**

In `src/background/database.ts`, add:
```typescript
export function getHeadshotStats(limit = 7): Array<{ matchId: string; timestamp: number; headshots: number; bodyshots: number }> {
  return requireDb().prepare(
    'SELECT id as matchId, timestamp, headshots, bodyshots FROM matches WHERE headshots + bodyshots > 0 ORDER BY timestamp DESC LIMIT ?'
  ).all(limit) as Array<{ matchId: string; timestamp: number; headshots: number; bodyshots: number }>;
}
```

Wire this into `broadcastFullState()` in `src/main/main.ts` so it's included in the match history update payload. Add it to `matchStore.ts` state.

- [ ] **Step 4: Create BodyDiagram component**

Create `src/dashboard/components/BodyDiagram.tsx`:

A simple SVG silhouette of a human body with two zones highlighted — head (cyan for headshots) and body (teal for bodyshots). Show the percentage values next to each zone.

```tsx
import React from 'react';

interface BodyDiagramProps {
  headshotPct: number;
  bodyshotPct: number;
}

const BodyDiagram: React.FC<BodyDiagramProps> = ({ headshotPct, bodyshotPct }) => {
  return (
    <div className="flex items-center justify-center gap-6">
      <svg viewBox="0 0 120 280" className="w-28 h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Head */}
        <circle cx="60" cy="35" r="22" fill={`rgba(0,229,255,${Math.max(headshotPct / 100, 0.15)})`} stroke="rgba(0,229,255,0.5)" strokeWidth="1" />
        {/* Neck */}
        <rect x="52" y="57" width="16" height="12" rx="4" fill="rgba(0,200,200,0.2)" />
        {/* Torso */}
        <path d="M30 69 Q30 65 40 65 L80 65 Q90 65 90 69 L95 160 Q95 170 85 170 L35 170 Q25 170 25 160 Z"
          fill={`rgba(0,200,200,${Math.max(bodyshotPct / 100, 0.15)})`} stroke="rgba(0,200,200,0.4)" strokeWidth="1" />
        {/* Left arm */}
        <path d="M30 72 L15 130 L10 135 L20 138 L35 85" fill="rgba(0,200,200,0.15)" stroke="rgba(0,200,200,0.3)" strokeWidth="1" />
        {/* Right arm */}
        <path d="M90 72 L105 130 L110 135 L100 138 L85 85" fill="rgba(0,200,200,0.15)" stroke="rgba(0,200,200,0.3)" strokeWidth="1" />
        {/* Left leg */}
        <path d="M35 170 L30 245 L25 265 L40 265 L45 245 L50 170" fill="rgba(0,200,200,0.12)" stroke="rgba(0,200,200,0.25)" strokeWidth="1" />
        {/* Right leg */}
        <path d="M70 170 L75 245 L80 265 L95 265 L90 245 L85 170" fill="rgba(0,200,200,0.12)" stroke="rgba(0,200,200,0.25)" strokeWidth="1" />
      </svg>
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-2xl font-bold text-apex-cyan">{headshotPct.toFixed(1)}%</div>
          <div className="text-xs text-gray-400">of Hits</div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">Headshots</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-teal-400">{bodyshotPct.toFixed(1)}%</div>
          <div className="text-xs text-gray-400">of Hits</div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">Body Shots</div>
        </div>
      </div>
    </div>
  );
};

export default BodyDiagram;
```

- [ ] **Step 5: Add headshot section to StatsPage**

In `src/dashboard/pages/StatsPage.tsx`, import BodyDiagram and Recharts components. Add a new section with:
1. Title: "AVG. HEADSHOT % — LAST 7 GAMES"
2. The BodyDiagram component showing aggregate headshot/bodyshot percentages
3. A Recharts `LineChart` below showing per-game headshot % trend over last 7 games

```tsx
// Compute from headshot stats
const totalHeadshots = headshotData.reduce((s, g) => s + g.headshots, 0);
const totalBodyshots = headshotData.reduce((s, g) => s + g.bodyshots, 0);
const totalHits = totalHeadshots + totalBodyshots;
const headshotPct = totalHits > 0 ? (totalHeadshots / totalHits) * 100 : 0;
const bodyshotPct = totalHits > 0 ? (totalBodyshots / totalHits) * 100 : 0;

const trendData = headshotData.reverse().map((g, i) => {
  const hits = g.headshots + g.bodyshots;
  return { game: i + 1, pct: hits > 0 ? (g.headshots / hits) * 100 : 0 };
});
```

Use a `LineChart` with cyan line, no fill, dot markers, and a white/10 grid.

- [ ] **Step 6: Add dev-sim headshot_kill event support**

In `src/main/main.ts`, in the `dev-sim-event` handler, the existing `kill_feed` case already passes through to `handleKillFeed`. Ensure the action field supports `'headshot_kill'`:

```js
// From console:
apexPulse.send('dev-sim-event', { type: 'kill_feed', data: { attackerName: 'Tristin', victimName: 'Enemy', weaponName: 'R-301', action: 'headshot_kill' } })
```

This already works because the sim passes `data` directly to `handleKillFeed`. No code change needed — just documenting the test command.

- [ ] **Step 7: Build, test, and commit**

```bash
npx cross-env NODE_ENV=production npx webpack --config webpack.config.js
```

Test with dev sim commands. Verify headshot diagram renders with percentages and the trend chart shows data.

```bash
git add src/shared/types.ts src/background/database.ts src/background/match-tracker.ts src/dashboard/components/BodyDiagram.tsx src/dashboard/pages/StatsPage.tsx src/main/main.ts src/stores/matchStore.ts
git commit -m "feat: add headshot % body diagram with trend chart"
```

---

### Execution Notes

- Tasks 1 and 2 are independent and can be done in parallel
- Task 3 depends on nothing but is the most complex (new data pipeline)
- No new npm dependencies required
- Legend portraits and weapon icons are NOT included — using text + badges instead (matching what the codebase already does). Icons can be added later as a polish pass.
- Database schema changes in Task 3 use `DEFAULT 0` so existing rows are compatible without migration
