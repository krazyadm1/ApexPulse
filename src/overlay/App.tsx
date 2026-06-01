import React from 'react';
import { useLiveStore } from '../stores/liveStore';
import { WEAPON_MAP } from '../shared/weapon-map';
import { LEGENDS } from '../shared/legend-map';

const App: React.FC = () => {
  const { isLive, kills, assists, knockdowns, damage, squadKills, teamsLeft, legend, mapName, weaponKills, matchState, lobbyPlayers } = useLiveStore();

  if (!isLive && matchState === 'idle' && lobbyPlayers.length === 0) {
    return (
      <div className="p-3 select-none">
        <div className="bg-black/50 backdrop-blur-sm border-l-2 border-cyan-400/40 px-3 py-1.5 rounded-r">
          <span className="text-[9px] text-gray-500 tracking-[0.2em] uppercase font-medium">ApexPulse</span>
        </div>
      </div>
    );
  }

  const sortedWeapons = Object.entries(weaponKills)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const legendDisplay = legend ? LEGENDS[legend]?.displayName ?? legend : '';

  return (
    <div className="p-3 select-none space-y-1.5" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {isLive && (
        <div className="bg-black/70 backdrop-blur-sm rounded overflow-hidden border border-white/[0.06]">
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-1 bg-cyan-400/10 border-b border-cyan-400/20">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)] animate-pulse" />
              <span className="text-[9px] font-semibold tracking-[0.15em] text-cyan-300 uppercase">Live</span>
            </div>
            <div className="flex items-center gap-2">
              {legendDisplay && <span className="text-[10px] text-gray-400">{legendDisplay}</span>}
              {mapName && <span className="text-[10px] text-gray-500">{mapName}</span>}
            </div>
          </div>

          {/* Main stats row */}
          <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
            <div className="px-3 py-2.5 text-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Kills</div>
              <div className="text-2xl font-bold text-white leading-none">{kills}</div>
            </div>
            <div className="px-3 py-2.5 text-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Damage</div>
              <div className="text-2xl font-bold text-cyan-400 leading-none">{damage.toLocaleString()}</div>
            </div>
            <div className="px-3 py-2.5 text-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">KDA</div>
              <div className="text-2xl font-bold text-white leading-none">
                {kills}<span className="text-gray-500 text-sm">/{assists}</span>
              </div>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06] bg-white/[0.02]">
            <div className="px-3 py-1.5 text-center">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Squad</span>
              <span className="text-[11px] font-semibold text-white ml-1.5">{squadKills}</span>
            </div>
            <div className="px-3 py-1.5 text-center">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Teams</span>
              <span className="text-[11px] font-semibold text-white ml-1.5">{teamsLeft > 0 ? teamsLeft : '—'}</span>
            </div>
            <div className="px-3 py-1.5 text-center">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Knocks</span>
              <span className="text-[11px] font-semibold text-white ml-1.5">{knockdowns}</span>
            </div>
          </div>

          {/* Weapon kills */}
          {sortedWeapons.length > 0 && (
            <div className="border-t border-white/[0.06] px-3 py-1.5 space-y-0.5">
              {sortedWeapons.map(([weapon, count]) => (
                <div key={weapon} className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">{WEAPON_MAP[weapon]?.display ?? weapon}</span>
                  <span className="text-[10px] font-semibold text-gray-300">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Squad Intel — pre-match */}
      {lobbyPlayers.filter(p => p.isTeammate).length > 0 && matchState !== 'in_match' && (
        <div className="bg-black/70 backdrop-blur-sm rounded overflow-hidden border border-white/[0.06]">
          <div className="px-3 py-1 border-b border-cyan-400/10">
            <span className="text-[9px] font-semibold tracking-[0.15em] text-cyan-300/70 uppercase">Squad</span>
          </div>
          {lobbyPlayers.filter(p => p.isTeammate).map((tm, i) => (
            <div key={i} className="flex justify-between items-center px-3 py-1 text-[10px] border-b border-white/[0.03] last:border-0">
              <span className="text-white font-medium">{tm.name}</span>
              <div className="flex gap-2 text-gray-500 font-mono text-[9px]">
                {tm.loaded ? (
                  <>
                    {tm.level && <span>Lv{tm.level}</span>}
                    {tm.rankName && <span>{tm.rankName}</span>}
                    {tm.kills !== undefined && <span>{tm.kills.toLocaleString()}K</span>}
                  </>
                ) : (
                  <span className="text-gray-600">...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lobby Intel — pre-match */}
      {lobbyPlayers.filter(p => !p.isTeammate).length > 0 && matchState !== 'in_match' && (
        <div className="bg-black/70 backdrop-blur-sm rounded overflow-hidden border border-white/[0.06]">
          <div className="px-3 py-1 border-b border-white/[0.06]">
            <span className="text-[9px] font-semibold tracking-[0.15em] text-gray-500 uppercase">Lobby</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {lobbyPlayers.filter(p => !p.isTeammate).slice(0, 20).map((player, i) => (
              <div key={i} className="flex justify-between items-center px-3 py-0.5 text-[9px] border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-gray-300 truncate max-w-[90px]">{player.name}</span>
                  {player.rankName && <span className="text-gray-600 truncate">{player.rankName}</span>}
                </div>
                <div className="flex gap-2 text-gray-500 font-mono shrink-0">
                  {player.loaded ? (
                    <>
                      {player.level && <span>Lv{player.level}</span>}
                      {player.kills !== undefined && <span>{player.kills.toLocaleString()}K</span>}
                    </>
                  ) : (
                    <span className="text-gray-700">...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
