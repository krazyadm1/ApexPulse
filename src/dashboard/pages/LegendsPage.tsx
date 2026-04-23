import { useState } from 'react';
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
import { LEGENDS } from '../../shared/legend-map';
import { LegendInfo } from '../../shared/types';

type LegendClass = LegendInfo['class'];
type ClassFilter = 'All' | LegendClass;

const CLASS_FILTERS: ClassFilter[] = [
  'All',
  'Assault',
  'Skirmisher',
  'Recon',
  'Support',
  'Controller',
];

const CLASS_BADGE_COLORS: Record<LegendClass, string> = {
  Assault: 'text-red-400 border-red-400/40 bg-red-400/10',
  Skirmisher: 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10',
  Recon: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
  Support: 'text-green-400 border-green-400/40 bg-green-400/10',
  Controller: 'text-purple-400 border-purple-400/40 bg-purple-400/10',
};

export default function LegendsPage() {
  const legendStats = useMatchStore((s) => s.legendStats);
  const [classFilter, setClassFilter] = useState<ClassFilter>('All');

  // Enrich stats with legend metadata, sort by matches DESC
  const enrichedStats = legendStats
    .map((stat) => ({
      ...stat,
      info: LEGENDS[stat.legend] ?? null,
    }))
    .sort((a, b) => b.matches - a.matches);

  // Apply class filter
  const filteredStats = enrichedStats.filter((stat) => {
    if (classFilter === 'All') return true;
    return stat.info?.class === classFilter;
  });

  // Chart data — top legends by matches played (unfiltered, up to 10)
  const chartData = enrichedStats.slice(0, 10).map((stat) => ({
    name: stat.info?.displayName ?? stat.legend,
    matches: stat.matches,
  }));

  const hasStats = legendStats.length > 0;

  return (
    <div className="min-h-screen bg-apex-navy p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-wide text-white">
          Legend Analytics
        </h1>

        {/* Class filter buttons */}
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

      {/* Empty state */}
      {!hasStats && (
        <div className="glass-card flex items-center justify-center py-24 text-center">
          <p className="text-white/40 font-mono text-sm">
            No legend data yet. Play some matches to see your legend analytics!
          </p>
        </div>
      )}

      {hasStats && (
        <>
          {/* Legend Comparison Chart */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-mono text-white/60 uppercase tracking-widest mb-4">
              Matches Played by Legend
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A1628',
                    border: '1px solid rgba(0,229,255,0.2)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'rgba(0,229,255,0.05)' }}
                  formatter={(value) => [String(value), 'Matches']}
                />
                <Bar dataKey="matches" fill="#00E5FF" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend Cards Grid */}
          {filteredStats.length === 0 ? (
            <div className="glass-card flex items-center justify-center py-16 text-center">
              <p className="text-white/40 font-mono text-sm">
                No legends found for the selected class.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStats.map((stat) => {
                const info = stat.info;
                const legendClass = info?.class ?? null;
                const displayName = info?.displayName ?? stat.legend;
                const winRate =
                  stat.matches > 0
                    ? ((stat.wins / stat.matches) * 100).toFixed(1)
                    : '0.0';

                return (
                  <div key={stat.legend} className="glass-card p-5 space-y-4">
                    {/* Legend name + class badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-semibold tracking-wide truncate">
                        {displayName}
                      </span>
                      {legendClass && (
                        <span
                          className={[
                            'shrink-0 px-2 py-0.5 rounded border text-xs font-mono',
                            CLASS_BADGE_COLORS[legendClass],
                          ].join(' ')}
                        >
                          {legendClass}
                        </span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-5 gap-1 text-center">
                      {[
                        { label: 'Matches', value: stat.matches.toLocaleString() },
                        { label: 'Kills', value: stat.kills.toLocaleString() },
                        { label: 'K/D', value: stat.kdRatio.toFixed(2) },
                        { label: 'Avg Dmg', value: Math.round(stat.avgDamage).toLocaleString() },
                        { label: 'Win %', value: `${winRate}%` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col gap-0.5">
                          <span className="text-white/40 text-[10px] leading-tight">
                            {label}
                          </span>
                          <span className="text-white font-mono text-sm leading-tight">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
