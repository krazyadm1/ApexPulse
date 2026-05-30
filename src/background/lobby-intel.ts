import { GepRosterPlayer, LobbyPlayer, ApexApiPlayerResponse } from '../shared/types';
import { getPlayerStats } from './api-client';
import { broadcastLobbyIntel } from './messaging';

let currentLobby: LobbyPlayer[] = [];
let lookupInProgress = false;
let lookupGeneration = 0;

export function getLobbyPlayers(): LobbyPlayer[] {
  return [...currentLobby];
}

export async function processRoster(roster: GepRosterPlayer[]): Promise<void> {
  lookupGeneration++;
  const thisGeneration = lookupGeneration;

  currentLobby = roster.map(p => ({
    name: p.name,
    platform: p.platform,
    teamId: p.teamId,
    isTeammate: p.isTeammate,
    loaded: false,
  }));

  broadcastLobbyIntel(currentLobby);

  if (lookupInProgress) return;
  lookupInProgress = true;

  try {
    const sorted = [...currentLobby].sort((a, b) => {
      if (a.isTeammate !== b.isTeammate) return a.isTeammate ? -1 : 1;
      return a.teamId - b.teamId;
    });

    for (const player of sorted) {
      if (thisGeneration !== lookupGeneration) break;
      if (!player.name) continue;

      try {
        const stats = await getPlayerStats(player.name);
        if (stats && thisGeneration === lookupGeneration) {
          applyStatsToPlayer(player, stats);
        }
        player.loaded = true;
      } catch {
        player.loaded = true;
      }

      if (thisGeneration === lookupGeneration) {
        broadcastLobbyIntel([...currentLobby]);
      }
    }
  } finally {
    lookupInProgress = false;
  }
}

function applyStatsToPlayer(player: LobbyPlayer, stats: ApexApiPlayerResponse): void {
  player.level = stats.global.level;
  player.rankName = `${stats.global.rank.rankName} ${stats.global.rank.rankDiv}`;
  player.rankScore = stats.global.rank.rankScore;
  player.selectedLegend = stats.realtime.selectedLegend;

  const totalKills = stats.total?.kills?.value;
  if (totalKills !== undefined) {
    player.kills = totalKills;
  }
}

export function clearLobby(): void {
  lookupGeneration++;
  currentLobby = [];
}
