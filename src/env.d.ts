declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

// Electron types — ow-electron re-exports electron's API
declare module 'electron' {
  export const app: {
    getPath: (name: string) => string;
    whenReady: () => Promise<void>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    quit: () => void;
    disableHardwareAcceleration: () => void;
  };
  export class BrowserWindow {
    constructor(options: Record<string, unknown>);
    loadFile(path: string): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    webContents: { send: (channel: string, ...args: unknown[]) => void };
    isVisible(): boolean;
    show(): void;
    hide(): void;
    focus(): void;
    getPosition(): [number, number];
    setIgnoreMouseEvents(ignore: boolean, options?: Record<string, boolean>): void;
    close(): void;
  }
  export class Tray {
    constructor(image: NativeImage);
    setToolTip(tooltip: string): void;
    setContextMenu(menu: Menu): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    destroy(): void;
  }
  export class Menu {
    static buildFromTemplate(template: Array<{ label?: string; type?: string; click?: () => void }>): Menu;
  }
  interface NativeImage {
    resize(options: { width?: number; height?: number }): NativeImage;
  }
  export const nativeImage: {
    createFromPath(path: string): NativeImage;
  };
  export const ipcMain: {
    on: (channel: string, handler: (event: unknown, ...args: unknown[]) => void) => void;
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown) => void;
  };
  export const ipcRenderer: {
    on: (channel: string, handler: (event: unknown, ...args: unknown[]) => void) => void;
    once: (channel: string, handler: (event: unknown, ...args: unknown[]) => void) => void;
    send: (channel: string, ...args: unknown[]) => void;
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  };
  export const contextBridge: {
    exposeInMainWorld: (name: string, api: Record<string, unknown>) => void;
  };
  export const globalShortcut: {
    register: (accelerator: string, handler: () => void) => void;
    unregisterAll: () => void;
  };
  export const desktopCapturer: {
    getSources: (options: Record<string, unknown>) => Promise<Array<{ thumbnail: { toDataURL: () => string } }>>;
  };
  export const screen: {
    getPrimaryDisplay: () => { id: number; workAreaSize: { width: number; height: number }; workArea: { x: number; y: number; width: number; height: number } };
    getAllDisplays: () => Array<{ id: number; workAreaSize: { width: number; height: number }; workArea: { x: number; y: number; width: number; height: number } }>;
  };
  export const shell: {
    openExternal: (url: string) => Promise<void>;
  };
}

// Global overwolf API (available when running as Overwolf app, otherwise undefined)
declare const overwolf: {
  games: {
    events: {
      onInfoUpdates2: { addListener: (cb: (info: unknown) => void) => void; removeListener: (cb: unknown) => void };
      onNewEvents: { addListener: (cb: (events: unknown) => void) => void; removeListener: (cb: unknown) => void };
      setRequiredFeatures: (features: string[], cb: (result: { success: boolean }) => void) => void;
    };
  };
  utils: {
    openUrlInDefaultBrowser: (url: string) => void;
  };
} | undefined;
