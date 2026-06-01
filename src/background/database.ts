import Database from 'better-sqlite3';
import path from 'path';
import { nowMs } from '../shared/utils';

let userDataPath = '';

export function setUserDataPath(p: string): void {
  userDataPath = p;
}
import type {
  DbMatchRow, DbMatchWeaponRow, DbMatchTeammateRow,
  DbSessionRow, DbUserAccountRow, DbProfileSnapshotRow,
  MatchRecord, SessionData, UserAccount, WeaponKillRecord, TeammateRecord,
} from '../shared/types';

let db: Database.Database | null = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, duration INTEGER,
  game_mode TEXT NOT NULL, map_name TEXT, legend TEXT NOT NULL,
  placement INTEGER, total_teams INTEGER,
  kills INTEGER NOT NULL DEFAULT 0, assists INTEGER NOT NULL DEFAULT 0,
  knockdowns INTEGER NOT NULL DEFAULT 0, damage INTEGER NOT NULL DEFAULT 0,
  revives_given INTEGER NOT NULL DEFAULT 0, respawns_given INTEGER NOT NULL DEFAULT 0,
  survival_time INTEGER, is_win INTEGER NOT NULL DEFAULT 0,
  squad_kills INTEGER NOT NULL DEFAULT 0,
  rp_before INTEGER, rp_after INTEGER, rp_change INTEGER,
  rank_before TEXT, rank_after TEXT,
  headshots INTEGER NOT NULL DEFAULT 0, bodyshots INTEGER NOT NULL DEFAULT 0,
  session_id TEXT, data_source TEXT NOT NULL DEFAULT 'gep', raw_data TEXT
);
CREATE TABLE IF NOT EXISTS match_weapons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  weapon_name TEXT NOT NULL, kills INTEGER NOT NULL DEFAULT 0,
  knockdowns INTEGER NOT NULL DEFAULT 0, was_in_loadout INTEGER NOT NULL DEFAULT 0,
  UNIQUE (match_id, weapon_name)
);
CREATE TABLE IF NOT EXISTS match_teammates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL, legend TEXT, platform TEXT,
  kills INTEGER, damage INTEGER, survived INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, start_time INTEGER NOT NULL, end_time INTEGER,
  matches_played INTEGER NOT NULL DEFAULT 0, total_kills INTEGER NOT NULL DEFAULT 0,
  total_damage INTEGER NOT NULL DEFAULT 0, total_rp_change INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS user_account (
  id TEXT PRIMARY KEY DEFAULT 'local',
  login_provider TEXT, login_id TEXT, login_name TEXT, login_avatar TEXT,
  login_token TEXT, login_token_expires INTEGER,
  origin_name TEXT, origin_uid TEXT, origin_verified INTEGER NOT NULL DEFAULT 0,
  origin_detection_method TEXT,
  steam_id TEXT, steam_name TEXT, steam_avatar TEXT,
  discord_id TEXT, discord_name TEXT, discord_avatar TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_login INTEGER
);
CREATE TABLE IF NOT EXISTS profile_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INTEGER NOT NULL,
  level INTEGER, rank_name TEXT, rank_score INTEGER,
  total_kills INTEGER, total_damage INTEGER, total_wins INTEGER,
  selected_legend TEXT, raw_data TEXT
);
CREATE INDEX IF NOT EXISTS idx_matches_timestamp ON matches(timestamp);
CREATE INDEX IF NOT EXISTS idx_matches_game_mode ON matches(game_mode);
CREATE INDEX IF NOT EXISTS idx_matches_legend ON matches(legend);
CREATE INDEX IF NOT EXISTS idx_matches_session_id ON matches(session_id);
CREATE INDEX IF NOT EXISTS idx_mw_match_id ON match_weapons(match_id);
CREATE INDEX IF NOT EXISTS idx_mw_weapon_name ON match_weapons(weapon_name);
`;

export function getDbPath(): string {
  return path.join(userDataPath, 'apexpulse.db');
}

export function initDatabase(): void {
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  // Migrate: add headshot columns if missing
  try {
    db.exec('ALTER TABLE matches ADD COLUMN headshots INTEGER NOT NULL DEFAULT 0');
    db.exec('ALTER TABLE matches ADD COLUMN bodyshots INTEGER NOT NULL DEFAULT 0');
  } catch { /* columns already exist */ }
  console.log('[DB] Initialized at', dbPath);
}

function requireDb(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// === Match CRUD ===

export function insertMatch(match: MatchRecord): void {
  const d = requireDb();

  const insertMatchStmt = d.prepare(`
    INSERT OR REPLACE INTO matches (id, timestamp, duration, game_mode, map_name, legend,
      placement, total_teams, kills, assists, knockdowns, damage,
      revives_given, respawns_given, survival_time, is_win, squad_kills,
      rp_before, rp_after, rp_change, rank_before, rank_after,
      headshots, bodyshots, session_id, data_source, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const insertWeaponStmt = d.prepare(`
    INSERT OR REPLACE INTO match_weapons (match_id, weapon_name, kills, knockdowns, was_in_loadout)
    VALUES (?, ?, ?, ?, ?)`);

  const insertTeammateStmt = d.prepare(`
    INSERT INTO match_teammates (match_id, player_name, legend, platform, kills, damage, survived)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  const transaction = d.transaction(() => {
    insertMatchStmt.run(
      match.matchId, match.timestamp, match.duration, match.gameMode, match.mapName, match.legend,
      match.placement, match.totalTeams, match.kills, match.assists, match.knockdowns, match.damage,
      match.revivesGiven, match.respawnsGiven, match.survivalTime, match.isWin ? 1 : 0, match.squadKills,
      match.rpBefore ?? null, match.rpAfter ?? null, match.rpChange ?? null,
      match.rankBefore ?? null, match.rankAfter ?? null,
      match.headshots ?? 0, match.bodyshots ?? 0, null, 'gep', null
    );

    const weaponMap = new Map<string, { kills: number; knockdowns: number }>();
    for (const wk of match.weaponKills) {
      const e = weaponMap.get(wk.weaponName) ?? { kills: 0, knockdowns: 0 };
      e.kills += wk.kills; e.knockdowns += wk.knockdowns;
      weaponMap.set(wk.weaponName, e);
    }
    for (const wk of match.weaponKnockdowns) {
      const e = weaponMap.get(wk.weaponName) ?? { kills: 0, knockdowns: 0 };
      e.knockdowns += wk.knockdowns;
      weaponMap.set(wk.weaponName, e);
    }
    const loadoutSet = new Set(match.loadoutFinal);
    for (const [name, stats] of weaponMap) {
      insertWeaponStmt.run(match.matchId, name, stats.kills, stats.knockdowns, loadoutSet.has(name) ? 1 : 0);
    }

    for (const tm of match.teammates) {
      insertTeammateStmt.run(match.matchId, tm.name, tm.legend, tm.platform, tm.kills, tm.damage, tm.survived ? 1 : 0);
    }
  });

  transaction();
}

export function getRecentMatches(limit = 20, offset = 0): MatchRecord[] {
  const rows = requireDb().prepare('SELECT * FROM matches ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset) as DbMatchRow[];
  return rows.map(dbRowToMatchRecord);
}

export function getMatchById(id: string): MatchRecord | null {
  const row = requireDb().prepare('SELECT * FROM matches WHERE id = ?').get(id) as DbMatchRow | undefined;
  return row ? dbRowToMatchRecord(row) : null;
}

export function getMatchesByMode(mode: string, limit = 50): MatchRecord[] {
  const rows = requireDb().prepare('SELECT * FROM matches WHERE game_mode = ? ORDER BY timestamp DESC LIMIT ?').all(mode, limit) as DbMatchRow[];
  return rows.map(dbRowToMatchRecord);
}

export function getMatchesByLegend(legend: string, limit = 50): MatchRecord[] {
  const rows = requireDb().prepare('SELECT * FROM matches WHERE legend = ? ORDER BY timestamp DESC LIMIT ?').all(legend, limit) as DbMatchRow[];
  return rows.map(dbRowToMatchRecord);
}

export function getOverallStats() {
  const row = requireDb().prepare(`
    SELECT COUNT(*) as totalMatches, COALESCE(SUM(kills),0) as totalKills,
      COALESCE(SUM(damage),0) as totalDamage, COALESCE(SUM(is_win),0) as totalWins
    FROM matches
  `).get() as { totalMatches: number; totalKills: number; totalDamage: number; totalWins: number };

  const deaths = Math.max(row.totalMatches - row.totalWins, 1);
  return {
    totalMatches: row.totalMatches, totalKills: row.totalKills,
    totalDamage: row.totalDamage, totalWins: row.totalWins,
    avgDamage: row.totalMatches > 0 ? Math.round(row.totalDamage / row.totalMatches) : 0,
    kdRatio: Math.round((row.totalKills / deaths) * 100) / 100,
    winRate: row.totalMatches > 0 ? Math.round((row.totalWins / row.totalMatches) * 1000) / 10 : 0,
  };
}

export function getWeaponStats() {
  return requireDb().prepare(`
    SELECT weapon_name as weaponName, SUM(kills) as totalKills,
      SUM(knockdowns) as totalKnockdowns, COUNT(DISTINCT match_id) as matchesUsed
    FROM match_weapons GROUP BY weapon_name ORDER BY totalKills DESC
  `).all() as Array<{ weaponName: string; totalKills: number; totalKnockdowns: number; matchesUsed: number }>;
}

export function getLegendStats() {
  const rows = requireDb().prepare(`
    SELECT legend, COUNT(*) as matches, COALESCE(SUM(kills),0) as kills,
      COALESCE(SUM(damage),0) as damage, COALESCE(SUM(is_win),0) as wins
    FROM matches GROUP BY legend ORDER BY matches DESC
  `).all() as Array<{ legend: string; matches: number; kills: number; damage: number; wins: number }>;

  return rows.map(r => {
    const deaths = Math.max(r.matches - r.wins, 1);
    return { ...r, avgDamage: Math.round(r.damage / Math.max(r.matches, 1)), kdRatio: Math.round((r.kills / deaths) * 100) / 100 };
  });
}

// === Session CRUD ===

export function upsertSession(session: SessionData): void {
  requireDb().prepare(`
    INSERT OR REPLACE INTO sessions (id, start_time, end_time, matches_played, total_kills, total_damage, total_rp_change)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(session.id, session.startTime, session.endTime, session.matchesPlayed, session.totalKills, session.totalDamage, session.totalRpChange);
}

export function getLatestSession(): SessionData | null {
  const row = requireDb().prepare('SELECT * FROM sessions ORDER BY start_time DESC LIMIT 1').get() as DbSessionRow | undefined;
  if (!row) return null;
  return { id: row.id, startTime: row.start_time, endTime: row.end_time, matchesPlayed: row.matches_played, totalKills: row.total_kills, totalDamage: row.total_damage, totalRpChange: row.total_rp_change };
}

// === User Account ===

export function getUserAccount(): UserAccount | null {
  const row = requireDb().prepare("SELECT * FROM user_account WHERE id = 'local'").get() as DbUserAccountRow | undefined;
  if (!row) return null;
  return {
    id: row.id, loginProvider: row.login_provider as UserAccount['loginProvider'],
    loginName: row.login_name, loginAvatar: row.login_avatar,
    originName: row.origin_name, originUid: row.origin_uid,
    originVerified: row.origin_verified === 1,
    originDetectionMethod: row.origin_detection_method as UserAccount['originDetectionMethod'],
    steamId: row.steam_id, steamName: row.steam_name, steamAvatar: row.steam_avatar,
    discordId: row.discord_id, discordName: row.discord_name, discordAvatar: row.discord_avatar,
  };
}

export function upsertUserAccount(partial: Partial<DbUserAccountRow>): void {
  const d = requireDb();
  const ts = nowMs();
  const existing = d.prepare("SELECT id FROM user_account WHERE id = 'local'").get();

  if (!existing) {
    d.prepare(`INSERT INTO user_account (id, login_provider, login_id, login_name, login_avatar,
      login_token, login_token_expires, origin_name, origin_uid, origin_verified, origin_detection_method,
      steam_id, steam_name, steam_avatar, discord_id, discord_name, discord_avatar, created_at, updated_at, last_login)
      VALUES ('local',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      partial.login_provider ?? null, partial.login_id ?? null, partial.login_name ?? null, partial.login_avatar ?? null,
      partial.login_token ?? null, partial.login_token_expires ?? null,
      partial.origin_name ?? null, partial.origin_uid ?? null, partial.origin_verified ?? 0, partial.origin_detection_method ?? null,
      partial.steam_id ?? null, partial.steam_name ?? null, partial.steam_avatar ?? null,
      partial.discord_id ?? null, partial.discord_name ?? null, partial.discord_avatar ?? null,
      ts, ts, null
    );
  } else {
    const fields = Object.keys(partial).filter(k => k !== 'id' && k !== 'created_at');
    if (!fields.length) return;
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const vals = fields.map(f => (partial as Record<string, unknown>)[f] as string | number | null);
    vals.push(ts);
    d.prepare(`UPDATE user_account SET ${sets}, updated_at = ? WHERE id = 'local'`).run(...vals);
  }
}

// === Profile Snapshots ===

export function insertProfileSnapshot(snapshot: DbProfileSnapshotRow): void {
  requireDb().prepare(`INSERT INTO profile_snapshots (timestamp, level, rank_name, rank_score, total_kills, total_damage, total_wins, selected_legend, raw_data)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(snapshot.timestamp, snapshot.level ?? null, snapshot.rank_name ?? null, snapshot.rank_score ?? null,
    snapshot.total_kills ?? null, snapshot.total_damage ?? null, snapshot.total_wins ?? null, snapshot.selected_legend ?? null, snapshot.raw_data ?? null);
}

export function getLatestProfileSnapshot(): DbProfileSnapshotRow | null {
  return (requireDb().prepare('SELECT * FROM profile_snapshots ORDER BY timestamp DESC LIMIT 1').get() as DbProfileSnapshotRow) ?? null;
}

// === Match → MatchRecord conversion ===

function dbRowToMatchRecord(row: DbMatchRow): MatchRecord {
  const d = requireDb();
  const weaponRows = d.prepare('SELECT * FROM match_weapons WHERE match_id = ?').all(row.id) as DbMatchWeaponRow[];
  const tmRows = d.prepare('SELECT * FROM match_teammates WHERE match_id = ?').all(row.id) as DbMatchTeammateRow[];

  return {
    matchId: row.id, timestamp: row.timestamp, duration: row.duration ?? 0,
    gameMode: row.game_mode as MatchRecord['gameMode'], mapName: row.map_name ?? '',
    placement: row.placement ?? 0, totalTeams: row.total_teams ?? 0,
    kills: row.kills, assists: row.assists, knockdowns: row.knockdowns, damage: row.damage,
    revivesGiven: row.revives_given, respawnsGiven: row.respawns_given, survivalTime: row.survival_time ?? 0,
    legend: row.legend,
    teammates: tmRows.map(t => ({ name: t.player_name, legend: t.legend ?? '', platform: t.platform ?? '', kills: t.kills ?? 0, damage: t.damage ?? 0, survived: t.survived === 1 })),
    weaponKills: weaponRows.filter(w => w.kills > 0).map(w => ({ weaponName: w.weapon_name, kills: w.kills, knockdowns: w.knockdowns })),
    weaponKnockdowns: weaponRows.filter(w => w.knockdowns > 0 && w.kills === 0).map(w => ({ weaponName: w.weapon_name, kills: 0, knockdowns: w.knockdowns })),
    loadoutFinal: weaponRows.filter(w => w.was_in_loadout === 1).map(w => w.weapon_name),
    rpBefore: row.rp_before ?? undefined, rpAfter: row.rp_after ?? undefined, rpChange: row.rp_change ?? undefined,
    rankBefore: row.rank_before ?? undefined, rankAfter: row.rank_after ?? undefined,
    isWin: row.is_win === 1, squadKills: row.squad_kills,
    headshots: (row as any).headshots ?? 0, bodyshots: (row as any).bodyshots ?? 0,
  };
}

// === RP Stats ===

export function getRpHistory(limit = 20): Array<{ matchId: string; timestamp: number; rpBefore: number | null; rpAfter: number | null; rpChange: number | null; gameMode: string }> {
  return requireDb().prepare(
    "SELECT id as matchId, timestamp, rp_before as rpBefore, rp_after as rpAfter, rp_change as rpChange, game_mode as gameMode FROM matches WHERE rp_change IS NOT NULL ORDER BY timestamp DESC LIMIT ?"
  ).all(limit) as any;
}

export function getWeeklyRpChange(): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const row = requireDb().prepare(
    "SELECT COALESCE(SUM(rp_change), 0) as total FROM matches WHERE rp_change IS NOT NULL AND timestamp >= ?"
  ).get(weekAgo) as { total: number };
  return row.total;
}

// === Headshot Stats ===

export function getHeadshotStats(limit = 7): Array<{ matchId: string; timestamp: number; headshots: number; bodyshots: number; legend: string }> {
  return requireDb().prepare(
    'SELECT id as matchId, timestamp, headshots, bodyshots, legend FROM matches ORDER BY timestamp DESC LIMIT ?'
  ).all(limit) as Array<{ matchId: string; timestamp: number; headshots: number; bodyshots: number; legend: string }>;
}

// === Export ===

export function exportAllData(): { matches: MatchRecord[]; sessions: SessionData[]; weaponStats: ReturnType<typeof getWeaponStats>; legendStats: ReturnType<typeof getLegendStats>; overallStats: ReturnType<typeof getOverallStats> } {
  const d = requireDb();
  const matchRows = d.prepare('SELECT * FROM matches ORDER BY timestamp DESC').all() as DbMatchRow[];
  const sessionRows = d.prepare('SELECT * FROM sessions ORDER BY start_time DESC').all() as DbSessionRow[];
  return {
    matches: matchRows.map(dbRowToMatchRecord),
    sessions: sessionRows.map(r => ({
      id: r.id, startTime: r.start_time, endTime: r.end_time,
      matchesPlayed: r.matches_played, totalKills: r.total_kills,
      totalDamage: r.total_damage, totalRpChange: r.total_rp_change,
    })),
    weaponStats: getWeaponStats(),
    legendStats: getLegendStats(),
    overallStats: getOverallStats(),
  };
}

// === Cleanup ===

export function closeDatabase(): void {
  if (db) { db.close(); db = null; }
}

export function saveDatabase(): void {
  // better-sqlite3 auto-persists via WAL — no manual save needed
}
