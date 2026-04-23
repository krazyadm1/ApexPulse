import { create } from 'zustand';
import { AppSettings, WindowMessage } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { onMessage, sendToMain } from '../background/messaging';

interface SettingsState extends AppSettings {
  init: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,

  init: () => {
    const saved = localStorage.getItem('apexpulse_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppSettings>;
        set(parsed);
      } catch {
        // Ignore corrupt settings
      }
    }

    onMessage('SETTINGS_UPDATE', (msg: WindowMessage) => {
      const settings = msg.payload as Partial<AppSettings>;
      set(settings);
    });
  },

  updateSettings: (partial: Partial<AppSettings>) => {
    set(state => {
      const updated = { ...state, ...partial };
      localStorage.setItem('apexpulse_settings', JSON.stringify({
        apiKey: updated.apiKey,
        overlayEnabled: updated.overlayEnabled,
        overlayPosition: updated.overlayPosition,
        overlayOpacity: updated.overlayOpacity,
        overlayHotkey: updated.overlayHotkey,
        autoDetectOrigin: updated.autoDetectOrigin,
        pollIntervalMs: updated.pollIntervalMs,
        sessionTimeoutMs: updated.sessionTimeoutMs,
      }));
      return partial;
    });

    sendToMain('update-settings', partial);
  },
}));
