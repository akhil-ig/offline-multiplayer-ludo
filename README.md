# Offline Multiplayer Ludo

Production-grade, offline-first Ludo for mobile. Pass-and-play on one device,
or LAN multiplayer where one phone hosts and friends join from any browser via QR.
Ships as a web app and as a Tauri v2 Android APK with an embedded Rust server.

See [PLAN.md](./PLAN.md) for the architecture, rules spec and milestone plan.

## Status

| Milestone | State |
|-----------|-------|
| M1 Engine + tests | done |
| M2 Board render | done |
| M3 Pass & Play | done |
| M4 Animations | done |
| M5 Audio + haptics | next |
| M6 Bots, debug toolbar, i18n | |
| M7 Rust server + LAN | |
| M8 Tauri + CI/APK | |

## Develop

```bash
cd ui
npm install
npm run dev        # Vite dev server, reachable on your LAN (--host)
npm test           # engine unit tests
npm run test:coverage
npm run lint
npm run build
```

## Layout

```
ui/        Vue 3 + Vite + Tailwind v4 + TypeScript (strict)
  src/engine/   pure rules engine, no DOM, fully unit-tested
server/    Rust axum WebSocket relay (M7)
tauri/     Tauri v2 Android/desktop wrapper (M8)
```

## License

MIT
