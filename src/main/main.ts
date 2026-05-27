import { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen, shell } from 'electron';
import { execFile } from 'child_process';
import path from 'path';
import { initDatabase, saveDatabase, closeDatabase, getRecentMatches, getOverallStats, getWeaponStats, getLegendStats, setUserDataPath } from '../background/database';
import { initGep, registerCallbacks, onGameRunningChange, cleanup as cleanupGep } from '../background/gep-manager';
import {
  setPlayerName, handleMatchStateChange, handleKillFeed, handleKill,
  handleAssist, handleDamage, handleKnockdown, handleDeath, handleRevive,
  handleTeamUpdate, handleInventoryUpdate, handleMatchSummary,
  handleGameModeDetected, handleMapDetected, handleLegendDetected,
  onMatchEnd,
} from '../background/match-tracker';
import { initSessionManager, onMatchPlayed, endCurrentSession, getCurrentSession } from '../background/session-manager';
import { setApiKey, getPlayerStats, getMapRotation, getServerStatus } from '../background/api-client';
import { initAuth, handlePlayerDetected, broadcastCurrentAuthState, loginSteam, loginDiscord, linkOriginManual, handleSteamCallback, handleDiscordCallback } from '../background/auth/auth-manager';
import { getOriginName } from '../background/auth/origin-resolver';
import { processRoster, clearLobby } from '../background/lobby-intel';
import { initPackDetector, startScanning, stopScanning, registerPackCallbacks, cleanupPackDetector } from '../background/pack-detector';
import { API_POLL_INTERVAL_MS } from '../shared/constants';
import { AppSettings } from '../shared/types';

let dashboardWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let currentGameMode: string | null = null;

function createDashboardWindow(): void {
  dashboardWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    backgroundColor: '#050B14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    title: 'ApexPulse',
  });

  dashboardWindow.loadFile(path.join(__dirname, 'dashboard.html'));
  (dashboardWindow as any).webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

function createOverlayWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW } = primaryDisplay.workAreaSize;

  const savedPos = loadOverlayPosition();

  overlayWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: savedPos?.x ?? screenW - 420,
    y: savedPos?.y ?? 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.setIgnoreMouseEvents(true);

  overlayWindow.on('moved', () => {
    if (overlayWindow) {
      const [x, y] = overlayWindow.getPosition();
      saveOverlayPosition(x, y);
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function loadOverlayPosition(): { x: number; y: number } | null {
  try {
    const stored = require('fs').readFileSync(
      path.join(app.getPath('userData'), 'overlay-position.json'), 'utf8'
    );
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveOverlayPosition(x: number, y: number): void {
  try {
    require('fs').writeFileSync(
      path.join(app.getPath('userData'), 'overlay-position.json'),
      JSON.stringify({ x, y })
    );
  } catch { /* ignore */ }
}

function broadcast(channel: string, data: unknown): void {
  dashboardWindow?.webContents.send(channel, data);
  overlayWindow?.webContents.send(channel, data);
}

function loadSettings(): AppSettings & Record<string, string> {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    const raw = require('fs').readFileSync(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      apiKey: '',
      overlayEnabled: true,
      overlayPosition: { top: 10, left: 10 },
      overlayOpacity: 0.8,
      overlayHotkey: 'Shift+F1',
      autoDetectOrigin: true,
      pollIntervalMs: API_POLL_INTERVAL_MS,
      sessionTimeoutMs: 30 * 60 * 1000,
    } as AppSettings & Record<string, string>;
  }
}

function saveSettings(settings: Partial<AppSettings>): void {
  try {
    const current = loadSettings();
    const merged = { ...current, ...settings };
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    require('fs').writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
  } catch { /* ignore */ }
}

function broadcastFullState(): void {
  broadcast('match-history-update', {
    recentMatches: getRecentMatches(50),
    stats: getOverallStats(),
    weaponStats: getWeaponStats(),
    legendStats: getLegendStats(),
  });

  const session = getCurrentSession();
  if (session) broadcast('session-update', session);

  broadcastCurrentAuthState();
}

function startPolling(intervalMs: number): void {
  if (!intervalMs) return;
  if (pollTimer) clearInterval(pollTimer);

  const poll = async () => {
    const originName = getOriginName();
    if (!originName) return;

    const stats = await getPlayerStats(originName);
    if (stats) broadcast('profile-update', stats);

    const maps = await getMapRotation();
    const servers = await getServerStatus();
    const serversOnline = servers ? Object.values(servers).every(r => r.Status === 'UP') : true;
    if (maps) broadcast('map-rotation-update', { rotation: maps, serversOnline });
  };

  poll();
  pollTimer = setInterval(poll, intervalMs);
}

function registerHotkeys(): void {
  globalShortcut.register('Shift+F1', () => {
    if (!overlayWindow) return;
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
    }
  });
}

function setupIpcHandlers(): void {
  ipcMain.on('request-state', () => {
    broadcastFullState();
    checkIfApexRunning();
  });

  ipcMain.on('launch-apex', () => {
    shell.openExternal('steam://rungameid/1172470');
  });

  ipcMain.on('login-steam', () => {
    loginSteam();
  });

  ipcMain.on('login-discord', () => {
    loginDiscord();
  });

  ipcMain.handle('link-origin-manual', async (_event: unknown, ...args: unknown[]) => {
    return linkOriginManual(args[0] as string);
  });

  ipcMain.handle('get-auth-state', () => {
    return broadcastCurrentAuthState();
  });

  ipcMain.on('update-settings', (_event: unknown, ...args: unknown[]) => {
    const settings = args[0] as Partial<AppSettings>;
    saveSettings(settings);
    if (settings.apiKey !== undefined) {
      setApiKey(settings.apiKey);
      startPolling(settings.pollIntervalMs ?? API_POLL_INTERVAL_MS);
    }
    broadcast('settings-update', settings);
  });

  ipcMain.on('set-pack-count', (_event: unknown, ...args: unknown[]) => {
    const count = args[0] as number;
    broadcast('pack-update', { count, justOpened: 0 });
  });
}

// Override messaging module's broadcast to use Electron IPC
function patchMessaging(): void {
  const messaging = require('../background/messaging');
  messaging.setBroadcastFn((channel: string, data: unknown) => {
    broadcast(channel, data);
  });
}

function logToRenderer(msg: string): void {
  try {
    (dashboardWindow as any)?.webContents?.executeJavaScript(`console.log('[MAIN] ${msg.replace(/'/g, "\\'").replace(/\\/g, '\\\\')}')`);
  } catch { /* ignore */ }
}

function checkIfApexRunning(): void {
  logToRenderer('Checking if Apex is already running...');
  execFile('tasklist', ['/FI', 'IMAGENAME eq r5apex.exe', '/FO', 'CSV', '/NH'], (err, stdout) => {
    logToRenderer('tasklist r5apex.exe: ' + (err ? err.message : stdout.trim()));
    if (!err && stdout.includes('r5apex')) {
      logToRenderer('Apex detected (DX11)');
      broadcast('game-running-update', { running: true });
      return;
    }
    execFile('tasklist', ['/FI', 'IMAGENAME eq r5apex_dx12.exe', '/FO', 'CSV', '/NH'], (err2, stdout2) => {
      logToRenderer('tasklist r5apex_dx12.exe: ' + (err2 ? err2.message : stdout2.trim()));
      if (!err2 && stdout2.includes('r5apex_dx12')) {
        logToRenderer('Apex detected (DX12)');
        broadcast('game-running-update', { running: true });
      } else {
        logToRenderer('Apex not detected');
      }
    });
  });
}

async function initApp(): Promise<void> {
  console.log('[ApexPulse] Initializing...');

  setUserDataPath(app.getPath('userData'));
  initDatabase();
  console.log('[ApexPulse] Database ready');

  const settings = loadSettings();
  if (settings.apiKey) setApiKey(settings.apiKey);

  initAuth({
    steamApiKey: settings.steamApiKey ?? '',
    discordClientId: settings.discordClientId ?? '',
  });

  initSessionManager();
  setupIpcHandlers();
  patchMessaging();

  try { await initPackDetector(); } catch (e) { console.warn('[ApexPulse] Pack detector init failed:', e); }
  registerPackCallbacks({
    onPacksOpened: (count, newTotal) => {
      broadcast('pack-update', { count: newTotal, justOpened: count });
    },
    onPackScreenDetected: (packCount) => {
      console.log(`[ApexPulse] Pack screen detected: ${packCount} packs`);
    },
    onPackScreenLeft: () => {},
  });

  registerCallbacks({
    onMatchStateChange: (state) => {
      handleMatchStateChange(state);
      if (state === 'active') {
        stopScanning();
        const isRanked = currentGameMode === 'ranked_br';
        if (isRanked && overlayWindow?.isVisible()) {
          overlayWindow.hide();
          broadcast('overlay-auto-hidden', { reason: 'ranked' });
        }
      } else {
        startScanning();
      }
    },
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
    onGameModeDetected: (mode: string) => {
      handleGameModeDetected(mode);
      currentGameMode = mode;
    },
    onMapDetected: handleMapDetected,
    onLegendDetected: handleLegendDetected,
  });
  onGameRunningChange((running) => {
    logToRenderer('GEP game running change: ' + running);
    broadcast('game-running-update', { running });
  });

  initGep();

  // Log GEP package events to renderer once windows exist
  const owApp2 = app as any;
  if (owApp2.overwolf?.packages) {
    const pkgs = owApp2.overwolf.packages;
    pkgs.on('ready', (_e: any, name: string, ver: string) => {
      logToRenderer('Package ready: ' + name + ' v' + ver);
    });
    pkgs.on('failed-to-initialize', (_e: any, name: string) => {
      logToRenderer('Package FAILED: ' + name);
    });
  }

  onMatchEnd((match) => {
    onMatchPlayed(match);
    clearLobby();
    broadcastFullState();
  });

  startScanning();
  startPolling(settings.apiKey ? API_POLL_INTERVAL_MS : 0);
  registerHotkeys();

  createDashboardWindow();
  createOverlayWindow();
  checkIfApexRunning();

  // Log GEP status to renderer after window is ready
  const owApp = app as any;
  const gepStatus = {
    overwolf: !!owApp.overwolf,
    packages: !!owApp.overwolf?.packages,
    gep: !!owApp.overwolf?.packages?.gep,
  };
  setTimeout(() => {
    logToRenderer('GEP status: ' + JSON.stringify(gepStatus));
  }, 2000);

  console.log('[ApexPulse] Initialization complete');
}

(app as any).commandLine.appendSwitch('owepm-packages-url', 'https://electronapi-qa.overwolf.com/packages');

app.whenReady().then(initApp);

app.on('window-all-closed', () => {
  // Keep running even if dashboard is closed (overlay may be active)
});

app.on('before-quit', () => {
  endCurrentSession();
  cleanupGep();
  cleanupPackDetector();
  closeDatabase();
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (!dashboardWindow) createDashboardWindow();
});
