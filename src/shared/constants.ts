export const APEX_GAME_ID = 21566;

export const API_BASE_URL = 'https://api.mozambiquehe.re';
export const API_ENDPOINTS = {
  bridge: '/bridge',
  mapRotation: '/maprotation',
  crafting: '/crafting',
  servers: '/servers',
  news: '/news',
  nameToUid: '/nametouid',
  events: '/events',
} as const;

export const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
export const STEAM_API_BASE = 'https://api.steampowered.com';
export const DISCORD_API_BASE = 'https://discord.com/api/v10';
export const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
export const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

export const AUTH_CALLBACK_PORT = 3847;
export const AUTH_CALLBACK_BASE = `http://localhost:${AUTH_CALLBACK_PORT}`;

export const DB_FILENAME = 'apexpulse.db';
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const API_POLL_INTERVAL_MS = 120_000;
export const API_RATE_LIMIT_MS = 500;
export const DB_SAVE_INTERVAL_MS = 30_000;

export const DEFAULT_SETTINGS: import('./types').AppSettings = {
  apiKey: '',
  overlayEnabled: true,
  overlayPosition: { top: 10, left: 10 },
  overlayOpacity: 0.8,
  overlayHotkey: 'Shift+F1',
  autoDetectOrigin: true,
  pollIntervalMs: API_POLL_INTERVAL_MS,
  sessionTimeoutMs: SESSION_TIMEOUT_MS,
};

export const WINDOW_NAMES = {
  background: 'background',
  dashboard: 'dashboard',
  overlay: 'overlay',
} as const;
