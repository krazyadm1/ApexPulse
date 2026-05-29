import { LIVEAPI_PORT } from '../shared/constants';
import { normalizeWeaponName, normalizeLegendName } from '../shared/utils';
import { GepKillFeedEvent, GepMatchSummary, GepTeamMember, MatchState, GepRosterPlayer } from '../shared/types';
import {
  LiveApiPlayer,
  LiveApiInit,
  LiveApiMatchSetup,
  LiveApiGameStateChanged,
  LiveApiCharacterSelected,
  LiveApiPlayerDamaged,
  LiveApiPlayerKilled,
  LiveApiPlayerDowned,
  LiveApiPlayerAssist,
  LiveApiPlayerStatChanged,
  LiveApiPlayerRevive,
  LiveApiSquadEliminated,
  LiveApiWeaponSwitched,
  LiveApiMatchStateEnd,
} from '../shared/liveapi-types';

type LiveApiCallbacks = {
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
  onMatchSummary: (summary: GepMatchSummary) => void;
  onRosterUpdate: (players: GepRosterPlayer[]) => void;
  onPlayerNameDetected: (name: string) => void;
  onGameModeDetected: (mode: string) => void;
  onMapDetected: (map: string) => void;
  onLegendDetected: (legend: string) => void;
  onGameRunning: (running: boolean) => void;
};

let wss: any = null;
let callbacks: LiveApiCallbacks | null = null;
let statusCallback: ((msg: string) => void) | null = null;
let localPlayerName = '';
let connected = false;

export function setStatusCallback(cb: (msg: string) => void): void {
  statusCallback = cb;
}

function logStatus(msg: string): void {
  console.log(msg);
  statusCallback?.(msg);
}

let matchKills = 0;
let matchAssists = 0;
let matchKnockdowns = 0;
let matchDamage = 0;
let matchTeammates: Map<string, GepTeamMember> = new Map();
let matchRoster: Map<number, GepRosterPlayer[]> = new Map();
let matchTotalTeams = 0;
let matchPlacement = 0;
let matchSquadKills = 0;
let localTeamId = 0;

function resetMatchState(): void {
  matchKills = 0;
  matchAssists = 0;
  matchKnockdowns = 0;
  matchDamage = 0;
  matchTeammates.clear();
  matchRoster.clear();
  matchTotalTeams = 0;
  matchPlacement = 0;
  matchSquadKills = 0;
  localTeamId = 0;
}

function isLocalPlayer(player: LiveApiPlayer): boolean {
  if (!localPlayerName) return false;
  return player.name === localPlayerName;
}

function isTeammate(player: LiveApiPlayer): boolean {
  return localTeamId > 0 && player.teamId === localTeamId;
}

export function setLocalPlayerName(name: string): void {
  localPlayerName = name;
}

export function registerLiveApiCallbacks(cbs: LiveApiCallbacks): void {
  callbacks = cbs;
}

export function isLiveApiConnected(): boolean {
  return connected;
}

export function startLiveApiServer(): void {
  if (wss) return;

  try {
    const { WebSocketServer: WsServer } = require('ws');
    wss = new WsServer({ port: LIVEAPI_PORT, host: '127.0.0.1' });

    wss.on('connection', (ws: any) => {
      logStatus('[LiveAPI] Game connected!');
      connected = true;
      callbacks?.onGameRunning(true);

      const pingInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.ping();
        }
      }, 15000);

      ws.on('pong', () => {});

      ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
        try {
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
          if (buf.length > 0 && buf[0] < 0x20 && buf[0] !== 0x09 && buf[0] !== 0x0A && buf[0] !== 0x0D) {
            return;
          }
          const text = buf.toString('utf8');
          const event = JSON.parse(text);
          handleLiveApiEvent(event);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logStatus(`[LiveAPI] Parse error: ${msg}`);
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        clearInterval(pingInterval);
        logStatus(`[LiveAPI] Game disconnected (code: ${code}, reason: ${reason?.toString() || 'none'})`);
        connected = false;
        callbacks?.onGameRunning(false);
      });

      ws.on('error', (err: Error) => {
        console.error('[LiveAPI] WebSocket error:', err);
      });
    });

    wss.on('error', (err: Error) => {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        logStatus(`[LiveAPI] Port ${LIVEAPI_PORT} already in use — another instance running?`);
      } else {
        logStatus(`[LiveAPI] Server error: ${err.message}`);
      }
    });

    wss.on('listening', () => {
      logStatus(`[LiveAPI] Server ready on ws://127.0.0.1:${LIVEAPI_PORT} — waiting for Apex to connect`);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStatus(`[LiveAPI] Failed to start server: ${msg}`);
  }
}

export function stopLiveApiServer(): void {
  if (wss) {
    wss.close();
    wss = null;
    connected = false;
  }
}

function handleLiveApiEvent(event: Record<string, unknown>): void {
  if (!callbacks) return;

  const type = detectEventType(event);
  if (!type) return;

  try {
    switch (type) {
      case 'Init': {
        const e = event as unknown as LiveApiInit;
        console.log(`[LiveAPI] Init — game v${e.gameVersion}, platform: ${e.platform}`);
        callbacks.onGameRunning(true);
        break;
      }

      case 'MatchSetup': {
        const e = event as unknown as LiveApiMatchSetup;
        callbacks.onMapDetected(e.map);
        callbacks.onGameModeDetected(e.playlistName);
        resetMatchState();
        break;
      }

      case 'GameStateChanged': {
        const e = event as unknown as LiveApiGameStateChanged;
        if (e.state === 'Playing' || e.state === 'playing') {
          callbacks.onMatchStateChange('active');
        } else if (e.state === 'Postmatch' || e.state === 'postmatch' || e.state === 'Resolution' || e.state === 'resolution') {
          callbacks.onMatchStateChange('inactive');
          callbacks.onMatchSummary({
            rank: matchPlacement,
            teams: matchTotalTeams,
            squadKills: matchSquadKills,
          });
        }
        break;
      }

      case 'CharacterSelected': {
        const e = event as unknown as LiveApiCharacterSelected;
        if (isLocalPlayer(e.player)) {
          callbacks.onLegendDetected(normalizeLegendName(e.player.character));
        }
        if (e.player.teamId > 0) {
          const roster: GepRosterPlayer = {
            name: e.player.name,
            teamId: e.player.teamId,
            platform: e.player.hardwareName || 'PC',
            isTeammate: isTeammate(e.player),
          };
          if (!matchRoster.has(e.player.teamId)) {
            matchRoster.set(e.player.teamId, []);
          }
          matchRoster.get(e.player.teamId)!.push(roster);
          matchTotalTeams = matchRoster.size;
        }
        break;
      }

      case 'PlayerConnected': {
        const e = event as unknown as { player: LiveApiPlayer };
        if (isLocalPlayer(e.player)) {
          localTeamId = e.player.teamId;
        }
        if (e.player.teamId === localTeamId && !isLocalPlayer(e.player)) {
          matchTeammates.set(e.player.name, {
            name: e.player.name,
            legend: normalizeLegendName(e.player.character),
            platform: e.player.hardwareName || 'PC',
            state: 'alive',
          });
          callbacks.onTeamUpdate(Array.from(matchTeammates.values()));
        }
        break;
      }

      case 'PlayerDamaged': {
        const e = event as unknown as LiveApiPlayerDamaged;
        if (isLocalPlayer(e.attacker)) {
          matchDamage += e.damageInflicted;
          callbacks.onDamage(matchDamage);
        }
        break;
      }

      case 'PlayerKilled': {
        const e = event as unknown as LiveApiPlayerKilled;
        if (isLocalPlayer(e.awardedTo)) {
          matchKills++;
          callbacks.onKill(matchKills);
          callbacks.onKillFeed({
            attackerName: e.awardedTo.name,
            victimName: e.victim.name,
            weaponName: normalizeWeaponName(e.weapon),
            action: 'kill',
          });
        } else if (isTeammate(e.awardedTo)) {
          matchSquadKills++;
          callbacks.onKillFeed({
            attackerName: e.awardedTo.name,
            victimName: e.victim.name,
            weaponName: normalizeWeaponName(e.weapon),
            action: 'kill',
          });
        }
        if (isLocalPlayer(e.victim)) {
          callbacks.onDeath();
        }
        if (matchTeammates.has(e.victim.name)) {
          matchTeammates.set(e.victim.name, {
            ...matchTeammates.get(e.victim.name)!,
            state: 'dead',
          });
          callbacks.onTeamUpdate(Array.from(matchTeammates.values()));
        }
        break;
      }

      case 'PlayerDowned': {
        const e = event as unknown as LiveApiPlayerDowned;
        if (isLocalPlayer(e.attacker)) {
          matchKnockdowns++;
          callbacks.onKnockdown(matchKnockdowns);
          callbacks.onKillFeed({
            attackerName: e.attacker.name,
            victimName: e.victim.name,
            weaponName: normalizeWeaponName(e.weapon),
            action: 'knockdown',
          });
        }
        if (matchTeammates.has(e.victim.name)) {
          matchTeammates.set(e.victim.name, {
            ...matchTeammates.get(e.victim.name)!,
            state: 'knocked',
          });
          callbacks.onTeamUpdate(Array.from(matchTeammates.values()));
        }
        break;
      }

      case 'PlayerAssist': {
        const e = event as unknown as LiveApiPlayerAssist;
        if (isLocalPlayer(e.assistant)) {
          matchAssists++;
          callbacks.onAssist(matchAssists);
        }
        break;
      }

      case 'PlayerStatChanged': {
        const e = event as unknown as LiveApiPlayerStatChanged;
        if (isLocalPlayer(e.player)) {
          switch (e.statName) {
            case 'kills': matchKills = e.newValue; callbacks.onKill(matchKills); break;
            case 'knockdowns': matchKnockdowns = e.newValue; callbacks.onKnockdown(matchKnockdowns); break;
            case 'revivesGiven': callbacks.onRevive(); break;
          }
        }
        break;
      }

      case 'PlayerRevive': {
        const e = event as unknown as LiveApiPlayerRevive;
        if (isLocalPlayer(e.player)) {
          callbacks.onRevive();
        }
        if (matchTeammates.has(e.revived.name)) {
          matchTeammates.set(e.revived.name, {
            ...matchTeammates.get(e.revived.name)!,
            state: 'alive',
          });
          callbacks.onTeamUpdate(Array.from(matchTeammates.values()));
        }
        break;
      }

      case 'SquadEliminated': {
        const e = event as unknown as LiveApiSquadEliminated;
        const isLocalSquad = e.players.some(p => isLocalPlayer(p));
        if (isLocalSquad) {
          matchPlacement = e.placement;
        }
        break;
      }

      case 'MatchStateEnd': {
        const e = event as unknown as LiveApiMatchStateEnd;
        const localWon = e.winners?.some(p => isLocalPlayer(p));
        if (localWon) {
          matchPlacement = 1;
        }
        break;
      }

      case 'WeaponSwitched': {
        const e = event as unknown as LiveApiWeaponSwitched;
        if (isLocalPlayer(e.player)) {
          const weapons = [e.newWeapon];
          if (e.oldWeapon) weapons.push(e.oldWeapon);
          callbacks.onInventoryUpdate(weapons.map(normalizeWeaponName));
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[LiveAPI] Error handling ${type}:`, err);
  }
}

function detectEventType(event: Record<string, unknown>): string | null {
  if (event.type) return String(event.type);
  if (event.gameMessage && typeof event.gameMessage === 'object') {
    const msg = event.gameMessage as Record<string, unknown>;
    if (msg['@type']) {
      const typeName = String(msg['@type']);
      return typeName.split('.').pop() ?? null;
    }
  }
  if (event.gameVersion !== undefined) return 'Init';
  if (event.playlistName !== undefined) return 'MatchSetup';
  if (event.damageInflicted !== undefined && event.weapon !== undefined && event.awardedTo !== undefined) return 'PlayerKilled';
  if (event.damageInflicted !== undefined && event.weapon !== undefined) return 'PlayerDamaged';
  if (event.state !== undefined && event.winners !== undefined) return 'MatchStateEnd';
  if (event.state !== undefined && !event.player) return 'GameStateChanged';
  if (event.statName !== undefined) return 'PlayerStatChanged';
  if (event.oldWeapon !== undefined) return 'WeaponSwitched';
  if (event.assistant !== undefined) return 'PlayerAssist';
  if (event.revived !== undefined) return 'PlayerRevive';
  if (event.placement !== undefined && event.players !== undefined) return 'SquadEliminated';
  if (event.awardedTo !== undefined) return 'PlayerKilled';
  return null;
}
