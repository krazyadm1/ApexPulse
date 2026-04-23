import { getUserAccount } from '../database';
import { UserAccount } from '../../shared/types';
import { broadcastAuthChange } from '../messaging';
import { initiateSteamLogin, completeSteamLogin } from './steam-auth';
import { initiateDiscordLogin, exchangeDiscordCode, setDiscordClientId } from './discord-auth';
import { resolveOriginName, handleGepPlayerNameDetected, getOriginName } from './origin-resolver';

interface AuthConfig {
  steamApiKey?: string;
  discordClientId?: string;
}

let config: AuthConfig = {};

export function initAuth(authConfig: AuthConfig): void {
  config = authConfig;
  if (authConfig.discordClientId) {
    setDiscordClientId(authConfig.discordClientId);
  }
}

export function getAuthState(): UserAccount | null {
  return getUserAccount();
}

export function isOriginLinked(): boolean {
  const account = getUserAccount();
  return Boolean(account?.originVerified);
}

export function loginSteam(): void {
  initiateSteamLogin();
}

export function loginDiscord(): void {
  initiateDiscordLogin();
}

export async function handleSteamCallback(callbackUrl: string): Promise<boolean> {
  return completeSteamLogin(callbackUrl, config.steamApiKey ?? '');
}

export async function handleDiscordCallback(code: string): Promise<boolean> {
  return exchangeDiscordCode(code);
}

export async function linkOriginManual(name: string): Promise<boolean> {
  return resolveOriginName(name, 'manual');
}

export async function handlePlayerDetected(name: string): Promise<void> {
  await handleGepPlayerNameDetected(name);
}

export function broadcastCurrentAuthState(): void {
  const account = getUserAccount();
  broadcastAuthChange(account);
}

export { getOriginName };
