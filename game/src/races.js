// races.js — repeatable free-roam activities, started at glowing ground markers:
//   Street Race — an 8-checkpoint circuit of the Palmera Strip against the clock.
//   Taxi — pick up a fare, deliver them across town, chain fares for tips.
//   Vigilante — a suspect car flees the VBPD HQ; disable it for a bounty.
// Each pays cash and shifts district standing where it is completed.

import { spawnCar, steerToward } from './vehicles.js';
import { ROAD_LINES } from './world.js';

const ACTIVITIES = {
  race: { name: 'Street Race — Palmera Circuit', marker: { x: 175, z: 62 }, color: 0xff5da2 },
  taxi: { name: 'Taxi — St. Azur Rank', marker: { x: 82, z: 142 }, color: 0xffc44d },
  vigilante: { name: 'Vigilante — VBPD Bounty', marker: { x: -125, z: 44 }, color: 0x6ab0ff },
};

const RACE_POINTS = [
  [175, 50], [200, 0], [175, -100], [100, -150], [0, -100],
  [-50, 0], [0, 100], [100, 150], [175, 62],
];

export function createRaces(ctx) {
  const { scene, W, S } = ctx;
  const rng = W.rng;
  const cars = [];
  const rings = {};
  let active = null;

  for (const [key, a] of Object.entries(ACTIVITIES)) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.22, 8, 24),
      new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: 0.85 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(a.marker.x, 0.4, a.marker.z);
    scene.add(ring);
    rings[key] = ring;
  }

  function farePoint() {
    const x = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)] + (rng() < 0.5 ? 9 : -9);
    const z = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)] + (rng() < 0.5 ? 9 : -9);
    return { x, z };
  }

  function finish(pay, district, standingDelta, msg) {
    S.cash += pay;
    if (district) S.standing[district] = Math.max(-100, Math.min(100, (S.standing[district] || 0) + standingDelta));
    ctx.hud.toast(msg + '  +$' + pay);
    if (ctx.audio) ctx.audio.cash();
    active = null;
    ctx.hud.setObjective('');
  }

  const api = {
    cars,
    ACTIVITIES,
    get active() { return active; },
    start(kind) {
      if (active || S.activeMission) return false;
      if (kind === 'race') {
        if (!S.player.inCar) { ctx.hud.toast('You need a car for the street race'); return false; }
        active = { kind, idx: 0, time: 0, par: 110 };
        ctx.hud.setObjective('Street Race: hit the checkpoints — beat ' + active.par + 's');
      } else if (kind === 'taxi') {
        if (!S.player.inCar) { ctx.hud.toast('You need a car to run fares'); return false; }
        const p = farePoint();
        active = { kind, phase: 'pickup', point: p, time: 0 };
        ctx.hud.setObjective('Taxi: pick up the fare');
      } else if (kind === 'vigilante') {
        const car = spawnCar(scene, 'sedan', -100, 0, 1.2, 0xd23b3b, rng);
        car.driver = 'target';
        car.health = 55;
        cars.length = 0;
        cars.push(car);
        active = { kind, car };
        ctx.hud.setObjective('Vigilante: disable the fleeing suspect car');
        if (ctx.systems.police) ctx.systems.police.crime(0.4, car.pos.x, car.pos.z);
      }
      return true;
    },
    objectivePos() {
      if (!active) return null;
      if (active.kind === 'race') { const [x, z] = RACE_POINTS[active.idx]; return { x, z }; }
      if (active.kind === 'taxi') return active.point;
      if (active.kind === 'vigilante') return { x: active.car.pos.x, z: active.car.pos.z };
      return null;
    },
    cancel() { active = null; ctx.hud.setObjective(''); },
    update(dt, t) {
      for (const [key, ring] of Object.entries(rings)) {
        ring.visible = !active && !S.activeMission;
        ring.rotation.z = t * 0.8;
        if (ring.visible && S.mode === 'play') {
          const a = ACTIVITIES[key];
          if (Math.hypot(S.player.pos.x - a.marker.x, S.player.pos.z - a.marker.z) < 3) api.start(key);
        }
      }
      if (!active) return;
      const p = S.player.pos;
      if (active.kind === 'race') {
        active.time += dt;
        const [x, z] = RACE_POINTS[active.idx];
        ctx.hud.setObjective('Street Race: checkpoint ' + (active.idx + 1) + '/' + RACE_POINTS.length + ' — ' + active.time.toFixed(0) + 's / par ' + active.par + 's');
        if (Math.hypot(p.x - x, p.z - z) < 9) {
          active.idx += 1;
          if (ctx.audio) ctx.audio.blip();
          if (active.idx >= RACE_POINTS.length) {
            const bonus = active.time <= active.par ? 350 : 0;
            finish(550 + bonus, 'Palmera Strip', 6, active.time <= active.par ? 'Race won — under par!' : 'Race finished');
          }
        }
        if (active.time > 240) { ctx.hud.toast('Race abandoned'); api.cancel(); }
      } else if (active.kind === 'taxi') {
        active.time += dt;
        const pt = active.point;
        if (Math.hypot(p.x - pt.x, p.z - pt.z) < 6 && S.player.inCar) {
          if (active.phase === 'pickup') {
            active.phase = 'dropoff';
            active.point = farePoint();
            active.dist = Math.hypot(active.point.x - pt.x, active.point.z - pt.z);
            ctx.hud.setObjective('Taxi: drop the fare off');
            if (ctx.audio) ctx.audio.blip();
          } else {
            const fare = Math.round(60 + active.dist * 0.9);
            const tip = active.time < active.dist * 0.55 ? 40 : 0;
            const district = W.districtAt(pt.x, pt.z);
            active = null;
            finish(fare + tip, district, 3, 'Fare paid' + (tip ? ' (fast — tip!)' : ''));
          }
        }
      } else if (active.kind === 'vigilante') {
        const car = active.car;
        if (car.dead || car.health <= 0) {
          cars.length = 0;
          finish(700, 'Old Canela', 4, 'Suspect disabled — bounty paid');
          return;
        }
        // The suspect flees the player.
        const away = { x: car.pos.x + (car.pos.x - p.x), z: car.pos.z + (car.pos.z - p.z) };
        const road = W.nearestRoad(away.x, away.z);
        steerToward(car, road.x, road.z, dt, W, { arrive: 2 });
        if (Math.hypot(car.pos.x - p.x, car.pos.z - p.z) > 260) {
          cars.length = 0;
          scene.remove(car.mesh);
          ctx.hud.toast('The suspect got away');
          api.cancel();
        }
      }
    },
  };
  return api;
}
