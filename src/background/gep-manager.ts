import { app } from 'electron';
import { GepKillFeedEvent, GepMatchSummary, GepTeamMember, MatchState, GepRosterPlayer } from '../shared/types';
import { normalizeWeaponName, normalizeLegendName } from '../shared/utils';

const APEX_GAME_ID = 21566;
const GEP_FEATURES = [
  'gep_internal', 'me', 'team', 'kill', 'damage', 'death',
  'revive', 'match_state', 'game_info', 'match_info',
  'inventory', 'location', 'match_summary', 'roster',
  'rank', 'kill_feed',
];
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

type GepEventCallback = {
  onMatchStateChange: (state: MatchState) => void;
  onKillFeed: (event: GepKillFeedEvent) => void;
  onKill: (kills: number) => void;
  onAssist: (assists: number) => void;
  onDamage: (total: number) => void;
  onKnockdown: (knockdowns: number) => void;
  onDeath: () => void;
  onRevive: () => void;
  onTeamUpdate: (team: GepTeamMember[]) => void;
  onInventoryUpdate: (items: string[]) => void;
  onLocationUpdate: (x: number, y: number, z: number) => void;
  onMatchSummary: (summary: GepMatchSummary) => void;
  onRosterUpdate: (players: GepRosterPlayer[]) => void;
  onPlayerNameDetected: (name: string) => void;
  onGameModeDetected: (mode: string) => void;
  onMapDetected: (map: string) => void;
  onLegendDetected: (legend: string) => void;
};

type GameRunningCallback = (running: boolean) => void;

let callbacks: GepEventCallback | null = null;
let retryCount = 0;
let gepPackage: any = null;
let gameRunningCallback: GameRunningCallback | null = null;

export function onGameRunningChange(cb: GameRunningCallback): void {
  gameRunningCallback = cb;
}

export function registerCallbacks(cbs: GepEventCallback): void {
  callbacks = cbs;
}

function safeParse<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  return null;
}

function platformHwToString(hw: number | undefined): string {
  switch (hw) {
    case 7: return 'PC/Steam';
    case 2: return 'PC/Origin';
    case 1: return 'PS';
    case 9: return 'Switch';
    case 0: return 'Xbox';
    default: return 'PC';
  }
}

const teammateBuffer = new Map<string, GepTeamMember>();
const rosterBuffer = new Map<string, GepRosterPlayer>();
let rosterFlushTimer: ReturnType<typeof setTimeout> | null = null;
const ROSTER_DEBOUNCE_MS = 500;

function flushRoster(): void {
  if (!callbacks || rosterBuffer.size === 0) return;
  callbacks.onRosterUpdate(Array.from(rosterBuffer.values()));
}

export function initGep(): void {
  try {
    const owApp = app as any;
    const hasOw = !!owApp.overwolf;
    const hasPkg = !!owApp.overwolf?.packages;
    console.log(`[GEP] app.overwolf exists: ${hasOw}, packages exists: ${hasPkg}`);

    const { BrowserWindow } = require('electron');
    const wins = BrowserWindow.getAllWindows();
    for (const w of wins) {
      try {
        (w as any).webContents?.executeJavaScript(
          `console.log('[MAIN GEP] app.overwolf: ${hasOw}, packages: ${hasPkg}')`
        );
      } catch { /* ignore */ }
    }

    if (!owApp.overwolf?.packages) {
      console.warn('[GEP] No Overwolf package manager available — running without game events');
      return;
    }

    const packages = owApp.overwolf.packages;

    // If GEP is already ready (loaded before we registered listeners)
    if (packages.gep) {
      console.log('[GEP] Package already available');
      gepPackage = packages.gep;
      setupGepListeners(gepPackage);
    }

    packages.on('ready', (_event: any, packageName: string, version: string) => {
      console.log(`[GEP] Package ready: ${packageName} v${version}`);
      if (packageName === 'gep') {
        gepPackage = packages.gep;
        setupGepListeners(gepPackage);
      }
    });

    packages.on('failed-to-initialize', (_event: any, packageName: string) => {
      console.error(`[GEP] Package failed to initialize: ${packageName}`);
    });

    packages.on('crashed', (_event: any, canRecover: boolean) => {
      console.error(`[GEP] Package crashed, canRecover: ${canRecover}`);
    });
  } catch (error) {
    console.warn('[GEP] GEP initialization failed:', error);
  }
}

function setupGepListeners(gep: any): void {
  gep.on('game-detected', (event: any, gameId: number, name: string) => {
    if (gameId === APEX_GAME_ID) {
      console.log(`[GEP] Apex Legends detected (${name})`);
      event.enable();
      setFeatures(gep);
      gameRunningCallback?.(true);
    }
  });

  gep.on('new-info-update', (_event: any, gameId: number, data: any) => {
    if (gameId !== APEX_GAME_ID) return;
    handleInfoUpdate(data.feature, data.key, data.value);
  });

  gep.on('new-game-event', (_event: any, gameId: number, data: any) => {
    if (gameId !== APEX_GAME_ID) return;
    handleNewEvents({ events: [{ name: data.key, data: data.value }] });
  });

  gep.on('game-exit', (_event: any, gameId: number) => {
    if (gameId === APEX_GAME_ID) {
      console.log('[GEP] Apex Legends exited');
      gameRunningCallback?.(false);
      teammateBuffer.clear();
      rosterBuffer.clear();
    }
  });

  gep.on('error', (_event: any, gameId: number, error: string) => {
    console.error(`[GEP] Error for game ${gameId}:`, error);
  });

  gep.on('elevated-privileges-required', (_event: any, gameId: number) => {
    if (gameId === APEX_GAME_ID) {
      console.warn('[GEP] Apex is running as admin — app must also run as admin for game events');
    }
  });
}

function setFeatures(gep: any): void {
  gep.setRequiredFeatures(APEX_GAME_ID, GEP_FEATURES)
    .then(() => {
      console.log('[GEP] Features set successfully');
      retryCount = 0;
    })
    .catch((err: Error) => {
      console.warn('[GEP] Failed to set features:', err);
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(() => setFeatures(gep), RETRY_DELAY_MS);
      }
    });
}

function handleInfoUpdate(feature: string, key: string, rawValue: unknown): void {
  if (!callbacks) return;

  try {
    switch (feature) {
      case 'me': {
        if (key === 'name') {
          if (typeof rawValue === 'string' && rawValue) {
            callbacks.onPlayerNameDetected(rawValue);
          }
        }
        break;
      }

      case 'game_info': {
        if (key === 'player') {
          const parsed = safeParse<{ player_name?: string }>(rawValue);
          if (parsed?.player_name) callbacks.onPlayerNameDetected(parsed.player_name);
        }
        break;
      }

      case 'match_info': {
        if (key === 'game_mode') {
          callbacks.onGameModeDetected(String(rawValue));
        } else if (key === 'tabs') {
          const tabs = safeParse<Record<string, number>>(rawValue);
          if (tabs) {
            if (tabs.kills !== undefined) callbacks.onKill(Number(tabs.kills));
            if (tabs.assists !== undefined) callbacks.onAssist(Number(tabs.assists));
            if (tabs.damage !== undefined) callbacks.onDamage(Number(tabs.damage));
            if (tabs.knockdowns !== undefined) callbacks.onKnockdown(Number(tabs.knockdowns));
          }
        } else if (key === 'map_name') {
          callbacks.onMapDetected(String(rawValue));
        }
        break;
      }

      case 'match_state': {
        if (key === 'match_state') {
          const state: MatchState = String(rawValue) === 'active' ? 'active' : 'inactive';
          callbacks.onMatchStateChange(state);
        }
        break;
      }

      case 'team': {
        if (key.startsWith('teammate')) {
          const tm = safeParse<{ name?: string; state?: string }>(rawValue);
          if (tm) {
            teammateBuffer.set(key, {
              name: tm.name ?? '',
              legend: '',
              platform: 'PC',
              state: (tm.state === 'knocked_out' ? 'knocked' : tm.state ?? 'alive') as GepTeamMember['state'],
            });
            callbacks.onTeamUpdate(Array.from(teammateBuffer.values()));
          }
        } else if (key.startsWith('legendSelect')) {
          const ls = safeParse<{ playerName?: string; legendName?: string; is_local?: boolean }>(rawValue);
          if (ls?.legendName) {
            if (ls.is_local) {
              callbacks.onLegendDetected(normalizeLegendName(ls.legendName));
            }
            for (const [tmKey, tm] of teammateBuffer) {
              if (tm.name === ls.playerName) {
                teammateBuffer.set(tmKey, { ...tm, legend: normalizeLegendName(ls.legendName) });
                callbacks.onTeamUpdate(Array.from(teammateBuffer.values()));
                break;
              }
            }
          }
        }
        break;
      }

      case 'inventory': {
        if (key === 'weapons') {
          const weapons = safeParse<Record<string, string>>(rawValue);
          if (weapons) {
            const items = Object.values(weapons).map(w => normalizeWeaponName(w));
            callbacks.onInventoryUpdate(items);
          }
        }
        break;
      }

      case 'location': {
        if (key === 'location') {
          const loc = safeParse<{ x: string | number; y: string | number; z: string | number }>(rawValue);
          if (loc) callbacks.onLocationUpdate(Number(loc.x), Number(loc.y), Number(loc.z));
        }
        break;
      }

      case 'roster': {
        if (key.startsWith('roster_')) {
          const p = safeParse<{ name?: string; team_id?: number; platform_hw?: number; isTeammate?: boolean }>(rawValue);
          if (p) {
            rosterBuffer.set(key, {
              name: p.name ?? '',
              teamId: Number(p.team_id ?? 0),
              platform: platformHwToString(p.platform_hw),
              isTeammate: Boolean(p.isTeammate),
            });
            if (rosterFlushTimer) clearTimeout(rosterFlushTimer);
            rosterFlushTimer = setTimeout(flushRoster, ROSTER_DEBOUNCE_MS);
          }
        }
        break;
      }

      case 'damage': {
        if (key === 'totalDamageDealt') {
          callbacks.onDamage(Number(rawValue));
        }
        break;
      }

      case 'match_summary': {
        if (key === 'match_summary') {
          const summary = safeParse<{ rank?: string | number; teams?: string | number; squadKills?: string | number }>(rawValue);
          if (summary) {
            callbacks.onMatchSummary({
              rank: Number(summary.rank ?? 0),
              teams: Number(summary.teams ?? 0),
              squadKills: Number(summary.squadKills ?? 0),
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error('[GEP] Error handling info update:', feature, key, error);
  }
}

function handleNewEvents(events: { events: Array<{ name: string; data: unknown }> }): void {
  if (!callbacks) return;

  for (const event of events.events) {
    try {
      const data = safeParse<Record<string, unknown>>(event.data) ?? {};

      switch (event.name) {
        case 'match_state': {
          const raw = typeof event.data === 'string' ? event.data : (data.state ?? data);
          const state: MatchState = raw === 'active' || String(raw) === 'active' ? 'active' : 'inactive';
          callbacks.onMatchStateChange(state);
          break;
        }
        case 'kill_feed': {
          callbacks.onKillFeed({
            attackerName: String(data.attackerName ?? data.attacker ?? ''),
            victimName: String(data.victimName ?? data.victim ?? ''),
            weaponName: normalizeWeaponName(String(data.weaponName ?? data.weapon ?? '')),
            action: (data.action as GepKillFeedEvent['action']) ?? 'kill',
          });
          break;
        }
        case 'kill': callbacks.onKill(Number(data.totalKills ?? data.count ?? event.data)); break;
        case 'death': callbacks.onDeath(); break;
        case 'revive': callbacks.onRevive(); break;
        case 'damage': callbacks.onDamage(Number(data.totalDamage ?? data.damage ?? event.data)); break;
        case 'match_summary': {
          callbacks.onMatchSummary({
            rank: Number(data.rank ?? data.placement ?? 0),
            teams: Number(data.teams ?? data.totalTeams ?? 0),
            squadKills: Number(data.squadKills ?? data.squad_kills ?? 0),
          });
          break;
        }
      }
    } catch (error) {
      console.error('[GEP] Error handling event:', event.name, error);
    }
  }
}

export function cleanup(): void {
  callbacks = null;
  gepPackage = null;
  teammateBuffer.clear();
  rosterBuffer.clear();
  if (rosterFlushTimer) {
    clearTimeout(rosterFlushTimer);
    rosterFlushTimer = null;
  }
}
