// vehicles.js — six vehicle classes with distinct handling, low-poly car meshes
// built from boxes, and the shared arcade driving step (acceleration, steering,
// building collision, car-to-car bumps, damage) used by player, traffic and police.

import { clamp, angleLerp } from './util.js';

export const CLASSES = {
  comet: { name: 'Comet GT', top: 46, accel: 22, grip: 3.4, len: 4.2, wid: 1.9, h: 0.62, colors: [0xd23b3b, 0x2b6fd2, 0xf2b134, 0x37b24d] },
  sedan: { name: 'Duchess Sedan', top: 34, accel: 15, grip: 3.0, len: 4.5, wid: 1.95, h: 0.72, colors: [0xb8bcc2, 0x5a6b7d, 0x7d5a5a, 0x445544] },
  hauler: { name: 'Hauler Pickup', top: 30, accel: 13, grip: 2.6, len: 5.2, wid: 2.1, h: 0.95, colors: [0xc96f2e, 0x707880, 0x4d6b8a, 0x8a4d6b] },
  moped: { name: 'Zip Moped', top: 22, accel: 14, grip: 4.2, len: 2.1, wid: 0.8, h: 0.5, colors: [0xe8e3d8, 0xd23b8a, 0x3bd2c8, 0xf2e134] },
  limo: { name: 'Regal Limo', top: 33, accel: 12, grip: 2.4, len: 6.4, wid: 2.0, h: 0.78, colors: [0x22242a, 0x3a2e4a, 0x54382e] },
  interceptor: { name: 'VBPD Interceptor', top: 44, accel: 21, grip: 3.3, len: 4.5, wid: 1.95, h: 0.7, colors: [0xf0f0f2] },
};

export const CLASS_KEYS = Object.keys(CLASSES);

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2a3a });
const lightMatF = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
const lightMatR = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

export function buildCarMesh(clsKey, color) {
  const c = CLASSES[clsKey];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(c.wid, c.h, c.len), bodyMat);
  body.position.y = 0.36 + c.h / 2;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(c.wid * 0.82, c.h * 0.72, c.len * 0.44), glassMat);
  cabin.position.set(0, 0.36 + c.h + c.h * 0.32, c.len * 0.04);
  g.add(cabin);
  const wheelPos = [
    [-c.wid / 2, -c.len / 2 + 0.8], [c.wid / 2, -c.len / 2 + 0.8],
    [-c.wid / 2, c.len / 2 - 0.8], [c.wid / 2, c.len / 2 - 0.8],
  ];
  const wheels = [];
  for (const [wx, wz] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(c.wid * 0.7, 0.14, 0.06), lightMatF);
  hl.position.set(0, 0.62, c.len / 2 + 0.02);
  g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(c.wid * 0.7, 0.12, 0.06), lightMatR);
  tl.position.set(0, 0.66, -c.len / 2 - 0.02);
  g.add(tl);
  if (clsKey === 'interceptor') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar.position.set(0, 0.36 + c.h + c.h * 0.72 + 0.1, c.len * 0.04);
    bar.name = 'lightbar';
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(c.wid + 0.02, 0.3, c.len * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x1c2a3a }));
    stripe.position.y = 0.52;
    g.add(stripe);
  }
  g.userData.wheels = wheels;
  g.userData.bodyMat = bodyMat;
  return g;
}

let carSeq = 0;
export function spawnCar(scene, clsKey, x, z, heading, color, rng) {
  const c = CLASSES[clsKey];
  const col = color ?? c.colors[Math.floor((rng ? rng() : Math.random()) * c.colors.length)];
  const mesh = buildCarMesh(clsKey, col);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    id: ++carSeq,
    cls: clsKey,
    spec: c,
    mesh,
    pos: mesh.position,
    heading,
    speed: 0,
    health: 100,
    color: col,
    driver: 'parked', // parked | traffic | police | player | crew | target
    dead: false,
    flatTire: 0,
    steerVis: 0,
  };
}

export function setCarColor(car, color) {
  car.color = color;
  car.mesh.userData.bodyMat.color.setHex(color);
}

// Arcade step: throttle -1..1, steer -1..1. Mutates car; resolves world collision.
export function stepCar(car, throttle, steer, dt, W) {
  const c = car.spec;
  const flatMul = car.flatTire > 0 ? 0.55 : 1;
  const top = c.top * flatMul * (0.45 + 0.55 * (car.health / 100));
  if (throttle > 0) car.speed += c.accel * throttle * dt * (1 - Math.max(0, car.speed) / (top + 8));
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= 34 * dt; // brake
    else car.speed = Math.max(car.speed + c.accel * 0.6 * throttle * dt, -12); // reverse
  } else {
    car.speed -= car.speed * 0.7 * dt; // drag
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  car.speed = clamp(car.speed, -12, top);
  const steerAuthority = clamp(Math.abs(car.speed) / 6, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.heading += steer * c.grip * 0.42 * steerAuthority * dt * (1 - Math.abs(car.speed) / (top * 2.4));
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  // Building collision: circle at centre + nose/tail probes.
  const p = { x: car.pos.x, z: car.pos.z };
  const before = { x: p.x, z: p.z };
  W.collide(p, c.wid * 0.72);
  if (p.x !== before.x || p.z !== before.z) {
    const impact = Math.abs(car.speed);
    if (impact > 9) damageCar(car, (impact - 8) * 1.6);
    car.speed *= 0.35;
    car.pos.x = p.x; car.pos.z = p.z;
  }
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  car.steerVis = steer;
  const spin = car.speed * dt / 0.36;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  if (car.flatTire > 0) car.flatTire -= dt;
}

export function damageCar(car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.mesh.userData.bodyMat.color.setHex(0x2a2a2e);
  }
}

// Circle-vs-circle bump between two cars; returns impact speed.
export function bumpCars(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const minD = (a.spec.wid + b.spec.wid) * 0.85;
  const d2 = dx * dx + dz * dz;
  if (d2 >= minD * minD || d2 === 0) return 0;
  const d = Math.sqrt(d2);
  const push = (minD - d) / 2;
  const nx = dx / d, nz = dz / d;
  a.pos.x -= nx * push; a.pos.z -= nz * push;
  b.pos.x += nx * push; b.pos.z += nz * push;
  const rel = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
  if (rel > 6) {
    damageCar(a, rel * 0.7);
    damageCar(b, rel * 0.7);
    const s = (a.speed + b.speed) / 2;
    a.speed = s * 0.8; b.speed = s * 0.8;
    return rel;
  }
  return 0;
}

// Drive a car toward a world point with simple pursuit steering.
export function steerToward(car, tx, tz, dt, W, opts = {}) {
  const dx = tx - car.pos.x, dz = tz - car.pos.z;
  const dist = Math.hypot(dx, dz);
  const targetAngle = Math.atan2(dx, dz);
  let diff = targetAngle - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 1.6, -1, 1);
  const arrive = opts.arrive ?? 4;
  let throttle = dist > arrive ? 1 : 0;
  if (Math.abs(diff) > 2.4 && dist < 14) throttle = -0.7; // reverse out of a bad angle
  stepCar(car, throttle, steer, dt, W);
  return dist;
}
