import { nameToUid } from '../api-client';
import { upsertUserAccount, getUserAccount } from '../database';
import { broadcastOriginDetected } from '../messaging';

export async function resolveOriginName(name: string, method: 'gep_auto' | 'manual' | 'discord_chain'): Promise<boolean> {
  const result = await nameToUid(name);
  if (!result || !result.uid) {
    console.warn('[OriginResolver] Could not resolve name:', name);
    return false;
  }

  upsertUserAccount({
    origin_name: result.name,
    origin_uid: result.uid,
    origin_verified: 1,
    origin_detection_method: method,
  });

  broadcastOriginDetected(result.name, result.uid);
  console.log(`[OriginResolver] Linked EA account: ${result.name} (${result.uid}) via ${method}`);
  return true;
}

export async function handleGepPlayerNameDetected(detectedName: string): Promise<void> {
  const account = getUserAccount();

  if (!account || !account.originName) {
    await resolveOriginName(detectedName, 'gep_auto');
  } else if (account.originName !== detectedName) {
    console.log(`[OriginResolver] EA name changed: ${account.originName} → ${detectedName}`);
    await resolveOriginName(detectedName, 'gep_auto');
  }
}

export function getOriginName(): string | null {
  const account = getUserAccount();
  return account?.originName ?? null;
}

export function getOriginUid(): string | null {
  const account = getUserAccount();
  return account?.originUid ?? null;
}
