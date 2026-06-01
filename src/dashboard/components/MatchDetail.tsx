import React from 'react';
import { MatchRecord } from '../../shared/types';
import { WEAPON_MAP } from '../../shared/weapon-map';
import { LEGENDS } from '../../shared/legend-map';

interface MatchDetailProps {
  match: MatchRecord;
  onClose: () => void;
}

const MatchDetail: React.FC<MatchDetailProps> = ({ match, onClose }) => {
  const legendInfo = LEGENDS[match.legend];
  const duration = match.duration > 0
    ? `${Math.floor(match.duration / 60)}m ${match.duration % 60}s`
    : '—';

  const totalKillEvents = match.headshots + match.bodyshots;
  const headshotPct = totalKillEvents > 0
    ? ((match.headshots / totalKillEvents) * 100).toFixed(1)
    : null;

  return (
    <div className="glass-card mt-2 mb-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[var(--text-primary)] font-bold text-lg">
            Match Details
          </h3>
          <span className="text-[var(--text-muted)] text-xs font-mono">
            {new Date(match.timestamp).toLocaleString()} · {duration}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Core Stats */}
        <div className="space-y-4">
          {/* Legend + Map */}
          <div className="flex items-center gap-3 mb-2">
            {legendInfo?.icon && (
              <img src={legendInfo.icon} alt={match.legend} className="w-10 h-10 rounded-full bg-[var(--hover)] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div>
              <div className="text-[var(--text-primary)] font-semibold">{legendInfo?.displayName ?? match.legend}</div>
              <div className="text-[var(--text-muted)] text-xs">{match.mapName} · {match.gameMode}</div>
            </div>
          </div>

          {/* Stat Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Kills', value: match.kills, accent: true },
              { label: 'Assists', value: match.assists },
              { label: 'Knockdowns', value: match.knockdowns },
              { label: 'Damage', value: match.damage.toLocaleString(), accent: true },
              { label: 'Squad Kills', value: match.squadKills },
              { label: 'Placement', value: match.placement > 0 ? `#${match.placement}` : '—' },
            ].map(s => (
              <div key={s.label} className="bg-[var(--hover)] rounded-lg p-3 text-center">
                <div className={`font-mono font-bold text-lg ${s.accent ? 'text-apex-cyan' : 'text-[var(--text-primary)]'}`}>
                  {s.value}
                </div>
                <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {/* RP Change */}
          {match.rpChange != null && (
            <div className="bg-[var(--hover)] rounded-lg p-3 flex items-center justify-between">
              <span className="text-[var(--text-secondary)] text-sm">RP Change</span>
              <span className={`font-mono font-bold ${match.rpChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {match.rpChange >= 0 ? '+' : ''}{match.rpChange}
              </span>
            </div>
          )}

          {/* Headshot Ratio */}
          {headshotPct && (
            <div className="bg-[var(--hover)] rounded-lg p-3 flex items-center justify-between">
              <span className="text-[var(--text-secondary)] text-sm">Headshot Rate</span>
              <span className="font-mono text-apex-cyan font-bold">
                {match.headshots}/{totalKillEvents} ({headshotPct}%)
              </span>
            </div>
          )}
        </div>

        {/* Right: Weapons + Squad */}
        <div className="space-y-4">
          {/* Weapons */}
          {match.weaponKills.length > 0 && (
            <div>
              <h4 className="text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-2">Weapons Used</h4>
              <div className="space-y-1">
                {match.weaponKills.map(w => {
                  const info = WEAPON_MAP[w.weaponName];
                  return (
                    <div key={w.weaponName} className="flex items-center justify-between bg-[var(--hover)] rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        {info?.icon && (
                          <img src={info.icon} alt={w.weaponName} className="w-6 h-6 object-contain opacity-70" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <span className="text-[var(--text-primary)] text-sm">{info?.display ?? w.weaponName}</span>
                      </div>
                      <div className="flex gap-4 text-xs font-mono">
                        <span className="text-apex-cyan">{w.kills} kill{w.kills !== 1 ? 's' : ''}</span>
                        {w.knockdowns > 0 && <span className="text-[var(--text-muted)]">{w.knockdowns} knock{w.knockdowns !== 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Teammates */}
          {match.teammates.length > 0 && (
            <div>
              <h4 className="text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-2">Squad</h4>
              <div className="space-y-1">
                {match.teammates.map((tm, i) => (
                  <div key={i} className="flex items-center justify-between bg-[var(--hover)] rounded px-3 py-2">
                    <span className="text-[var(--text-primary)] text-sm">{tm.name}</span>
                    <div className="flex gap-3 text-xs text-[var(--text-muted)] font-mono">
                      {tm.legend && <span>{LEGENDS[tm.legend]?.displayName ?? tm.legend}</span>}
                      <span>{tm.platform}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Match Metadata */}
          <div>
            <h4 className="text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-2">Details</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-[var(--text-muted)]">Duration</div>
              <div className="text-[var(--text-secondary)] font-mono">{duration}</div>
              <div className="text-[var(--text-muted)]">Teams</div>
              <div className="text-[var(--text-secondary)] font-mono">{match.totalTeams > 0 ? match.totalTeams : '—'}</div>
              <div className="text-[var(--text-muted)]">Result</div>
              <div className="text-[var(--text-secondary)] font-mono">{match.isWin ? 'Champion' : match.placement > 0 ? `#${match.placement}` : 'Eliminated'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchDetail;
