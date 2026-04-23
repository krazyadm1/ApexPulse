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
  try {
    const bgWindow = overwolf.windows.getMainWindow();
    if (bgWindow && (bgWindow as unknown as { requestState?: () => void }).requestState) {
      (bgWindow as unknown as { requestState: () => void }).requestState();
    }
  } catch { /* background not ready yet */ }
}, 500);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
