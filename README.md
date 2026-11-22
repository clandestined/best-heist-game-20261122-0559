# The Velvet Vault

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/clandestined/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/clandestined/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist game, written for the [make.fun bounty](https://make.fun/bounty/best-heist-game-20261122-0559): three rooms, one crew, and a vault in each. Read the patrols, mind the cameras, crack the vault, and slip out the green door before the alarm hits 100.

## How it plays

- **Move** with WASD or the arrow keys. **Sneak** with Shift (or C): slower, but the guards' cones reach less far and the alarm climbs slower.
- **Guards** patrol waypoints and wait at each end, scanning the room. Step into a yellow vision cone and the alarm climbs; get too close and a guard grabs you. A loud alarm sends the nearest guard to investigate where you were last seen.
- **Cameras** sweep their arcs from the walls. Their orange cones count just like a guard's.
- **The vault** opens only if you stand beside it for 1.6 seconds — the gold ring shows the crack progress. Grab the side loot (paintings, gold bars, the Crown Jewel) on the way for extra score.
- **Coins** (3 per room): click anywhere in the room to toss one. Guards in earshot leave their patrol to check the clink. A good toss opens a route that was never there.
- **The alarm meter** decays while nobody can see you, so breaking line of sight behind a crate, case or pillar is how you survive. Finish a room with the alarm never passing 30 for a stealth bonus, and fast for a time bonus.
- Three rooms — The Gallery, The Vault, The Penthouse — each harder than the last: more guards, more cameras, faster patrols.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

`game/` is plain static files (no build step, no network request): `game/index.html` opens in desktop Chrome and plays. Sounds are synthesised with the Web Audio API; there are no audio files. The best score is kept in the browser's local storage.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `game/src/config.js` — every tuning number, the palette, and the three rooms.
- `game/src/world.js` — the rules: movement and collision, vision cones and line of sight, patrols and investigations, the vault, the loot and the alarm.
- `game/src/render.js` — drawing only: the room, the cones, the HUD and the screens.
- `game/src/input.js` — keyboard and mouse input, with one-shot presses queued.
- `game/src/shots.js` — the staged screenshot scenes, played by an autopilot through the real rules.
- `game/src/audio.js` — synthesised sound effects (Web Audio, no files).
- `game/src/random.js` — a seeded RNG so the screenshot scenes repeat.
- `game/src/main.js` — boot and the one loop, the six screens, and the scoring.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## Screenshots

`shots.json` lists the three staged scenes (`?shot=start|play|end&seed=1`): the cover (the thief sneaking toward the vault with the cones sweeping), a mid-heist frame with the vault cracked and the getaway run, and a clean getaway. Each is a real render of the game's own code, taken in desktop Chrome.
