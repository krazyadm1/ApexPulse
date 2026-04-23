import React from 'react';
import { useMatchStore } from '../stores/matchStore';
import { useLiveStore } from '../stores/liveStore';
import { WEAPON_MAP } from '../shared/weapon-map';
import { LEGENDS } from '../shared/legend-map';

const App: React.FC = () => {
  const { recentMatches, totalKills, kdRatio, avgDamage, winRate, totalMatches } = useMatchStore();
  const { isLive, kills: liveKills, damage: liveDamage, legend: liveLegend } = useLiveStore();

  return (
    <div className="flex h-screen bg-apex-dark text-white">
      <aside className="w-64 bg-apex-navy border-r border-white border-opacity-10 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-apex-cyan tracking-tighter">APEX PULSE</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {['Home', 'Stats', 'Weapons', 'Legends', 'History', 'Maps', 'Settings'].map((item) => (
            <a
              key={item}
              href="#"
              className={`block px-4 py-2 rounded-lg transition-colors ${
                item === 'Home' ? 'bg-apex-cyan bg-opacity-10 text-apex-cyan' : 'hover:bg-white hover:bg-opacity-5'
              }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-gray-400">
              {totalMatches > 0 ? `${totalMatches} matches tracked` : 'Welcome back, Legend.'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-apex-navy px-4 py-2 rounded-lg border border-white border-opacity-10">
              <span className="text-gray-400 text-sm">Status:</span>
              <span className={`ml-2 font-medium ${isLive ? 'text-green-400' : 'text-gray-500'}`}>
                {isLive ? 'In Match' : 'Idle'}
              </span>
            </div>
          </div>
        </header>

        {isLive && (
          <div className="glass-card border-apex-cyan border-opacity-30 mb-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <span className="text-apex-cyan font-bold animate-pulse">LIVE</span>
                <span className="text-white font-bold">{liveLegend ? LEGENDS[liveLegend]?.displayName ?? liveLegend : ''}</span>
              </div>
              <div className="flex space-x-6">
                <div><span className="text-gray-400 text-sm">Kills:</span> <span className="font-bold ml-1">{liveKills}</span></div>
                <div><span className="text-gray-400 text-sm">Damage:</span> <span className="font-bold ml-1">{liveDamage.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Kills" value={totalKills.toLocaleString()} />
          <StatCard title="K/D Ratio" value={kdRatio.toFixed(2)} />
          <StatCard title="Avg Damage" value={avgDamage.toLocaleString()} />
          <StatCard title="Win Rate" value={`${winRate}%`} />
        </div>

        <section className="glass-card">
          <h3 className="text-xl font-bold mb-4">Recent Matches</h3>
          <div className="space-y-4">
            {recentMatches.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No matches tracked yet. Launch Apex Legends to start!</p>
            ) : (
              recentMatches.slice(0, 10).map((match) => (
                <div key={match.matchId} className="flex items-center justify-between p-4 bg-white bg-opacity-5 rounded-lg border border-white border-opacity-5">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                      match.isWin ? 'bg-yellow-500 bg-opacity-20 text-yellow-400' : 'bg-apex-cyan bg-opacity-20 text-apex-cyan'
                    }`}>
                      #{match.placement || '?'}
                    </div>
                    <div>
                      <div className="font-bold">
                        {match.gameMode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — {match.mapName}
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(match.timestamp).toLocaleString()} &bull; {LEGENDS[match.legend]?.displayName ?? match.legend}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-8 text-right">
                    <div>
                      <div className="text-sm text-gray-400">Kills</div>
                      <div className="font-bold">{match.kills}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Damage</div>
                      <div className="font-bold">{match.damage.toLocaleString()}</div>
                    </div>
                    {match.weaponKills.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-400">Top Weapon</div>
                        <div className="font-bold text-apex-cyan">
                          {WEAPON_MAP[match.weaponKills[0].weaponName]?.display ?? match.weaponKills[0].weaponName}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="glass-card">
    <div className="text-gray-400 text-sm mb-1">{title}</div>
    <div className="text-3xl font-bold font-mono">{value}</div>
  </div>
);

export default App;
