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

let callbacks: GepEventCallback | null = null;
let retryCount = 0;
let gepProvider: unknown = null;

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

export function initGep(): void {
  try {
    // ow-electron exposes GEP via the overwolf-electron package
    // Try to load the GEP provider
    const { OverwolfPlugin } = require('@overwolf/ow-electron');
    if (OverwolfPlugin && OverwolfPlugin.GameEventProvider) {
      gepProvider = new OverwolfPlugin.GameEventProvider();
      setupGepListeners(gepProvider as GepProviderLike);
      setFeatures(gepProvider as GepProviderLike);
    }
  } catch {
    // Fallback: try the global overwolf API (Overwolf client mode)
    try {
      if (typeof overwolf !== 'undefined' && overwolf && overwolf.games?.events) {
        overwolf.games.events.onInfoUpdates2.addListener(handleInfoUpdate as (info: unknown) => void);
        overwolf.games.events.onNewEvents.addListener(handleNewEvents as (events: unknown) => void);
        setFeaturesOverwolf();
      } else {
        console.warn('[GEP] No GEP provider available — running without game events');
      }
    } catch {
      console.warn('[GEP] GEP initialization failed — game events disabled');
    }
  }
}

interface GepProviderLike {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  start: (config: { gameId: number; features: string[] }) => Promise<void>;
}

function setupGepListeners(provider: GepProviderLike): void {
  provider.on('info', (info: unknown) => {
    handleInfoUpdate(info as { feature: string; info: Record<string, unknown> });
  });

  provider.on('event', (event: unknown) => {
    const e = event as { events: Array<{ name: string; data: unknown }> };
    if (e.events) {
      handleNewEvents(e as { events: Array<{ name: string; data: unknown }> });
    }
  });
}

function setFeatures(provider: GepProviderLike): void {
  provider.start({ gameId: APEX_GAME_ID, features: GEP_FEATURES })
    .then(() => {
      console.log('[GEP] Features set successfully via ow-electron');
      retryCount = 0;
    })
    .catch((err: Error) => {
      console.warn('[GEP] Failed to set features:', err);
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(() => setFeatures(provider), RETRY_DELAY_MS);
      }
    });
}

function setFeaturesOverwolf(): void {
  if (typeof overwolf === 'undefined' || !overwolf) return;
  overwolf.games.events.setRequiredFeatures(GEP_FEATURES, (result: { success: boolean }) => {
    if (result.success) {
      console.log('[GEP] Features set successfully via Overwolf');
      retryCount = 0;
    } else {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(setFeaturesOverwolf, RETRY_DELAY_MS);
      }
    }
  });
}

function handleInfoUpdate(info: { feature: string; info: Record<string, unknown> }): void {
  if (!callbacks) return;
  const { feature, info: data } = info;

  try {
    switch (feature) {
      case 'me': {
        const meData = safeParse<{ name?: string }>(data.me ?? data);
        if (meData?.name) callbacks.onPlayerNameDetected(meData.name);
        else if (typeof data.me === 'string') callbacks.onPlayerNameDetected(data.me);
        break;
      }
      case 'match_info': {
        const tabs = safeParse<Record<string, number>>(data.tabs ?? data);
        if (tabs) {
          if (tabs.kills !== undefined) callbacks.onKill(Number(tabs.kills));
          if (tabs.assists !== undefined) callbacks.onAssist(Number(tabs.assists));
          if (tabs.damage !== undefined) callbacks.onDamage(Number(tabs.damage));
          if (tabs.knockdowns !== undefined) callbacks.onKnockdown(Number(tabs.knockdowns));
        }
        break;
      }
      case 'game_info': {
        if (data.game_mode) callbacks.onGameModeDetected(String(data.game_mode));
        if (data.map) callbacks.onMapDetected(String(data.map));
        if (data.legend) callbacks.onLegendDetected(normalizeLegendName(String(data.legend)));
        break;
      }
      case 'team': {
        const members: GepTeamMember[] = [];
        for (const [key, val] of Object.entries(data)) {
          if (key.startsWith('teammate')) {
            const tm = safeParse<{ name?: string; legend?: string; platform?: string; state?: string }>(val);
            if (tm) members.push({ name: tm.name ?? '', legend: normalizeLegendName(tm.legend ?? ''), platform: tm.platform ?? 'PC', state: (tm.state ?? 'alive') as GepTeamMember['state'] });
          }
        }
        if (members.length) callbacks.onTeamUpdate(members);
        break;
      }
      case 'inventory': {
        const items: string[] = [];
        for (const [key, val] of Object.entries(data)) {
          if (key.startsWith('inventory_')) {
            const item = safeParse<{ name?: string }>(val);
            if (item?.name) items.push(normalizeWeaponName(item.name));
          }
        }
        if (items.length) callbacks.onInventoryUpdate(items);
        break;
      }
      case 'location': {
        const loc = safeParse<{ x: number; y: number; z: number }>(data.location ?? data);
        if (loc) callbacks.onLocationUpdate(Number(loc.x), Number(loc.y), Number(loc.z));
        break;
      }
      case 'roster': {
        const players: GepRosterPlayer[] = [];
        for (const [key, val] of Object.entries(data)) {
          if (key.startsWith('roster_')) {
            const p = safeParse<{ name?: string; team_id?: number; platform?: string; is_teammate?: boolean }>(val);
            if (p) players.push({ name: p.name ?? '', teamId: Number(p.team_id ?? 0), platform: p.platform ?? 'PC', isTeammate: Boolean(p.is_teammate) });
          }
        }
        if (players.length) callbacks.onRosterUpdate(players);
        break;
      }
    }
  } catch (error) {
    console.error('[GEP] Error handling info update:', feature, error);
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
  try {
    if (typeof overwolf !== 'undefined' && overwolf && overwolf.games?.events) {
      overwolf.games.events.onInfoUpdates2.removeListener(handleInfoUpdate as unknown);
      overwolf.games.events.onNewEvents.removeListener(handleNewEvents as unknown);
    }
  } catch { /* ignore */ }
  callbacks = null;
  gepProvider = null;
}
