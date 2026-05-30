export interface LiveApiPlayer {
  name: string;
  teamId: number;
  pos: { x: number; y: number; z: number };
  angles: { x: number; y: number; z: number };
  currentHealth: number;
  maxHealth: number;
  shieldHealth: number;
  shieldMaxHealth: number;
  nucleusHash: string;
  hardwareName: string;
  teamName: string;
  squadIndex: number;
  character: string;
  skin: string;
}

export interface LiveApiMatchSetup {
  timestamp: string;
  category: string;
  map: string;
  playlistName: string;
  playlistDesc: string;
  datacenter: { name: string };
  aimAssistOn: boolean;
  anonymousMode: boolean;
  serverId: string;
}

export interface LiveApiGameStateChanged {
  timestamp: string;
  category: string;
  state: string;
}

export interface LiveApiCharacterSelected {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
}

export interface LiveApiPlayerDamaged {
  timestamp: string;
  category: string;
  attacker: LiveApiPlayer;
  victim: LiveApiPlayer;
  weapon: string;
  damageInflicted: number;
}

export interface LiveApiPlayerKilled {
  timestamp: string;
  category: string;
  attacker: LiveApiPlayer;
  victim: LiveApiPlayer;
  awardedTo: LiveApiPlayer;
  weapon: string;
}

export interface LiveApiPlayerDowned {
  timestamp: string;
  category: string;
  attacker: LiveApiPlayer;
  victim: LiveApiPlayer;
  weapon: string;
}

export interface LiveApiPlayerAssist {
  timestamp: string;
  category: string;
  assistant: LiveApiPlayer;
  victim: LiveApiPlayer;
  weapon: string;
}

export interface LiveApiSquadEliminated {
  timestamp: string;
  category: string;
  players: LiveApiPlayer[];
  placement: number;
}

export interface LiveApiPlayerStatChanged {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  statName: string;
  newValue: number;
}

export interface LiveApiPlayerRevive {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  revived: LiveApiPlayer;
}

export interface LiveApiWeaponSwitched {
  timestamp: string;
  category: string;
  player: LiveApiPlayer;
  oldWeapon: string;
  newWeapon: string;
}

export interface LiveApiMatchStateEnd {
  timestamp: string;
  category: string;
  state: string;
  winners: LiveApiPlayer[];
}

export interface LiveApiInit {
  timestamp: string;
  category: string;
  gameVersion: string;
  apiVersion: { major_num: number; minor_num: number; build_stamp: number };
  platform: string;
}
