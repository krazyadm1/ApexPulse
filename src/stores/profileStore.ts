import { create } from 'zustand';
import { onMessage } from '../background/messaging';
import { WindowMessage } from '../shared/types';

interface RankInfo {
  rankScore: number;
  rankName: string;
  rankDiv: number;
  rankImg: string;
  rankedSeason: string;
}

interface LegendApiData {
  data?: Array<{ name: string; value: number; key: string }>;
  ImgAssets?: { icon: string; banner: string };
}

interface ProfileState {
  name: string | null;
  uid: string | null;
  level: number;
  levelPrestige: number;
  rank: RankInfo | null;
  careerKills: number;
  careerWins: number;
  careerRevives: number;
  careerDamage: number;
  kd: number;
  selectedLegend: string | null;
  realtimeStatus: string | null;
  isOnline: boolean;
  badges: Array<{ name: string; value: number }>;
  legends: Record<string, LegendApiData>;
  weaponMastery: Array<{ weaponKey: string; name: string; kills: number }>;
  avatarUrl: string | null;
  hasData: boolean;
  init: () => void;
}

function extractWeaponMastery(total: Record<string, { name: string; value: number }>): ProfileState['weaponMastery'] {
  const weapons: ProfileState['weaponMastery'] = [];
  for (const [key, entry] of Object.entries(total)) {
    if (key.startsWith('mastery_') && key.endsWith('_kills')) {
      weapons.push({ weaponKey: key, name: entry.name, kills: entry.value });
    }
  }
  return weapons.sort((a, b) => b.kills - a.kills);
}

export const useProfileStore = create<ProfileState>((set) => ({
  name: null,
  uid: null,
  level: 0,
  levelPrestige: 0,
  rank: null,
  careerKills: 0,
  careerWins: 0,
  careerRevives: 0,
  careerDamage: 0,
  kd: 0,
  selectedLegend: null,
  realtimeStatus: null,
  isOnline: false,
  badges: [],
  legends: {},
  weaponMastery: [],
  avatarUrl: null,
  hasData: false,

  init: () => {
    onMessage('PROFILE_UPDATE', (msg: WindowMessage) => {
      const data = msg.payload as any;
      if (!data?.global) return;

      const g = data.global;
      const rt = data.realtime ?? {};
      const total = data.total ?? {};

      set({
        name: g.name ?? null,
        uid: g.uid ?? null,
        level: g.level ?? 0,
        levelPrestige: g.levelPrestige ?? 0,
        rank: g.rank ? {
          rankScore: g.rank.rankScore,
          rankName: g.rank.rankName,
          rankDiv: g.rank.rankDiv,
          rankImg: g.rank.rankImg,
          rankedSeason: g.rank.rankedSeason,
        } : null,
        careerKills: total.career_kills?.value ?? 0,
        careerWins: total.career_wins?.value ?? 0,
        careerRevives: total.career_revives?.value ?? 0,
        careerDamage: total.specialEvent_damage?.value ?? total.damage?.value ?? 0,
        kd: parseFloat(total.kd?.value) > 0 ? parseFloat(total.kd?.value) : 0,
        selectedLegend: rt.selectedLegend ?? null,
        realtimeStatus: rt.currentStateAsText ?? null,
        isOnline: rt.isOnline === 1,
        badges: Array.isArray(g.badges) ? g.badges.filter((b: any) => b.name !== 'null') : [],
        legends: data.legends?.all ?? {},
        weaponMastery: extractWeaponMastery(total),
        avatarUrl: g.avatar ?? null,
        hasData: true,
      });
    });
  },
}));
