import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMatchStore } from '../../stores/matchStore';
import { WEAPON_MAP } from '../../shared/weapon-map';

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryFilter =
  | 'All'
  | 'Assault Rifle'
  | 'SMG'
  | 'LMG'
  | 'Marksman'
  | 'Sniper'
  | 'Shotgun'
  | 'Pistol';

type SortColumn =
  | 'weapon'
  | 'category'
  | 'kills'
  | 'knockdowns'
  | 'matchesUsed'
  | 'killsPerMatch';

type SortDir = 'asc' | 'desc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_FILTERS: CategoryFilter[] = [
  'All',
  'Assault Rifle',
  'SMG',
  'LMG',
  'Marksman',
  'Sniper',
  'Shotgun',
  'Pistol',
];

function getWeaponDisplay(weaponName: string): string {
  return WEAPON_MAP[weaponName]?.display ?? weaponName;
}

function getWeaponCategory(weaponName: string): string {
  return WEAPON_MAP[weaponName]?.category ?? 'Unknown';
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomBarTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="glass-card"
      style={{ padding: '8px 14px', border: '1px solid rgba(0,229,255,0.25)' }}
    >
      <p style={{ color: '#00E5FF', margin: 0, fontSize: 13 }}>{label}</p>
      <p style={{ color: '#fff', margin: '2px 0 0', fontSize: 13 }}>
        Kills: <span className="font-mono">{payload[0].value}</span>
      </p>
    </div>
  );
}

// ─── Category Card ─────────────────────────────────────────────────────────────

interface CategoryCardProps {
  category: string;
  totalKills: number;
  weaponsUsed: number;
  bestWeapon: string;
  bestWeaponKills: number;
}

function CategoryCard({
  category,
  totalKills,
  weaponsUsed,
  bestWeapon,
  bestWeaponKills,
}: CategoryCardProps) {
  return (
    <div className="glass-card" style={{ padding: '18px 20px' }}>
      <h3
        style={{
          color: '#00E5FF',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: '0 0 14px',
        }}
      >
        {category}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Total Kills</span>
          <span
            className="font-mono"
            style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}
          >
            {totalKills.toLocaleString()}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Weapons Used</span>
          <span className="font-mono" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>
            {weaponsUsed}
          </span>
        </div>

        {bestWeapon && (
          <div
            style={{
              marginTop: 6,
              padding: '8px 10px',
              background: 'rgba(0,229,255,0.06)',
              borderRadius: 6,
              borderLeft: '2px solid #00E5FF',
            }}
          >
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 2 }}>
              Best Weapon
            </div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{bestWeapon}</div>
            <div
              className="font-mono"
              style={{ color: '#00E5FF', fontSize: 12, marginTop: 1 }}
            >
              {bestWeaponKills} kills
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WeaponsPage() {
  const weaponStats = useMatchStore((s) => s.weaponStats);

  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('All');
  const [sortCol, setSortCol] = useState<SortColumn>('kills');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Bar chart: top 10 weapons by kills ──────────────────────────────────────
  const barChartData = useMemo(() => {
    return [...weaponStats]
      .sort((a, b) => b.totalKills - a.totalKills)
      .slice(0, 10)
      .map((ws) => ({
        name: getWeaponDisplay(ws.weaponName),
        kills: ws.totalKills,
      }));
  }, [weaponStats]);

  // ── Category breakdown ──────────────────────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { totalKills: number; weapons: Array<{ name: string; kills: number }> }
    >();

    for (const ws of weaponStats) {
      const cat = getWeaponCategory(ws.weaponName);
      // Skip non-player-controlled categories in the breakdown cards
      if (cat === 'Environmental' || cat === 'Melee' || cat === 'Unknown') continue;

      if (!map.has(cat)) map.set(cat, { totalKills: 0, weapons: [] });
      const entry = map.get(cat)!;
      entry.totalKills += ws.totalKills;
      entry.weapons.push({ name: getWeaponDisplay(ws.weaponName), kills: ws.totalKills });
    }

    const result: CategoryCardProps[] = [];
    for (const [category, data] of map.entries()) {
      const best = data.weapons.reduce(
        (prev, cur) => (cur.kills > prev.kills ? cur : prev),
        { name: '', kills: 0 }
      );
      result.push({
        category,
        totalKills: data.totalKills,
        weaponsUsed: data.weapons.length,
        bestWeapon: best.name,
        bestWeaponKills: best.kills,
      });
    }

    // Sort cards by total kills descending
    return result.sort((a, b) => b.totalKills - a.totalKills);
  }, [weaponStats]);

  // ── Filtered + sorted table rows ─────────────────────────────────────────────
  const tableRows = useMemo(() => {
    let rows = weaponStats.map((ws) => ({
      weaponName: ws.weaponName,
      display: getWeaponDisplay(ws.weaponName),
      category: getWeaponCategory(ws.weaponName),
      kills: ws.totalKills,
      knockdowns: ws.totalKnockdowns,
      matchesUsed: ws.matchesUsed,
      killsPerMatch: ws.matchesUsed > 0 ? ws.totalKills / ws.matchesUsed : 0,
    }));

    // Filter
    if (activeFilter !== 'All') {
      rows = rows.filter((r) => r.category === activeFilter);
    }

    // Sort
    rows.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortCol) {
        case 'weapon':
          aVal = a.display;
          bVal = b.display;
          break;
        case 'category':
          aVal = a.category;
          bVal = b.category;
          break;
        case 'kills':
          aVal = a.kills;
          bVal = b.kills;
          break;
        case 'knockdowns':
          aVal = a.knockdowns;
          bVal = b.knockdowns;
          break;
        case 'matchesUsed':
          aVal = a.matchesUsed;
          bVal = b.matchesUsed;
          break;
        case 'killsPerMatch':
          aVal = a.killsPerMatch;
          bVal = b.killsPerMatch;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal as string);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return rows;
  }, [weaponStats, activeFilter, sortCol, sortDir]);

  // ── Sort handler ──────────────────────────────────────────────────────────────
  function handleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function sortIndicator(col: SortColumn) {
    if (sortCol !== col) return <span style={{ color: 'rgba(255,255,255,0.2)' }}> ↕</span>;
    return (
      <span style={{ color: '#00E5FF' }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
    );
  }

  // ── Shared header cell styles ─────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '11px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: '#050B14' }}>

      {/* ── Empty State ── */}
      {weaponStats.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>🔫</div>
          <p className="text-white font-mono font-semibold text-base" style={{ margin: '0 0 4px' }}>No weapon data yet</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>Play some matches and your weapon stats will appear here.</p>
        </div>
      )}

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <h1
          style={{
            color: '#fff',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.02em',
            margin: 0,
            flexShrink: 0,
          }}
        >
          Weapon Analytics
        </h1>

        {/* Category filter buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORY_FILTERS.map((cat) => {
            const isActive = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  border: isActive
                    ? '1px solid rgba(0,229,255,0.45)'
                    : '1px solid rgba(255,255,255,0.1)',
                  background: isActive ? 'rgba(0,229,255,0.2)' : 'transparent',
                  color: isActive ? '#00E5FF' : 'rgba(255,255,255,0.55)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                className={
                  isActive
                    ? 'bg-apex-cyan bg-opacity-20 text-apex-cyan'
                    : ''
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bar Chart ── */}
      <div className="glass-card" style={{ padding: '20px 20px 10px', marginBottom: 24 }}>
        <h2
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            margin: '0 0 18px',
          }}
        >
          Top 10 Weapons by Kills
        </h2>

        {barChartData.length === 0 ? (
          <div
            style={{
              height: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 13,
            }}
          >
            No weapon data available yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={barChartData}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0,229,255,0.06)' }} />
              <Bar dataKey="kills" fill="#00E5FF" radius={[3, 3, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Category Breakdown ── */}
      {categoryBreakdown.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              margin: '0 0 14px',
            }}
          >
            Category Breakdown
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            {categoryBreakdown.map((cat) => (
              <CategoryCard key={cat.category} {...cat} />
            ))}
          </div>
        </div>
      )}

      {/* ── Weapons Table ── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Weapon Details
          </h2>
        </div>

        {tableRows.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.35)',
              fontSize: 13,
            }}
          >
            No weapon data yet. Play some matches to see your weapon analytics!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 560,
              }}
            >
              <thead>
                <tr>
                  {(
                    [
                      { col: 'weapon', label: 'Weapon' },
                      { col: 'category', label: 'Category' },
                      { col: 'kills', label: 'Kills' },
                      { col: 'knockdowns', label: 'Knockdowns' },
                      { col: 'matchesUsed', label: 'Matches Used' },
                      { col: 'killsPerMatch', label: 'Kills / Match' },
                    ] as { col: SortColumn; label: string }[]
                  ).map(({ col, label }) => (
                    <th
                      key={col}
                      style={thStyle}
                      onClick={() => handleSort(col)}
                    >
                      {label}
                      {sortIndicator(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr
                    key={row.weaponName}
                    style={{ transition: 'background 0.1s' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        'rgba(0,229,255,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                    }}
                  >
                    <td style={{ ...tdStyle, color: '#fff', fontWeight: 600 }}>
                      {row.display}
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                      {row.category}
                    </td>
                    <td style={{ ...tdStyle }}>
                      <span className="font-mono" style={{ color: '#00E5FF', fontWeight: 700 }}>
                        {row.kills.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ ...tdStyle }}>
                      <span className="font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {row.knockdowns.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ ...tdStyle }}>
                      <span className="font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {row.matchesUsed.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ ...tdStyle }}>
                      <span className="font-mono" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {row.killsPerMatch.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
