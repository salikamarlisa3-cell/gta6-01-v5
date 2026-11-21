// crew.js — Ren's crew, callable in the field:
//   Rook (Z) — a getaway driver who brings a fresh Comet GT to your position.
//   Sable (X) — a gunner who fights beside you for 30 seconds.
// Both charge a fee and cool down between calls. District standing is tracked
// in state and shifted by missions and activities (see missions.js / races.js).

import { spawnCar, steerToward, damageCar } from './vehicles.js';

export function createCrew(ctx) {
  const { scene, W, S, input } = ctx;
  const cars = [];
  let rookCar = null;
  let sable = null;
  let sableT = 0;
  let fireAcc = 0;
  const cd = { rook: 0, sable: 0 };
  const tracers = [];

  function buildSable() {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.74, 0.3), new THREE.MeshLambertMaterial({ color: 0x7c2d12 }));
    torso.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), new THREE.MeshLambertMaterial({ color: 0x8d5524 }));
    head.position.y = 1.68;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.28), new THREE.MeshLambertMaterial({ color: 0x111827 }));
    legs.position.y = 0.35;
    g.add(torso, head, legs);
    return g;
  }

  function tracer(x1, y1, z1, x2, y2, z2) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, life: 0.08 });
  }

  input.onPress((code) => {
    if (S.mode !== 'play') return;
    if (code === 'KeyZ') api.callRook();
    if (code === 'KeyX') api.callSable();
  });

  const api = {
    cars,
    cd,
    callRook() {
      if (cd.rook > 0) { ctx.hud.toast('Rook is cooling down (' + Math.ceil(cd.rook) + 's)'); return false; }
      if (S.cash < 120) { ctx.hud.toast('Rook charges $120 — not enough cash'); return false; }
      S.cash -= 120;
      cd.rook = 45;
      const road = W.nearestRoad(S.player.pos.x, S.player.pos.z);
      const x = Math.abs(S.player.pos.x - road.x) < Math.abs(S.player.pos.z - road.z) ? road.x : S.player.pos.x + 18;
      const z = Math.abs(S.player.pos.x - road.x) < Math.abs(S.player.pos.z - road.z) ? S.player.pos.z + 18 : road.z;
      rookCar = spawnCar(scene, 'comet', x, z, 0, 0x2b6fd2, W.rng);
      rookCar.driver = 'crew';
      cars.length = 0;
      cars.push(rookCar);
      ctx.hud.toast('Rook is bringing a Comet GT — $120');
      if (ctx.audio) ctx.audio.cash();
      return true;
    },
    callSable() {
      if (cd.sable > 0) { ctx.hud.toast('Sable is cooling down (' + Math.ceil(cd.sable) + 's)'); return false; }
      if (S.cash < 200) { ctx.hud.toast('Sable charges $200 — not enough cash'); return false; }
      S.cash -= 200;
      cd.sable = 60;
      sableT = 30;
      if (!sable) {
        sable = { mesh: buildSable(), health: 100, down: 0 };
        sable.pos = sable.mesh.position;
        scene.add(sable.mesh);
      }
      sable.mesh.visible = true;
      sable.pos.set(S.player.pos.x + 2, 0, S.player.pos.z + 1);
      ctx.hud.toast('Sable has your back for 30s — $200');
      if (ctx.audio) ctx.audio.cash();
      return true;
    },
    update(dt) {
      cd.rook = Math.max(0, cd.rook - dt);
      cd.sable = Math.max(0, cd.sable - dt);
      // Rook drives his delivery to the player, then parks it.
      if (rookCar && rookCar.driver === 'crew') {
        const d = steerToward(rookCar, S.player.pos.x, S.player.pos.z, dt, W, { arrive: 6 });
        if (d < 7) {
          rookCar.driver = 'parked';
          if (!ctx.parkedCars.includes(rookCar)) ctx.parkedCars.push(rookCar);
          cars.length = 0;
        }
      }
      // Sable follows and engages the nearest hostile.
      if (sable && sableT > 0) {
        sableT -= dt;
        if (sableT <= 0) { sable.mesh.visible = false; }
        else {
          const p = S.player.pos;
          const d = Math.hypot(sable.pos.x - p.x, sable.pos.z - p.z);
          if (d > 3) {
            const vx = (p.x - sable.pos.x) / d, vz = (p.z - sable.pos.z) / d;
            sable.pos.x += vx * 5.2 * dt;
            sable.pos.z += vz * 5.2 * dt;
            sable.mesh.rotation.y = Math.atan2(vx, vz);
            const tmp = { x: sable.pos.x, z: sable.pos.z };
            W.collide(tmp, 0.4);
            sable.pos.x = tmp.x; sable.pos.z = tmp.z;
          }
          fireAcc += dt;
          if (fireAcc > 0.6 && ctx.systems.police) {
            fireAcc = 0;
            let best = null, bd = 46;
            for (const u of ctx.systems.police.units) {
              const dd = Math.hypot(u.pos.x - sable.pos.x, u.pos.z - sable.pos.z);
              if (dd < bd && !W.losBlocked(sable.pos.x, sable.pos.z, u.pos.x, u.pos.z)) { bd = dd; best = u; }
            }
            if (best) {
              tracer(sable.pos.x, 1.4, sable.pos.z, best.pos.x, 0.8, best.pos.z);
              damageCar(best, 7);
              if (ctx.audio) ctx.audio.gunshot(0.2);
              sable.mesh.rotation.y = Math.atan2(best.pos.x - sable.pos.x, best.pos.z - sable.pos.z);
            }
          }
        }
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
    },
  };
  return api;
}
