export type GameMode = 'battle_royale' | 'ranked_br' | 'mixtape' | 'ltm' | 'firing_range';

export interface WeaponKillRecord {
  weaponName: string;
  kills: number;
  knockdowns: number;
}

export interface TeammateRecord {
  name: string;
  legend: string;
  platform: string;
  kills: number;
  damage: number;
  survived: boolean;
}

export interface MatchRecord {
  matchId: string;
  timestamp: number;
  duration: number;
  gameMode: GameMode;
  mapName: string;
  placement: number;
  totalTeams: number;
  kills: number;
  assists: number;
  knockdowns: number;
  damage: number;
  revivesGiven: number;
  respawnsGiven: number;
  survivalTime: number;
  legend: string;
  teammates: TeammateRecord[];
  weaponKills: WeaponKillRecord[];
  weaponKnockdowns: WeaponKillRecord[];
  loadoutFinal: string[];
  rpBefore?: number;
  rpAfter?: number;
  rpChange?: number;
  rankBefore?: string;
  rankAfter?: string;
  isWin: boolean;
  squadKills: number;
}

export interface LegendInfo {
  id: string;
  displayName: string;
  class: 'Assault' | 'Skirmisher' | 'Recon' | 'Support' | 'Controller';
  tactical: string;
  ultimate: string;
  passive: string;
}

export interface WeaponInfo {
  display: string;
  category: string;
  ammo: string;
}
