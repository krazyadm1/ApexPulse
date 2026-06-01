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
  headshots: number;
  bodyshots: number;
  deathX?: number;
  deathY?: number;
  deathZ?: number;
}

export interface LegendInfo {
  id: string;
  displayName: string;
  class: 'Assault' | 'Skirmisher' | 'Recon' | 'Support' | 'Controller';
  tactical: string;
  ultimate: string;
  passive: string;
  icon: string;
}

export interface WeaponInfo {
  display: string;
  category: string;
  ammo: string;
  icon: string;
}

// === Database Types ===

export interface DbMatchRow {
  id: string;
  timestamp: number;
  duration: number | null;
  game_mode: string;
  map_name: string | null;
  legend: string;
  placement: number | null;
  total_teams: number | null;
  kills: number;
  assists: number;
  knockdowns: number;
  damage: number;
  revives_given: number;
  respawns_given: number;
  survival_time: number | null;
  is_win: number;
  squad_kills: number;
  rp_before: number | null;
  rp_after: number | null;
  rp_change: number | null;
  rank_before: string | null;
  rank_after: string | null;
  session_id: string | null;
  data_source: string;
  raw_data: string | null;
}

export interface DbMatchWeaponRow {
  id?: number;
  match_id: string;
  weapon_name: string;
  kills: number;
  knockdowns: number;
  was_in_loadout: number;
}

export interface DbMatchTeammateRow {
  id?: number;
  match_id: string;
  player_name: string;
  legend: string | null;
  platform: string | null;
  kills: number | null;
  damage: number | null;
  survived: number | null;
}

export interface DbSessionRow {
  id: string;
  start_time: number;
  end_time: number | null;
  matches_played: number;
  total_kills: number;
  total_damage: number;
  total_rp_change: number;
}

export interface DbUserAccountRow {
  id: string;
  login_provider: string | null;
  login_id: string | null;
  login_name: string | null;
  login_avatar: string | null;
  login_token: string | null;
  login_token_expires: number | null;
  origin_name: string | null;
  origin_uid: string | null;
  origin_verified: number;
  origin_detection_method: string | null;
  steam_id: string | null;
  steam_name: string | null;
  steam_avatar: string | null;
  discord_id: string | null;
  discord_name: string | null;
  discord_avatar: string | null;
  created_at: number;
  updated_at: number;
  last_login: number | null;
}

export interface DbProfileSnapshotRow {
  id?: number;
  timestamp: number;
  level: number | null;
  rank_name: string | null;
  rank_score: number | null;
  total_kills: number | null;
  total_damage: number | null;
  total_wins: number | null;
  selected_legend: string | null;
  raw_data: string | null;
}

// === API Response Types ===

export interface ApexApiPlayerResponse {
  global: {
    name: string;
    uid: number;
    platform: string;
    level: number;
    levelPrestige?: number;
    avatar?: string;
    toNextLevelPercent: number;
    rank: {
      rankScore: number;
      rankName: string;
      rankDiv: number;
      ladderPosPlatform: number;
      rankImg: string;
      rankedSeason?: string;
    };
    battlepass: {
      level: string;
    };
  };
  realtime: {
    lobbyState: string;
    isOnline: number;
    isInGame: number;
    canJoin: number;
    partyFull: number;
    selectedLegend: string;
    currentState: string;
    currentStateSinceTimestamp: number;
    currentStateAsText?: string;
  };
  legends: {
    selected: {
      LegendName: string;
      data: Array<{ name: string; value: number; key: string }>;
    };
    all: Record<string, {
      data?: Array<{ name: string; value: number; key: string }>;
    }>;
  };
  total: {
    kills?: { value: number };
    damage?: { value: number };
    wins?: { value: number };
    [key: string]: { value: number } | undefined;
  };
}

export interface ApexApiMapRotationResponse {
  battle_royale: {
    current: { map: string; remainingTimer: string; remainingSecs: number; start: number; end: number };
    next: { map: string; start: number; end: number };
  };
  ranked: {
    current: { map: string; remainingTimer: string; remainingSecs: number; start: number; end: number };
    next: { map: string; start: number; end: number };
  };
  ltm?: {
    current: { map: string; remainingTimer: string; remainingSecs: number };
    next: { map: string };
  };
}

export interface ApexApiCraftingResponse {
  bundle: string;
  start: number;
  end: number;
  bundleContent: Array<{
    item: string;
    cost: number;
    itemType: { name: string; rarity: string };
  }>;
}

export interface ApexApiServerStatusResponse {
  [region: string]: {
    HTTP: number;
    QueryDelay: number;
    RTT: number;
    Status: string;
  };
}

export interface ApexApiNameToUidResponse {
  name: string;
  uid: string;
  pid: string;
  platform: string;
}

// === GEP Event Types ===

export type MatchState = 'inactive' | 'active';

export interface GepKillFeedEvent {
  attackerName: string;
  victimName: string;
  weaponName: string;
  action: 'kill' | 'headshot_kill' | 'knockdown' | 'bleedout';
}

export interface GepMatchSummary {
  rank: number;
  teams: number;
  squadKills: number;
}

export interface GepTeamMember {
  name: string;
  legend: string;
  platform: string;
  state: 'alive' | 'knocked' | 'dead';
}

export interface GepInventoryItem {
  name: string;
  slot: string;
}

export interface GepLocationData {
  x: number;
  y: number;
  z: number;
}

export interface GepRosterPlayer {
  name: string;
  teamId: number;
  platform: string;
  isTeammate: boolean;
}

// === Match Tracker Types ===

export type TrackerState = 'idle' | 'lobby' | 'legend_select' | 'in_match' | 'post_match';

export interface LiveMatchData {
  state: TrackerState;
  matchStartTime: number | null;
  gameMode: GameMode | null;
  mapName: string | null;
  legend: string | null;
  kills: number;
  deaths: number;
  assists: number;
  knockdowns: number;
  damage: number;
  squadKills: number;
  teamsLeft: number;
  totalTeams: number;
  teammates: GepTeamMember[];
  weaponKills: Record<string, number>;
  weaponKnockdowns: Record<string, number>;
  inventory: string[];
  placement: number | null;
  rpEstimate: number | null;
  headshots: number;
  bodyshots: number;
}

// === Window Messaging Types ===

export type MessageType =
  | 'LIVE_MATCH_UPDATE'
  | 'MATCH_ENDED'
  | 'MATCH_HISTORY_UPDATE'
  | 'PROFILE_UPDATE'
  | 'MAP_ROTATION_UPDATE'
  | 'AUTH_STATE_CHANGE'
  | 'SETTINGS_UPDATE'
  | 'SESSION_UPDATE'
  | 'ORIGIN_DETECTED'
  | 'REQUEST_STATE'
  | 'LOBBY_INTEL_UPDATE'
  | 'PACK_UPDATE'
  | 'GAME_RUNNING_UPDATE'
  | 'APP_ERROR'
  | 'OVERLAY_AUTO_HIDDEN';

export interface WindowMessage<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: number;
}

// === Session Types ===

export interface SessionData {
  id: string;
  startTime: number;
  endTime: number | null;
  matchesPlayed: number;
  totalKills: number;
  totalDamage: number;
  totalRpChange: number;
}

// === Settings Types ===

export interface AppSettings {
  apiKey: string;
  overlayEnabled: boolean;
  overlayPosition: { top: number; left: number };
  overlayOpacity: number;
  overlayHotkey: string;
  autoDetectOrigin: boolean;
  pollIntervalMs: number;
  sessionTimeoutMs: number;
  consentAccepted: boolean;
  hardwareAcceleration: boolean;
  theme: 'dark' | 'light';
}

// === Auth Types ===

export type LoginProvider = 'steam' | 'discord' | null;
export type OriginDetectionMethod = 'gep_auto' | 'manual' | 'discord_chain' | null;

export interface UserAccount {
  id: string;
  loginProvider: LoginProvider;
  loginName: string | null;
  loginAvatar: string | null;
  originName: string | null;
  originUid: string | null;
  originVerified: boolean;
  originDetectionMethod: OriginDetectionMethod;
  steamId: string | null;
  steamName: string | null;
  steamAvatar: string | null;
  discordId: string | null;
  discordName: string | null;
  discordAvatar: string | null;
}

// === Lobby Intel Types ===

export interface LobbyPlayer {
  name: string;
  platform: string;
  teamId: number;
  isTeammate: boolean;
  level?: number;
  rankName?: string;
  rankScore?: number;
  kills?: number;
  kd?: number;
  selectedLegend?: string;
  loaded: boolean;
}
