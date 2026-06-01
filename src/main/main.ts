import { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen, shell, Tray, Menu, nativeImage } from 'electron';
import { execFile } from 'child_process';
import path from 'path';
import { initDatabase, saveDatabase, closeDatabase, getRecentMatches, getOverallStats, getWeaponStats, getLegendStats, getHeadshotStats, getRpHistory, getWeeklyRpChange, setUserDataPath, exportAllData } from '../background/database';
import { initGep, registerCallbacks, onGameRunningChange, cleanup as cleanupGep } from '../background/gep-manager';
import {
  setPlayerName, getPlayerName, handleMatchStateChange, handleKillFeed, handleKill,
  handleAssist, handleDamage, handleKnockdown, handleDeath, handleRevive,
  handleTeamUpdate, handleInventoryUpdate, handleMatchSummary,
  handleGameModeDetected, handleMapDetected, handleLegendDetected,
  handleSquadKills, handleTeamsLeft, updateRankScore, onMatchEnd,
} from '../background/match-tracker';
import { initSessionManager, onMatchPlayed, endCurrentSession, getCurrentSession } from '../background/session-manager';
import { setApiKey, getApiKey, getPlayerStats, getMapRotation, getServerStatus, getGepEventStatus, getCraftingRotation } from '../background/api-client';
import { initAuth, handlePlayerDetected, broadcastCurrentAuthState, loginSteam, loginDiscord, linkOriginManual, handleSteamCallback, handleDiscordCallback } from '../background/auth/auth-manager';
import { getOriginName } from '../background/auth/origin-resolver';
import { processRoster, clearLobby } from '../background/lobby-intel';
// Pack detector disabled: uses DOM APIs not available in main process.
// TODO: reimplement using @napi-rs/canvas or move to renderer process.
import { startAuthServer, stopAuthServer } from '../background/auth/auth-server';
import { startLiveApiServer, stopLiveApiServer, registerLiveApiCallbacks, setLocalPlayerName, setStatusCallback as setLiveApiStatusCallback } from '../background/liveapi-client';
import { API_POLL_INTERVAL_MS } from '../shared/constants';
import { parseGameMode } from '../shared/utils';
import { AppSettings } from '../shared/types';

let dashboardWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let gepStatusTimer: ReturnType<typeof setInterval> | null = null;
let currentGameMode: string | null = null;
let isQuitting = false;
let cachedMapData: { rotation: unknown; crafting: unknown; serversOnline: boolean } | null = null;

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
  dashboardWindow.on('close', (e: unknown) => {
    if (!isQuitting) {
      (e as Event).preventDefault();
      dashboardWindow?.hide();
    }
  });
  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, 'assets/icons/icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('ApexPulse');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open ApexPulse', click: () => { dashboardWindow?.show(); dashboardWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { dashboardWindow?.show(); dashboardWindow?.focus(); });
}

function createOverlayWindow(): void {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const secondaryDisplay = displays.find(d => d.id !== primaryDisplay.id);

  const targetDisplay = secondaryDisplay ?? primaryDisplay;
  const bounds = targetDisplay.workArea;

  const savedPos = loadOverlayPosition();

  overlayWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: savedPos?.x ?? bounds.x + bounds.width - 420,
    y: savedPos?.y ?? bounds.y + 10,
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

  const settings = loadSettings();
  if (settings.overlayOpacity !== undefined) {
    (overlayWindow as any).setOpacity(settings.overlayOpacity);
  }
  if (settings.overlayEnabled === false) {
    overlayWindow.hide();
  }

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

function broadcastError(code: string, message: string): void {
  broadcast('app-error', { code, message, timestamp: Date.now() });
}

async function checkGepStatus(): Promise<void> {
  try {
    const status = await getGepEventStatus();
    if (status && typeof status === 'object') {
      const downFeatures = Object.entries(status)
        .filter(([, v]) => typeof v === 'string' && v !== 'good' && v !== 'up')
        .map(([k]) => k);
      if (downFeatures.length > 0) {
        broadcastError('gep_status', `Some game events may be unavailable: ${downFeatures.join(', ')}.`);
      }
    }
  } catch { /* ignore */ }
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
      hardwareAcceleration: true,
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
    headshotStats: getHeadshotStats(7),
    rpHistory: getRpHistory(20),
    weeklyRpChange: getWeeklyRpChange(),
  });

  const session = getCurrentSession();
  if (session) broadcast('session-update', session);

  broadcastCurrentAuthState();
}

async function triggerPoll(): Promise<void> {
  if (!getApiKey()) return;

  const originName = getOriginName();
  if (originName) {
    try {
      const stats = await getPlayerStats(originName);
      if (stats) {
        broadcast('profile-update', stats);
        if (stats.global?.rank?.rankScore != null) {
          updateRankScore(stats.global.rank.rankScore);
        }
      }
    } catch {
      broadcastError('api_stats', 'Could not fetch player stats. Check your API key and connection.');
    }
  }

  try {
    const maps = await getMapRotation();
    const servers = await getServerStatus();
    const crafting = await getCraftingRotation();
    const gameServerKeys = ['Origin_login', 'EA_novafusion', 'EA_accounts', 'ApexOauth_Crossplay'];
    const serversOnline = servers ? gameServerKeys.every(key => {
      const category = (servers as Record<string, unknown>)[key];
      if (!category || typeof category !== 'object') return true;
      return Object.values(category as Record<string, { Status?: string }>).every(region => region?.Status === 'UP' || region?.Status === 'SLOW');
    }) : true;
    if (maps) {
      cachedMapData = { rotation: maps, crafting, serversOnline };
      broadcast('map-rotation-update', cachedMapData);
    }
  } catch {
    broadcastError('api_maps', 'Could not fetch map rotation. Will retry shortly.');
  }
}

function startPolling(intervalMs: number): void {
  if (!intervalMs) return;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(triggerPoll, intervalMs);
}

function registerHotkeys(): void {
  const settings = loadSettings();
  const hotkey = settings.overlayHotkey || 'Shift+F1';

  globalShortcut.unregisterAll();

  globalShortcut.register(hotkey, () => {
    if (!overlayWindow) return;
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
    }
  });

  console.log(`[ApexPulse] Hotkey registered: ${hotkey}`);
}

function setupIpcHandlers(): void {
  ipcMain.on('request-state', () => {
    broadcastFullState();
    if (cachedMapData) broadcast('map-rotation-update', cachedMapData);
    checkIfApexRunning();
    triggerPoll();
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

  ipcMain.handle('export-data', async () => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const result = await dialog.showSaveDialog(dashboardWindow!, {
      defaultPath: `ApexPulse-Export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { success: false };
    const data = exportAllData();
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, path: result.filePath };
  });

  ipcMain.on('update-settings', (_event: unknown, ...args: unknown[]) => {
    const settings = args[0] as Partial<AppSettings>;
    saveSettings(settings);
    if (settings.apiKey !== undefined) {
      setApiKey(settings.apiKey);
      startPolling(settings.pollIntervalMs ?? API_POLL_INTERVAL_MS);
    }
    broadcast('settings-update', settings);
    if (settings.overlayEnabled !== undefined && overlayWindow) {
      if (settings.overlayEnabled) {
        overlayWindow.show();
      } else {
        overlayWindow.hide();
      }
    }
    if (settings.overlayOpacity !== undefined && overlayWindow) {
      (overlayWindow as any).setOpacity(settings.overlayOpacity);
    }
    if (settings.overlayHotkey !== undefined) {
      registerHotkeys();
    }
  });

  ipcMain.on('set-pack-count', (_event: unknown, ...args: unknown[]) => {
    const count = args[0] as number;
    broadcast('pack-update', { count, justOpened: 0 });
  });

  ipcMain.on('dev-sim-event', (_event: unknown, ...args: unknown[]) => {
    if (process.env.OW_DEV !== 'true') return;
    const { type, data } = args[0] as { type: string; data: any };
    console.log(`[DEV-SIM] ${type}:`, JSON.stringify(data));
    switch (type) {
      case 'match_state': handleMatchStateChange(data.state); break;
      case 'kill': handleKill(Number(data.kills ?? 1)); break;
      case 'assist': handleAssist(Number(data.assists ?? 1)); break;
      case 'damage': handleDamage(Number(data.damage ?? 100)); break;
      case 'knockdown': handleKnockdown(Number(data.knockdowns ?? 1)); break;
      case 'death': handleDeath(); break;
      case 'revive': handleRevive(); break;
      case 'kill_feed': handleKillFeed(data); break;
      case 'team': handleTeamUpdate(data.teammates); break;
      case 'inventory': handleInventoryUpdate(data.items); break;
      case 'match_summary': handleMatchSummary(data); break;
      case 'game_mode': handleGameModeDetected(data.mode); currentGameMode = parseGameMode(data.mode); break;
      case 'map': handleMapDetected(data.map); break;
      case 'legend': handleLegendDetected(data.legend); break;
      case 'player_name': setPlayerName(data.name); setLocalPlayerName(data.name); break;
      case 'squad_kills': handleSquadKills(Number(data.count ?? 1)); break;
      case 'teams_left': handleTeamsLeft(Number(data.teams)); break;
      case 'rank_score': updateRankScore(Number(data.score)); break;
      case 'game_running': broadcast('game-running-update', { running: data.running }); break;
    }
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
    (dashboardWindow as any)?.webContents?.executeJavaScript(`console.log('[MAIN] ${msg.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`);
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

async function initCmp(): Promise<void> {
  try {
    const owApp = app as any;
    if (!owApp.overwolf) return;

    const required = await owApp.overwolf.isCMPRequired();
    if (required) {
      await owApp.overwolf.openCMPWindow();
    }
  } catch (e) {
    console.warn('[ApexPulse] CMP init failed:', e);
  }
}

async function initApp(): Promise<void> {
  console.log('[ApexPulse] Initializing...');

  setUserDataPath(app.getPath('userData'));
  initDatabase();
  console.log('[ApexPulse] Database ready');

  const settings = loadSettings();
  if (settings.apiKey) setApiKey(settings.apiKey);

  const { DISCORD_CLIENT_ID, STEAM_API_KEY } = require('../shared/constants');
  initAuth({
    steamApiKey: STEAM_API_KEY,
    discordClientId: DISCORD_CLIENT_ID,
  });
  startAuthServer();

  initSessionManager();
  setupIpcHandlers();
  patchMessaging();

  registerCallbacks({
    onMatchStateChange: (state) => {
      handleMatchStateChange(state);
      if (state === 'active') {
        const isRanked = currentGameMode === 'ranked_br';
        if (isRanked && overlayWindow?.isVisible()) {
          overlayWindow.hide();
          broadcast('overlay-auto-hidden', { reason: 'ranked' });
        }
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
      setLocalPlayerName(name);
      await handlePlayerDetected(name);
    },
    onGameModeDetected: (mode: string) => {
      handleGameModeDetected(mode);
      currentGameMode = parseGameMode(mode);
    },
    onMapDetected: handleMapDetected,
    onLegendDetected: handleLegendDetected,
  });
  onGameRunningChange((running) => {
    logToRenderer('GEP game running change: ' + running);
    broadcast('game-running-update', { running });
  });

  registerLiveApiCallbacks({
    onMatchStateChange: (state) => {
      handleMatchStateChange(state);
      if (state === 'active') {
        const isRanked = currentGameMode === 'ranked_br';
        if (isRanked && overlayWindow?.isVisible()) {
          overlayWindow.hide();
          broadcast('overlay-auto-hidden', { reason: 'ranked' });
        }
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
    onMatchSummary: handleMatchSummary,
    onRosterUpdate: (players) => { processRoster(players); },
    onPlayerNameDetected: async (name: string) => {
      setPlayerName(name);
      setLocalPlayerName(name);
      await handlePlayerDetected(name);
    },
    onGameModeDetected: (mode: string) => {
      handleGameModeDetected(mode);
      currentGameMode = parseGameMode(mode);
    },
    onMapDetected: handleMapDetected,
    onLegendDetected: handleLegendDetected,
    onGameRunning: (running) => {
      logToRenderer('LiveAPI game running change: ' + running);
      broadcast('game-running-update', { running });
    },
  });
  setLiveApiStatusCallback((msg) => logToRenderer(msg));

  initGep();
  checkGepStatus();
  gepStatusTimer = setInterval(checkGepStatus, 5 * 60 * 1000);

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

  startPolling(settings.apiKey ? API_POLL_INTERVAL_MS : 0);
  registerHotkeys();

  await initCmp();
  createTray();
  createDashboardWindow();
  createOverlayWindow();
  startLiveApiServer();
  const originName = getOriginName();
  if (originName) {
    setLocalPlayerName(originName);
    logToRenderer('[LiveAPI] Local player set from Origin: ' + originName);
  }
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

if (process.env.OW_DEV === 'true') {
  (app as any).commandLine.appendSwitch('owepm-packages-url', 'https://electronapi-qa.overwolf.com/packages');
}

const earlySettings = loadSettings();
if (earlySettings.hardwareAcceleration === false) {
  (app as any).disableHardwareAcceleration();
}

app.whenReady().then(initApp).catch(err => console.error('[ApexPulse] Fatal init error:', err));

process.on('unhandledRejection', (reason) => {
  console.error('[ApexPulse] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[ApexPulse] Uncaught exception:', err);
});

app.on('window-all-closed', () => {
  // Keep running even if dashboard is closed (overlay may be active)
});

app.on('before-quit', () => {
  isQuitting = true;
  stopAuthServer();
  stopLiveApiServer();
  if (gepStatusTimer) clearInterval(gepStatusTimer);
  if (pollTimer) clearInterval(pollTimer);
  endCurrentSession();
  cleanupGep();
  closeDatabase();
  globalShortcut.unregisterAll();
  tray?.destroy();
});

app.on('activate', () => {
  if (!dashboardWindow) createDashboardWindow();
});
