import { shell } from 'electron';
import { DISCORD_AUTH_URL, DISCORD_TOKEN_URL, DISCORD_API_BASE, AUTH_CALLBACK_BASE } from '../../shared/constants';
import { upsertUserAccount } from '../database';
import { broadcastAuthChange } from '../messaging';

let discordClientId = '';

export function setDiscordClientId(id: string): void {
  discordClientId = id;
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

let codeVerifier = '';

export async function getDiscordAuthUrl(): Promise<string> {
  if (!discordClientId) throw new Error('Discord client ID not set');

  codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: discordClientId,
    response_type: 'code',
    redirect_uri: `${AUTH_CALLBACK_BASE}/auth/discord/callback`,
    scope: 'identify connections',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${DISCORD_AUTH_URL}?${params.toString()}`;
}

export async function exchangeDiscordCode(code: string): Promise<boolean> {
  if (!discordClientId) return false;

  try {
    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: discordClientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${AUTH_CALLBACK_BASE}/auth/discord/callback`,
        code_verifier: codeVerifier,
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return false;

    const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userResponse.json();

    const connectionsResponse = await fetch(`${DISCORD_API_BASE}/users/@me/connections`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const connections = await connectionsResponse.json();

    const steamConnection = Array.isArray(connections)
      ? connections.find((c: { type: string }) => c.type === 'steam')
      : null;

    upsertUserAccount({
      login_provider: 'discord',
      login_id: user.id,
      login_name: user.username,
      login_avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      login_token: tokens.access_token,
      login_token_expires: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      discord_id: user.id,
      discord_name: user.username,
      discord_avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      ...(steamConnection ? { steam_id: steamConnection.id, steam_name: steamConnection.name } : {}),
    });

    broadcastAuthChange({
      provider: 'discord',
      discordId: user.id,
      name: user.username,
      steamId: steamConnection?.id,
    });

    return true;
  } catch (error) {
    console.error('[DiscordAuth] Failed to exchange code:', error);
    return false;
  }
}

export function initiateDiscordLogin(): void {
  getDiscordAuthUrl().then(url => {
    shell.openExternal(url);
  }).catch(err => {
    console.error('[DiscordAuth] Failed to initiate login:', err);
  });
}
