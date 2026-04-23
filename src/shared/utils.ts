export function generateId(): string {
  return crypto.randomUUID();
}

export function nowMs(): number {
  return Date.now();
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function normalizeWeaponName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function normalizeLegendName(raw: string): string {
  const match = raw.match(/character_(\w+)_NAME/i);
  if (match) return match[1].toLowerCase();
  return raw.toLowerCase().replace(/[^a-z]/g, '');
}

export function parseGameMode(raw: string): import('./types').GameMode {
  const lower = raw.toLowerCase();
  if (lower.includes('ranked')) return 'ranked_br';
  if (lower.includes('mixtape') || lower.includes('tdm') || lower.includes('control') || lower.includes('gun_run')) return 'mixtape';
  if (lower.includes('ltm') || lower.includes('event')) return 'ltm';
  if (lower.includes('firing') || lower.includes('range')) return 'firing_range';
  return 'battle_royale';
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
