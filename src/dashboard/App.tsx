import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import LoginPage from './pages/LoginPage';
import LinkAccountPage from './pages/LinkAccountPage';
import HomePage from './pages/HomePage';
import StatsPage from './pages/StatsPage';
import WeaponsPage from './pages/WeaponsPage';
import LegendsPage from './pages/LegendsPage';
import HistoryPage from './pages/HistoryPage';
import MapsPage from './pages/MapsPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'Home' | 'Stats' | 'Weapons' | 'Legends' | 'History' | 'Maps' | 'Settings';

const NAV_ITEMS: Page[] = ['Home', 'Stats', 'Weapons', 'Legends', 'History', 'Maps', 'Settings'];

const PAGE_COMPONENTS: Record<Page, React.FC> = {
  Home: HomePage,
  Stats: StatsPage,
  Weapons: WeaponsPage,
  Legends: LegendsPage,
  History: HistoryPage,
  Maps: MapsPage,
  Settings: SettingsPage,
};

const App: React.FC = () => {
  const { setupComplete, completeSetup } = useAuthStore();
  const [activePage, setActivePage] = useState<Page>('Home');
  const [onboardStep, setOnboardStep] = useState<'login' | 'link' | 'done'>(
    setupComplete ? 'done' : 'login'
  );

  const handleLogin = (method: 'steam' | 'discord' | 'skip') => {
    if (method === 'skip') {
      completeSetup();
      setOnboardStep('done');
      return;
    }

    try {
      const bgWindow = overwolf.windows.getMainWindow();
      if (method === 'steam') {
        (bgWindow as unknown as { loginSteam?: () => void }).loginSteam?.();
      } else {
        (bgWindow as unknown as { loginDiscord?: () => void }).loginDiscord?.();
      }
    } catch { /* not in Overwolf */ }

    setOnboardStep('link');
  };

  const handleLinked = () => {
    completeSetup();
    setOnboardStep('done');
  };

  const handleSkipLink = () => {
    completeSetup();
    setOnboardStep('done');
  };

  if (onboardStep === 'login') {
    return <LoginPage onLogin={handleLogin} onManualLink={() => setOnboardStep('link')} />;
  }

  if (onboardStep === 'link') {
    return <LinkAccountPage onLinked={handleLinked} onSkip={handleSkipLink} />;
  }

  const ActiveComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="flex h-screen bg-apex-dark text-white">
      <aside className="w-64 bg-apex-navy border-r border-white/10 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-apex-cyan tracking-tighter cursor-pointer" onClick={() => setActivePage('Home')}>
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
        <div className="p-4 text-xs text-gray-600">
          ApexPulse v1.0.0
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <ActiveComponent />
      </main>
    </div>
  );
};

export default App;
