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
| M5 Audio + haptics | done |
| M6 Bots, debug toolbar, i18n | done |
| M7 Rust server + LAN | done |
| M8 Tauri + CI/APK | done (CI-verified builds) |

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

## LAN play (one phone hosts, friends join from any browser)

```bash
cd ui && npm run build          # the server embeds ui/dist
cd ../server && cargo run --release -- --port 7878
```

The server prints a LAN URL. Open it on the host phone, tap **Host a room**,
and let friends scan the QR (or type the 4-letter code) from any phone on the
same Wi-Fi or hotspot. The host device runs the rules; joiners send intents.
Seats survive reloads and screen-locks for 10 minutes.

Checks:

```bash
cd server && cargo test                      # room registry + WebSocket relay
cd ui && npm run lan-check                   # two headless browsers through the relay
```

## Android APK and desktop builds

Tauri v2 wraps the web app and starts the Rust server inside the app, so the
host phone needs nothing else. Builds run in GitHub Actions:

| Workflow | Trigger | Produces |
|----------|---------|----------|
| `ci.yml` | every push / PR | lint, unit tests, Rust tests, headless browser checks, screenshots |
| `pages.yml` | push to `main` | pass-and-play web demo on GitHub Pages (installable PWA) |
| `release.yml` | tag `v*` | Android APKs (arm64 + armv7) and Linux AppImage/deb attached to the release |

See [tauri/README.md](./tauri/README.md) for local builds and Android caveats.

```bash
git tag v0.1.0 && git push origin v0.1.0     # builds and publishes the APK
```

## Layout

```
ui/        Vue 3 + Vite + Tailwind v4 + TypeScript (strict)
  src/engine/   pure rules engine, no DOM, fully unit-tested
server/    Rust axum WebSocket relay + embedded static UI
tauri/     Tauri v2 Android/desktop wrapper (embeds the server)
.github/   CI, GitHub Pages deploy, tagged releases
```

## License

MIT
