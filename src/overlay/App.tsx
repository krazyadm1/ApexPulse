import React from 'react';
import { useLiveStore } from '../stores/liveStore';
import { WEAPON_MAP } from '../shared/weapon-map';
import { LEGENDS } from '../shared/legend-map';

const App: React.FC = () => {
  const { isLive, kills, damage, squadKills, teamsLeft, legend, mapName, weaponKills, matchState } = useLiveStore();

  if (!isLive && matchState === 'idle') {
    return (
      <div className="p-4 select-none">
        <div className="bg-apex-dark bg-opacity-60 backdrop-blur-md border border-white border-opacity-10 rounded-lg px-3 py-2">
          <span className="text-[10px] text-gray-500 tracking-widest uppercase">ApexPulse — Waiting for match</span>
        </div>
      </div>
    );
  }

  const sortedWeapons = Object.entries(weaponKills)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="p-4 select-none">
      <div className="bg-apex-dark bg-opacity-80 backdrop-blur-md border border-apex-cyan border-opacity-30 rounded-lg overflow-hidden shadow-2xl">
        <div className="bg-apex-cyan bg-opacity-20 px-3 py-1 flex justify-between items-center border-b border-apex-cyan border-opacity-20">
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

          <div className="h-1 bg-white bg-opacity-10 rounded-full overflow-hidden">
            <div
              className="h-full bg-apex-cyan shadow-[0_0_8px_rgba(0,229,255,0.5)]"
              style={{ width: `${Math.min((damage / 2000) * 100, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white bg-opacity-5 p-2 rounded">
              <span className="text-gray-400">Squad Kills:</span>
              <span className="ml-1 font-bold text-white">{squadKills}</span>
            </div>
            <div className="bg-white bg-opacity-5 p-2 rounded">
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
    </div>
  );
};

export default App;
