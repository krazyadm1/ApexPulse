import {
  MatchState,
  GepKillFeedEvent,
  GepMatchSummary,
  GepTeamMember,
  GepRosterPlayer,
} from '../shared/types';
import { normalizeWeaponName, normalizeLegendName } from '../shared/utils';
import { APEX_GAME_ID } from '../shared/constants';

// ── Callback interface ────────────────────────────────────────────────────────

export interface GepEventCallback {
  onMatchStateChange(state: MatchState): void;
  onKillFeed(event: GepKillFeedEvent): void;
  onKill(kills: number): void;
  onAssist(assists: number): void;
  onDamage(total: number): void;
  onKnockdown(knockdowns: number): void;
  onDeath(): void;
  onRevive(): void;
  onTeamUpdate(team: GepTeamMember[]): void;
  onInventoryUpdate(items: string[]): void;
  onLocationUpdate(x: number, y: number, z: number): void;
  onMatchSummary(summary: GepMatchSummary): void;
  onRosterUpdate(players: GepRosterPlayer[]): void;
  onPlayerNameDetected(name: string): void;
  onGameModeDetected(mode: string): void;
  onMapDetected(map: string): void;
  onLegendDetected(legend: string): void;
}

// ── Module state ──────────────────────────────────────────────────────────────

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

const GEP_FEATURES: string[] = [
  'gep_internal',
  'me',
  'team',
  'kill',
  'damage',
  'death',
  'revive',
  'match_state',
  'game_info',
  'match_info',
  'inventory',
  'location',
  'match_summary',
  'roster',
  'rank',
  'kill_feed',
];

let callbacks: GepEventCallback | null = null;
let featuresSet = false;
let retryCount = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely parse a value that may already be an object or a JSON string.
 */
function safeParse<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

// ── Event handlers ────────────────────────────────────────────────────────────

function handleInfoUpdate(info: overwolf.games.events.InfoUpdates2Event): void {
  if (!callbacks) return;

  try {
    const feature = info.feature as string;
    const data = info.info as Record<string, unknown>;

    switch (feature) {
      case 'me': {
        try {
          const me = (data['me'] as Record<string, unknown>) ?? data;
          const name = (me['player_name'] ?? me['name']) as string | undefined;
          if (name) callbacks.onPlayerNameDetected(name);
        } catch {
          // ignore malformed me data
        }
        break;
      }

      case 'match_info': {
        try {
          const matchInfo = (data['match_info'] as Record<string, unknown>) ?? data;
          const tabs = safeParse<Record<string, unknown>>(matchInfo['tabs']);
          if (tabs) {
            const kills = Number(tabs['kills'] ?? tabs['kill']);
            const assists = Number(tabs['assists'] ?? tabs['assist']);
            const damage = Number(tabs['damage']);
            const knockdowns = Number(tabs['knockdowns'] ?? tabs['knockdown']);
            if (!isNaN(kills)) callbacks.onKill(kills);
            if (!isNaN(assists)) callbacks.onAssist(assists);
            if (!isNaN(damage)) callbacks.onDamage(damage);
            if (!isNaN(knockdowns)) callbacks.onKnockdown(knockdowns);
          }
        } catch {
          // ignore malformed match_info data
        }
        break;
      }

      case 'game_info': {
        try {
          const gameInfo = (data['game_info'] as Record<string, unknown>) ?? data;
          const gameMode = gameInfo['game_mode'] as string | undefined;
          const map = gameInfo['map'] as string | undefined;
          const legendRaw = gameInfo['legend'] as string | undefined;
          if (gameMode) callbacks.onGameModeDetected(gameMode);
          if (map) callbacks.onMapDetected(map);
          if (legendRaw) callbacks.onLegendDetected(normalizeLegendName(legendRaw));
        } catch {
          // ignore malformed game_info data
        }
        break;
      }

      case 'team': {
        try {
          const teamData = (data['team'] as Record<string, unknown>) ?? data;
          const members: GepTeamMember[] = [];
          for (const key of Object.keys(teamData)) {
            try {
              const raw = safeParse<Record<string, unknown>>(teamData[key]);
              if (!raw) continue;
              members.push({
                name: String(raw['name'] ?? ''),
                legend: String(raw['legend'] ?? ''),
                platform: String(raw['platform'] ?? ''),
                state: (['alive', 'knocked', 'dead'].includes(raw['state'] as string)
                  ? (raw['state'] as GepTeamMember['state'])
                  : 'alive'),
              });
            } catch {
              // skip individual bad entries
            }
          }
          if (members.length > 0) callbacks.onTeamUpdate(members);
        } catch {
          // ignore malformed team data
        }
        break;
      }

      case 'inventory': {
        try {
          const inventoryData = (data['inventory'] as Record<string, unknown>) ?? data;
          const items: string[] = [];
          for (const key of Object.keys(inventoryData)) {
            try {
              const raw = safeParse<Record<string, unknown>>(inventoryData[key]);
              if (!raw) continue;
              const name = raw['name'] as string | undefined;
              if (name) items.push(normalizeWeaponName(name));
            } catch {
              // skip individual bad entries
            }
          }
          callbacks.onInventoryUpdate(items);
        } catch {
          // ignore malformed inventory data
        }
        break;
      }

      case 'location': {
        try {
          const locationData = (data['location'] as Record<string, unknown>) ?? data;
          const loc = safeParse<Record<string, unknown>>(locationData) ?? locationData;
          const x = Number(loc['x']);
          const y = Number(loc['y']);
          const z = Number(loc['z']);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            callbacks.onLocationUpdate(x, y, z);
          }
        } catch {
          // ignore malformed location data
        }
        break;
      }

      case 'roster': {
        try {
          const rosterData = (data['roster'] as Record<string, unknown>) ?? data;
          const players: GepRosterPlayer[] = [];
          for (const key of Object.keys(rosterData)) {
            try {
              const raw = safeParse<Record<string, unknown>>(rosterData[key]);
              if (!raw) continue;
              players.push({
                name: String(raw['name'] ?? ''),
                teamId: Number(raw['team_id'] ?? raw['teamId'] ?? 0),
                platform: String(raw['platform'] ?? ''),
                isTeammate: Boolean(raw['is_teammate'] ?? raw['isTeammate'] ?? false),
              });
            } catch {
              // skip individual bad entries
            }
          }
          if (players.length > 0) callbacks.onRosterUpdate(players);
        } catch {
          // ignore malformed roster data
        }
        break;
      }

      default:
        break;
    }
  } catch {
    // top-level guard — never let a parse error crash the handler
  }
}

function handleNewEvents(events: overwolf.games.events.NewGameEvents): void {
  if (!callbacks) return;

  try {
    for (const event of events.events) {
      try {
        const name = event.name as string;
        const dataRaw = event.data as unknown;

        switch (name) {
          case 'match_state': {
            try {
              const parsed = safeParse<Record<string, unknown>>(dataRaw) ?? {};
              const stateVal = (parsed['match_state'] ?? parsed['state'] ?? dataRaw) as string;
              const state: MatchState =
                stateVal === 'active' || stateVal === 'start' ? 'active' : 'inactive';
              callbacks.onMatchStateChange(state);
            } catch {
              // ignore
            }
            break;
          }

          case 'kill_feed': {
            try {
              const parsed = safeParse<Record<string, unknown>>(dataRaw) ?? {};
              const attackerName = String(parsed['attackerName'] ?? parsed['attacker'] ?? '');
              const victimName = String(parsed['victimName'] ?? parsed['victim'] ?? '');
              const weaponRaw = String(parsed['weaponName'] ?? parsed['weapon'] ?? '');
              const action = (['kill', 'knockdown', 'bleedout'].includes(parsed['action'] as string)
                ? (parsed['action'] as GepKillFeedEvent['action'])
                : 'kill');
              callbacks.onKillFeed({
                attackerName,
                victimName,
                weaponName: normalizeWeaponName(weaponRaw),
                action,
              });
            } catch {
              // ignore
            }
            break;
          }

          case 'kill': {
            try {
              const parsed = safeParse<Record<string, unknown>>(dataRaw) ?? {};
              const count = Number(parsed['kills'] ?? parsed['kill'] ?? dataRaw ?? 0);
              if (!isNaN(count)) callbacks.onKill(count);
            } catch {
              // ignore
            }
            break;
          }

          case 'death': {
            callbacks.onDeath();
            break;
          }

          case 'revive': {
            callbacks.onRevive();
            break;
          }

          case 'damage': {
            try {
              const parsed = safeParse<Record<string, unknown>>(dataRaw) ?? {};
              const total = Number(parsed['total'] ?? parsed['damage'] ?? dataRaw ?? 0);
              if (!isNaN(total)) callbacks.onDamage(total);
            } catch {
              // ignore
            }
            break;
          }

          case 'match_summary': {
            try {
              const parsed = safeParse<Record<string, unknown>>(dataRaw) ?? {};
              const rank = Number(parsed['rank'] ?? parsed['placement'] ?? 0);
              const teams = Number(parsed['teams'] ?? parsed['totalTeams'] ?? 0);
              const squadKills = Number(parsed['squad_kills'] ?? parsed['squadKills'] ?? 0);
              callbacks.onMatchSummary({ rank, teams, squadKills });
            } catch {
              // ignore
            }
            break;
          }

          default:
            break;
        }
      } catch {
        // guard per-event processing
      }
    }
  } catch {
    // top-level guard
  }
}

// ── setFeatures ───────────────────────────────────────────────────────────────

function setFeatures(): void {
  overwolf.games.events.setRequiredFeatures(GEP_FEATURES, (result) => {
    if (result.success) {
      featuresSet = true;
      retryCount = 0;
    } else {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(setFeatures, RETRY_DELAY_MS);
      } else {
        console.error(
          `[gep-manager] Failed to set GEP features after ${MAX_RETRIES} attempts:`,
          result,
        );
      }
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function registerCallbacks(cbs: GepEventCallback): void {
  callbacks = cbs;
}

export function initGep(): void {
  overwolf.games.events.onInfoUpdates2.addListener(handleInfoUpdate);
  overwolf.games.events.onNewEvents.addListener(handleNewEvents);
  setFeatures();
}

export function cleanup(): void {
  overwolf.games.events.onInfoUpdates2.removeListener(handleInfoUpdate);
  overwolf.games.events.onNewEvents.removeListener(handleNewEvents);
  callbacks = null;
  featuresSet = false;
  retryCount = 0;
}
