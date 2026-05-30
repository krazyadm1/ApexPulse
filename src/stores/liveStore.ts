import { create } from 'zustand';
import { LiveMatchData, TrackerState, WindowMessage, LobbyPlayer } from '../shared/types';
import { onMessage, setupRendererListener } from '../background/messaging';

interface LiveState {
  matchState: TrackerState;
  kills: number;
  assists: number;
  knockdowns: number;
  damage: number;
  squadKills: number;
  teamsLeft: number;
  legend: string | null;
  mapName: string | null;
  gameMode: string | null;
  teammates: LiveMatchData['teammates'];
  weaponKills: Record<string, number>;
  inventory: string[];
  placement: number | null;
  isLive: boolean;
  gameRunning: boolean;
  lobbyPlayers: LobbyPlayer[];
  init: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  matchState: 'idle',
  kills: 0,
  assists: 0,
  knockdowns: 0,
  damage: 0,
  squadKills: 0,
  teamsLeft: 0,
  legend: null,
  mapName: null,
  gameMode: null,
  teammates: [],
  weaponKills: {},
  inventory: [],
  placement: null,
  isLive: false,
  gameRunning: false,
  lobbyPlayers: [],

  init: () => {
    setupRendererListener();
    onMessage('LIVE_MATCH_UPDATE', (msg: WindowMessage) => {
      const data = msg.payload as LiveMatchData;
      set({
        matchState: data.state,
        kills: data.kills,
        assists: data.assists,
        knockdowns: data.knockdowns,
        damage: data.damage,
        squadKills: data.squadKills,
        teamsLeft: data.teamsLeft,
        legend: data.legend,
        mapName: data.mapName,
        gameMode: data.gameMode,
        teammates: data.teammates,
        weaponKills: data.weaponKills,
        inventory: data.inventory,
        placement: data.placement,
        isLive: data.state === 'in_match',
      });
    });

    onMessage('LOBBY_INTEL_UPDATE', (msg: WindowMessage) => {
      const players = msg.payload as LobbyPlayer[];
      set({ lobbyPlayers: players });
    });

    onMessage('MATCH_ENDED', () => {
      set({ isLive: false, matchState: 'idle', lobbyPlayers: [] });
    });

    onMessage('GAME_RUNNING_UPDATE', (msg: WindowMessage) => {
      const { running } = msg.payload as { running: boolean };
      set({ gameRunning: running, ...(running ? {} : { isLive: false, matchState: 'idle' as TrackerState }) });
    });
  },
}));
