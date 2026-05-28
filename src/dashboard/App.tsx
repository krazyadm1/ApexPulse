import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import ConsentPage from './pages/ConsentPage';
import LoginPage from './pages/LoginPage';
import LinkAccountPage from './pages/LinkAccountPage';
import ApiKeyPage from './pages/ApiKeyPage';
import HomePage from './pages/HomePage';
import StatsPage from './pages/StatsPage';
import WeaponsPage from './pages/WeaponsPage';
import LegendsPage from './pages/LegendsPage';
import HistoryPage from './pages/HistoryPage';
import MapsPage from './pages/MapsPage';
import SettingsPage from './pages/SettingsPage';
import FaqPage from './pages/FaqPage';
import WelcomePage from './pages/WelcomePage';

type Page = 'Home' | 'Stats' | 'Weapons' | 'Legends' | 'History' | 'Maps' | 'FAQ' | 'Settings';

const NAV_ITEMS: Page[] = ['Home', 'Stats', 'Weapons', 'Legends', 'History', 'Maps', 'FAQ', 'Settings'];

const PAGE_COMPONENTS: Record<Page, React.FC> = {
  Home: HomePage,
  Stats: StatsPage,
  Weapons: WeaponsPage,
  Legends: LegendsPage,
  History: HistoryPage,
  Maps: MapsPage,
  FAQ: FaqPage,
  Settings: SettingsPage,
};

const App: React.FC = () => {
  const { setupComplete, completeSetup } = useAuthStore();
  const [activePage, setActivePage] = useState<Page>('Home');
  const [onboardStep, setOnboardStep] = useState<'consent' | 'welcome' | 'login' | 'link' | 'apikey' | 'done'>(
    setupComplete ? 'done' : 'consent'
  );
  const [errorToast, setErrorToast] = useState<string | null>(null);

  React.useEffect(() => {
    const api = (window as unknown as { apexPulse?: { on: (ch: string, cb: (...args: unknown[]) => void) => void } }).apexPulse;
    if (!api) return;
    api.on('app-error', (data: unknown) => {
      const err = data as { message: string };
      setErrorToast(err.message);
      setTimeout(() => setErrorToast(null), 8000);
    });
  }, []);

  const handleConsent = () => {
    const api = (window as unknown as { apexPulse?: { send: (ch: string, data?: unknown) => void } }).apexPulse;
    if (api) api.send('update-settings', { consentAccepted: true });
    setOnboardStep('welcome');
  };

  const handleWelcomeContinue = () => setOnboardStep('login');

  const handleLogin = (method: 'steam' | 'discord' | 'skip') => {
    if (method === 'skip') {
      completeSetup();
      setOnboardStep('done');
      return;
    }

    const api = (window as unknown as { apexPulse?: { send: (ch: string) => void } }).apexPulse;
    if (api) api.send(method === 'steam' ? 'login-steam' : 'login-discord');

    setOnboardStep('link');
  };

  const handleLinked = () => {
    setOnboardStep('apikey');
  };

  const handleSkipLink = () => {
    setOnboardStep('apikey');
  };

  const handleApiKeySave = (key: string) => {
    const api = (window as unknown as { apexPulse?: { send: (ch: string, data?: unknown) => void } }).apexPulse;
    if (api) api.send('update-settings', { apiKey: key });
    completeSetup();
    setOnboardStep('done');
  };

  const handleApiKeySkip = () => {
    completeSetup();
    setOnboardStep('done');
  };

  if (onboardStep === 'consent') {
    return <ConsentPage onConsent={handleConsent} />;
  }

  if (onboardStep === 'welcome') {
    return <WelcomePage onContinue={handleWelcomeContinue} />;
  }

  if (onboardStep === 'login') {
    return <LoginPage onLogin={handleLogin} onManualLink={() => setOnboardStep('link')} />;
  }

  if (onboardStep === 'link') {
    return <LinkAccountPage onLinked={handleLinked} onSkip={handleSkipLink} />;
  }

  if (onboardStep === 'apikey') {
    return <ApiKeyPage onSave={handleApiKeySave} onSkip={handleApiKeySkip} />;
  }

  const ActiveComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="flex h-screen bg-apex-dark text-white">
      {errorToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 flex items-start gap-3 shadow-lg">
          <span className="shrink-0 mt-0.5">!</span>
          <span>{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="shrink-0 text-red-400/60 hover:text-red-400 ml-auto">&times;</button>
        </div>
      )}
      <aside className="w-64 bg-apex-navy border-r border-white/10 flex flex-col">
        <div className="p-6 flex items-center space-x-3 cursor-pointer" onClick={() => setActivePage('Home')}>
          <img src="./assets/icons/icon.png" alt="ApexPulse" className="w-10 h-10" />
          <h1 className="text-2xl font-bold text-apex-cyan tracking-tighter">
            APEX PULSE
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              onClick={() => setActivePage(item)}
              className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                activePage === item ? 'bg-apex-cyan/10 text-apex-cyan' : 'hover:bg-white/5 text-gray-300'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="p-4 space-y-3">
          <a
            href="https://discord.gg/Pfd6ScNaSW"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 w-full px-4 py-2 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2]/20 transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            <span>Join Discord</span>
          </a>
          <div className="text-xs text-gray-600">ApexPulse v1.0.0</div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <ActiveComponent />
      </main>
    </div>
  );
};

export default App;
