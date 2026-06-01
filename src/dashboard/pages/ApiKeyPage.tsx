import React, { useState } from 'react';

interface ApiKeyPageProps {
  onSave: (key: string) => void;
  onSkip: () => void;
}

const ApiKeyPage: React.FC<ApiKeyPageProps> = ({ onSave, onSkip }) => {
  const [key, setKey] = useState('');

  return (
    <div className="flex items-center justify-center h-screen bg-apex-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2 text-white">API Key (Optional)</h2>
          <p className="text-gray-400">
            Match tracking works without this. An API key unlocks extra features.
          </p>
        </div>

        <div className="glass-card space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <span className="text-green-400 mt-0.5">&#10003;</span>
              <div>
                <span className="text-white">Profile stats</span>
                <span className="text-gray-500"> — lifetime K/D, rank, level from EA</span>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-green-400 mt-0.5">&#10003;</span>
              <div>
                <span className="text-white">Map rotation</span>
                <span className="text-gray-500"> — current and upcoming maps</span>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-green-400 mt-0.5">&#10003;</span>
              <div>
                <span className="text-white">Lobby intel</span>
                <span className="text-gray-500"> — look up other players' stats</span>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-green-400 mt-0.5">&#10003;</span>
              <div>
                <span className="text-white">Server status</span>
                <span className="text-gray-500"> — see if EA servers are up</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && key.trim() && onSave(key.trim())}
              placeholder="Paste your key here"
              className="bg-apex-dark border border-white/10 rounded-lg px-4 py-3 text-white w-full focus:border-apex-cyan focus:outline-none font-mono text-sm"
            />
            <p className="text-white/40 text-xs mt-2">
              Free from{' '}
              <a
                href="https://apexlegendsapi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-apex-cyan hover:underline"
              >
                apexlegendsapi.com
              </a>
            </p>
          </div>

          <button
            onClick={() => onSave(key.trim())}
            disabled={!key.trim()}
            className="w-full bg-apex-cyan text-apex-dark font-bold px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save & Continue
          </button>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={onSkip}
            className="text-gray-400 text-sm hover:text-white transition-colors"
          >
            Skip — I'll add this later in Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyPage;
