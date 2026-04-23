// @ts-expect-error sql.js has no type declarations
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { DB_FILENAME, DB_SAVE_INTERVAL_MS } from '../shared/constants';
import { nowMs } from '../shared/utils';
import type {
  DbMatchRow,
  DbMatchWeaponRow,
  DbMatchTeammateRow,
  DbSessionRow,
  DbUserAccountRow,
  DbProfileSnapshotRow,
  MatchRecord,
  SessionData,
  UserAccount,
  WeaponKillRecord,
  TeammateRecord,
} from '../shared/types';

// ─── Module State ────────────────────────────────────────────────────────────

let db: SqlJsDatabase | null = null;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

// ─── Schema DDL ──────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS matches (
  id              TEXT PRIMARY KEY,
  timestamp       INTEGER NOT NULL,
  duration        INTEGER,
  game_mode       TEXT NOT NULL,
  map_name        TEXT,
  legend          TEXT NOT NULL,
  placement       INTEGER,
  total_teams     INTEGER,
  kills           INTEGER NOT NULL DEFAULT 0,
  assists         INTEGER NOT NULL DEFAULT 0,
  knockdowns      INTEGER NOT NULL DEFAULT 0,
  damage          INTEGER NOT NULL DEFAULT 0,
  revives_given   INTEGER NOT NULL DEFAULT 0,
  respawns_given  INTEGER NOT NULL DEFAULT 0,
  survival_time   INTEGER,
  is_win          INTEGER NOT NULL DEFAULT 0,
  squad_kills     INTEGER NOT NULL DEFAULT 0,
  rp_before       INTEGER,
  rp_after        INTEGER,
  rp_change       INTEGER,
  rank_before     TEXT,
  rank_after      TEXT,
  session_id      TEXT,
  data_source     TEXT NOT NULL DEFAULT 'gep',
  raw_data        TEXT
);

CREATE TABLE IF NOT EXISTS match_weapons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id        TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  weapon_name     TEXT NOT NULL,
  kills           INTEGER NOT NULL DEFAULT 0,
  knockdowns      INTEGER NOT NULL DEFAULT 0,
  was_in_loadout  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (match_id, weapon_name)
);

CREATE TABLE IF NOT EXISTS match_teammates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  legend      TEXT,
  platform    TEXT,
  kills       INTEGER,
  damage      INTEGER,
  survived    INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  start_time      INTEGER NOT NULL,
  end_time        INTEGER,
  matches_played  INTEGER NOT NULL DEFAULT 0,
  total_kills     INTEGER NOT NULL DEFAULT 0,
  total_damage    INTEGER NOT NULL DEFAULT 0,
  total_rp_change INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_account (
  id                       TEXT PRIMARY KEY DEFAULT 'local',
  login_provider           TEXT,
  login_id                 TEXT,
  login_name               TEXT,
  login_avatar             TEXT,
  login_token              TEXT,
  login_token_expires      INTEGER,
  origin_name              TEXT,
  origin_uid               TEXT,
  origin_verified          INTEGER NOT NULL DEFAULT 0,
  origin_detection_method  TEXT,
  steam_id                 TEXT,
  steam_name               TEXT,
  steam_avatar             TEXT,
  discord_id               TEXT,
  discord_name             TEXT,
  discord_avatar           TEXT,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL,
  last_login               INTEGER
);

CREATE TABLE IF NOT EXISTS profile_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp       INTEGER NOT NULL,
  level           INTEGER,
  rank_name       TEXT,
  rank_score      INTEGER,
  total_kills     INTEGER,
  total_damage    INTEGER,
  total_wins      INTEGER,
  selected_legend TEXT,
  raw_data        TEXT
);

CREATE INDEX IF NOT EXISTS idx_matches_timestamp   ON matches (timestamp);
CREATE INDEX IF NOT EXISTS idx_matches_game_mode   ON matches (game_mode);
CREATE INDEX IF NOT EXISTS idx_matches_legend      ON matches (legend);
CREATE INDEX IF NOT EXISTS idx_matches_session_id  ON matches (session_id);
CREATE INDEX IF NOT EXISTS idx_mw_match_id         ON match_weapons (match_id);
CREATE INDEX IF NOT EXISTS idx_mw_weapon_name      ON match_weapons (weapon_name);
`;

// ─── Path & File I/O ─────────────────────────────────────────────────────────

export function getDbPath(): string {
  const base = overwolf.io.paths.localAppData;
  return `${base}\\ApexPulse\\${DB_FILENAME}`;
}

function readFileAsUint8Array(path: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    (overwolf.io as unknown as { readBinaryFile: (path: string, options: Record<string, string>, cb: (result: { success: boolean; content?: number[] }) => void) => void }).readBinaryFile(
      path,
      { encoding: 'binary' },
      (result: { success: boolean; content?: number[] }) => {
        if (result.success && result.content) {
          resolve(new Uint8Array(result.content));
        } else {
          resolve(null);
        }
      },
    );
  });
}

function writeFileContents(path: string, data: string): Promise<boolean> {
  return new Promise((resolve) => {
    overwolf.io.writeFileContents(
      path,
      data,
      'UTF8' as overwolf.io.enums.eEncoding,
      true,
      (result: { success: boolean }) => {
        resolve(result.success);
      },
    );
  });
}

export async function saveDatabase(): Promise<void> {
  if (!db) return;
  try {
    const data = db.export() as Uint8Array;
    const binaryStr = Array.from(data)
      .map((b) => String.fromCharCode(b))
      .join('');
    await writeFileContents(getDbPath(), binaryStr);
  } catch (err) {
    console.error('[ApexPulse][DB] Failed to save database:', err);
  }
}

export function startAutoSave(): void {
  if (autoSaveTimer !== null) return;
  autoSaveTimer = setInterval(() => {
    saveDatabase().catch((err) =>
      console.error('[ApexPulse][DB] Auto-save error:', err),
    );
  }, DB_SAVE_INTERVAL_MS);
}

// ─── Initialization ───────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs({
    // Overwolf apps typically serve WASM from the extension root
    locateFile: (file: string) => `./${file}`,
  });

  const dbPath = getDbPath();
  const existing = await readFileAsUint8Array(dbPath);

  if (existing) {
    db = new SQL.Database(existing);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA_SQL);
  startAutoSave();
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function requireDb(): SqlJsDatabase {
  if (!db) throw new Error('[ApexPulse][DB] Database is not initialized.');
  return db;
}

/**
 * Converts a sql.js query result (columns + values arrays) into a typed object.
 */
export function rowToObject<T>(
  columns: string[],
  values: (string | number | null)[],
): T {
  const obj: Record<string, string | number | null> = {};
  columns.forEach((col, i) => {
    obj[col] = values[i];
  });
  return obj as unknown as T;
}

function queryRows<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const database = requireDb();
  const results = database.exec(sql, params);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row: unknown[]) => rowToObject<T>(columns, row as (string | number | null)[]));
}

function queryFirstRow<T>(
  sql: string,
  params: (string | number | null)[] = [],
): T | null {
  const rows = queryRows<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// ─── Match Conversion ─────────────────────────────────────────────────────────

function fetchWeaponRows(matchId: string): DbMatchWeaponRow[] {
  return queryRows<DbMatchWeaponRow>(
    'SELECT * FROM match_weapons WHERE match_id = ?',
    [matchId],
  );
}

function fetchTeammateRows(matchId: string): DbMatchTeammateRow[] {
  return queryRows<DbMatchTeammateRow>(
    'SELECT * FROM match_teammates WHERE match_id = ?',
    [matchId],
  );
}

export function dbRowToMatchRecord(row: DbMatchRow): MatchRecord {
  const weaponRows = fetchWeaponRows(row.id);
  const teammateRows = fetchTeammateRows(row.id);

  // Separate weapon kill records from weapon knockdown records.
  // Both are stored in the same table; weaponKills and weaponKnockdowns
  // on MatchRecord are parallel arrays.
  const weaponKills: WeaponKillRecord[] = weaponRows.map((w) => ({
    weaponName: w.weapon_name,
    kills: w.kills,
    knockdowns: w.knockdowns,
  }));

  // weaponKnockdowns mirrors weaponKills (same rows, just the knockdown view)
  const weaponKnockdowns: WeaponKillRecord[] = weaponRows.map((w) => ({
    weaponName: w.weapon_name,
    kills: w.kills,
    knockdowns: w.knockdowns,
  }));

  const loadoutFinal: string[] = weaponRows
    .filter((w) => w.was_in_loadout === 1)
    .map((w) => w.weapon_name);

  const teammates: TeammateRecord[] = teammateRows.map((t) => ({
    name: t.player_name,
    legend: t.legend ?? '',
    platform: t.platform ?? '',
    kills: t.kills ?? 0,
    damage: t.damage ?? 0,
    survived: t.survived === 1,
  }));

  return {
    matchId: row.id,
    timestamp: row.timestamp,
    duration: row.duration ?? 0,
    gameMode: row.game_mode as MatchRecord['gameMode'],
    mapName: row.map_name ?? '',
    placement: row.placement ?? 0,
    totalTeams: row.total_teams ?? 0,
    kills: row.kills,
    assists: row.assists,
    knockdowns: row.knockdowns,
    damage: row.damage,
    revivesGiven: row.revives_given,
    respawnsGiven: row.respawns_given,
    survivalTime: row.survival_time ?? 0,
    legend: row.legend,
    teammates,
    weaponKills,
    weaponKnockdowns,
    loadoutFinal,
    rpBefore: row.rp_before ?? undefined,
    rpAfter: row.rp_after ?? undefined,
    rpChange: row.rp_change ?? undefined,
    rankBefore: row.rank_before ?? undefined,
    rankAfter: row.rank_after ?? undefined,
    isWin: row.is_win === 1,
    squadKills: row.squad_kills,
  };
}

// ─── Match CRUD ───────────────────────────────────────────────────────────────

export function insertMatch(match: MatchRecord): void {
  const database = requireDb();

  database.run(
    `INSERT OR REPLACE INTO matches (
      id, timestamp, duration, game_mode, map_name, legend,
      placement, total_teams, kills, assists, knockdowns, damage,
      revives_given, respawns_given, survival_time, is_win, squad_kills,
      rp_before, rp_after, rp_change, rank_before, rank_after,
      session_id, data_source, raw_data
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?
    )`,
    [
      match.matchId,
      match.timestamp,
      match.duration,
      match.gameMode,
      match.mapName,
      match.legend,
      match.placement,
      match.totalTeams,
      match.kills,
      match.assists,
      match.knockdowns,
      match.damage,
      match.revivesGiven,
      match.respawnsGiven,
      match.survivalTime,
      match.isWin ? 1 : 0,
      match.squadKills,
      match.rpBefore ?? null,
      match.rpAfter ?? null,
      match.rpChange ?? null,
      match.rankBefore ?? null,
      match.rankAfter ?? null,
      null, // session_id — callers can update separately if needed
      'gep',
      null,
    ],
  );

  // Merge weaponKills and weaponKnockdowns into a unified set keyed by weapon name.
  const weaponMap = new Map<
    string,
    { kills: number; knockdowns: number; wasInLoadout: boolean }
  >();

  for (const wk of match.weaponKills) {
    const entry = weaponMap.get(wk.weaponName) ?? {
      kills: 0,
      knockdowns: 0,
      wasInLoadout: false,
    };
    entry.kills += wk.kills;
    entry.knockdowns += wk.knockdowns;
    weaponMap.set(wk.weaponName, entry);
  }

  for (const wk of match.weaponKnockdowns) {
    const entry = weaponMap.get(wk.weaponName) ?? {
      kills: 0,
      knockdowns: 0,
      wasInLoadout: false,
    };
    entry.knockdowns += wk.knockdowns;
    weaponMap.set(wk.weaponName, entry);
  }

  const loadoutSet = new Set(match.loadoutFinal);
  for (const [name, stats] of weaponMap.entries()) {
    stats.wasInLoadout = loadoutSet.has(name);
    database.run(
      `INSERT OR REPLACE INTO match_weapons
        (match_id, weapon_name, kills, knockdowns, was_in_loadout)
       VALUES (?, ?, ?, ?, ?)`,
      [match.matchId, name, stats.kills, stats.knockdowns, stats.wasInLoadout ? 1 : 0],
    );
  }

  for (const tm of match.teammates) {
    database.run(
      `INSERT INTO match_teammates
        (match_id, player_name, legend, platform, kills, damage, survived)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        match.matchId,
        tm.name,
        tm.legend,
        tm.platform,
        tm.kills,
        tm.damage,
        tm.survived ? 1 : 0,
      ],
    );
  }
}

export function getRecentMatches(limit = 20, offset = 0): MatchRecord[] {
  const rows = queryRows<DbMatchRow>(
    'SELECT * FROM matches ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );
  return rows.map(dbRowToMatchRecord);
}

export function getMatchById(id: string): MatchRecord | null {
  const row = queryFirstRow<DbMatchRow>('SELECT * FROM matches WHERE id = ?', [id]);
  return row ? dbRowToMatchRecord(row) : null;
}

export function getMatchesByMode(mode: string, limit = 50): MatchRecord[] {
  const rows = queryRows<DbMatchRow>(
    'SELECT * FROM matches WHERE game_mode = ? ORDER BY timestamp DESC LIMIT ?',
    [mode, limit],
  );
  return rows.map(dbRowToMatchRecord);
}

export function getMatchesByLegend(legend: string, limit = 50): MatchRecord[] {
  const rows = queryRows<DbMatchRow>(
    'SELECT * FROM matches WHERE legend = ? ORDER BY timestamp DESC LIMIT ?',
    [legend, limit],
  );
  return rows.map(dbRowToMatchRecord);
}

export interface OverallStats {
  totalMatches: number;
  totalKills: number;
  totalDamage: number;
  totalWins: number;
  avgDamage: number;
  kdRatio: number;
  winRate: number;
}

export function getOverallStats(): OverallStats {
  const row = queryFirstRow<{
    totalMatches: number;
    totalKills: number;
    totalDamage: number;
    totalWins: number;
  }>(
    `SELECT
       COUNT(*)        AS totalMatches,
       SUM(kills)      AS totalKills,
       SUM(damage)     AS totalDamage,
       SUM(is_win)     AS totalWins
     FROM matches`,
  );

  const totalMatches = row?.totalMatches ?? 0;
  const totalKills = row?.totalKills ?? 0;
  const totalDamage = row?.totalDamage ?? 0;
  const totalWins = row?.totalWins ?? 0;
  const avgDamage = totalMatches > 0 ? totalDamage / totalMatches : 0;
  const deaths = totalMatches - totalWins; // one death per non-win match
  const kdRatio = deaths > 0 ? totalKills / deaths : totalKills;
  const winRate = totalMatches > 0 ? totalWins / totalMatches : 0;

  return { totalMatches, totalKills, totalDamage, totalWins, avgDamage, kdRatio, winRate };
}

export interface WeaponStat {
  weaponName: string;
  kills: number;
  knockdowns: number;
  matchesUsed: number;
}

export function getWeaponStats(): WeaponStat[] {
  return queryRows<WeaponStat>(
    `SELECT
       weapon_name    AS weaponName,
       SUM(kills)     AS kills,
       SUM(knockdowns) AS knockdowns,
       COUNT(*)       AS matchesUsed
     FROM match_weapons
     GROUP BY weapon_name
     ORDER BY kills DESC`,
  );
}

export interface LegendStat {
  legend: string;
  matches: number;
  kills: number;
  damage: number;
  wins: number;
  avgDamage: number;
  kdRatio: number;
}

export function getLegendStats(): LegendStat[] {
  const rows = queryRows<{
    legend: string;
    matches: number;
    kills: number;
    damage: number;
    wins: number;
  }>(
    `SELECT
       legend,
       COUNT(*)    AS matches,
       SUM(kills)  AS kills,
       SUM(damage) AS damage,
       SUM(is_win) AS wins
     FROM matches
     GROUP BY legend
     ORDER BY matches DESC`,
  );

  return rows.map((r) => {
    const deaths = r.matches - r.wins;
    return {
      legend: r.legend,
      matches: r.matches,
      kills: r.kills,
      damage: r.damage,
      wins: r.wins,
      avgDamage: r.matches > 0 ? r.damage / r.matches : 0,
      kdRatio: deaths > 0 ? r.kills / deaths : r.kills,
    };
  });
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

export function upsertSession(session: SessionData): void {
  const database = requireDb();
  database.run(
    `INSERT OR REPLACE INTO sessions
       (id, start_time, end_time, matches_played, total_kills, total_damage, total_rp_change)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.startTime,
      session.endTime ?? null,
      session.matchesPlayed,
      session.totalKills,
      session.totalDamage,
      session.totalRpChange,
    ],
  );
}

export function getLatestSession(): SessionData | null {
  const row = queryFirstRow<DbSessionRow>(
    'SELECT * FROM sessions ORDER BY start_time DESC LIMIT 1',
  );
  if (!row) return null;
  return {
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time ?? null,
    matchesPlayed: row.matches_played,
    totalKills: row.total_kills,
    totalDamage: row.total_damage,
    totalRpChange: row.total_rp_change,
  };
}

// ─── User Account CRUD ────────────────────────────────────────────────────────

export function getUserAccount(): UserAccount | null {
  const row = queryFirstRow<DbUserAccountRow>(
    "SELECT * FROM user_account WHERE id = 'local' LIMIT 1",
  );
  if (!row) return null;
  return {
    id: row.id,
    loginProvider: (row.login_provider as UserAccount['loginProvider']) ?? null,
    loginName: row.login_name ?? null,
    loginAvatar: row.login_avatar ?? null,
    originName: row.origin_name ?? null,
    originUid: row.origin_uid ?? null,
    originVerified: row.origin_verified === 1,
    originDetectionMethod:
      (row.origin_detection_method as UserAccount['originDetectionMethod']) ?? null,
    steamId: row.steam_id ?? null,
    steamName: row.steam_name ?? null,
    steamAvatar: row.steam_avatar ?? null,
    discordId: row.discord_id ?? null,
    discordName: row.discord_name ?? null,
    discordAvatar: row.discord_avatar ?? null,
  };
}

export function upsertUserAccount(partial: Partial<DbUserAccountRow>): void {
  const database = requireDb();
  const ts = nowMs();

  // Fetch existing row so we can do a proper merge.
  const existing = queryFirstRow<DbUserAccountRow>(
    "SELECT * FROM user_account WHERE id = 'local'",
  );

  if (!existing) {
    database.run(
      `INSERT INTO user_account (
         id, login_provider, login_id, login_name, login_avatar,
         login_token, login_token_expires,
         origin_name, origin_uid, origin_verified, origin_detection_method,
         steam_id, steam_name, steam_avatar,
         discord_id, discord_name, discord_avatar,
         created_at, updated_at, last_login
       ) VALUES (
         'local', ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?
       )`,
      [
        partial.login_provider ?? null,
        partial.login_id ?? null,
        partial.login_name ?? null,
        partial.login_avatar ?? null,
        partial.login_token ?? null,
        partial.login_token_expires ?? null,
        partial.origin_name ?? null,
        partial.origin_uid ?? null,
        partial.origin_verified ?? 0,
        partial.origin_detection_method ?? null,
        partial.steam_id ?? null,
        partial.steam_name ?? null,
        partial.steam_avatar ?? null,
        partial.discord_id ?? null,
        partial.discord_name ?? null,
        partial.discord_avatar ?? null,
        partial.created_at ?? ts,
        ts,
        partial.last_login ?? null,
      ],
    );
  } else {
    // Build a SET clause for only the provided fields.
    const fields = Object.keys(partial).filter((k) => k !== 'id' && k !== 'created_at');
    if (fields.length === 0) return;

    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values: (string | number | null)[] = fields.map(
      (f) => (partial as Record<string, string | number | null>)[f],
    );
    values.push(ts); // updated_at
    database.run(
      `UPDATE user_account SET ${setClauses}, updated_at = ? WHERE id = 'local'`,
      values,
    );
  }
}

// ─── Profile Snapshots ────────────────────────────────────────────────────────

export function insertProfileSnapshot(snapshot: DbProfileSnapshotRow): void {
  const database = requireDb();
  database.run(
    `INSERT INTO profile_snapshots
       (timestamp, level, rank_name, rank_score, total_kills, total_damage, total_wins, selected_legend, raw_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.timestamp,
      snapshot.level ?? null,
      snapshot.rank_name ?? null,
      snapshot.rank_score ?? null,
      snapshot.total_kills ?? null,
      snapshot.total_damage ?? null,
      snapshot.total_wins ?? null,
      snapshot.selected_legend ?? null,
      snapshot.raw_data ?? null,
    ],
  );
}

export function getLatestProfileSnapshot(): DbProfileSnapshotRow | null {
  return queryFirstRow<DbProfileSnapshotRow>(
    'SELECT * FROM profile_snapshots ORDER BY timestamp DESC LIMIT 1',
  );
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function closeDatabase(): Promise<void> {
  if (autoSaveTimer !== null) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
  await saveDatabase();
  if (db) {
    db.close();
    db = null;
  }
}
