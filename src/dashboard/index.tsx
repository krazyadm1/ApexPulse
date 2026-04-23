import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../index.css';
import { useMatchStore } from '../stores/matchStore';
import { useAuthStore } from '../stores/authStore';
import { useLiveStore } from '../stores/liveStore';
import { useSettingsStore } from '../stores/settingsStore';

useMatchStore.getState().init();
useAuthStore.getState().init();
useLiveStore.getState().init();
useSettingsStore.getState().init();

setTimeout(() => {
  const api = (window as unknown as { apexPulse?: { send: (ch: string) => void } }).apexPulse;
  if (api) api.send('request-state');
}, 500);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
