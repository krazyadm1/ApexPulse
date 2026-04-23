import { STEAM_OPENID_URL, AUTH_CALLBACK_BASE } from '../../shared/constants';
import { upsertUserAccount } from '../database';
import { broadcastAuthChange } from '../messaging';

interface SteamAuthResult {
  steamId: string;
  success: boolean;
}

export function getSteamOpenIdUrl(): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${AUTH_CALLBACK_BASE}/auth/steam/callback`,
    'openid.realm': AUTH_CALLBACK_BASE,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

export function parseSteamCallback(url: string): SteamAuthResult {
  try {
    const params = new URL(url).searchParams;
    const claimedId = params.get('openid.claimed_id') ?? '';
    const match = claimedId.match(/\/id\/(\d+)$/);
    if (match) {
      return { steamId: match[1], success: true };
    }
  } catch {
    // Parse failed
  }
  return { steamId: '', success: false };
}

export async function fetchSteamProfile(steamId: string, steamApiKey: string): Promise<{ name: string; avatar: string } | null> {
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamId}`;
    const response = await fetch(url);
    const data = await response.json();
    const player = data?.response?.players?.[0];
    if (player) {
      return {
        name: player.personaname,
        avatar: player.avatarfull || player.avatar,
      };
    }
  } catch (error) {
    console.error('[SteamAuth] Failed to fetch profile:', error);
  }
  return null;
}

export async function completeSteamLogin(callbackUrl: string, steamApiKey: string): Promise<boolean> {
  const result = parseSteamCallback(callbackUrl);
  if (!result.success) return false;

  const profile = await fetchSteamProfile(result.steamId, steamApiKey);

  upsertUserAccount({
    login_provider: 'steam',
    login_id: result.steamId,
    login_name: profile?.name ?? null,
    login_avatar: profile?.avatar ?? null,
    steam_id: result.steamId,
    steam_name: profile?.name ?? null,
    steam_avatar: profile?.avatar ?? null,
  });

  broadcastAuthChange({
    provider: 'steam',
    steamId: result.steamId,
    name: profile?.name,
    avatar: profile?.avatar,
  });

  return true;
}

export function initiateSteamLogin(): void {
  const url = getSteamOpenIdUrl();
  overwolf.utils.openUrlInDefaultBrowser(url);
}
