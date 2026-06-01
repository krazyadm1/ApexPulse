import React, { useState } from 'react';

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left hover:text-apex-cyan transition-colors"
      >
        <span className="text-[var(--text-primary)] text-sm font-medium pr-4">{question}</span>
        <span className="text-[var(--text-muted)] shrink-0 text-lg">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="pb-4 text-[var(--text-secondary)] text-sm leading-relaxed">{answer}</div>
      )}
    </div>
  );
}

const FAQ_ITEMS: FaqItemProps[] = [
  {
    question: 'How does ApexPulse track my matches?',
    answer: 'ApexPulse uses the Overwolf Game Events Provider (GEP) to detect game events in real time. When Apex Legends is running, GEP captures kills, damage, placement, and other match data automatically.',
  },
  {
    question: 'Do I need an API key?',
    answer: 'An API key from apexlegendsapi.com is optional but recommended. It enables player profile stats, map rotations, and server status on the dashboard. Without it, live match tracking still works via GEP.',
  },
  {
    question: 'Is my data sent to any server?',
    answer: 'No. All match data, settings, and account info are stored locally on your computer in a SQLite database. The only external calls are to the Apex Legends Status API (for stats/maps) and Steam/Discord (for optional login).',
  },
  {
    question: "Why isn't the overlay showing?",
    answer: 'Press Shift+F1 (or your custom hotkey) to toggle the overlay. Make sure Apex Legends is running and the overlay is enabled in Settings. If Apex is running as administrator, ApexPulse may also need to run as admin.',
  },
  {
    question: 'Why are my stats not updating?',
    answer: 'Stats come from the Overwolf GEP service. If the service is temporarily down due to a game update, stats may not track. Check your internet connection and ensure Apex is running in fullscreen borderless or windowed mode.',
  },
  {
    question: 'How does the heirloom pack tracker work?',
    answer: "ApexPulse uses screen capture and OCR to detect when you open Apex Packs. It only scans a small area of the screen and only while you're not in a match. You can also manually set your pack count in Settings.",
  },
  {
    question: 'Can I get banned for using ApexPulse?',
    answer: 'No. ApexPulse runs on the Overwolf platform, which is approved by Respawn Entertainment. The app only reads game data — it never modifies game files or injects code.',
  },
  {
    question: 'How do I report a bug?',
    answer: 'Head to the #support channel in our Discord server. You can join from the sidebar or from Settings > Community & Support.',
  },
];

export default function FaqPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-[var(--text-primary)] font-bold text-2xl tracking-wide">FAQ</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Frequently asked questions about ApexPulse</p>
      </div>

      <div className="glass-card p-6">
        {FAQ_ITEMS.map((item, i) => (
          <FaqItem key={i} question={item.question} answer={item.answer} />
        ))}
      </div>

      <div className="glass-card p-6 flex items-center justify-between">
        <div>
          <p className="text-[var(--text-primary)] text-sm font-medium">Still have questions?</p>
          <p className="text-[var(--text-muted)] text-xs">Get help from the community</p>
        </div>
        <a
          href="https://discord.gg/Pfd6ScNaSW"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] font-bold px-5 py-2 rounded-lg hover:bg-[#5865F2]/20 text-sm"
        >
          Join Discord
        </a>
      </div>
    </div>
  );
}
