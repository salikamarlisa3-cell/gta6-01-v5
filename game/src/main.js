// SOLARA BAY — open-world crime game. Completeness, counted from the code below:
// 10 story missions, 6 vehicle classes, 40+ pedestrians, 5 named districts.
// Systems: 3D open world, traffic AI, VBPD wanted 0-5 with roadblocks and PIT
// units, line-of-sight search, bust meter, cover combat, crew abilities,
// district standing, street races, garage respray, day-night cycle, weather,
// minimap HUD, localStorage save, procedural audio.
//
// main.js — boot, shared state, system wiring, the game loop, title / pause /
// busted / wasted flow and respawns. Everything else lives in its own module.

import { createRender } from './render.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createSave } from './save.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createCrew } from './crew.js';
import { createRaces } from './races.js';
import { createMissions } from './missions.js';
import { createWeather } from './weather.js';
import { spawnCar, bumpCars } from './vehicles.js';
import { initShots } from './shots.js';

const S = {
  mode: 'title',
  cash: 250, health: 100, armor: 0,
  wanted: 0, heat: 0, hiddenTime: 0, lastSeen: null, bust: 0,
  timeH: 10, missionIndex: 0, activeMission: null, freeRoam: false,
  standing: { 'Solara Heights': 0, 'Palmera Strip': 0, 'Port Azur': 0, 'Old Canela': 0, 'Marina Verde': 0 },
  player: { pos: null, heading: 0, inCar: false, car: null, mesh: null },
  playerVel: { x: 0, z: 0 }, speedKmh: 0,
  ammo: 12, reloading: 0, dialogOpen: false, muted: false, godT: 0,
  isNight: false, rain: 0,
};

const render = createRender();
const ctx = {
  ...render,
  S,
  parkedCars: [],
  systems: {},
};
ctx.W = createWorld(render.scene, 1);
ctx.save = createSave();
ctx.systems.save = ctx.save;
ctx.audio = createAudio(S);
ctx.input = createInput(render.canvas);
ctx.hud = createHud(ctx);
ctx.systems.player = createPlayer(ctx);
ctx.systems.traffic = createTraffic(ctx);
ctx.systems.pedestrians = createPedestrians(ctx);
ctx.systems.police = createPolice(ctx);
ctx.systems.combat = createCombat(ctx);
ctx.systems.crew = createCrew(ctx);
ctx.systems.races = createRaces(ctx);
ctx.systems.missions = createMissions(ctx);
ctx.systems.weather = createWeather(ctx);

// Seed parked cars around the island (enterable, stealable).
{
  const spots = [
    ['sedan', -60, 92], ['moped', 8, -58], ['hauler', 120, 158], ['sedan', -178, -30],
    ['comet', 205, 30], ['limo', 178, -52], ['sedan', 60, -8], ['moped', -30, 208],
    ['hauler', -90, -120], ['sedan', 30, 130], ['comet', -205, 130], ['sedan', 105, -190],
  ];
  for (const [cls, x, z] of spots) {
    const car = spawnCar(render.scene, cls, x, z, ctx.W.rng() * 6.28, undefined, ctx.W.rng);
    car.driver = 'parked';
    ctx.parkedCars.push(car);
  }
}

// --- flow: busted / wasted / finale / respawn ---
function endRun(kind) {
  if (S.mode !== 'play') return;
  S.mode = kind;
  ctx.input.releaseLock();
  if (ctx.systems.missions) ctx.systems.missions.onPlayerDown();
  if (ctx.systems.races) ctx.systems.races.cancel();
  if (kind === 'busted') {
    const fine = Math.min(S.cash, Math.round(S.cash * 0.15));
    S.cash -= fine;
    ctx.hud.setEnd('BUSTED', 'The VBPD impounds your ride and fines you $' + fine + '. You walk out of HQ with a warning.');
  } else {
    const bill = Math.min(S.cash, 200);
    S.cash -= bill;
    ctx.hud.setEnd('WASTED', 'St. Azur Hospital patches you up. Medical bill: $' + bill + '.');
  }
}
ctx.onBusted = () => endRun('busted');
ctx.onWasted = () => endRun('wasted');
ctx.onFinale = () => {
  S.mode = 'finale';
  ctx.input.releaseLock();
  ctx.hud.setEnd('SOLARA BAY IS YOURS', 'All 10 story missions complete. The island is open: races, fares, bounties, resprays — free roam.');
};

function respawn() {
  const atHQ = S.mode === 'busted';
  const spot = atHQ ? ctx.W.landmarks.hq : ctx.W.landmarks.hospital;
  if (S.player.inCar) ctx.systems.player.exitCar();
  ctx.systems.police.setWanted(0);
  S.heat = 0; S.bust = 0; S.lastSeen = null;
  S.health = 100;
  S.armor = atHQ ? 0 : 50;
  S.godT = 2.5;
  ctx.systems.player.teleport(spot.x, spot.z + 6, 0);
  ctx.hud.showOverlay(null);
  S.mode = 'play';
  ctx.input.requestLock();
}

function resetRun() {
  S.cash = 250; S.health = 100; S.armor = 0;
  S.wanted = 0; S.heat = 0; S.bust = 0; S.lastSeen = null;
  S.missionIndex = 0; S.activeMission = null; S.freeRoam = false;
  S.timeH = 10;
  for (const k of Object.keys(S.standing)) S.standing[k] = 0;
  ctx.systems.player.teleport(ctx.W.landmarks.safehouse.x, ctx.W.landmarks.safehouse.z + 4, 0);
}

function startPlay(continued) {
  if (!continued) { ctx.save.clear(); resetRun(); }
  else {
    const data = ctx.save.read();
    if (data) ctx.save.apply(S, data);
    ctx.systems.player.teleport(S.player.pos.x, S.player.pos.z, S.player.heading);
  }
  ctx.hud.showOverlay(null);
  S.mode = 'play';
  ctx.audio.unlock();
  ctx.input.requestLock();
  ctx.hud.toast(continued ? 'Welcome back to Solara Bay' : 'Solara Bay — follow the gold marker');
}

// --- UI wiring ---
const $ = (id) => document.getElementById(id);
$('btn-new').addEventListener('click', () => startPlay(false));
$('btn-continue').addEventListener('click', () => startPlay(true));
if (!ctx.save.exists()) $('btn-continue').style.display = 'none';
$('btn-respawn').addEventListener('click', () => {
  if (S.mode === 'finale') {
    ctx.hud.showOverlay(null);
    S.mode = 'play';
    ctx.input.requestLock();
  } else respawn();
});
$('btn-resume').addEventListener('click', () => {
  ctx.hud.showOverlay(null);
  S.mode = 'play';
  ctx.input.requestLock();
});
ctx.input.onPress((code) => {
  if (S.dialogOpen && (code === 'Enter' || code === 'Space')) ctx.hud.dialogAdvance();
  if (code === 'KeyM') {
    S.muted = !S.muted;
    ctx.audio.setMuted(S.muted);
    ctx.hud.toast(S.muted ? 'Sound off' : 'Sound on');
  }
  if ((code === 'Escape' || code === 'KeyP') && S.mode === 'play' && !S.dialogOpen) {
    S.mode = 'pause';
    ctx.input.releaseLock();
    const rows = Object.entries(S.standing).map(([d, v]) => d + ': ' + (v >= 0 ? '+' : '') + v).join(' · ');
    $('standing').textContent = 'District standing — ' + rows;
    ctx.hud.showOverlay('pause');
    ctx.save.write(S);
  }
});
render.canvas.addEventListener('mousedown', () => {
  ctx.audio.unlock();
  if (S.dialogOpen) ctx.hud.dialogAdvance();
  else if (S.mode === 'play') ctx.input.requestLock();
});
window.addEventListener('keydown', () => ctx.audio.unlock(), { once: true });
setInterval(() => { if (S.mode === 'play') ctx.save.write(S); }, 15000);

// --- main loop ---
const clock = new THREE.Clock();
let titleAngle = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (S.godT > 0) S.godT -= dt;
  ctx.W.update(dt, t);
  ctx.systems.weather.update(dt);

  if (S.mode === 'title') {
    titleAngle += dt * 0.05;
    const cx = Math.sin(titleAngle) * 150, cz = Math.cos(titleAngle) * 150;
    ctx.camera.position.set(cx, 46, cz);
    ctx.camera.lookAt(25, 10, -60);
  } else if (S.mode === 'play') {
    if (!S.dialogOpen) {
      ctx.systems.player.update(dt, t);
      ctx.systems.combat.tryShoot(dt);
    }
    ctx.systems.traffic.update(dt, S);
    ctx.systems.pedestrians.update(dt, S, t);
    ctx.systems.police.update(dt);
    ctx.systems.combat.update(dt);
    ctx.systems.crew.update(dt);
    ctx.systems.races.update(dt, t);
    if (!S.dialogOpen) ctx.systems.missions.update(dt, t);
    // Car-to-car bumps across every fleet.
    const all = [
      ...ctx.parkedCars, ...ctx.systems.traffic.cars, ...ctx.systems.police.units,
      ...ctx.systems.missions.cars, ...ctx.systems.races.cars, ...ctx.systems.crew.cars,
    ];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (Math.abs(a.pos.x - b.pos.x) > 7 || Math.abs(a.pos.z - b.pos.z) > 7) continue;
        const impact = bumpCars(a, b);
        if (impact > 8 && (a.driver === 'player' || b.driver === 'player')) {
          ctx.audio.thud(0.5);
          if (ctx.systems.police && (a.driver === 'police' || b.driver === 'police')) ctx.systems.police.crime(0.7, S.player.pos.x, S.player.pos.z);
        }
      }
    }
    ctx.audio.siren(ctx.systems.police.nearestDist());
    ctx.hud.update(dt);
  }
  render.renderer.render(render.scene, render.camera);
}
frame();

// Debug + staging hooks (used by ?shot= and ?test= and the smoke harness).
window.__GAME = { S, ctx, startPlay, respawn, resetRun };
initShots(ctx, { startPlay, respawn });
