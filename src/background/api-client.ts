import axios, { AxiosInstance } from 'axios';
import {
  ApexApiPlayerResponse,
  ApexApiMapRotationResponse,
  ApexApiCraftingResponse,
  ApexApiServerStatusResponse,
  ApexApiNameToUidResponse,
} from '../shared/types';
import { API_BASE_URL, API_ENDPOINTS, API_RATE_LIMIT_MS } from '../shared/constants';

// Module state
let apiKey: string = '';
let lastRequestTime: number = 0;

// Axios instance
const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
});

// Throttle: ensures at least API_RATE_LIMIT_MS between requests
async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < API_RATE_LIMIT_MS) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, API_RATE_LIMIT_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

// Key accessors
export function setApiKey(key: string): void {
  apiKey = key;
}

export function getApiKey(): string {
  return apiKey;
}

// Player stats
export async function getPlayerStats(
  playerName: string,
  platform: string = 'PC'
): Promise<ApexApiPlayerResponse | null> {
  await throttle();
  try {
    const response = await client.get<ApexApiPlayerResponse>(API_ENDPOINTS.bridge, {
      params: { auth: apiKey, player: playerName, platform },
    });
    return response.data;
  } catch (error) {
    console.error('[api-client] getPlayerStats error:', error);
    return null;
  }
}

// Map rotation (version=2)
export async function getMapRotation(): Promise<ApexApiMapRotationResponse | null> {
  await throttle();
  try {
    const response = await client.get<ApexApiMapRotationResponse>(API_ENDPOINTS.mapRotation, {
      params: { auth: apiKey, version: 2 },
    });
    return response.data;
  } catch (error) {
    console.error('[api-client] getMapRotation error:', error);
    return null;
  }
}

// Crafting rotation
export async function getCraftingRotation(): Promise<ApexApiCraftingResponse[] | null> {
  await throttle();
  try {
    const response = await client.get<ApexApiCraftingResponse[]>(API_ENDPOINTS.crafting, {
      params: { auth: apiKey },
    });
    return response.data;
  } catch (error) {
    console.error('[api-client] getCraftingRotation error:', error);
    return null;
  }
}

// Server status
export async function getServerStatus(): Promise<ApexApiServerStatusResponse | null> {
  await throttle();
  try {
    const response = await client.get<ApexApiServerStatusResponse>(API_ENDPOINTS.servers, {
      params: { auth: apiKey },
    });
    return response.data;
  } catch (error) {
    console.error('[api-client] getServerStatus error:', error);
    return null;
  }
}

// Name to UID lookup
export async function nameToUid(
  playerName: string,
  platform: string = 'PC'
): Promise<ApexApiNameToUidResponse | null> {
  await throttle();
  try {
    const response = await client.get<ApexApiNameToUidResponse>(API_ENDPOINTS.nameToUid, {
      params: { auth: apiKey, player: playerName, platform },
    });
    return response.data;
  } catch (error) {
    console.error('[api-client] nameToUid error:', error);
    return null;
  }
}

// GEP event status check (Overwolf public endpoint)
export async function getGepEventStatus(): Promise<Record<string, string> | null> {
  try {
    const response = await axios.get('https://game-events-status.overwolf.com/gamestatus/21566_prod', {
      timeout: 5000,
    });
    return response.data;
  } catch {
    return null;
  }
}

// Bulk player lookup — sequential with throttle per request
export async function lookupMultiplePlayers(
  names: string[],
  platform: string = 'PC'
): Promise<Map<string, ApexApiPlayerResponse>> {
  const results = new Map<string, ApexApiPlayerResponse>();
  for (const name of names) {
    const data = await getPlayerStats(name, platform);
    if (data !== null) {
      results.set(name, data);
    }
  }
  return results;
}
