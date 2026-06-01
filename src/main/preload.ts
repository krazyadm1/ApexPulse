import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('apexPulse', {
  // Send messages to main process
  send: (channel: string, data?: unknown) => {
    const validChannels = [
      'request-state',
      'launch-apex',
      'login-steam',
      'login-discord',
      'update-settings',
      'set-pack-count',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Receive messages from main process
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'live-match-update',
      'match-ended',
      'match-history-update',
      'profile-update',
      'map-rotation-update',
      'auth-state-change',
      'settings-update',
      'session-update',
      'origin-detected',
      'lobby-intel-update',
      'pack-update',
      'game-running-update',
      'app-error',
      'overlay-auto-hidden',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  // One-shot receive
  once: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'live-match-update', 'match-ended', 'match-history-update', 'profile-update',
      'map-rotation-update', 'auth-state-change', 'settings-update', 'session-update',
      'origin-detected', 'lobby-intel-update', 'pack-update', 'game-running-update',
      'app-error', 'overlay-auto-hidden',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    }
  },

  // Invoke with response
  invoke: (channel: string, data?: unknown): Promise<unknown> => {
    const validChannels = [
      'link-origin-manual',
      'get-auth-state',
      'export-data',
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },
});
