import React from 'react';

const App: React.FC = () => {
  return (
    <div className="p-4 select-none">
      <div className="bg-apex-dark bg-opacity-80 backdrop-blur-md border border-apex-cyan border-opacity-30 rounded-lg overflow-hidden shadow-2xl">
        <div className="bg-apex-cyan bg-opacity-20 px-3 py-1 flex justify-between items-center border-b border-apex-cyan border-opacity-20">
          <span className="text-[10px] font-bold tracking-widest text-apex-cyan uppercase">▶ Live Match</span>
          <span className="text-[10px] text-gray-300">World's Edge</span>
        </div>
        
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs text-gray-400">Bangalore</div>
              <div className="text-2xl font-bold leading-none">6 Kills</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Damage</div>
              <div className="text-xl font-bold leading-none text-apex-cyan">1,432</div>
            </div>
          </div>

          <div className="h-1 bg-white bg-opacity-10 rounded-full overflow-hidden">
            <div className="h-full bg-apex-cyan w-2/3 shadow-[0_0_8px_rgba(0,229,255,0.5)]"></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white bg-opacity-5 p-2 rounded">
              <span className="text-gray-400">Squad Kills:</span>
              <span className="ml-1 font-bold text-white">12</span>
            </div>
            <div className="bg-white bg-opacity-5 p-2 rounded">
              <span className="text-gray-400">Teams:</span>
              <span className="ml-1 font-bold text-white">8/20</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">🔫 R-301</span>
              <span className="font-bold">4 Kills</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">🔫 Peacekeeper</span>
              <span className="font-bold">2 Kills</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
