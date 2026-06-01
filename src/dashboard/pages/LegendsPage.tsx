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
        icon: info?.icon ?? null,
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
    if (sortCol !== col) return <span className="text-white/20 ml-1">↕</span>;
    return <span className="text-apex-cyan ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
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
            <table className="w-full border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-center text-[11px] text-white/45 font-semibold uppercase tracking-wider w-14">Rank</th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/45 font-semibold uppercase tracking-wider">Legend</th>
                  {columns.map(({ col, label }) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-4 py-3 text-right text-[11px] text-white/45 font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-white/70 transition-colors"
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
                      <div className="flex items-center gap-3">
                        {row.icon && (
                          <img
                            src={row.icon}
                            alt={row.displayName}
                            className="w-8 h-8 rounded-full bg-white/5 object-cover shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <span className="text-white font-semibold text-sm">{row.displayName}</span>
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
