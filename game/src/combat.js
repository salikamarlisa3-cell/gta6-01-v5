// combat.js — hitscan pistol with tracers and muzzle flash, fist fighting as a
// fallback, return fire from hostile NPCs, and player health/armour damage.

import { damageCar } from './vehicles.js';

export function createCombat(ctx) {
  const { scene, W, S } = ctx;
  const tracers = [];
  const flash = new THREE.PointLight(0xffc46b, 0, 18);
  scene.add(flash);
  let fireCd = 0;
  let hostileAcc = 0;

  function addTracer(x1, y1, z1, x2, y2, z2, color = 0xffe9a0) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    scene.add(line);
    tracers.push({ line, life: 0.08 });
  }

  function targets() {
    const list = [];
    if (ctx.systems.pedestrians) {
      for (const p of ctx.systems.pedestrians.peds) if (p.down <= 0) list.push({ kind: 'ped', ref: p, x: p.pos.x, y: 1.05, z: p.pos.z, r: 0.95 });
    }
    if (ctx.systems.police) {
      for (const c of ctx.systems.police.footCops) if (c.down <= 0) list.push({ kind: 'cop', ref: c, x: c.pos.x, y: 1.05, z: c.pos.z, r: 0.95 });
      for (const u of ctx.systems.police.units) list.push({ kind: 'car', ref: u, x: u.pos.x, y: 0.8, z: u.pos.z, r: 2.6 });
    }
    if (ctx.systems.traffic) {
      for (const c of ctx.systems.traffic.cars) list.push({ kind: 'car', ref: c, x: c.pos.x, y: 0.8, z: c.pos.z, r: 2.6 });
    }
    if (ctx.systems.missions) {
      for (const t of ctx.systems.missions.liveTargets()) list.push(t);
    }
    return list;
  }

  const api = {
    tracers,
    damagePlayer(amount) {
      if (S.mode !== 'play' || S.godT > 0) return;
      const absorbed = Math.min(S.armor, amount * 0.55);
      S.armor -= absorbed;
      S.health -= (amount - absorbed);
      if (ctx.hud) ctx.hud.damageFlash();
      if (S.health <= 0) {
        S.health = 0;
        ctx.onWasted();
      }
    },
    // One hostile NPC shot cycle; call every frame per shooter with dt.
    hostileFire(fromPos, dt) {
      hostileAcc += dt;
      if (hostileAcc < 0.55) return;
      hostileAcc = 0;
      const p = S.player.pos;
      const d = Math.hypot(fromPos.x - p.x, fromPos.z - p.z);
      addTracer(fromPos.x, 1.45, fromPos.z, p.x + (Math.random() - 0.5) * 2, 1.1, p.z + (Math.random() - 0.5) * 2, 0xff9d5c);
      if (ctx.audio) ctx.audio.gunshot(0.25);
      const hitChance = Math.max(0.1, 0.55 - d * 0.011) * (S.player.car ? 0.8 : 1);
      if (Math.random() < hitChance) api.damagePlayer(5 + Math.random() * 6);
    },
    melee() {
      const p = S.player;
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      for (const t of targets()) {
        const dx = t.x - p.pos.x, dz = t.z - p.pos.z;
        if (Math.hypot(dx, dz) < 2.3 && dx * fx + dz * fz > 0) {
          api.hitTarget(t, 60, p.pos);
          return true;
        }
      }
      return false;
    },
    hitTarget(t, dmg, fromPos) {
      if (t.kind === 'car') {
        damageCar(t.ref, dmg * 0.14);
        return;
      }
      t.ref.health -= dmg;
      if (t.ref.health <= 0 && t.ref.down <= 0) {
        t.ref.down = 6;
        t.ref.mesh.rotation.x = Math.PI / 2;
        t.ref.mesh.position.y = 0.25;
        if (ctx.systems.police) ctx.systems.police.crime(t.kind === 'cop' ? 1.2 : 0.8, t.x, t.z);
        if (ctx.systems.pedestrians) ctx.systems.pedestrians.startle(t.x, t.z, 15);
      }
    },
    tryShoot(dt) {
      fireCd -= dt;
      if (S.reloading > 0) { S.reloading -= dt; if (S.reloading <= 0) S.ammo = 12; return; }
      if (!ctx.input.mouseDown || fireCd > 0 || S.player.car) return;
      if (S.ammo <= 0) { S.reloading = 1.1; return; }
      fireCd = 0.17;
      S.ammo -= 1;
      const cam = ctx.camera;
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const p = S.player.pos;
      const ox = p.x, oy = 1.5, oz = p.z;
      // Find the closest target the camera ray passes near.
      let best = null, bestT = 75;
      for (const t of targets()) {
        const vx = t.x - ox, vy = t.y - oy, vz = t.z - oz;
        const along = vx * dir.x + vy * dir.y + vz * dir.z;
        if (along < 1 || along > bestT) continue;
        const px = ox + dir.x * along, py = oy + dir.y * along, pz = oz + dir.z * along;
        const miss = Math.hypot(t.x - px, t.y - py, t.z - pz);
        if (miss < t.r) { best = t; bestT = along; }
      }
      const endX = ox + dir.x * bestT, endY = oy + dir.y * bestT, endZ = oz + dir.z * bestT;
      if (best && W.losBlocked(ox, oz, best.x, best.z)) best = null;
      addTracer(ox + dir.x * 1.2, oy, oz + dir.z * 1.2, endX, endY, endZ);
      flash.position.set(ox + dir.x * 1.4, oy + 0.1, oz + dir.z * 1.4);
      flash.intensity = 2.4;
      if (ctx.audio) ctx.audio.gunshot(0.5);
      if (ctx.systems.pedestrians) ctx.systems.pedestrians.startle(p.x, p.z, 16);
      if (ctx.systems.police) ctx.systems.police.crime(0.55, p.x, p.z);
      if (best) api.hitTarget(best, 55, p);
    },
    update(dt) {
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
      flash.intensity = Math.max(0, flash.intensity - dt * 22);
    },
  };
  return api;
}
