# Offline Multiplayer Ludo — Master Plan

Target: production-grade, offline-first local-multiplayer Ludo.
Pass-and-play on one device, plus LAN multiplayer where one phone hosts
and friends join from any browser via QR. Ships as a web app (GitHub Pages)
and as a Tauri v2 Android APK that embeds the server.

---

## 1. Review of the pasted plan

### What is right (keep as-is)
- Vue 3 + Vite + Tailwind + TypeScript, Tauri v2 wrapping, axum/tokio server.
- 15x15 coordinate engine instead of eyeballed cells. All coordinates in the
  prompt were verified: 52-cell track, start offsets 0/13/26/39, star squares
  8/21/34/47, home lanes and goals are all mutually consistent (1-indexed).
- Cell-by-cell hop animation, 3D dice, stacking layout, capture drama,
  Web Audio synth (no asset files), vibrate haptics, debug toolbar.
- Rules: 6 to unlock, three-6 forfeit, capture bonus, exact roll to finish.

### Problems found (fix before building)

| # | Issue | Why it matters | Fix |
|---|-------|----------------|-----|
| 1 | Rules engine written twice: TS store in Phase 1, Rust "server-authoritative" engine in Phase 2 | Two engines drift; every rule bug must be fixed in two languages | Write the engine ONCE in TypeScript as pure functions. Server is a relay + room manager. The HOST device runs the engine and is authoritative. Cheating is not a threat model for friends on a hotspot. |
| 2 | Phase 1 is one giant prompt: engine + board + animations + audio + lobby + debug tools | Everything ends up 70% done, nothing verified | Split into 8 milestones, each with a concrete acceptance check (tests pass, screenshot, device test). |
| 3 | No persistence/resume | Phone call or screen lock kills the game | Save game state to localStorage after every action. Resume on open. |
| 4 | No reconnect design for WebSocket | Android kills sockets on screen lock within seconds. Players "fall out" of the room | Each player gets a seat token. Client auto-reconnects with it. Server keeps room alive for 10 min with no sockets. Host state re-syncs on rejoin. |
| 5 | No state management lib named | Ad-hoc reactive state becomes spaghetti | Pinia store with one `GameState` object. Engine returns new state + events; UI only renders. |
| 6 | No tests mentioned | Ludo has many edge cases (safe star capture, stacking, home entry overshoot) | Vitest unit tests for the engine, target 100% branch coverage of rules. |
| 7 | Dice randomness location undefined | In LAN mode clients must never roll locally | Only the host rolls. Clients send `intent` (roll, move token N); host validates and broadcasts state. |
| 8 | Ambiguous rules not pinned down | Arguments mid-game | See Rules spec in section 3. Decided and configurable where classic variants exist. |
| 9 | "Motion blur" on dice, screen shake, particles all at once | Low-end Android WebView stutters | Keep effects but gate heavy ones. Respect `prefers-reduced-motion`. Use `transform`/`opacity` only, no `filter: blur` on moving elements. |
| 10 | Android LAN IP detection from Rust not addressed | Android 11+ restricts netlink; some `getifaddrs` paths return nothing | Use `local-ip-address` crate with fallback. Also expose a manual "type IP" path. Test on real device early (milestone 7). |
| 11 | Joiners use plain `http://ip:port` | No service worker/PWA for joiners, iOS has no vibrate | Fine. Joiners are online on the LAN. Audio and haptics degrade gracefully. |
| 12 | APK build needs Android SDK + NDK locally | Heavy local setup, not available in this cloud session | GitHub Actions workflow builds the APK on every tag. Also deploys web build to GitHub Pages. |
| 13 | Sound needs a user gesture to start on mobile | Silent game if AudioContext created at load | Create/resume AudioContext on first tap (the "Start" button). |

---

## 2. Architecture

```
offline-multiplayer-ludo/
├── ui/                     Vue 3 + Vite + Tailwind v4 + TS (strict)
│   ├── src/engine/         PURE logic, zero DOM, zero Vue
│   │   ├── boardCoords.ts  52-track, yards, lanes, goals, safe cells
│   │   ├── rules.ts        legalMoves, applyMove, nextTurn, winner
│   │   ├── types.ts        GameState, Player, Token, GameEvent
│   │   └── rng.ts          seeded RNG (replayable games, deterministic tests)
│   ├── src/stores/         Pinia: game store, settings store, net store
│   ├── src/net/            WebSocket client, protocol types, reconnect
│   ├── src/components/     Board, Cell, Token, Dice, PlayerCard, HUD,
│   │                       LobbyModal(QR), DebugToolbar, Toast, WinScreen
│   ├── src/composables/    useAnimationQueue, useSound, useHaptics
│   ├── src/utils/sound.ts  Web Audio synth
│   └── tests/              Vitest engine tests
├── server/                 Rust axum + tokio
│   ├── src/main.rs         serves embedded UI (rust-embed) + /ws
│   ├── src/room.rs         rooms, seats, seat tokens, broadcast
│   └── src/protocol.rs     serde mirror of ui/src/net/protocol.ts
├── tauri/                  Tauri v2 app (Android + desktop), starts server
├── .github/workflows/      ci.yml (lint+test+build), pages.yml, android.yml
├── PLAN.md  README.md  LICENSE (MIT)
```

Data flow (LAN): client tap -> `intent` over WS -> server forwards to host ->
host engine validates + applies -> host broadcasts `state` + `events` ->
every client animates from events. Pass-and-play is the same loop with an
in-memory "loopback" transport. One code path, two transports.

Mode matrix:
| Mode | Transport | Who runs engine |
|------|-----------|-----------------|
| Pass & Play | loopback | this device |
| LAN host (APK or `cargo run`) | WebSocket | host device |
| LAN joiner (any browser) | WebSocket | host device |

---

## 3. Rules spec (decided)

Position model per token: `-1` yard, `0..50` track (relative to own start),
`51..55` home lane, `56` goal. Absolute track cell = `(start + pos) % 52`.

- Turn order Red -> Green -> Yellow -> Blue. 2P = Red vs Yellow (diagonal).
- Need a 6 to leave the yard. Token lands on own start cell.
- Bonus roll on: rolling a 6, capturing, reaching goal.
- Three consecutive 6s: turn forfeited immediately, toast shown.
- Exact roll required to reach goal; overshoot = that token cannot move.
- No legal move after roll: auto-pass after a short beat.
- Only one legal move: auto-move (configurable, default on).
- Safe cells: 4 start cells + 4 star cells. No capture there.
- Capture: landing on a non-safe cell with opponent tokens sends ALL
  opponent tokens on that cell back to yard. (Variant "two tokens form a
  block" is a settings toggle, default OFF.)
- Game continues until all but one player finish. Ranking 1st..4th shown.
  Setting: "end at first winner" (default OFF).
- Bots: simple heuristic bot (prefer capture > reach goal > unlock > move
  safe > farthest). Can fill empty seats in any mode.

---

## 4. Milestones (execute in order, each gated)

| M | Deliverable | Acceptance check |
|---|-------------|------------------|
| M1 | Scaffold `ui/`, Tailwind, Pinia, Vitest, ESLint, strict TS. `boardCoords.ts` + `rules.ts` + `rng.ts` | `npm test` green: track continuity, 52 cells, every start/star/lane coordinate, unlock, capture, safe cell, 3-six, overshoot, goal, win ranking. `npm run build` zero errors. |
| M2 | Static board render: 15x15 grid, yards, lanes, center hub SVG, stars, all 16 tokens in yards | Playwright screenshot at 390x844 and 1280x800. Visual compare against spec coordinates. |
| M3 | Pass & Play playable end to end (no animation polish): roll, highlight, tap-move, capture, win screen, localStorage resume | Play a full 2P game with forced dice via debug toolbar. Reload mid-game resumes. |
| M4 | Animation system: per-cell hop with bounce, 3D dice tumble, radar pulse, stacking layout, capture shake + particles + reverse-zip, confetti on goal | Playwright video/screens of each effect. 60fps check in Chrome devtools on throttled CPU. |
| M5 | Audio + haptics: Web Audio synth (dice, hop ascending, unlock, capture, goal), vibrate, settings toggles, reduced-motion support | Manual test on Android Chrome. No console errors. Works after first tap. |
| M6 | Bots, debug toolbar (2P/4P, force roll, bot seats, LAN modal preview), HUD polish, win screen rankings, i18n hooks (EN + HI strings) | Full 4P bot-vs-bot game runs to completion automatically without errors (used as a soak test). |
| M7 | `server/`: axum WS relay, rooms, seat tokens, reconnect, rust-embed of `ui/dist`, QR with `http://ip:port/?room=XXXX`. `net/` client with reconnect | `cargo test` + integration test: 2 headless Playwright browsers join one room and finish a forced game. Real-device test on hotspot. |
| M8 | Tauri v2: desktop + Android, starts embedded server, back-button handling, portrait lock. GitHub Actions: CI, Pages deploy, APK build on tag | APK installs on Galaxy A52s, hosts a room, a second phone joins via QR and plays. |

Milestones M1 to M6 run entirely in this cloud session with automated
checks. M7 is mostly here, with one real-device check by you. M8 APK build
runs in GitHub Actions.

---

## 5. Repo and GitHub

- Repo name: `offline-multiplayer-ludo` under the `akhil-ig` account.
- This session's GitHub connection is `kajalsakhiya`, and it cannot create
  repos. You create the empty repo on `akhil-ig`, install the Claude GitHub
  App on it (or connect that account), then I attach and push.
- Until then all work is committed locally in this folder, so nothing is lost.
- Branch strategy: `main` protected, one branch per milestone, PR per milestone
  so each has its own review and CI run.

---

## 6. Open decisions for you

1. Blocking rule default (two same-color tokens block the cell): OFF. OK?
2. Capture ALL opponent tokens on the cell, or only one? Plan says ALL.
3. Game continues to full ranking, or ends at first winner? Plan says ranking.
4. Hindi + English UI from the start, or English only first? Plan says both
   via a small i18n map, English default.
5. License: MIT. OK?
