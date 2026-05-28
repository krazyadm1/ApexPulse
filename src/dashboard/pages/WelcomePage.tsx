import React from 'react';

interface WelcomePageProps {
  onContinue: () => void;
}

const FEATURES = [
  { icon: '📊', title: 'Live Match Tracking', desc: 'Kills, damage, and placement captured in real-time via GEP' },
  { icon: '🎯', title: 'Weapon & Legend Stats', desc: 'See which weapons and legends give you the best results' },
  { icon: '🗺️', title: 'Map Rotations', desc: 'Current and upcoming maps for BR and Ranked at a glance' },
  { icon: '👁️', title: 'In-Game Overlay', desc: 'Live stats overlay — toggle with a hotkey during matches' },
  { icon: '🔍', title: 'Lobby Intel', desc: 'Scout player stats in your lobby before the match starts' },
  { icon: '📦', title: 'Heirloom Tracker', desc: 'Auto-detect pack openings and track your progress to 500' },
];

const WelcomePage: React.FC<WelcomePageProps> = ({ onContinue }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-apex-dark p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-apex-cyan tracking-tighter mb-2">APEX PULSE</h1>
          <p className="text-gray-400">The Apex Legends tracker that actually works.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-apex-navy border border-white/10 rounded-lg p-4">
              <div className="text-xl mb-2">{f.icon}</div>
              <div className="text-white text-sm font-semibold mb-1">{f.title}</div>
              <div className="text-white/40 text-xs leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onContinue}
          className="w-full bg-apex-cyan text-apex-dark font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-colors"
        >
          Get Started
        </button>

        <p className="text-center text-gray-600 text-xs mt-4">
          All your data stays local. No account required.
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;
