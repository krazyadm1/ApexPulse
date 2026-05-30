import { MatchRecord, LiveMatchData, TrackerState, GepKillFeedEvent, GepMatchSummary, GepTeamMember, MatchState, WeaponKillRecord } from '../shared/types';
import { generateId, nowMs, parseGameMode } from '../shared/utils';
import { insertMatch } from './database';
import { broadcastLiveUpdate, broadcastMatchEnded } from './messaging';

let live: LiveMatchData = createEmptyLiveData();
let playerName = '';
let postMatchTimer: ReturnType<typeof setTimeout> | null = null;

type MatchEndCallback = (match: MatchRecord) => void;
let onMatchEndCallback: MatchEndCallback | null = null;

export function setPlayerName(name: string): void {
  playerName = name;
}

export function getPlayerName(): string {
  return playerName;
}

export function onMatchEnd(callback: MatchEndCallback): void {
  onMatchEndCallback = callback;
}

export function getLiveData(): LiveMatchData {
  return { ...live };
}

function createEmptyLiveData(): LiveMatchData {
  return {
    state: 'idle',
    matchStartTime: null,
    gameMode: null,
    mapName: null,
    legend: null,
    kills: 0,
    deaths: 0,
    assists: 0,
    knockdowns: 0,
    damage: 0,
    squadKills: 0,
    teamsLeft: 0,
    totalTeams: 0,
    teammates: [],
    weaponKills: {},
    weaponKnockdowns: {},
    inventory: [],
    placement: null,
    rpEstimate: null,
  };
}

function transitionTo(newState: TrackerState): void {
  const old = live.state;
  live.state = newState;
  console.log(`[MatchTracker] ${old} → ${newState}`);
}

export function handleMatchStateChange(state: MatchState): void {
  if (state === 'active' && live.state !== 'in_match') {
    if (postMatchTimer) { clearTimeout(postMatchTimer); postMatchTimer = null; }
    live = createEmptyLiveData();
    live.matchStartTime = nowMs();
    transitionTo('in_match');
    broadcastLiveUpdate(live);
  } else if (state === 'inactive' && live.state === 'in_match') {
    transitionTo('post_match');
    finalizeMatch();
  }
}

export function handleKillFeed(event: GepKillFeedEvent): void {
  if (live.state !== 'in_match') return;

  const isPlayerKill = event.attackerName === playerName;
  const isPlayerTeamKill = live.teammates.some(t => t.name === event.attackerName) || isPlayerKill;

  if (isPlayerKill) {
    const weapon = event.weaponName;
    if (event.action === 'kill') {
      live.weaponKills[weapon] = (live.weaponKills[weapon] ?? 0) + 1;
    } else if (event.action === 'knockdown') {
      live.weaponKnockdowns[weapon] = (live.weaponKnockdowns[weapon] ?? 0) + 1;
    }
  }

  if (isPlayerTeamKill && event.action === 'kill') {
    live.squadKills++;
  }

  broadcastLiveUpdate(live);
}

export function handleKill(totalKills: number): void {
  if (live.state !== 'in_match') return;
  live.kills = totalKills;
  broadcastLiveUpdate(live);
}

export function handleAssist(totalAssists: number): void {
  if (live.state !== 'in_match') return;
  live.assists = totalAssists;
  broadcastLiveUpdate(live);
}

export function handleDamage(totalDamage: number): void {
  if (live.state !== 'in_match') return;
  live.damage = totalDamage;
  broadcastLiveUpdate(live);
}

export function handleKnockdown(totalKnockdowns: number): void {
  if (live.state !== 'in_match') return;
  live.knockdowns = totalKnockdowns;
  broadcastLiveUpdate(live);
}

export function handleDeath(): void {
  if (live.state !== 'in_match') return;
  live.deaths++;
  broadcastLiveUpdate(live);
}

export function handleRevive(): void {
  if (live.state !== 'in_match') return;
  broadcastLiveUpdate(live);
}

export function handleTeamUpdate(team: GepTeamMember[]): void {
  live.teammates = team;
  if (live.state === 'idle' || live.state === 'lobby') {
    transitionTo('legend_select');
  }
  broadcastLiveUpdate(live);
}

export function handleInventoryUpdate(items: string[]): void {
  live.inventory = items;
  broadcastLiveUpdate(live);
}

export function handleMatchSummary(summary: GepMatchSummary): void {
  live.placement = summary.rank;
  live.squadKills = Math.max(live.squadKills, summary.squadKills);
  live.totalTeams = summary.teams ?? live.totalTeams;

  if (live.state === 'in_match') {
    transitionTo('post_match');
    finalizeMatch();
  }
}

export function handleGameModeDetected(mode: string): void {
  live.gameMode = parseGameMode(mode);
}

export function handleMapDetected(map: string): void {
  live.mapName = map;
}

export function handleLegendDetected(legend: string): void {
  live.legend = legend;
}

export function handleTeamsLeft(teams: number): void {
  live.teamsLeft = teams;
  broadcastLiveUpdate(live);
}

function finalizeMatch(): void {
  const duration = live.matchStartTime ? Math.round((nowMs() - live.matchStartTime) / 1000) : 0;

  const weaponKills: WeaponKillRecord[] = Object.entries(live.weaponKills).map(([weaponName, kills]) => ({
    weaponName,
    kills,
    knockdowns: live.weaponKnockdowns[weaponName] ?? 0,
  }));

  const weaponKnockdowns: WeaponKillRecord[] = Object.entries(live.weaponKnockdowns)
    .filter(([name]) => !live.weaponKills[name])
    .map(([weaponName, knockdowns]) => ({ weaponName, kills: 0, knockdowns }));

  const record: MatchRecord = {
    matchId: generateId(),
    timestamp: nowMs(),
    duration,
    gameMode: live.gameMode ?? 'battle_royale',
    mapName: live.mapName ?? 'Unknown',
    placement: live.placement ?? 0,
    totalTeams: live.totalTeams ?? live.teamsLeft,
    kills: live.kills,
    assists: live.assists,
    knockdowns: live.knockdowns,
    damage: live.damage,
    revivesGiven: 0,
    respawnsGiven: 0,
    survivalTime: duration,
    legend: live.legend ?? 'Unknown',
    teammates: live.teammates.map(t => ({
      name: t.name,
      legend: t.legend,
      platform: t.platform,
      kills: 0,
      damage: 0,
      survived: t.state === 'alive',
    })),
    weaponKills,
    weaponKnockdowns,
    loadoutFinal: [...live.inventory],
    isWin: live.placement === 1,
    squadKills: live.squadKills,
  };

  try {
    insertMatch(record);
    console.log('[MatchTracker] Match saved:', record.matchId);
  } catch (error) {
    console.error('[MatchTracker] Failed to save match:', error);
  }

  broadcastMatchEnded(record);

  if (onMatchEndCallback) {
    onMatchEndCallback(record);
  }

  postMatchTimer = setTimeout(() => {
    postMatchTimer = null;
    live = createEmptyLiveData();
    transitionTo('idle');
  }, 5000);
}
