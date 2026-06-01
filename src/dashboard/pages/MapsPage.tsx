import React, { useState, useEffect } from 'react';
import {
  ApexApiMapRotationResponse,
  ApexApiCraftingResponse,
} from '../../shared/types';
import { formatCraftingItemName } from '../../shared/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a raw second count into "Xh Ym" or "Ym Zs". */
function formatCountdown(totalSecs: number): string {
  if (totalSecs <= 0) return '0s';
  if (totalSecs >= 3600) {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MapCardProps {
  label: string;
  borderColor: string;
  currentMap: string | null;
  nextMap: string | null;
  initialSecs: number | null;
}

const MapCard: React.FC<MapCardProps> = ({
  label,
  borderColor,
  currentMap,
  nextMap,
  initialSecs,
}) => {
  const [remainingSecs, setRemainingSecs] = useState<number>(initialSecs ?? 0);

  // Sync when the parent receives fresh data
  useEffect(() => {
    if (initialSecs !== null) {
      setRemainingSecs(initialSecs);
    }
  }, [initialSecs]);

  // Tick countdown every second
  useEffect(() => {
    if (initialSecs === null) return;
    const id = setInterval(() => {
      setRemainingSecs((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [initialSecs]);

  const hasData = currentMap !== null;

  return (
    <div
      className="glass-card flex flex-col gap-3 overflow-hidden"
      style={{ borderTop: `3px solid ${borderColor}` }}
    >
      {/* Card label */}
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: borderColor }}
      >
        {label}
      </span>

      {hasData ? (
        <>
          {/* Current map */}
          <div>
            <p className="text-[var(--text-secondary)] text-xs mb-1">Current</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] leading-tight truncate">
              {currentMap}
            </p>
          </div>

          {/* Countdown */}
          <div>
            <p className="text-[var(--text-secondary)] text-xs mb-1">Time Remaining</p>
            <p
              className="text-3xl font-bold font-mono"
              style={{ color: borderColor }}
            >
              {formatCountdown(remainingSecs)}
            </p>
          </div>

          {/* Next map */}
          {nextMap && (
            <div className="mt-auto pt-2 border-t border-[var(--border)]">
              <p className="text-[var(--text-muted)] text-xs">
                Next:{' '}
                <span className="text-[var(--text-secondary)] font-medium">{nextMap}</span>
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center py-6">
          <p className="text-[var(--text-muted)] text-sm italic">Connecting to API...</p>
        </div>
      )}
    </div>
  );
};

// ─── Crafting Section ─────────────────────────────────────────────────────────

interface CraftingSectionProps {
  items: ApexApiCraftingResponse[] | null;
}

const CraftingSection: React.FC<CraftingSectionProps> = ({ items }) => {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('apexpulse_crafting_collapsed') === 'true');

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('apexpulse_crafting_collapsed', String(next));
  }

  // Flatten all bundle contents into a single list
  const allItems =
    items && items.length > 0
      ? items.flatMap((bundle) =>
          bundle.bundleContent.map((entry) => ({
            bundle: bundle.bundle,
            item: entry.item,
            cost: entry.cost,
            rarity: entry.itemType.rarity,
          }))
        )
      : null;

  const rarityColors: Record<string, string> = {
    Common: '#9CA3AF',
    Rare: '#3B82F6',
    Epic: '#A855F7',
    Legendary: '#F59E0B',
  };

  return (
    <div className="glass-card">
      <button
        onClick={toggleCollapsed}
        className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)] mb-4 hover:text-apex-cyan transition-colors w-full text-left"
      >
        <span className="text-[var(--text-muted)] text-sm">{collapsed ? '▸' : '▾'}</span>
        Crafting Rotation
      </button>

      {!collapsed && allItems && allItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {allItems.map((entry, idx) => {
            const color = rarityColors[entry.rarity] ?? '#9CA3AF';
            return (
              <div
                key={idx}
                className="bg-[var(--hover)] rounded-lg p-3 border border-[var(--border)] flex flex-col gap-2"
                style={{ borderTop: `2px solid ${color}` }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color }}
                >
                  {entry.rarity}
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
                  {formatCraftingItemName(entry.item)}
                </p>
                <p className="text-apex-cyan font-mono font-bold text-sm mt-auto">
                  {entry.cost.toLocaleString()} mats
                </p>
              </div>
            );
          })}
        </div>
      ) : !collapsed ? (
        <p className="text-[var(--text-muted)] text-sm italic text-center py-6">
          Crafting data will appear when connected to the API
        </p>
      ) : null}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

interface MapsPageState {
  rotation: ApexApiMapRotationResponse | null;
  crafting: ApexApiCraftingResponse[] | null;
  serversOnline: boolean;
}

const MapsPage: React.FC = () => {
  const [state, setState] = useState<MapsPageState>({
    rotation: null,
    crafting: null,
    serversOnline: true,
  });

  useEffect(() => {
    const api = (window as unknown as { apexPulse?: { on: (ch: string, cb: (...args: unknown[]) => void) => void; send: (ch: string) => void } }).apexPulse;
    if (api) {
      api.on('map-rotation-update', (data) => {
        const payload = data as {
          rotation?: ApexApiMapRotationResponse;
          crafting?: ApexApiCraftingResponse[];
          serversOnline?: boolean;
        };
        setState((prev) => ({
          rotation: payload.rotation ?? prev.rotation,
          crafting: payload.crafting ?? prev.crafting,
          serversOnline: payload.serversOnline ?? prev.serversOnline,
        }));
      });
    }
  }, []);

  const { rotation, crafting, serversOnline } = state;

  // Derive per-mode data
  const brCurrent = rotation?.battle_royale.current ?? null;
  const brNext = rotation?.battle_royale.next ?? null;
  const rankedCurrent = rotation?.ranked.current ?? null;
  const rankedNext = rotation?.ranked.next ?? null;
  const ltmCurrent = rotation?.ltm?.current ?? null;
  const ltmNext = rotation?.ltm?.next ?? null;

  return (
    <div className="flex flex-col gap-8 p-8 min-h-full">

      {/* ── Header ── */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[var(--text-primary)]">Maps &amp; Rotation</h2>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Live map schedule and crafting rotation
          </p>
        </div>

        {/* Server status indicator */}
        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: serversOnline ? '#22C55E' : '#EF4444',
              boxShadow: serversOnline
                ? '0 0 6px #22C55E88'
                : '0 0 6px #EF444488',
            }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: serversOnline ? '#22C55E' : '#EF4444' }}
          >
            {serversOnline ? 'Servers Online' : 'Servers Down'}
          </span>
        </div>
      </header>

      {/* ── No API data empty state ── */}
      {!rotation && (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>🗺️</div>
          <p className="text-[var(--text-primary)] font-mono font-semibold text-base" style={{ margin: '0 0 4px' }}>Map rotation unavailable</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Add your API key in Settings to see map rotations, or check your connection.</p>
        </div>
      )}

      {/* ── Current Map Rotation (3-column grid) ── */}
      <section>
        <h3 className="text-base font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
          Current Rotation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Battle Royale */}
          <MapCard
            label="Battle Royale"
            borderColor="#00E5FF"
            currentMap={brCurrent?.map ?? null}
            nextMap={brNext?.map ?? null}
            initialSecs={brCurrent?.remainingSecs ?? null}
          />

          {/* Ranked */}
          <MapCard
            label="Ranked"
            borderColor="#FACC15"
            currentMap={rankedCurrent?.map ?? null}
            nextMap={rankedNext?.map ?? null}
            initialSecs={rankedCurrent?.remainingSecs ?? null}
          />

          {/* Mixtape / LTM */}
          {ltmCurrent ? (
            <MapCard
              label="Mixtape / LTM"
              borderColor="#C084FC"
              currentMap={ltmCurrent.map}
              nextMap={ltmNext?.map ?? null}
              initialSecs={ltmCurrent.remainingSecs}
            />
          ) : (
            <div
              className="glass-card flex flex-col gap-3"
              style={{ borderTop: '3px solid #C084FC' }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-purple-400">
                Mixtape / LTM
              </span>
              <div className="flex flex-1 items-center justify-center py-6">
                <p className="text-[var(--text-muted)] text-sm italic">No LTM Active</p>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ── Crafting Rotation ── */}
      <section>
        <CraftingSection items={crafting} />
      </section>

    </div>
  );
};

export default MapsPage;
