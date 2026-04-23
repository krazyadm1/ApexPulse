import React, { useState } from 'react';

interface LinkAccountPageProps {
  onLinked: () => void;
  onSkip: () => void;
}

const LinkAccountPage: React.FC<LinkAccountPageProps> = ({ onLinked, onSkip }) => {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleValidate = async () => {
    if (!name.trim()) return;
    setStatus('validating');
    setErrorMsg('');

    try {
      const api = (window as unknown as { apexPulse?: { invoke: (ch: string, data?: unknown) => Promise<unknown> } }).apexPulse;
      if (api) {
        const success = await api.invoke('link-origin-manual', name.trim());
        if (success) {
          setStatus('success');
          setTimeout(onLinked, 1000);
        } else {
          setStatus('error');
          setErrorMsg('Could not find that EA/Origin name. Check spelling and try again.');
        }
      } else {
        setStatus('error');
        setErrorMsg('Background service not ready. Try again in a moment.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-apex-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2 text-white">Link Your EA Account</h2>
          <p className="text-gray-400">
            We need your EA/Origin username to pull your Apex Legends stats from the API.
          </p>
        </div>

        <div className="glass-card space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">EA/Origin Username</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              placeholder="Your EA ID"
              className="bg-apex-dark border border-white/10 rounded-lg px-4 py-3 text-white w-full focus:border-apex-cyan focus:outline-none text-lg"
              disabled={status === 'validating'}
            />
          </div>

          <p className="text-gray-500 text-xs">
            Not sure? Open the EA App, go to your Profile — your EA ID is shown at the top.
          </p>

          {status === 'error' && (
            <p className="text-red-400 text-sm">{errorMsg}</p>
          )}

          {status === 'success' && (
            <p className="text-green-400 text-sm font-medium">Account linked! Loading your stats...</p>
          )}

          <button
            onClick={handleValidate}
            disabled={status === 'validating' || !name.trim()}
            className="w-full bg-apex-cyan text-apex-dark font-bold px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'validating' ? 'Validating...' : 'Validate & Continue'}
          </button>
        </div>

        <div className="text-center mt-6">
          <div className="flex items-center gap-4 py-2 mb-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <p className="text-gray-400 text-sm mb-3">
            Launch Apex Legends and we'll detect your EA name automatically.
          </p>
          <button
            onClick={onSkip}
            className="text-apex-cyan text-sm hover:underline"
          >
            Skip for now — detect on next Apex launch
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkAccountPage;
