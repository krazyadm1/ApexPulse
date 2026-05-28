import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMatchStore } from '../../stores/matchStore';
import { MatchRecord } from '../../shared/types';
import CoachMark from '../components/CoachMark';

// ─── Time Range ───────────────────────────────────────────────────────────────

type TimeRange = 'today' | 'week' | 'season' | 'all';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: 'Today',
  week: 'Week',
  season: 'Season',
  'all': 'All-Time',
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string | number;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-apex-navy border border-white border-opacity-10 rounded-lg px-3 py-2 text-sm shadow-lg">
      {label !== undefined && (
        <p className="text-gray-400 mb-1 text-xs">Match {label}</p>
      )}
      {payload.map((entry) => (
        <p key={entry.name} className="font-mono font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
        </p>
      ))}
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, sub }) => (
  <div className="glass-card flex flex-col gap-1">
    <span className="text-gray-400 text-xs uppercase tracking-widest">{title}</span>
    <span className="text-3xl font-bold font-mono text-white leading-tight">{value}</span>
    {sub && <span className="text-gray-500 text-xs">{sub}</span>}
  </div>
);

// ─── Heirloom Pack Tracker ────────────────────────────────────────────────────

const PACK_PITY = 500;
const PACK_STORAGE_KEY = 'apexpulse_pack_count';

const HeirloomPackTracker: React.FC = () => {
  const [packCount, setPackCount] = useState<number>(() => {
    const stored = localStorage.getItem(PACK_STORAGE_KEY);
    const parsed = stored !== null ? parseInt(stored, 10) : 0;
    return isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, PACK_PITY));
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PACK_STORAGE_KEY && e.newValue !== null) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed)) setPackCount(Math.max(0, Math.min(parsed, PACK_PITY)));
      }
    };
    window.addEventListener('storage', handleStorage);

    // Listen for automatic pack detection from background
    const api = (window as unknown as { apexPulse?: { on: (ch: string, cb: (...args: unknown[]) => void) => void } }).apexPulse;
    if (api) {
      api.on('pack-update', (data) => {
        const payload = data as { count: number };
        if (typeof payload.count === 'number') {
          setPackCount(Math.max(0, Math.min(payload.count, PACK_PITY)));
        }
      });
    }

    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const pct = (packCount / PACK_PITY) * 100;

  let barColor: string;
  if (packCount < 300) barColor = '#22C55E';       // green
  else if (packCount < 450) barColor = '#EAB308';  // yellow
  else barColor = '#00E5FF';                         // apex-cyan

  return (
    <div className="glass-card">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-lg font-bold text-white">Heirloom Pack Tracker</h3>
          <p className="text-gray-400 text-sm mt-0.5 max-w-xl">
            Track your progress toward guaranteed Heirloom Shards (500 pack pity timer)
          </p>
        </div>
        <div className="text-right ml-4 shrink-0">
          <span
            className="font-mono text-3xl font-bold"
            style={{ color: barColor }}
          >
            {packCount}
          </span>
          <span className="font-mono text-xl text-gray-500"> / {PACK_PITY} packs</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 mb-3">
        <div className="relative h-4 w-full rounded-full bg-white bg-opacity-5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: barColor,
              boxShadow: `0 0 8px ${barColor}66`,
            }}
          />
          {/* Threshold markers */}
          <div
            className="absolute top-0 h-full w-px bg-green-500 bg-opacity-50"
            style={{ left: `${(300 / PACK_PITY) * 100}%` }}
          />
          <div
            className="absolute top-0 h-full w-px bg-yellow-500 bg-opacity-50"
            style={{ left: `${(450 / PACK_PITY) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-600 font-mono select-none">
          <span>0</span>
          <span className="text-green-600">300</span>
          <span className="text-yellow-600">450</span>
          <span className="text-apex-cyan">500</span>
        </div>
      </div>

      <p className="text-gray-500 text-xs mt-3">
        Auto-detects pack openings via screen capture. Set your starting count in Settings.
      </p>
    </div>
  );
};

// ─── Chart helpers ────────────────────────────────────────────────────────────

interface KillsDataPoint {
  match: number;
  kills: number;
}

interface DamageDataPoint {
  match: number;
  damage: number;
}

interface KdDataPoint {
  match: number;
  kd: number;
}

function buildKillsData(matches: MatchRecord[]): KillsDataPoint[] {
  return [...matches].reverse().map((m, i) => ({ match: i + 1, kills: m.kills }));
}

function buildDamageData(matches: MatchRecord[]): DamageDataPoint[] {
  return [...matches].reverse().map((m, i) => ({ match: i + 1, damage: m.damage }));
}

function buildKdData(matches: MatchRecord[]): KdDataPoint[] {
  let cumulativeKills = 0;
  let cumulativeDeaths = 0;
  return [...matches].reverse().map((m, i) => {
    cumulativeKills += m.kills;
    // A death = 1 per non-win match (eliminated = squad wiped)
    cumulativeDeaths += m.isWin ? 0 : 1;
    const kd = cumulativeDeaths === 0 ? cumulativeKills : cumulativeKills / cumulativeDeaths;
    return { match: i + 1, kd: parseFloat(kd.toFixed(2)) };
  });
}

// ─── Shared chart props ───────────────────────────────────────────────────────

const axisStyle = { fill: '#9CA3AF', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' };
const gridStyle = { stroke: 'rgba(255,255,255,0.08)' };

// ─── Main Component ───────────────────────────────────────────────────────────

const StatsPage: React.FC = () => {
  const {
    recentMatches,
    totalMatches,
    totalKills,
    kdRatio,
    winRate,
    avgDamage,
  } = useMatchStore();

  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  // Time range filtering is wired up for future implementation.
  // Currently all ranges resolve to the full store data.
  const filteredMatches: MatchRecord[] = useMemo(() => {
    // Placeholder filter — swap in real date logic when needed.
    return recentMatches;
  }, [recentMatches, timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const killsData = useMemo(() => buildKillsData(filteredMatches), [filteredMatches]);
  const damageData = useMemo(() => buildDamageData(filteredMatches), [filteredMatches]);
  const kdData = useMemo(() => buildKdData(filteredMatches), [filteredMatches]);

  const hasData = filteredMatches.length > 0;

  return (
    <div className="flex flex-col gap-8 p-8 min-h-full">

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Statistics</h2>
          <p className="text-gray-400 text-sm mt-1">
            {totalMatches > 0 ? `${totalMatches} matches tracked` : 'No matches recorded yet.'}
          </p>
        </div>

        {/* Time range selector */}
        <CoachMark id="timerange" message="Filter your stats by time period. Play a few matches to see trends in the charts.">
          <div className="flex gap-2 bg-apex-navy rounded-xl p-1 border border-white border-opacity-10">
            {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  timeRange === range
                    ? 'bg-apex-cyan bg-opacity-15 text-apex-cyan border border-apex-cyan border-opacity-40'
                    : 'text-gray-400 hover:text-white hover:bg-white hover:bg-opacity-5'
                }`}
              >
                {TIME_RANGE_LABELS[range]}
              </button>
            ))}
          </div>
        </CoachMark>
      </header>

      {/* ── Overall Stats Cards ── */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Matches"
            value={totalMatches.toLocaleString()}
          />
          <StatCard
            title="Total Kills"
            value={totalKills.toLocaleString()}
          />
          <StatCard
            title="K/D Ratio"
            value={kdRatio.toFixed(2)}
            sub="Kills per death"
          />
          <StatCard
            title="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            sub={`${avgDamage.toLocaleString()} avg dmg`}
          />
        </div>
      </section>

      {/* ── Performance Charts (2-col) ── */}
      <section>
        <h3 className="text-base font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Match Performance
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Kills Per Match Trend */}
          <div className="glass-card">
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Kills Per Match</h4>
            {hasData ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={killsData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
                  <XAxis dataKey="match" tick={axisStyle} tickLine={false} axisLine={false} label={{ value: 'Match', fill: '#6B7280', fontSize: 10, position: 'insideBottomRight', offset: -4 }} />
                  <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="kills"
                    name="Kills"
                    stroke="#00E5FF"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#00E5FF', stroke: '#050B14', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={220} />
            )}
          </div>

          {/* Damage Per Match Trend */}
          <div className="glass-card">
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Damage Per Match</h4>
            {hasData ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={damageData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
                  <XAxis dataKey="match" tick={axisStyle} tickLine={false} axisLine={false} label={{ value: 'Match', fill: '#6B7280', fontSize: 10, position: 'insideBottomRight', offset: -4 }} />
                  <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="damage"
                    name="Damage"
                    stroke="#22C55E"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#22C55E', stroke: '#050B14', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={220} />
            )}
          </div>

        </div>
      </section>

      {/* ── K/D Over Time (full width) ── */}
      <section>
        <h3 className="text-base font-semibold text-gray-300 uppercase tracking-wider mb-4">
          K/D Ratio Over Time
        </h3>
        <div className="glass-card">
          <h4 className="text-sm font-semibold text-gray-300 mb-4">Cumulative K/D</h4>
          {hasData ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={kdData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="kdGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
                <XAxis dataKey="match" tick={axisStyle} tickLine={false} axisLine={false} label={{ value: 'Match', fill: '#6B7280', fontSize: 10, position: 'insideBottomRight', offset: -4 }} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="kd"
                  name="K/D"
                  stroke="#00E5FF"
                  strokeWidth={2}
                  fill="url(#kdGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#00E5FF', stroke: '#050B14', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart height={260} />
          )}
        </div>
      </section>

      {/* ── Heirloom Pack Tracker ── */}
      <section>
        <h3 className="text-base font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Cosmetics
        </h3>
        <HeirloomPackTracker />
      </section>

    </div>
  );
};

// ─── Empty state placeholder for charts ──────────────────────────────────────

const EmptyChart: React.FC<{ height: number }> = ({ height }) => (
  <div
    className="flex items-center justify-center text-gray-600 text-sm"
    style={{ height }}
  >
    No match data yet — play some games to see your trends.
  </div>
);

export default StatsPage;
