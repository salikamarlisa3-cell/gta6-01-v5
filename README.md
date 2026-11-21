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

## Controls

- **WASD / arrows** — walk, or drive (W/S throttle and reverse, A/D steer)
- **Mouse** — orbit the camera (click the game to pointer-lock); **Shift** — sprint / handbrake
- **E** — enter or leave a car, talk to a mission giver, respray at a garage
- **F or left mouse** — punch, or fire the pistol while it has ammo
- **Z** — call Rook, your backup driver ($120) · **X** — call Sable, your gunner ($200)
- **Enter / Space** — advance dialogue · **P or Esc** — pause · **M** — mute

## Run it

Serve `game/` with any static file server and open `index.html`, e.g.:

```sh
python3 -m http.server 8080 --directory game
# then open http://localhost:8080
```

## As built — verification notes

- `game/index.html?test=1` runs an automated self-test in the page (boot and
  world spawn, mission 1 end-to-end with payout, car theft raising the
  wanted level, police dispatch, star decay while hidden, BUSTED, WASTED,
  and a save that persists across a reload) and writes PASS/FAIL lines into
  the page; the current build passes all of them with zero console errors.
- `?shot=cover|drive|chase|night&seed=1` stages the four deterministic
  scenes captured in `screenshots/`.
- VBPD units searching for a lost suspect sweep around the last place the
  suspect was actually seen — never the live position — and brake to park
  on top of a cornered suspect on foot, which is what fills the bust meter.
- `main.ts` verifies its own package after copying: it counts the game
  files and bytes, requires exactly 4 screenshots, and prints a one-line
  summary alongside the dossier.

## Entry

- **Competition:** `gta6-01` — "Make GTA 6" (make.fun)
- **Author:** [@salikamarlisa3-cell](https://github.com/salikamarlisa3-cell)
- `main.ts` hands the game in: it copies `game/` and `screenshots/` to
  the output directory and writes `dossier.json` with the kit's
  `buildDossier` (`vendor/makefun-game.ts`, unchanged).

## License

MIT — see [LICENSE](LICENSE).
