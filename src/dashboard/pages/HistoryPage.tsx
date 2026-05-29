import React from 'react';
import { useMatchStore } from '../../stores/matchStore';
import { WEAPON_MAP } from '../../shared/weapon-map';
import { LEGENDS } from '../../shared/legend-map';
import { GameMode, MatchRecord } from '../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<GameMode | 'all', string> = {
  all: 'All Modes',
  battle_royale: 'Battle Royale',
  ranked_br: 'Ranked',
  mixtape: 'Mixtape',
  ltm: 'LTM',
  firing_range: 'Firing Range',
};

const FILTER_MODES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Modes' },
  { value: 'battle_royale', label: 'Battle Royale' },
  { value: 'ranked_br', label: 'Ranked' },
  { value: 'mixtape', label: 'Mixtape' },
  { value: 'ltm', label: 'LTM' },
];

function formatMode(mode: GameMode): string {
  return MODE_LABELS[mode] ?? mode;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getLegendDisplayName(legendId: string): string {
  return LEGENDS[legendId.toLowerCase()]?.displayName ?? legendId;
}

function getWeaponDisplayName(weaponKey: string): string {
  return WEAPON_MAP[weaponKey.toLowerCase()]?.display ?? weaponKey;
}

// ---------------------------------------------------------------------------
// Placement Badge
// ---------------------------------------------------------------------------

interface PlacementBadgeProps {
  placement: number;
}

function PlacementBadge({ placement }: PlacementBadgeProps) {
  const isValid = placement > 0;
  let bgClass: string;
  if (!isValid) {
    bgClass = 'bg-white/10 text-white';
  } else if (placement === 1) {
    bgClass = 'bg-yellow-500 text-black';
  } else if (placement <= 5) {
    bgClass = 'bg-apex-cyan text-apex-navy';
  } else {
    bgClass = 'bg-white/10 text-white';
  }

  return (
    <div
      className={`flex items-center justify-center w-10 h-10 rounded-full font-mono font-bold text-sm flex-shrink-0 ${bgClass}`}
      title={isValid ? `Placement: #${placement}` : 'Placement unknown'}
    >
      {isValid ? `#${placement}` : '?'}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded detail panel
// ---------------------------------------------------------------------------

interface ExpandedPanelProps {
  match: MatchRecord;
}

function ExpandedPanel({ match }: ExpandedPanelProps) {
  const isRanked = match.gameMode === 'ranked_br';

  return (
    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">

      {/* Duration */}
      <div className="flex flex-col gap-1">
        <span className="text-white/50 uppercase text-xs tracking-wider font-mono">Duration</span>
        <span className="text-white font-mono">
          {match.duration > 0 ? formatDuration(match.duration) : '—'}
        </span>
      </div>

      {/* Win badge */}
      {match.isWin && (
        <div className="flex items-center">
          <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-mono font-bold text-xs border border-yellow-500/40 uppercase tracking-widest">
            Champion
          </span>
        </div>
      )}

      {/* Ranked RP */}
      {isRanked && match.rpChange !== undefined && match.rpChange !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-white/50 uppercase text-xs tracking-wider font-mono">RP Change</span>
          <span
            className={`font-mono font-bold text-base ${
              match.rpChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {match.rpChange >= 0 ? '+' : ''}
            {match.rpChange} RP
          </span>
          {match.rankBefore && match.rankAfter && (
            <span className="text-white/40 text-xs font-mono">
              {match.rankBefore} → {match.rankAfter}
            </span>
          )}
        </div>
      )}

      {/* Weapons */}
      {match.weaponKills.length > 0 && (
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-white/50 uppercase text-xs tracking-wider font-mono">Weapons Used</span>
          <div className="flex flex-wrap gap-2">
            {match.weaponKills.map((wk, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
              >
                <span className="text-white font-mono text-xs">
                  {getWeaponDisplayName(wk.weaponName)}
                </span>
                <span className="text-apex-cyan font-mono font-bold text-xs">
                  {wk.kills}K
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teammates */}
      {match.teammates.length > 0 && (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-white/50 uppercase text-xs tracking-wider font-mono">Teammates</span>
          <div className="flex flex-col gap-1.5">
            {match.teammates.map((tm, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-mono text-sm">{tm.name}</span>
                  <span className="text-white/50 text-xs font-mono">
                    {getLegendDisplayName(tm.legend)}
                  </span>
                  <span className="text-white/30 text-xs font-mono uppercase">{tm.platform}</span>
                </div>
                <div className={`text-xs font-mono ${tm.survived ? 'text-green-400' : 'text-red-400'}`}>
                  {tm.survived ? 'Survived' : 'Eliminated'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match Card
// ---------------------------------------------------------------------------

interface MatchCardProps {
  match: MatchRecord;
  isExpanded: boolean;
  onToggle: () => void;
}

function MatchCard({ match, isExpanded, onToggle }: MatchCardProps) {
  return (
    <div
      className="glass-card p-4 cursor-pointer select-none transition-colors hover:border-white/20"
      onClick={onToggle}
      role="button"
      aria-expanded={isExpanded}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-4">
        {/* Placement badge */}
        <PlacementBadge placement={match.placement} />

        {/* Center info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-mono font-semibold text-sm">
              {formatMode(match.gameMode)}
            </span>
            {match.mapName && (
              <>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-white/60 text-sm">{match.mapName}</span>
              </>
            )}
            <span className="text-white/30 text-xs">·</span>
            <span className="text-apex-cyan text-sm font-mono">
              {getLegendDisplayName(match.legend)}
            </span>
          </div>
          <div className="text-white/40 text-xs font-mono mt-0.5">
            {new Date(match.timestamp).toLocaleString()}
          </div>
        </div>

        {/* Right stats */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-white font-mono font-bold text-base leading-none">
              {match.kills}
            </span>
            <span className="text-white/40 text-xs font-mono uppercase mt-0.5">Kills</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-white font-mono font-bold text-base leading-none">
              {match.damage.toLocaleString()}
            </span>
            <span className="text-white/40 text-xs font-mono uppercase mt-0.5">Damage</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-white font-mono font-bold text-base leading-none">
              {match.squadKills}
            </span>
            <span className="text-white/40 text-xs font-mono uppercase mt-0.5">Squad</span>
          </div>

          {/* Expand chevron */}
          <div
            className={`text-white/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
            aria-hidden="true"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && <ExpandedPanel match={match} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const recentMatches = useMatchStore((s) => s.recentMatches);

  const [expandedMatchId, setExpandedMatchId] = React.useState<string | null>(null);
  const [modeFilter, setModeFilter] = React.useState<string>('all');
  const [legendFilter, setLegendFilter] = React.useState<string>('all');

  const filteredMatches = recentMatches.filter((m) => {
    const modeOk = modeFilter === 'all' || m.gameMode === modeFilter;
    const legendOk = legendFilter === 'all' || m.legend.toLowerCase() === legendFilter;
    return modeOk && legendOk;
  });

  const selectClass =
    'bg-apex-navy border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-apex-cyan/50 transition-colors cursor-pointer';

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full" style={{ background: 'var(--apex-dark, #050B14)' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-mono tracking-tight">
            Match History
          </h1>
          <p className="text-white/40 text-sm font-mono mt-0.5">
            {filteredMatches.length === recentMatches.length
              ? `${recentMatches.length} match${recentMatches.length !== 1 ? 'es' : ''} recorded`
              : `Showing ${filteredMatches.length} of ${recentMatches.length} matches`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Mode filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by game mode"
          >
            {FILTER_MODES.map((m) => (
              <option key={m.value} value={m.value} style={{ background: '#0A1628' }}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Legend filter */}
          <select
            value={legendFilter}
            onChange={(e) => setLegendFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by legend"
          >
            <option value="all" style={{ background: '#0A1628' }}>All Legends</option>
            {Object.values(LEGENDS)
              .sort((a, b) => a.displayName.localeCompare(b.displayName))
              .map((legend) => (
                <option key={legend.id} value={legend.id} style={{ background: '#0A1628' }}>
                  {legend.displayName}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Match List / Empty State */}
      {recentMatches.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="text-4xl opacity-30" aria-hidden="true">
            {/* Target / crosshair icon */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white">
              <circle cx="24" cy="24" r="20" />
              <circle cx="24" cy="24" r="8" />
              <line x1="24" y1="4" x2="24" y2="16" />
              <line x1="24" y1="32" x2="24" y2="44" />
              <line x1="4" y1="24" x2="16" y2="24" />
              <line x1="32" y1="24" x2="44" y2="24" />
            </svg>
          </div>
          <p className="text-white font-mono font-semibold text-base">No matches recorded yet.</p>
          <p className="text-white/40 font-mono text-sm max-w-xs">
            Launch Apex Legends and play a match!
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-white/60 font-mono text-sm">No matches match the current filters.</p>
          <button
            onClick={() => { setModeFilter('all'); setLegendFilter('all'); }}
            className="text-apex-cyan font-mono text-sm underline underline-offset-2 hover:text-apex-cyan/80 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.matchId}
              match={match}
              isExpanded={expandedMatchId === match.matchId}
              onToggle={() =>
                setExpandedMatchId(
                  expandedMatchId === match.matchId ? null : match.matchId
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
