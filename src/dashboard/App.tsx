import React from 'react';

const App: React.FC = () => {
  return (
    <div className="flex h-screen bg-apex-dark text-white">
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-gray-400">Welcome back, Legend.</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-apex-navy px-4 py-2 rounded-lg border border-white border-opacity-10">
              <span className="text-gray-400 text-sm">Status:</span>
              <span className="ml-2 text-green-400 font-medium">Live</span>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Kills" value="1,234" trend="+12 today" />
          <StatCard title="K/D Ratio" value="1.45" trend="+0.02" />
          <StatCard title="Avg Damage" value="642" trend="-5" />
          <StatCard title="Win Rate" value="8.4%" trend="+0.5%" />
        </div>

        {/* Recent Matches */}
        <section className="glass-card">
          <h3 className="text-xl font-bold mb-4">Recent Matches</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white bg-opacity-5 rounded-lg border border-white border-opacity-5">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-apex-cyan bg-opacity-20 rounded-full flex items-center justify-center text-apex-cyan font-bold">
                    #3
                  </div>
                  <div>
                    <div className="font-bold">Trios - World's Edge</div>
                    <div className="text-sm text-gray-400">24 mins ago • Bangalore</div>
                  </div>
                </div>
                <div className="flex space-x-8 text-right">
                  <div>
                    <div className="text-sm text-gray-400">Kills</div>
                    <div className="font-bold">6</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Damage</div>
                    <div className="font-bold">1,432</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; trend: string }> = ({ title, value, trend }) => (
  <div className="glass-card">
    <div className="text-gray-400 text-sm mb-1">{title}</div>
    <div className="text-3xl font-bold mb-2">{value}</div>
    <div className={`text-xs ${trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
      {trend}
    </div>
  </div>
);

export default App;
