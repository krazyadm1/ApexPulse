import { create } from 'zustand';
import { MatchRecord, WindowMessage } from '../shared/types';
import { onMessage } from '../background/messaging';

interface MatchState {
  recentMatches: MatchRecord[];
  totalMatches: number;
  totalKills: number;
  totalDamage: number;
  totalWins: number;
  avgDamage: number;
  kdRatio: number;
  winRate: number;
  weaponStats: Array<{ weaponName: string; totalKills: number; totalKnockdowns: number; matchesUsed: number }>;
  legendStats: Array<{ legend: string; matches: number; kills: number; damage: number; wins: number; avgDamage: number; kdRatio: number }>;
  headshotStats: Array<{ matchId: string; timestamp: number; headshots: number; bodyshots: number; legend: string }>;
  rpHistory: Array<{ matchId: string; timestamp: number; rpBefore: number | null; rpAfter: number | null; rpChange: number | null; gameMode: string }>;
  weeklyRpChange: number;
  sessionRpChange: number;
  init: () => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  recentMatches: [],
  totalMatches: 0,
  totalKills: 0,
  totalDamage: 0,
  totalWins: 0,
  avgDamage: 0,
  kdRatio: 0,
  winRate: 0,
  weaponStats: [],
  legendStats: [],
  headshotStats: [],
  rpHistory: [],
  weeklyRpChange: 0,
  sessionRpChange: 0,

  init: () => {
    onMessage('MATCH_HISTORY_UPDATE', (msg: WindowMessage) => {
      const data = msg.payload as {
        recentMatches: MatchRecord[];
        stats: { totalMatches: number; totalKills: number; totalDamage: number; totalWins: number; avgDamage: number; kdRatio: number; winRate: number };
        weaponStats: MatchState['weaponStats'];
        legendStats: MatchState['legendStats'];
        headshotStats: MatchState['headshotStats'];
        rpHistory: MatchState['rpHistory'];
        weeklyRpChange: number;
      };
      set({
        recentMatches: data.recentMatches,
        totalMatches: data.stats.totalMatches,
        totalKills: data.stats.totalKills,
        totalDamage: data.stats.totalDamage,
        totalWins: data.stats.totalWins,
        avgDamage: data.stats.avgDamage,
        kdRatio: data.stats.kdRatio,
        winRate: data.stats.winRate,
        weaponStats: data.weaponStats,
        legendStats: data.legendStats,
        headshotStats: data.headshotStats ?? [],
        rpHistory: data.rpHistory ?? [],
        weeklyRpChange: data.weeklyRpChange ?? 0,
      });
    });

    onMessage('SESSION_UPDATE', (msg: WindowMessage) => {
      const session = msg.payload as { totalRpChange: number };
      set({ sessionRpChange: session.totalRpChange ?? 0 });
    });

    onMessage('MATCH_ENDED', (msg: WindowMessage) => {
      const match = msg.payload as MatchRecord;
      set(state => {
        const totalMatches = state.totalMatches + 1;
        const totalKills = state.totalKills + match.kills;
        const totalDamage = state.totalDamage + match.damage;
        const totalWins = state.totalWins + (match.isWin ? 1 : 0);
        const deaths = Math.max(totalMatches - totalWins, 1);
        return {
          recentMatches: [match, ...state.recentMatches].slice(0, 50),
          totalMatches,
          totalKills,
          totalDamage,
          totalWins,
          avgDamage: Math.round(totalDamage / totalMatches),
          kdRatio: Math.round((totalKills / deaths) * 100) / 100,
          winRate: Math.round((totalWins / totalMatches) * 1000) / 10,
        };
      });
    });
  },
}));
