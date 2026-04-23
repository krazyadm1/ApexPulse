import React from 'react';
import { useLiveStore } from '../stores/liveStore';
import { WEAPON_MAP } from '../shared/weapon-map';
import { LEGENDS } from '../shared/legend-map';

const App: React.FC = () => {
  const { isLive, kills, damage, squadKills, teamsLeft, legend, mapName, weaponKills, matchState, lobbyPlayers } = useLiveStore();

  // Idle state
  if (!isLive && matchState === 'idle' && lobbyPlayers.length === 0) {
    return (
      <div className="p-4 select-none">
        <div className="bg-apex-dark/60 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
          <span className="text-[10px] text-gray-500 tracking-widest uppercase">ApexPulse — Waiting for match</span>
        </div>
      </div>
    );
  }

  const sortedWeapons = Object.entries(weaponKills)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const teammatesInLobby = lobbyPlayers.filter(p => p.isTeammate);
  const enemiesInLobby = lobbyPlayers.filter(p => !p.isTeammate);

  return (
    <div className="p-4 select-none space-y-2">
      {/* Live Match Stats */}
      {isLive && (
        <div className="bg-apex-dark/80 backdrop-blur-md border border-apex-cyan/30 rounded-lg overflow-hidden shadow-2xl">
          <div className="bg-apex-cyan/20 px-3 py-1 flex justify-between items-center border-b border-apex-cyan/20">
            <span className="text-[10px] font-bold tracking-widest text-apex-cyan uppercase">LIVE MATCH</span>
            <span className="text-[10px] text-gray-300">{mapName ?? ''}</span>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs text-gray-400">{legend ? LEGENDS[legend]?.displayName ?? legend : ''}</div>
                <div className="text-2xl font-bold leading-none">{kills} Kill{kills !== 1 ? 's' : ''}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Damage</div>
                <div className="text-xl font-bold leading-none text-apex-cyan">{damage.toLocaleString()}</div>
              </div>
            </div>

            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-apex-cyan shadow-[0_0_8px_rgba(0,229,255,0.5)]"
                style={{ width: `${Math.min((damage / 2000) * 100, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-white/5 p-2 rounded">
                <span className="text-gray-400">Squad Kills:</span>
                <span className="ml-1 font-bold text-white">{squadKills}</span>
              </div>
              <div className="bg-white/5 p-2 rounded">
                <span className="text-gray-400">Teams:</span>
                <span className="ml-1 font-bold text-white">{teamsLeft > 0 ? teamsLeft : '—'}</span>
              </div>
            </div>

            {sortedWeapons.length > 0 && (
              <div className="space-y-1">
                {sortedWeapons.map(([weapon, count]) => (
                  <div key={weapon} className="flex justify-between text-[11px]">
                    <span className="text-gray-400">{WEAPON_MAP[weapon]?.display ?? weapon}</span>
                    <span className="font-bold">{count} Kill{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Squad Intel */}
      {teammatesInLobby.length > 0 && matchState !== 'in_match' && (
        <div className="bg-apex-dark/80 backdrop-blur-md border border-apex-cyan/20 rounded-lg overflow-hidden">
          <div className="px-3 py-1 border-b border-apex-cyan/10">
            <span className="text-[10px] font-bold tracking-widest text-apex-cyan uppercase">Your Squad</span>
          </div>
          {teammatesInLobby.map((tm, i) => (
            <div key={i} className="flex justify-between items-center px-3 py-1.5 text-[11px]">
              <span className="text-white font-medium">{tm.name}</span>
              <div className="flex space-x-3 text-gray-400 font-mono">
                {tm.loaded ? (
                  <>
                    {tm.level && <span>Lv{tm.level}</span>}
                    {tm.rankName && <span>{tm.rankName}</span>}
                    {tm.kills !== undefined && <span>{tm.kills.toLocaleString()}K</span>}
                  </>
                ) : (
                  <span className="text-gray-600">Loading...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lobby Intel */}
      {enemiesInLobby.length > 0 && matchState !== 'in_match' && (
        <div className="bg-apex-dark/80 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
          <div className="px-3 py-1 border-b border-white/10">
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Lobby Intel</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {enemiesInLobby.slice(0, 20).map((player, i) => (
              <div key={i} className="flex justify-between items-center px-3 py-1 text-[10px] border-b border-white/5">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="text-white truncate max-w-[100px]">{player.name}</span>
                  {player.rankName && (
                    <span className="text-gray-500 truncate">{player.rankName}</span>
                  )}
                </div>
                <div className="flex space-x-3 text-gray-400 font-mono shrink-0">
                  {player.loaded ? (
                    <>
                      {player.level && <span>Lv{player.level}</span>}
                      {player.kills !== undefined && <span>{player.kills.toLocaleString()}K</span>}
                    </>
                  ) : (
                    <span className="text-gray-600">...</span>
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
