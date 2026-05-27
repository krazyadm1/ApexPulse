import React, { useState } from 'react';
import { LEGAL_URLS } from '../../shared/constants';

interface ConsentPageProps {
  onConsent: () => void;
}

const ConsentPage: React.FC<ConsentPageProps> = ({ onConsent }) => {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex items-center justify-center h-screen bg-apex-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-apex-cyan tracking-tighter mb-2">APEX PULSE</h1>
          <p className="text-gray-400">The Apex Legends tracker that works.</p>
        </div>

        <div className="bg-apex-navy border border-white/10 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Before you begin</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            ApexPulse stores your match data locally on your computer. We collect basic gameplay
            statistics to power the dashboard. No data is sold to third parties.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Please review our{' '}
            <a
              href={LEGAL_URLS.termsOfUse}
              target="_blank"
              rel="noopener noreferrer"
              className="text-apex-cyan hover:underline"
            >
              Terms of Use
            </a>{' '}
            and{' '}
            <a
              href={LEGAL_URLS.privacyPolicy}
              target="_blank"
              rel="noopener noreferrer"
              className="text-apex-cyan hover:underline"
            >
              Privacy Policy
            </a>{' '}
            before continuing.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-6 select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 accent-apex-cyan w-4 h-4 cursor-pointer flex-shrink-0"
          />
          <span className="text-sm text-gray-300">
            I have read and agree to the Terms of Use and Privacy Policy
          </span>
        </label>

        <button
          onClick={onConsent}
          disabled={!checked}
          className={`w-full rounded-lg px-6 py-3 font-semibold transition-colors ${
            checked
              ? 'bg-apex-cyan text-apex-dark hover:opacity-90'
              : 'bg-white/10 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default ConsentPage;
