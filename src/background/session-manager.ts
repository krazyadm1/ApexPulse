import { SessionData, MatchRecord } from '../shared/types';
import { SESSION_TIMEOUT_MS } from '../shared/constants';
import { generateId, nowMs } from '../shared/utils';
import { upsertSession, getLatestSession } from './database';
import { broadcastSession } from './messaging';

let currentSession: SessionData | null = null;
let sessionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

export function initSessionManager(): void {
  const latest = getLatestSession();
  if (latest && latest.endTime === null) {
    const elapsed = nowMs() - latest.startTime;
    if (elapsed < SESSION_TIMEOUT_MS) {
      currentSession = latest;
      resetTimeout();
      return;
    }
    latest.endTime = latest.startTime + SESSION_TIMEOUT_MS;
    upsertSession(latest);
  }
}

export function getCurrentSession(): SessionData | null {
  return currentSession ? { ...currentSession } : null;
}

export function onMatchPlayed(match: MatchRecord): void {
  if (!currentSession || isSessionExpired()) {
    startNewSession();
  }

  currentSession!.matchesPlayed++;
  currentSession!.totalKills += match.kills;
  currentSession!.totalDamage += match.damage;
  currentSession!.totalRpChange += match.rpChange ?? 0;

  upsertSession(currentSession!);
  broadcastSession(currentSession!);
  resetTimeout();
}

function isSessionExpired(): boolean {
  if (!currentSession) return true;
  return nowMs() - (currentSession.endTime ?? currentSession.startTime) > SESSION_TIMEOUT_MS;
}

function startNewSession(): void {
  if (currentSession) {
    currentSession.endTime = nowMs();
    upsertSession(currentSession);
  }

  currentSession = {
    id: generateId(),
    startTime: nowMs(),
    endTime: null,
    matchesPlayed: 0,
    totalKills: 0,
    totalDamage: 0,
    totalRpChange: 0,
  };

  upsertSession(currentSession);
  broadcastSession(currentSession);
}

function resetTimeout(): void {
  if (sessionTimeoutTimer) clearTimeout(sessionTimeoutTimer);
  sessionTimeoutTimer = setTimeout(() => {
    if (currentSession) {
      currentSession.endTime = nowMs();
      upsertSession(currentSession);
      broadcastSession(currentSession);
      currentSession = null;
    }
  }, SESSION_TIMEOUT_MS);
}

export function endCurrentSession(): void {
  if (currentSession) {
    currentSession.endTime = nowMs();
    upsertSession(currentSession);
    broadcastSession(currentSession);
    currentSession = null;
  }
  if (sessionTimeoutTimer) clearTimeout(sessionTimeoutTimer);
}
