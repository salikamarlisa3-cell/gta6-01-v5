// weather.js — the day-night cycle and the weather: sun orbit, sky and fog
// colour grading, street lamps and lit windows after dark, the lighthouse beam,
// the player's headlights, and short tropical rain bursts that thicken the fog.

import { clamp, lerp } from './util.js';

const DAY_SKY = new THREE.Color(0x87b5d9);
const DUSK_SKY = new THREE.Color(0xf2a65e);
const NIGHT_SKY = new THREE.Color(0x0d1526);

export function createWeather(ctx) {
  const { scene, S, W } = ctx;
  const sun = ctx.sun, hemi = ctx.hemi, amb = ctx.amb;
  let rain = 0;            // 0 clear .. 1 downpour
  let rainTarget = 0;
  let clearTimer = 120 + Math.random() * 120;
  let rainTimer = 0;
  let forced = null;       // shots can pin the weather

  // Rain: a cylinder of falling streaks around the camera.
  const DROP_N = 850;
  const dropPos = new Float32Array(DROP_N * 3);
  for (let i = 0; i < DROP_N; i++) {
    dropPos[i * 3] = (Math.random() - 0.5) * 90;
    dropPos[i * 3 + 1] = Math.random() * 42;
    dropPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const drops = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0xa8c8e8, size: 0.32, transparent: true, opacity: 0 }));
  scene.add(drops);

  // Player headlight.
  const headlight = new THREE.SpotLight(0xffe9b8, 0, 42, 0.5, 0.5, 1.2);
  scene.add(headlight);
  scene.add(headlight.target);

  const sky = new THREE.Color();

  const api = {
    get raining() { return rain > 0.25; },
    setTime(h) { S.timeH = h; },
    force(h, rainOn) { forced = { h, rainOn }; if (h !== null) S.timeH = h; rainTarget = rainOn ? 1 : 0; },
    clearForce() { forced = null; },
    update(dt) {
      if (!forced) {
        S.timeH += dt * (24 / 1440); // one game day = 24 real minutes
        if (S.timeH >= 24) S.timeH -= 24;
        // Weather machine: long clear spells, short sharp rain.
        if (rainTarget === 0) {
          clearTimer -= dt;
          if (clearTimer <= 0) { rainTarget = 1; rainTimer = 26 + Math.random() * 22; }
        } else {
          rainTimer -= dt;
          if (rainTimer <= 0) { rainTarget = 0; clearTimer = 150 + Math.random() * 140; }
        }
      }
      rain = clamp(rain + (rainTarget - rain) * dt * 0.5, 0, 1);

      const h = S.timeH;
      const sunA = ((h - 6) / 12) * Math.PI; // sunrise 06:00, sunset 18:00
      const elev = Math.sin(sunA);
      const dayF = clamp(elev * 2.2, 0, 1);
      const duskF = clamp(1 - Math.abs(elev) * 2.6, 0, 1) * (h > 4 && h < 20 ? 1 : 0);
      sky.copy(NIGHT_SKY).lerp(DAY_SKY, dayF).lerp(DUSK_SKY, duskF * 0.55);
      if (rain > 0) sky.lerp(new THREE.Color(0x5a6a7a), rain * 0.45);
      scene.background.copy(sky);
      scene.fog.color.copy(sky);
      scene.fog.near = lerp(190, 90, rain);
      scene.fog.far = lerp(620, 300, rain);
      sun.position.set(Math.cos(sunA) * 160, Math.max(elev, -0.3) * 180 + 12, 60);
      sun.intensity = lerp(0.06, 1.65, dayF) * (1 - rain * 0.55);
      sun.color.setHex(duskF > 0.45 ? 0xffb37a : 0xfff2d8);
      hemi.intensity = lerp(0.16, 0.75, dayF);
      amb.intensity = lerp(0.5, 0.35, dayF);
      const night = 1 - dayF;
      if (W.lampMat) W.lampMat.emissiveIntensity = night * 0.55;
      if (W.windowMats) for (const m of W.windowMats) m.emissiveIntensity = night * 0.85;
      if (W.lighthouseBeam) W.lighthouseBeam.material.opacity = night * 0.3;
      // Headlights on the player's car after dark.
      const car = S.player.car;
      if (car && night > 0.25) {
        headlight.intensity = 2.6;
        headlight.position.set(car.pos.x + Math.sin(car.heading) * 2, 1.1, car.pos.z + Math.cos(car.heading) * 2);
        headlight.target.position.set(car.pos.x + Math.sin(car.heading) * 22, 0, car.pos.z + Math.cos(car.heading) * 22);
      } else headlight.intensity = 0;
      // Rain around the camera.
      drops.material.opacity = rain * 0.75;
      if (rain > 0.02) {
        const cam = ctx.camera.position;
        drops.position.set(cam.x, 0, cam.z);
        const arr = dropGeo.attributes.position.array;
        for (let i = 0; i < DROP_N; i++) {
          arr[i * 3 + 1] -= dt * 34;
          if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 42;
        }
        dropGeo.attributes.position.needsUpdate = true;
      }
      S.isNight = night > 0.5;
      S.rain = rain;
    },
  };
  return api;
}
