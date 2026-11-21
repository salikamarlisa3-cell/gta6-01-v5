// traffic.js — ambient traffic AI: cars follow the road grid in right-hand lanes,
// pick a new leg at each intersection, brake for the car ahead and stop at
// nothing else. The fleet respawns at the city edge so the streets stay alive.

import { ROAD_LINES, ROAD_W } from './world.js';
import { spawnCar, stepCar, CLASS_KEYS } from './vehicles.js';
import { clamp } from './util.js';

const LANE = ROAD_W / 2 - 3.4; // lane offset from road centre
const TRAFFIC_CLASSES = ['comet', 'sedan', 'sedan', 'hauler', 'moped', 'limo'];

export function createTraffic(ctx) {
  const { scene, W } = ctx;
  const rng = W.rng;
  const cars = [];
  const TARGET = 13;

  function lanePoint(nodeX, nodeZ, dx, dz) {
    // Waypoint at an intersection, offset into the correct lane for travel dir.
    if (dx !== 0) return { x: nodeX, z: nodeZ + (dx > 0 ? LANE : -LANE) };
    return { x: nodeX + (dz > 0 ? -LANE : LANE), z: nodeZ };
  }

  function pickNext(car) {
    // Choose the next intersection from the one we are heading to.
    const { nodeX, nodeZ, dx, dz } = car.route;
    const options = [];
    for (const [ndx, ndz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ndx === -dx && ndz === -dz && rng() > 0.12) continue; // rarely U-turn
      const nx = nodeX + ndx * 50, nz = nodeZ + ndz * 50;
      if (nx < -200 || nx > 200 || nz < -200 || nz > 200) continue;
      options.push([nx, nz, ndx, ndz]);
    }
    if (!options.length) options.push([nodeX - dx * 50, nodeZ - dz * 50, -dx, -dz]);
    const [nx, nz, ndx, ndz] = options[Math.floor(rng() * options.length)];
    car.route = { nodeX: nx, nodeZ: nz, dx: ndx, dz: ndz, wp: lanePoint(nx, nz, ndx, ndz) };
  }

  function spawnOne(nearX, nearZ) {
    const ix = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const iz = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    if (Math.hypot(ix - nearX, iz - nearZ) < 65) return null;
    const dx = rng() < 0.5 ? (rng() < 0.5 ? 1 : -1) : 0;
    const dz = dx === 0 ? (rng() < 0.5 ? 1 : -1) : 0;
    const start = lanePoint(ix, iz, dx, dz);
    const cls = TRAFFIC_CLASSES[Math.floor(rng() * TRAFFIC_CLASSES.length)];
    const car = spawnCar(scene, cls, start.x, start.z, Math.atan2(dx, dz), undefined, rng);
    car.driver = 'traffic';
    car.route = { nodeX: ix, nodeZ: iz, dx, dz, wp: null };
    pickNext(car);
    // Start at the previous node so the first leg is full length.
    car.pos.x = car.route.wp.x - dx * 46;
    car.pos.z = car.route.wp.z - dz * 46;
    if (dx !== 0) car.pos.z = iz + (dx > 0 ? LANE : -LANE);
    else car.pos.x = ix + (dz > 0 ? -LANE : LANE);
    car.speed = 6 + rng() * 4;
    cars.push(car);
    return car;
  }

  return {
    cars,
    update(dt, S) {
      const px = S.player.pos.x, pz = S.player.pos.z;
      for (let i = cars.length - 1; i >= 0; i--) {
        const car = cars[i];
        if (car.driver !== 'traffic') { cars.splice(i, 1); continue; }
        if (Math.hypot(car.pos.x - px, car.pos.z - pz) > 210) {
          scene.remove(car.mesh);
          cars.splice(i, 1);
          continue;
        }
        const wp = car.route.wp;
        const dx = wp.x - car.pos.x, dz = wp.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 7) pickNext(car);
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        // Brake for anything ahead in our lane.
        let throttle = 0.85;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const all = [...cars, ...(S.player.car ? [S.player.car] : []), ...ctx.systems.police.units];
        for (const o of all) {
          if (o === car) continue;
          const ox = o.pos.x - car.pos.x, oz = o.pos.z - car.pos.z;
          const ahead = ox * fx + oz * fz;
          const side = Math.abs(ox * fz - oz * fx);
          if (ahead > 0 && ahead < 10 && side < 2.4) { throttle = ahead < 5 ? -1 : 0; break; }
        }
        const steer = clamp(diff * 1.8, -1, 1);
        const cruise = car.spec.top * 0.55;
        if (car.speed > cruise) throttle = Math.min(throttle, 0);
        stepCar(car, throttle, steer, dt, W);
      }
      if (cars.length < TARGET) spawnOne(px, pz);
    },
  };
}
