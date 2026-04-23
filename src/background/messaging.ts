import { WindowMessage, MessageType } from '../shared/types';
import { WINDOW_NAMES } from '../shared/constants';

// === Types ===

export type MessageHandler = (message: WindowMessage) => void;

// === Handler Registry ===

const registry = new Map<MessageType, Set<MessageHandler>>();

// === Registration ===

export function onMessage(type: MessageType, handler: MessageHandler): () => void {
  if (!registry.has(type)) {
    registry.set(type, new Set());
  }
  registry.get(type)!.add(handler);

  return () => {
    registry.get(type)?.delete(handler);
  };
}

// === Internal Dispatch ===

function dispatch(message: WindowMessage): void {
  const handlers = registry.get(message.type);
  if (handlers) {
    for (const handler of handlers) {
      handler(message);
    }
  }
}

// === Background Listener ===

export function setupMessageListener(): void {
  overwolf.windows.onMessageReceived.addListener((event: { id: string; content: string }) => {
    try {
      const message = JSON.parse(event.content) as WindowMessage;
      dispatch(message);
    } catch {
      // Ignore malformed messages
    }
  });
}

// === Renderer Listener ===

export function setupRendererListener(): void {
  overwolf.windows.onMessageReceived.addListener((event: { id: string; content: string }) => {
    try {
      const message = JSON.parse(event.content) as WindowMessage;
      dispatch(message);
    } catch {
      // Ignore malformed messages
    }
  });
}

// === Sending ===

export function sendToWindow(windowName: string, message: WindowMessage): void {
  overwolf.windows.getWindow(windowName, (result: { success: boolean; window: { id: string } }) => {
    if (result.success && result.window?.id) {
      const content = JSON.stringify(message);
      overwolf.windows.sendMessage(result.window.id, message.type, content, () => {
        // Fire and forget
      });
    }
  });
}

export function broadcast(message: WindowMessage): void {
  sendToWindow(WINDOW_NAMES.dashboard, message);
  sendToWindow(WINDOW_NAMES.overlay, message);
}

// === Convenience Broadcasters ===

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
