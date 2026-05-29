import { WindowMessage, MessageType } from '../shared/types';

type MessageHandler = (message: WindowMessage) => void;
const handlers: Map<MessageType, Set<MessageHandler>> = new Map();

// Map from MessageType to kebab-case IPC channel
const channelMap: Record<MessageType, string> = {
  'LIVE_MATCH_UPDATE': 'live-match-update',
  'MATCH_ENDED': 'match-ended',
  'MATCH_HISTORY_UPDATE': 'match-history-update',
  'PROFILE_UPDATE': 'profile-update',
  'MAP_ROTATION_UPDATE': 'map-rotation-update',
  'AUTH_STATE_CHANGE': 'auth-state-change',
  'SETTINGS_UPDATE': 'settings-update',
  'SESSION_UPDATE': 'session-update',
  'ORIGIN_DETECTED': 'origin-detected',
  'REQUEST_STATE': 'request-state',
  'LOBBY_INTEL_UPDATE': 'lobby-intel-update',
  'PACK_UPDATE': 'pack-update',
  'GAME_RUNNING_UPDATE': 'game-running-update',
  'APP_ERROR': 'app-error',
  'OVERLAY_AUTO_HIDDEN': 'overlay-auto-hidden',
};

// Injected by main process
let broadcastFn: ((channel: string, data: unknown) => void) | null = null;

export function setBroadcastFn(fn: (channel: string, data: unknown) => void): void {
  broadcastFn = fn;
}

export function onMessage(type: MessageType, handler: MessageHandler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler);
  return () => handlers.get(type)?.delete(handler);
}

// For renderer windows: set up IPC listener via preload bridge
export function setupRendererListener(): void {
  const api = (window as unknown as { apexPulse?: { on: (ch: string, cb: (...args: unknown[]) => void) => void } }).apexPulse;
  if (!api) return;

  for (const [msgType, channel] of Object.entries(channelMap)) {
    api.on(channel, (data: unknown) => {
      const message: WindowMessage = {
        type: msgType as MessageType,
        payload: data,
        timestamp: Date.now(),
      };
      const typeHandlers = handlers.get(msgType as MessageType);
      if (typeHandlers) {
        typeHandlers.forEach(h => h(message));
      }
    });
  }
}

// For main process: also kept for backward compat
export function setupMessageListener(): void {
  // No-op in Electron — IPC handlers are in main.ts
}

function broadcast(message: WindowMessage): void {
  const channel = channelMap[message.type];
  if (channel && broadcastFn) {
    broadcastFn(channel, message.payload);
  }
}

export function broadcastLiveUpdate<T>(payload: T): void {
  broadcast({ type: 'LIVE_MATCH_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastMatchEnded<T>(payload: T): void {
  broadcast({ type: 'MATCH_ENDED', payload, timestamp: Date.now() });
}

export function broadcastMatchHistory<T>(payload: T): void {
  broadcast({ type: 'MATCH_HISTORY_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastProfile<T>(payload: T): void {
  broadcast({ type: 'PROFILE_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastMapRotation<T>(payload: T): void {
  broadcast({ type: 'MAP_ROTATION_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastAuthChange<T>(payload: T): void {
  broadcast({ type: 'AUTH_STATE_CHANGE', payload, timestamp: Date.now() });
}

export function broadcastSettings<T>(payload: T): void {
  broadcast({ type: 'SETTINGS_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastSession<T>(payload: T): void {
  broadcast({ type: 'SESSION_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastOriginDetected(name: string, uid: string): void {
  broadcast({ type: 'ORIGIN_DETECTED', payload: { name, uid }, timestamp: Date.now() });
}

export function broadcastLobbyIntel<T>(payload: T): void {
  broadcast({ type: 'LOBBY_INTEL_UPDATE', payload, timestamp: Date.now() });
}

export function broadcastPackUpdate(count: number, justOpened: number): void {
  broadcast({ type: 'PACK_UPDATE', payload: { count, justOpened }, timestamp: Date.now() });
}

// Convenience for renderer to send to main
export function sendToMain(channel: string, data?: unknown): void {
  const api = (window as unknown as { apexPulse?: { send: (ch: string, data?: unknown) => void } }).apexPulse;
  if (api) api.send(channel, data);
}

export function invokeMain(channel: string, data?: unknown): Promise<unknown> {
  const api = (window as unknown as { apexPulse?: { invoke: (ch: string, data?: unknown) => Promise<unknown> } }).apexPulse;
  if (api) return api.invoke(channel, data);
  return Promise.reject(new Error('Not in Electron renderer'));
}
