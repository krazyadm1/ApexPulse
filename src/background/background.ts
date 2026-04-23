import { initDatabase, saveDatabase, closeDatabase, getRecentMatches, getOverallStats, getWeaponStats, getLegendStats } from './database';
import { initGep, registerCallbacks, cleanup as cleanupGep } from './gep-manager';
import {
  setPlayerName, handleMatchStateChange, handleKillFeed, handleKill,
  handleAssist, handleDamage, handleKnockdown, handleDeath, handleRevive,
  handleTeamUpdate, handleInventoryUpdate, handleMatchSummary,
  handleGameModeDetected, handleMapDetected, handleLegendDetected,
  onMatchEnd,
} from './match-tracker';
import { initSessionManager, onMatchPlayed, endCurrentSession, getCurrentSession } from './session-manager';
import { processRoster, clearLobby } from './lobby-intel';
import { setApiKey, getPlayerStats, getMapRotation } from './api-client';
import { setupMessageListener, broadcastMatchHistory, broadcastProfile, broadcastMapRotation, broadcastSession, onMessage } from './messaging';
import { initAuth, handlePlayerDetected, broadcastCurrentAuthState, loginSteam, loginDiscord, linkOriginManual, handleSteamCallback, handleDiscordCallback } from './auth/auth-manager';
import { getOriginName } from './auth/origin-resolver';
import { API_POLL_INTERVAL_MS } from '../shared/constants';
import { AppSettings } from '../shared/types';

let pollTimer: ReturnType<typeof setInterval> | null = null;

class BackgroundController {
  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    console.log('[ApexPulse] Initializing...');

    await initDatabase();
    console.log('[ApexPulse] Database ready');

    const settings = this.loadSettings();
    if (settings.apiKey) setApiKey(settings.apiKey);

    initAuth({
      steamApiKey: (settings as unknown as Record<string, string>).steamApiKey ?? '',
      discordClientId: (settings as unknown as Record<string, string>).discordClientId ?? '',
    });

    initSessionManager();

    setupMessageListener();
    this.setupBackgroundMessageHandlers();

    registerCallbacks({
      onMatchStateChange: handleMatchStateChange,
      onKillFeed: handleKillFeed,
      onKill: handleKill,
      onAssist: handleAssist,
      onDamage: handleDamage,
      onKnockdown: handleKnockdown,
      onDeath: handleDeath,
      onRevive: handleRevive,
      onTeamUpdate: handleTeamUpdate,
      onInventoryUpdate: handleInventoryUpdate,
      onLocationUpdate: () => {},
      onMatchSummary: handleMatchSummary,
      onRosterUpdate: (players) => {
        processRoster(players);
      },
      onPlayerNameDetected: async (name: string) => {
        setPlayerName(name);
        await handlePlayerDetected(name);
      },
      onGameModeDetected: handleGameModeDetected,
      onMapDetected: handleMapDetected,
      onLegendDetected: handleLegendDetected,
    });
    initGep();

    onMatchEnd((match) => {
      onMatchPlayed(match);
      clearLobby();
      this.broadcastFullState();
    });

    this.startPolling(settings.apiKey ? API_POLL_INTERVAL_MS : 0);
    this.openDashboard();
    this.registerHotkeys();

    console.log('[ApexPulse] Initialization complete');
  }

  private loadSettings(): AppSettings {
    try {
      const raw = localStorage.getItem('apexpulse_settings');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      apiKey: '',
      overlayEnabled: true,
      overlayPosition: { top: 10, left: 10 },
      overlayOpacity: 0.8,
      overlayHotkey: 'Shift+F1',
      autoDetectOrigin: true,
      pollIntervalMs: API_POLL_INTERVAL_MS,
      sessionTimeoutMs: 30 * 60 * 1000,
    };
  }

  private setupBackgroundMessageHandlers(): void {
    onMessage('REQUEST_STATE', () => {
      this.broadcastFullState();
    });
  }

  broadcastFullState(): void {
    broadcastMatchHistory({
      recentMatches: getRecentMatches(50),
      stats: getOverallStats(),
      weaponStats: getWeaponStats(),
      legendStats: getLegendStats(),
    });

    const session = getCurrentSession();
    if (session) broadcastSession(session);

    broadcastCurrentAuthState();
  }

  private startPolling(intervalMs: number): void {
    if (!intervalMs) return;
    if (pollTimer) clearInterval(pollTimer);

    const poll = async () => {
      const originName = getOriginName();
      if (!originName) return;

      const stats = await getPlayerStats(originName);
      if (stats) broadcastProfile(stats);

      const maps = await getMapRotation();
      if (maps) broadcastMapRotation(maps);
    };

    poll();
    pollTimer = setInterval(poll, intervalMs);
  }

  private registerHotkeys(): void {
    overwolf.settings.hotkeys.onPressed.addListener((event: overwolf.settings.hotkeys.OnPressedEvent) => {
      if (event.name === 'toggle_overlay') {
        this.toggleOverlay();
      }
    });
  }

  private toggleOverlay(): void {
    overwolf.windows.obtainDeclaredWindow('overlay', (result) => {
      if (!result.success) return;
      const windowId = result.window.id;
      if (result.window.isVisible) {
        overwolf.windows.hide(windowId, () => {});
      } else {
        overwolf.windows.restore(windowId, () => {});
      }
    });
  }

  private openDashboard(): void {
    overwolf.windows.obtainDeclaredWindow('dashboard', (result) => {
      if (result.success) {
        overwolf.windows.restore(result.window.id, () => {});
      }
    });
  }

  onSettingsChange(settings: Partial<AppSettings>): void {
    if (settings.apiKey !== undefined) {
      setApiKey(settings.apiKey);
      this.startPolling(settings.pollIntervalMs ?? API_POLL_INTERVAL_MS);
    }
    const current = this.loadSettings();
    localStorage.setItem('apexpulse_settings', JSON.stringify({ ...current, ...settings }));
  }
}

const controller = new BackgroundController();

(window as unknown as Record<string, unknown>).apexpulse = controller;
(window as unknown as Record<string, unknown>).loginSteam = loginSteam;
(window as unknown as Record<string, unknown>).loginDiscord = loginDiscord;
(window as unknown as Record<string, unknown>).linkOriginManual = linkOriginManual;
(window as unknown as Record<string, unknown>).handleSteamCallback = handleSteamCallback;
(window as unknown as Record<string, unknown>).handleDiscordCallback = handleDiscordCallback;
(window as unknown as Record<string, unknown>).onSettingsChange = (s: Partial<AppSettings>) => controller.onSettingsChange(s);
(window as unknown as Record<string, unknown>).requestState = () => controller.broadcastFullState();

window.addEventListener('beforeunload', () => {
  endCurrentSession();
  cleanupGep();
  closeDatabase();
});
