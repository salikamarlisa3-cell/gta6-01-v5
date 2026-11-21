// police.js — the VBPD (Solara Bay Police Department): a 0–5 star wanted system
// with tiered dispatch, pursuit steering, PIT/ram behaviour at high stars,
// roadblocks with spike strips and foot officers, line-of-sight search, a bust
// meter when the player is cornered, and star decay while hidden.

import { spawnCar, steerToward, damageCar } from './vehicles.js';
import { clamp } from './util.js';
import { ROAD_LINES } from './world.js';

const DISPATCH = [0, 1, 2, 3, 5, 7]; // interceptors per star level

export function createPolice(ctx) {
  const { scene, W, S } = ctx;
  const rng = W.rng;
  const units = [];       // interceptor cars
  const footCops = [];    // officers standing at roadblocks
  let block = null;       // active roadblock {cars:[], strip:{x,z}, cops:[]}
  let blockTimer = 14;
  let losTimer = 0;
  let decayTimer = 0;

  const copMat = new THREE.MeshLambertMaterial({ color: 0x24457a });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  function buildCop() {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.74, 0.3), copMat);
    torso.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), skinMat);
    head.position.y = 1.68;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.28), new THREE.MeshLambertMaterial({ color: 0x1c2432 }));
    legs.position.y = 0.35;
    g.add(torso, head, legs);
    return g;
  }

  function spawnUnit() {
    // Spawn at HQ half the time, else at a road point far from the player.
    let x, z;
    if (rng() < 0.45) { x = W.landmarks.hq.x + (rng() * 16 - 8); z = W.landmarks.hq.z + (rng() * 10 - 5); }
    else {
      x = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
      z = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
      if (Math.hypot(x - S.player.pos.x, z - S.player.pos.z) < 75) { x = -x; z = -z; }
    }
    const car = spawnCar(scene, 'interceptor', x, z, rng() * 6.28, 0xf0f0f2, rng);
    car.driver = 'police';
    car.state = 'chase';
    car.searchT = 0;
    units.push(car);
    return car;
  }

  function spawnBlock() {
    const p = S.player;
    const fx = p.car ? Math.sin(p.car.heading) : Math.sin(p.heading);
    const fz = p.car ? Math.cos(p.car.heading) : Math.cos(p.heading);
    const road = W.nearestRoad(p.pos.x + fx * 55, p.pos.z + fz * 55);
    const bx = Math.abs(fx) > Math.abs(fz) ? p.pos.x + fx * 55 : road.x;
    const bz = Math.abs(fx) > Math.abs(fz) ? road.z : p.pos.z + fz * 55;
    const cars = [];
    for (const off of [-3.4, 3.4]) {
      const car = spawnCar(scene, 'interceptor', bx + (Math.abs(fz) > 0.5 ? off : 0), bz + (Math.abs(fx) > 0.5 ? off : 0), Math.atan2(fz, fx) + Math.PI / 2, 0xf0f0f2, rng);
      car.driver = 'police';
      car.state = 'block';
      units.push(car);
      cars.push(car);
    }
    const cops = [];
    for (const off of [-6, 6]) {
      const mesh = buildCop();
      mesh.position.set(bx + off, 0, bz + (Math.abs(fx) > 0.5 ? off * 0.4 : 2));
      scene.add(mesh);
      const cop = { mesh, pos: mesh.position, health: 100, down: 0 };
      footCops.push(cop);
      cops.push(cop);
    }
    block = { cars, cops, strip: { x: bx, z: bz }, x: bx, z: bz };
    if (ctx.hud) ctx.hud.toast('VBPD roadblock ahead!');
  }

  function clearBlock() {
    if (!block) return;
    for (const c of block.cops) {
      scene.remove(c.mesh);
      const i = footCops.indexOf(c);
      if (i >= 0) footCops.splice(i, 1);
    }
    block = null; // cars stay on as regular units
  }

  const api = {
    units,
    footCops,
    crime(amount, x, z) {
      if (S.mode !== 'play') return;
      // Crimes committed in plain sight of an officer count double.
      let witnessed = false;
      for (const u of units) if (Math.hypot(u.pos.x - x, u.pos.z - z) < 55) witnessed = true;
      S.heat += amount * (witnessed ? 1 : 0.55);
      while (S.heat >= 1 && S.wanted < 5) { S.heat -= 1; S.wanted += 1; }
      if (S.wanted >= 5) S.heat = Math.min(S.heat, 0.99);
      if (S.wanted === 0 && S.heat > 0.4) S.wanted = 1;
      if (ctx.systems.pedestrians) ctx.systems.pedestrians.startle(x, z, 13);
    },
    setWanted(n) { S.wanted = clamp(Math.round(n), 0, 5); S.heat = 0; },
    addHeat(v) { api.crime(v, S.player.pos.x, S.player.pos.z); },
    nearestDist() {
      let best = 1e9;
      for (const u of units) best = Math.min(best, Math.hypot(u.pos.x - S.player.pos.x, u.pos.z - S.player.pos.z));
      return best;
    },
    anyLOS() {
      const p = S.player.pos;
      for (const u of units) {
        if (Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < 95 && !W.losBlocked(u.pos.x, u.pos.z, p.x, p.z)) return true;
      }
      return false;
    },
    forceHidden() { S.hiddenTime = 99; S.lastSeen = null; },
    spawnBlockNow() { if (!block) { spawnBlock(); blockTimer = 26; } },
    update(dt) {
      const p = S.player;
      // --- line of sight bookkeeping ---
      losTimer -= dt;
      if (losTimer <= 0) {
        losTimer = 0.15;
        if (api.anyLOS()) {
          S.lastSeen = { x: p.pos.x, z: p.pos.z };
          S.hiddenTime = 0;
        }
      }
      if (S.lastSeen) S.hiddenTime += dt;
      // --- star decay while hidden ---
      if (S.wanted > 0 && S.hiddenTime > 6) {
        decayTimer += dt;
        if (decayTimer > 5) {
          decayTimer = 0;
          S.wanted -= 1;
          S.heat = 0;
          S.hiddenTime = 2;
          if (S.wanted <= 0) { S.wanted = 0; clearBlock(); }
        }
      } else decayTimer = 0;
      // --- dispatch ---
      const want = DISPATCH[S.wanted];
      if (units.length < want) spawnUnit();
      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        const d = Math.hypot(u.pos.x - p.pos.x, u.pos.z - p.pos.z);
        if ((S.wanted === 0 && d > 40) || d > 230 || u.dead) {
          scene.remove(u.mesh);
          units.splice(i, 1);
        }
      }
      // --- roadblocks ---
      blockTimer -= dt;
      if (S.wanted >= 3 && !block && blockTimer <= 0 && p.car) {
        spawnBlock();
        blockTimer = 26;
      }
      if (block && Math.hypot(block.x - p.pos.x, block.z - p.pos.z) > 130) clearBlock();
      if (block && p.car && Math.hypot(block.strip.x - p.car.pos.x, block.strip.z - p.car.pos.z) < 3) {
        if (p.car.flatTire <= 0) { p.car.flatTire = 6; if (ctx.audio) ctx.audio.thud(0.7); }
      }
      // --- unit driving ---
      for (const u of units) {
        if (u.state === 'block') continue;
        const seen = S.lastSeen && S.hiddenTime < 3;
        const tx = seen ? S.lastSeen.x : (u.wanderX ?? u.pos.x);
        const tz = seen ? S.lastSeen.z : (u.wanderZ ?? u.pos.z);
        if (!seen) {
          u.searchT += dt;
          if (u.searchT > 4 || (u.wanderX !== undefined && Math.hypot(u.wanderX - u.pos.x, u.wanderZ - u.pos.z) < 6)) {
            u.searchT = 0;
            // Search around the last place the suspect was actually seen —
            // never around their live position, or hiding could never work.
            const c = S.lastSeen || { x: u.pos.x, z: u.pos.z };
            u.wanderX = c.x + (rng() * 70 - 35);
            u.wanderZ = c.z + (rng() * 70 - 35);
          }
        }
        if (S.wanted >= 4 && p.car && !u.dead) {
          // PIT: aim at the rear quarter of the player's car.
          const back = 2.6;
          const qx = p.car.pos.x - Math.sin(p.car.heading) * back + Math.cos(p.car.heading) * 1.4;
          const qz = p.car.pos.z - Math.cos(p.car.heading) * back - Math.sin(p.car.heading) * 1.4;
          steerToward(u, seen ? qx : tx, seen ? qz : tz, dt, W, { arrive: 0.5 });
          if (Math.hypot(u.pos.x - p.car.pos.x, u.pos.z - p.car.pos.z) < 3.4) u.speed = Math.min(u.speed + 14 * dt, u.spec.top);
        } else {
          steerToward(u, tx, tz, dt, W, { arrive: p.car ? 2.5 : 3.2 });
        }
        // Closing on a suspect on foot: brake hard and park on top of them
        // instead of orbiting past — this is what builds bust pressure.
        if (!p.car && seen && Math.hypot(p.pos.x - u.pos.x, p.pos.z - u.pos.z) < 9) {
          u.speed *= Math.max(0, 1 - dt * 3);
        }
        // Lightbar strobe.
        const bar = u.mesh.getObjectByName('lightbar');
        if (bar) bar.material.color.setHex(Math.sin(performance.now() * 0.02 + u.id) > 0 ? 0x2266ff : 0xff2222);
      }
      // --- foot cops open fire at 3+ stars ---
      if (S.wanted >= 3 && ctx.systems.combat) {
        for (const c of footCops) {
          if (c.down > 0) { c.down -= dt; continue; }
          const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z);
          if (d < 40 && !W.losBlocked(c.pos.x, c.pos.z, p.pos.x, p.pos.z)) {
            c.mesh.lookAt(p.pos.x, 0, p.pos.z);
            ctx.systems.combat.hostileFire(c.pos, dt);
          }
        }
      }
      // --- bust meter ---
      let pressure = 0;
      const pSpeed = p.car ? Math.abs(p.car.speed) : Math.hypot(S.playerVel.x, S.playerVel.z);
      if (pSpeed < 2.2) {
        for (const u of units) if (Math.hypot(u.pos.x - p.pos.x, u.pos.z - p.pos.z) < 8) pressure++;
        for (const c of footCops) if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 5) pressure++;
      }
      if (pressure > 0 && S.wanted > 0) {
        S.bust += dt / 2.2 * Math.min(pressure, 2);
        if (S.bust >= 1) { S.bust = 0; ctx.onBusted(); }
      } else {
        S.bust = Math.max(0, S.bust - dt * 0.8);
      }
    },
  };
  return api;
}
