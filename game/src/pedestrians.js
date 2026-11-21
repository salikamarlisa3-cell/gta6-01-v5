// pedestrians.js — 44 citizens who stroll the sidewalks, cross at corners and
// run screaming from gunfire, speeding cars and police chases. Getting run down
// is a crime the VBPD notices.

import { ROAD_LINES, ROAD_W } from './world.js';
import { clamp } from './util.js';

const COUNT = 44;
const SHIRTS = [0xd9534f, 0x5bc0de, 0x5cb85c, 0xf0ad4e, 0xd8bfd8, 0x9ec5e5, 0xf5f5f5, 0x8a6d3b];
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function createPedestrians(ctx) {
  const { scene, W } = ctx;
  const rng = W.rng;
  const peds = [];

  function buildPed() {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)] });
    const skin = new THREE.MeshLambertMaterial({ color: SKIN[Math.floor(rng() * SKIN.length)] });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), shirt);
    torso.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), skin);
    head.position.y = 1.68;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.28), new THREE.MeshLambertMaterial({ color: 0x2e3138 }));
    legs.position.y = 0.35;
    g.add(torso, head, legs);
    return g;
  }

  function sidewalkPoint() {
    const along = -230 + rng() * 460;
    const road = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const off = (ROAD_W / 2 + 2.2) * (rng() < 0.5 ? -1 : 1);
    if (rng() < 0.5) return { x: road + off, z: along };
    return { x: along, z: road + off };
  }

  for (let i = 0; i < COUNT; i++) {
    const p = sidewalkPoint();
    const mesh = buildPed();
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    peds.push({
      mesh, pos: mesh.position,
      target: sidewalkPoint(),
      speed: 1.3 + rng() * 0.7,
      flee: 0, threatX: 0, threatZ: 0,
      down: 0, health: 100, phase: rng() * 6.28,
    });
  }

  return {
    peds,
    startle(x, z, radius = 14) {
      for (const p of peds) {
        if (p.down > 0) continue;
        if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius) {
          p.flee = 2.5 + rng() * 1.5;
          p.threatX = x; p.threatZ = z;
        }
      }
    },
    update(dt, S, t) {
      const cars = [
        ...(ctx.systems.traffic ? ctx.systems.traffic.cars : []),
        ...(ctx.systems.police ? ctx.systems.police.units : []),
        ...(S.player.car ? [S.player.car] : []),
      ];
      for (const p of peds) {
        if (p.down > 0) {
          p.down -= dt;
          if (p.down <= 0) { p.mesh.rotation.x = 0; p.health = 100; }
          continue;
        }
        // Run-over check.
        for (const c of cars) {
          if (Math.abs(c.speed) > 4 && Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 1.7) {
            p.down = 5;
            p.mesh.rotation.x = Math.PI / 2;
            p.mesh.position.y = 0.25;
            if (c.driver === 'player' && ctx.systems.police) ctx.systems.police.crime(1, p.pos.x, p.pos.z);
            break;
          }
        }
        if (p.down > 0) continue;
        p.mesh.position.y = 0;
        let tx, tz, sp;
        if (p.flee > 0) {
          p.flee -= dt;
          const dx = p.pos.x - p.threatX, dz = p.pos.z - p.threatZ;
          const d = Math.hypot(dx, dz) || 1;
          tx = p.pos.x + (dx / d) * 18; tz = p.pos.z + (dz / d) * 18;
          sp = 4.4;
        } else {
          tx = p.target.x; tz = p.target.z; sp = p.speed;
          if (Math.hypot(tx - p.pos.x, tz - p.pos.z) < 1.6) p.target = sidewalkPoint();
        }
        const dx = tx - p.pos.x, dz = tz - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.1) {
          const vx = (dx / d) * sp, vz = (dz / d) * sp;
          p.pos.x += vx * dt; p.pos.z += vz * dt;
          p.mesh.rotation.y = Math.atan2(vx, vz);
          const tmp = { x: p.pos.x, z: p.pos.z };
          W.collide(tmp, 0.4);
          p.pos.x = tmp.x; p.pos.z = tmp.z;
          p.mesh.position.y = Math.abs(Math.sin(t * (p.flee > 0 ? 11 : 7) + p.phase)) * 0.06;
        }
        // Shy away from fast traffic even without a scare event.
        for (const c of cars) {
          if (Math.abs(c.speed) > 12 && Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 5) {
            p.flee = Math.max(p.flee, 1.2);
            p.threatX = c.pos.x; p.threatZ = c.pos.z;
          }
        }
      }
    },
  };
}
