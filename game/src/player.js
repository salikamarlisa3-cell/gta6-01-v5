// player.js — the protagonist "Ren": third-person walking and running, mouse-orbit
// camera, entering and stealing cars (parked, traffic or police — all theft the
// VBPD can punish), arcade driving input, and garage respray visits that repair
// the car, change its colour and shake off the wanted level.

import { stepCar, setCarColor } from './vehicles.js';
import { clamp, angleLerp } from './util.js';

export function createPlayer(ctx) {
  const { scene, W, S, input } = ctx;

  const mesh = new THREE.Group();
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.74, 0.3), new THREE.MeshLambertMaterial({ color: 0x0f766e }));
  jacket.position.y = 1.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), new THREE.MeshLambertMaterial({ color: 0xc68642 }));
  head.position.y = 1.68;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.28), new THREE.MeshLambertMaterial({ color: 0x23272e }));
  legs.position.y = 0.35;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0xb91c1c }));
  cap.position.y = 1.86;
  mesh.add(jacket, head, legs, cap);
  scene.add(mesh);

  S.player.mesh = mesh;
  S.player.pos = mesh.position;
  mesh.position.set(W.landmarks.safehouse.x, 0, W.landmarks.safehouse.z + 4);

  let camYaw = 0, camPitch = 0.32, vy = 0, grounded = true;
  const RESPRAY_COLORS = [0xd23b3b, 0x2b6fd2, 0x37b24d, 0xf2b134, 0x8b5cf6, 0x111318, 0xf5f5f5, 0xff7b1c];

  function allCars() {
    const list = [...ctx.parkedCars];
    if (ctx.systems.traffic) list.push(...ctx.systems.traffic.cars);
    if (ctx.systems.police) list.push(...ctx.systems.police.units);
    if (ctx.systems.crew) list.push(...ctx.systems.crew.cars);
    if (ctx.systems.missions) list.push(...ctx.systems.missions.cars);
    return list;
  }

  function nearGarage() {
    for (const g of W.landmarks.garages) {
      if (Math.hypot(g.x - S.player.pos.x, g.z - S.player.pos.z) < 9) return g;
    }
    return null;
  }

  function enterCar(car) {
    S.player.car = car;
    S.player.inCar = true;
    car.driver = 'player';
    mesh.visible = false;
    if (ctx.audio) ctx.audio.engineStart();
  }

  function exitCar() {
    const car = S.player.car;
    if (!car) return;
    car.driver = 'parked';
    if (!ctx.parkedCars.includes(car)) ctx.parkedCars.push(car);
    const side = { x: car.pos.x + Math.cos(car.heading) * 2.2, z: car.pos.z - Math.sin(car.heading) * 2.2 };
    W.collide(side, 0.45);
    mesh.position.set(side.x, 0, side.z);
    S.player.car = null;
    S.player.inCar = false;
    mesh.visible = true;
  }

  // The E key: context interaction — respray at a garage, exit a car, or
  // enter/steal the nearest car. Exposed so the self-test drives the real path.
  function interact() {
    if (S.player.inCar) {
      const g = nearGarage();
      if (g) { respray(g); return; }
      exitCar();
      return;
    }
    let best = null, bd = 4.4;
    for (const car of allCars()) {
      if (car.dead) continue;
      const d = Math.hypot(car.pos.x - S.player.pos.x, car.pos.z - S.player.pos.z);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      const wasDriver = best.driver;
      if (ctx.parkedCars.includes(best)) ctx.parkedCars.splice(ctx.parkedCars.indexOf(best), 1);
      enterCar(best);
      if (wasDriver === 'traffic' && ctx.systems.police) ctx.systems.police.crime(1.1, best.pos.x, best.pos.z);
      if (wasDriver === 'police' && ctx.systems.police) ctx.systems.police.crime(1.6, best.pos.x, best.pos.z);
      if (ctx.systems.missions) ctx.systems.missions.onEnterCar(best);
    }
  }

  input.onPress((code) => {
    if (S.mode !== 'play') return;
    if (code === 'KeyE') interact();
    if (code === 'KeyF' && !S.player.inCar && ctx.systems.combat) ctx.systems.combat.melee();
    if (code === 'KeyR' && S.ammo < 12 && S.reloading <= 0) S.reloading = 1.1;
  });

  function respray(g) {
    const car = S.player.car;
    const district = W.districtAt(g.x, g.z);
    const discount = Math.max(0, (S.standing[district] || 0)) * 0.5;
    const cost = Math.max(40, Math.round(150 - discount));
    if (S.cash < cost) { ctx.hud.toast('Respray costs ' + cost + ' — not enough cash'); return; }
    S.cash -= cost;
    car.health = 100;
    car.dead = false;
    setCarColor(car, RESPRAY_COLORS[Math.floor(Math.random() * RESPRAY_COLORS.length)]);
    if (ctx.systems.police) { ctx.systems.police.setWanted(0); S.heat = 0; S.lastSeen = null; }
    ctx.hud.toast('Resprayed & repaired for $' + cost + ' — VBPD lost your trail');
    if (ctx.audio) ctx.audio.cash();
  }

  const api = {
    mesh,
    enterCar,
    exitCar,
    interact,
    allCars,
    setCamera(yaw, pitch) { camYaw = yaw; camPitch = pitch; },
    teleport(x, z, heading = 0) {
      if (S.player.inCar) exitCar();
      mesh.position.set(x, 0, z);
      S.player.heading = heading;
      mesh.rotation.y = heading;
    },
    update(dt, t) {
      const p = S.player;
      const md = input.consumeMouse();
      if (S.mode === 'play') {
        camYaw -= md.dx * 0.0032;
        camPitch = clamp(camPitch + md.dy * 0.0026, 0.06, 1.15);
      }
      if (p.inCar && p.car) {
        const car = p.car;
        const axis = input.axis();
        const throttle = -axis.y;
        const steer = axis.x;
        if (input.down('Space')) car.speed -= car.speed * 3.2 * dt;
        stepCar(car, throttle, steer, dt, W);
        p.pos.copy(car.pos);
        p.heading = car.heading;
        S.playerVel.x = Math.sin(car.heading) * car.speed;
        S.playerVel.z = Math.cos(car.heading) * car.speed;
        S.speedKmh = Math.abs(car.speed) * 3.6;
        // Camera chases the car's heading.
        const targetYaw = car.heading + Math.PI;
        camYaw = angleLerp(camYaw, targetYaw, dt * 2.2);
        const dist = 10.5, h = 4.2;
        ctx.camera.position.set(
          car.pos.x + Math.sin(camYaw) * Math.cos(camPitch) * dist,
          h + Math.sin(camPitch) * 4,
          car.pos.z + Math.cos(camYaw) * Math.cos(camPitch) * dist,
        );
        ctx.camera.lookAt(car.pos.x, 1.6, car.pos.z);
        if (ctx.audio) ctx.audio.engine(Math.abs(car.speed) / car.spec.top, true);
      } else {
        const axis = input.axis();
        const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
        const sp = sprint ? 6.1 : 3.3;
        let mx = 0, mz = 0;
        if (axis.x || axis.y) {
          // Camera-relative movement: screen-forward is away from the camera,
          // screen-right is the camera's right vector.
          const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
          const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
          mx = (fx * -axis.y + rx * axis.x) * sp;
          mz = (fz * -axis.y + rz * axis.x) * sp;
          p.heading = Math.atan2(mx, mz);
        }
        if (input.down('Space') && grounded) { vy = 4.6; grounded = false; }
        vy -= 12 * dt;
        mesh.position.y += vy * dt;
        if (mesh.position.y <= 0) { mesh.position.y = 0; vy = 0; grounded = true; }
        const tmp = { x: p.pos.x + mx * dt, z: p.pos.z + mz * dt };
        W.collide(tmp, 0.45);
        S.playerVel.x = (tmp.x - p.pos.x) / Math.max(dt, 0.001);
        S.playerVel.z = (tmp.z - p.pos.z) / Math.max(dt, 0.001);
        p.pos.x = tmp.x; p.pos.z = tmp.z;
        mesh.rotation.y = p.heading;
        S.speedKmh = Math.hypot(S.playerVel.x, S.playerVel.z) * 3.6;
        const moving = Math.abs(mx) + Math.abs(mz) > 0.1;
        mesh.position.y += moving ? Math.abs(Math.sin(t * (sprint ? 11 : 8))) * 0.05 : 0;
        const dist = 7.5;
        ctx.camera.position.set(
          p.pos.x + Math.sin(camYaw) * Math.cos(camPitch) * dist,
          2.2 + Math.sin(camPitch) * 5,
          p.pos.z + Math.cos(camYaw) * Math.cos(camPitch) * dist,
        );
        ctx.camera.lookAt(p.pos.x, 1.6, p.pos.z);
        if (ctx.audio) ctx.audio.engine(0, false);
      }
      // Garage prompt.
      if (p.inCar && nearGarage()) ctx.hud.setPrompt('E — Respray & repair ($150, clears wanted)');
      else if (!p.inCar) {
        let near = false;
        for (const car of allCars()) {
          if (!car.dead && Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z) < 4.4) { near = true; break; }
        }
        ctx.hud.setPrompt(near ? 'E — Enter vehicle' : '');
      } else ctx.hud.setPrompt('');
    },
  };
  return api;
}
