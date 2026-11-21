# SOLARA BAY — an original open-world crime game

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/salikamarlisa3-cell/gta6-01-v5/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/salikamarlisa3-cell/gta6-01-v5/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLARA BAY** is an original 3D open-world crime game that runs fully
offline from static files (`game/index.html`), built with three.js
vendored under `game/vendor/`. No network requests, no external assets,
no names, characters or maps from any existing franchise.

## What's in the game

- A procedural island city: road grid with sidewalks, multi-storey
  buildings with lit facades, neon signs, a beach with animated water,
  a pier, 5 named districts and named landmarks, building colliders.
- Third-person on-foot play plus entering/leaving any car (parked or
  traffic — stealing raises your wanted level), arcade driving with
  collisions.
- Traffic AI that follows lanes, turns at junctions and brakes for the
  car ahead; 40+ pedestrians who flee from cars and gunfire.
- The VBPD wanted system, 0–5 stars: escalating dispatch, roadblocks at
  high stars, PIT/ram units, line-of-sight search mode, a bust meter
  when cornered at low speed, stars decay while unseen. BUSTED/WASTED
  respawns at the hospital/HQ with a cash penalty.
- Combat: hitscan pistol with tracer and muzzle flash, enemies who
  shoot back, health + armour, fists as fallback.
- 10 sequential story missions in one arc with named characters,
  opening dialogue cards, objective lines, payouts, gold markers and a
  finale card, then free roam; plus 3 repeatable activities: checkpoint
  street races, taxi/courier runs and vigilante jobs.
- A 2-person crew with callable abilities (backup driver, shooter) and
  a per-district standing meter moved by missions and activities.
- 6 vehicle classes with distinct handling; a garage/respray that
  lowers wanted.
- Day–night cycle with street lights, neon and headlights at night,
  plus a weather touch (short rain showers / heat haze).
- Full HUD (health, armour, cash, stars, weapon, speed, objective,
  clock, mission, bust meter) and a live canvas minimap (roads, water,
  police/traffic/objective blips, player arrow).
- Title screen (New Game / Continue), pause, mute; localStorage save
  (cash, mission index, position, clock) on mission completion and
  periodically.
- Procedural WebAudio throughout: engine follows speed, sirens follow
  distance, gunshots, crashes, an ambient music loop; starts on the
  first user gesture.

Source is modular under `game/src/`: world, traffic, police, missions,
combat, crew, races, vehicles, pedestrians, audio, hud, save, weather,
player, input, render, main.

## Run it

```sh
node serve.ts   # static server, then open http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html`.

## Entry

- **Competition:** `gta6-01` — "Make GTA 6" (make.fun)
- **Author:** [@salikamarlisa3-cell](https://github.com/salikamarlisa3-cell)
- `main.ts` hands the game in: it copies `game/` and `screenshots/` to
  the output directory and writes `dossier.json` with the kit's
  `buildDossier` (`vendor/makefun-game.ts`, unchanged).

## License

MIT — see [LICENSE](LICENSE).
