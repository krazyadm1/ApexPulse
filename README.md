# ApexPulse

Real-time Apex Legends companion app built on [Overwolf Electron (ow-electron)](https://overwolf.github.io/tools/ow-electron). Tracks matches, stats, weapons, legends, and map rotations — all in a sleek desktop overlay.

## Features

- **Live Match Tracking** — Kills, damage, knockdowns, deaths tracked in real-time via Overwolf GEP
- **Career Stats Dashboard** — Career kills, K/D, wins, rank, and level from the Apex Legends API
- **Map Rotation** — Live BR, Ranked, and LTM map schedules with countdown timers
- **Crafting Rotation** — Current replicator items with costs and rarity
- **Server Status** — Real-time Apex server health monitoring
- **Weapon Analytics** — Per-weapon kill tracking with charts and category breakdowns
- **Legend Analytics** — Per-legend performance stats with class filtering
- **Match History** — Full match-by-match history with expandable details
- **In-Game Overlay** — Transparent always-on-top overlay with hotkey toggle (Shift+F1)
- **System Tray** — Minimizes to tray, right-click to quit
- **Heirloom Pack Tracker** — Track progress toward the 500-pack pity timer
- **Post-Match Summary** — Popup with placement, kills, and damage after each match
- **LiveAPI WebSocket** — Built-in WebSocket server for Apex's native LiveAPI (custom lobbies)

## Tech Stack

- **Runtime:** [ow-electron](https://overwolf.github.io/tools/ow-electron) (Electron fork with Overwolf GEP)
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **State:** Zustand
- **Charts:** Recharts
- **Database:** better-sqlite3 (local match history)
- **API:** [mozambiquehe.re](https://apexlegendsapi.com/) for player stats, maps, servers, crafting
- **Build:** Webpack 5 + electron-builder

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
git clone https://github.com/krazyadm1/ApexPulse.git
cd ApexPulse
npm install
```

### Development

```bash
npm run build          # webpack build
npm start              # launch with ow-electron
npm run start:dev      # launch with GEP DEV endpoint
```

### Production Build

```bash
npm run build:prod     # production webpack build
npm run pack           # package with electron-builder (unpacked)
npm run dist           # create NSIS installer
```

## Project Structure

```
src/
  main/           # Electron main process + preload
  dashboard/      # React dashboard UI (pages, components, stores)
  overlay/        # In-game overlay UI
  background/     # Backend services (GEP, match tracking, API, auth, database)
  shared/         # Shared types, constants, utilities
  stores/         # Zustand state stores
```

## LiveAPI Setup (Custom Lobbies)

For real-time tracking in custom/tournament lobbies via Apex's native LiveAPI:

1. Add to Steam launch options:
   ```
   +cl_liveapi_enabled 1 +cl_liveapi_ws_servers "ws://127.0.0.1:7777" +cl_liveapi_use_protobuf 0
   ```
2. Launch ApexPulse first, then Apex Legends

> Note: LiveAPI gameplay events are currently restricted to custom lobbies by EA/Respawn. Public match tracking requires Overwolf GEP.

## API Key

ApexPulse uses the free [Apex Legends Status API](https://apexlegendsapi.com/) for player stats, map rotations, and server status. Get a free API key at apexlegendsapi.com and enter it in Settings.

## License

ISC

## Author

**krazyadm** — [Discord](https://discord.gg/zcgMzRwJFv)
