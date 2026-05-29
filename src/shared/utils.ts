import { WEAPON_MAP } from './weapon-map';

// ─── Crafting item name lookup tables ────────────────────────────────────────

const GEAR_NAMES: Record<string, string> = {
  backpack_pickup_lv1: 'Backpack Lv.1',
  backpack_pickup_lv2: 'Backpack Lv.2',
  backpack_pickup_lv3: 'Backpack Lv.3',
  backpack_pickup_lv4_revive_boost: 'Gold Backpack',
  helmet_pickup_lv1: 'Helmet Lv.1',
  helmet_pickup_lv2: 'Helmet Lv.2',
  helmet_pickup_lv3: 'Helmet Lv.3',
  helmet_pickup_lv4_abilities: 'Gold Helmet',
  knockdownshield_pickup_lv1: 'Knockdown Shield Lv.1',
  knockdownshield_pickup_lv2: 'Knockdown Shield Lv.2',
  knockdownshield_pickup_lv3: 'Knockdown Shield Lv.3',
  knockdownshield_pickup_lv4_selfrevive: 'Gold Knockdown Shield',
  bodyshield_pickup_lv1: 'Body Shield Lv.1',
  bodyshield_pickup_lv2: 'Body Shield Lv.2',
  bodyshield_pickup_lv3: 'Body Shield Lv.3',
  bodyshield_pickup_lv5_evolving: 'Evo Shield',
};

const HEALTH_NAMES: Record<string, string> = {
  health_pickup_health_large: 'Med Kit',
  health_pickup_health_small: 'Syringe',
  health_pickup_combo_large: 'Phoenix Kit',
  health_pickup_combo_small: 'Shield Cell',
  health_pickup_shield_large: 'Shield Battery',
  health_pickup_shield_small: 'Shield Cell',
};

const AMMO_NAMES: Record<string, string> = {
  bullet: 'Light Ammo',
  highcal: 'Heavy Ammo',
  special: 'Energy Ammo',
  shotgun: 'Shotgun Ammo',
  sniper: 'Sniper Ammo',
  arrows: 'Arrows',
};

const MISC_NAMES: Record<string, string> = {
  evo_points: 'Evo Points',
};

function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/**
 * Convert a raw internal crafting item name (e.g. `mp_weapon_hemlock`,
 * `backpack_pickup_lv3`, `bullet`) into a human-readable display name.
 */
export function formatCraftingItemName(rawName: string): string {
  // Exact-match lookups
  if (GEAR_NAMES[rawName]) return GEAR_NAMES[rawName];
  if (HEALTH_NAMES[rawName]) return HEALTH_NAMES[rawName];
  if (AMMO_NAMES[rawName]) return AMMO_NAMES[rawName];
  if (MISC_NAMES[rawName]) return MISC_NAMES[rawName];

  // Weapons: strip mp_weapon_ prefix and look up via WEAPON_MAP
  if (rawName.startsWith('mp_weapon_')) {
    const key = rawName.replace('mp_weapon_', '');
    const weapon = WEAPON_MAP[key];
    if (weapon) return weapon.display;
    // Fallback: title-case the key portion
    return toTitleCase(key.replace(/_/g, ' '));
  }

  // Generic fallback: strip common prefixes, replace underscores, title case
  const cleaned = rawName
    .replace(/^(pickup_|item_|loot_)/, '')
    .replace(/_/g, ' ');
  return toTitleCase(cleaned);
}

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
