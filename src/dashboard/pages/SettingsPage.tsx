import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

type ApexPulseApi = {
  send: (ch: string, data?: unknown) => void;
  invoke: (ch: string, data?: unknown) => Promise<unknown>;
};

function getApi(): ApexPulseApi | null {
  return (window as unknown as { apexPulse?: ApexPulseApi }).apexPulse ?? null;
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-apex-cyan focus:ring-offset-2 focus:ring-offset-apex-navy ${
          checked ? 'bg-apex-cyan' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-white/80 text-sm">{label}</span>
    </label>
  );
}

// ─── Section Card ────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <h2 className="text-white font-bold text-lg tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

// ─── Account Row ─────────────────────────────────────────────────────────────

interface AccountRowProps {
  icon: string;
  provider: string;
  linkedName: string | null | undefined;
  onAction: () => void;
  actionLabel: string;
  manualInput?: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  };
}

function AccountRow({ icon, provider, linkedName, onAction, actionLabel, manualInput }: AccountRowProps) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
      <span className="text-2xl w-8 text-center">{icon}</span>
      <span className="text-white/70 font-mono text-sm w-20 shrink-0">{provider}</span>
      {linkedName ? (
        <span className="text-apex-cyan font-mono text-sm flex-1 truncate">{linkedName}</span>
      ) : manualInput ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={manualInput.value}
            onChange={e => manualInput.onChange(e.target.value)}
            placeholder={manualInput.placeholder}
            className="bg-apex-dark border border-white/10 rounded-lg px-4 py-2 text-white flex-1 focus:border-apex-cyan focus:outline-none text-sm font-mono"
          />
          <button
            onClick={onAction}
            className="bg-apex-cyan text-apex-dark font-bold px-6 py-2 rounded-lg hover:bg-opacity-90 text-sm whitespace-nowrap"
          >
            {actionLabel}
          </button>
        </div>
      ) : (
        <button
          onClick={onAction}
          className="bg-apex-cyan text-apex-dark font-bold px-6 py-2 rounded-lg hover:bg-opacity-90 text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // Settings store
  const {
    apiKey,
    overlayEnabled,
    overlayOpacity,
    overlayHotkey,
    updateSettings,
  } = useSettingsStore();

  // Auth store
  const { user, isOriginLinked } = useAuthStore();

  // ── API Key ──
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);

  // Keep local state in sync if store changes externally
  useEffect(() => {
    setApiKeyInput(apiKey);
  }, [apiKey]);

  function handleSaveApiKey() {
    updateSettings({ apiKey: apiKeyInput.trim() });
  }

  // ── Origin manual link ──
  const [originInput, setOriginInput] = useState('');

  function handleLinkOrigin() {
    const name = originInput.trim();
    if (!name) return;
    const api = getApi();
    if (api) api.invoke('link-origin-manual', name);
  }

  // ── Steam ──
  function handleLoginSteam() {
    const api = getApi();
    if (api) api.send('login-steam');
  }

  // ── Discord ──
  function handleLoginDiscord() {
    const api = getApi();
    if (api) api.send('login-discord');
  }

  // ── Overlay opacity (local for smooth slider, flush on change end) ──
  const [opacityLocal, setOpacityLocal] = useState(overlayOpacity);

  useEffect(() => {
    setOpacityLocal(overlayOpacity);
  }, [overlayOpacity]);

  function handleOpacityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setOpacityLocal(val);
  }

  function handleOpacityCommit() {
    updateSettings({ overlayOpacity: opacityLocal });
  }

  // ── Pack counter ──
  const PACK_STORAGE_KEY = 'apexpulse_pack_count';

  const [packCount, setPackCount] = useState<number>(() => {
    const stored = localStorage.getItem(PACK_STORAGE_KEY);
    return stored !== null ? parseInt(stored, 10) : 0;
  });

  function handleSavePacks() {
    localStorage.setItem(PACK_STORAGE_KEY, String(packCount));
  }

  function handleResetPacks() {
    setPackCount(0);
    localStorage.setItem(PACK_STORAGE_KEY, '0');
  }

  // ── Export ──
  function handleExport() {
    alert('Export coming soon');
  }

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <h1 className="text-white font-bold text-2xl tracking-wide">Settings</h1>

      {/* ── API Configuration ── */}
      <SectionCard title="API Configuration">
        <div className="flex flex-col gap-2">
          <label className="text-white/60 text-sm font-mono" htmlFor="api-key-input">
            Apex Legends API Key
          </label>
          <input
            id="api-key-input"
            type="text"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            placeholder="Enter your API key…"
            className="bg-apex-dark border border-white/10 rounded-lg px-4 py-2 text-white w-full focus:border-apex-cyan focus:outline-none font-mono text-sm"
          />
          <p className="text-white/40 text-xs">
            Get your free API key at{' '}
            <a
              href="https://apexlegendsapi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-apex-cyan hover:underline"
            >
              apexlegendsapi.com
            </a>
          </p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSaveApiKey}
            className="bg-apex-cyan text-apex-dark font-bold px-6 py-2 rounded-lg hover:bg-opacity-90"
          >
            Save
          </button>
        </div>
      </SectionCard>

      {/* ── Linked Accounts ── */}
      <SectionCard title="Linked Accounts">
        {/* EA / Origin */}
        <AccountRow
          icon="🎮"
          provider="EA/Origin"
          linkedName={isOriginLinked ? user?.originName : null}
          onAction={handleLinkOrigin}
          actionLabel="Link"
          manualInput={
            !isOriginLinked
              ? {
                  value: originInput,
                  onChange: setOriginInput,
                  placeholder: 'Enter your Origin / EA username',
                }
              : undefined
          }
        />

        {/* Steam */}
        <AccountRow
          icon="🖥️"
          provider="Steam"
          linkedName={user?.steamName}
          onAction={handleLoginSteam}
          actionLabel="Sign in with Steam"
        />

        {/* Discord */}
        <AccountRow
          icon="💬"
          provider="Discord"
          linkedName={user?.discordName}
          onAction={handleLoginDiscord}
          actionLabel="Sign in with Discord"
        />
      </SectionCard>

      {/* ── Overlay Settings ── */}
      <SectionCard title="Overlay Settings">
        {/* Enable / disable toggle */}
        <Toggle
          checked={overlayEnabled}
          onChange={val => updateSettings({ overlayEnabled: val })}
          label="Enable in-game overlay"
        />

        {/* Opacity slider */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-white/60 text-sm font-mono" htmlFor="opacity-slider">
              Overlay Opacity
            </label>
            <span className="text-apex-cyan font-mono text-sm">
              {Math.round(opacityLocal * 100)}%
            </span>
          </div>
          <input
            id="opacity-slider"
            type="range"
            min={0.3}
            max={1.0}
            step={0.05}
            value={opacityLocal}
            onChange={handleOpacityChange}
            onMouseUp={handleOpacityCommit}
            onTouchEnd={handleOpacityCommit}
            className="w-full accent-apex-cyan"
          />
          <div className="flex justify-between text-white/30 text-xs font-mono">
            <span>30%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Hotkey (read-only) */}
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm font-mono">Toggle Overlay Hotkey</span>
          <kbd className="bg-apex-dark border border-white/20 rounded px-3 py-1 text-apex-cyan font-mono text-sm tracking-widest">
            {overlayHotkey || 'Not set'}
          </kbd>
        </div>
      </SectionCard>

      {/* ── Heirloom Pack Tracker ── */}
      <SectionCard title="Heirloom Pack Tracker">
        <div className="flex flex-col gap-2">
          <label className="text-white/60 text-sm font-mono" htmlFor="pack-count-input">
            Current Pack Count
          </label>
          <input
            id="pack-count-input"
            type="number"
            min={0}
            max={500}
            value={packCount}
            onChange={e => setPackCount(Math.min(500, Math.max(0, parseInt(e.target.value, 10) || 0)))}
            className="bg-apex-dark border border-white/10 rounded-lg px-4 py-2 text-white w-full focus:border-apex-cyan focus:outline-none font-mono text-sm"
          />
          <p className="text-white/40 text-xs">
            Manually track your packs opened. Increment each time you open packs in-game.
          </p>
        </div>

        {/* Progress bar toward 500 */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-white/40 text-xs font-mono">
            <span>{packCount} / 500 packs opened</span>
            <span>{Math.max(0, 500 - packCount)} until guaranteed heirloom</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-apex-cyan rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (packCount / 500) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleResetPacks}
            className="border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5 text-white/70 text-sm"
          >
            Reset to 0
          </button>
          <button
            onClick={handleSavePacks}
            className="bg-apex-cyan text-apex-dark font-bold px-6 py-2 rounded-lg hover:bg-opacity-90"
          >
            Save
          </button>
        </div>
      </SectionCard>

      {/* ── Data Management ── */}
      <SectionCard title="Data Management">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-white/80 text-sm">Export match history and stats</span>
            <span className="text-white/40 text-xs font-mono">JSON format</span>
          </div>
          <button
            onClick={handleExport}
            className="border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5 text-white/70 text-sm"
          >
            Export Data
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-white/40 text-xs font-mono">Version</span>
          <span className="text-white/60 text-xs font-mono">ApexPulse v1.0.0</span>
        </div>
      </SectionCard>
    </div>
  );
}
