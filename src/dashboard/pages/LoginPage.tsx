import React from 'react';

interface LoginPageProps {
  onLogin: (method: 'steam' | 'discord' | 'skip') => void;
  onManualLink: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onManualLink }) => {
  return (
    <div className="flex items-center justify-center h-screen bg-apex-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-apex-cyan tracking-tighter mb-2">APEX PULSE</h1>
          <p className="text-gray-400">The Apex Legends tracker that works.</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onLogin('steam')}
            className="w-full flex items-center justify-center gap-3 bg-apex-navy border border-white/10 rounded-lg px-6 py-3 hover:bg-white/5 transition-colors"
          >
            <span className="font-medium">Sign in with Steam</span>
          </button>

          <button
            onClick={() => onLogin('discord')}
            className="w-full flex items-center justify-center gap-3 bg-apex-navy border border-white/10 rounded-lg px-6 py-3 hover:bg-white/5 transition-colors"
          >
            <span className="font-medium">Sign in with Discord</span>
          </button>

          <button
            onClick={onManualLink}
            className="w-full flex items-center justify-center gap-3 bg-apex-navy border border-white/10 rounded-lg px-6 py-3 hover:bg-white/5 transition-colors"
          >
            <span className="font-medium">Enter EA/Origin Name Manually</span>
          </button>

          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={() => onLogin('skip')}
            className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/5 rounded-lg px-6 py-3 hover:bg-white/10 transition-colors text-gray-400"
          >
            <span>Skip — Just launch Apex and we'll detect your account</span>
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Your data stays local. No account needed.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
