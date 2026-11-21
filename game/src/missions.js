// missions.js — the SOLARA BAY story arc: 10 sequential missions for fixer
// Marisol Vega and friends, run by a small step engine (go-to, steal & deliver,
// chase-and-disable, eliminations, pickups, survival, escape, defence and a
// timed finale run). Gold marker beams show the way; each mission opens with a
// dialogue card, pays out, shifts district standing and saves the game.

import { spawnCar, steerToward } from './vehicles.js';

export const MISSIONS = [
  {
    title: 'First Wheels', giver: 'Marisol Vega', where: { x: -125, z: 92 }, payout: 400,
    dialog: ['Marisol: Ren! Back in Solara Bay and already owing me a favour.', 'Marisol: Lift the red Comet GT parked by Central Garage and bring it to the bay. Quietly.'],
    steps: [
      { t: 'steal', cls: 'comet', x: 52, z: -28, color: 0xd23b3b, label: 'Steal the Comet GT' },
      { t: 'deliver', x: 25, z: 34, label: 'Deliver it to Central Garage' },
    ],
    standing: ['Old Canela', 4],
  },
  {
    title: 'Night Courier', giver: 'Dario Ferreira', where: { x: 25, z: 44 }, payout: 650,
    dialog: ['Dario: Cousin! A package run — three drops, no questions.', 'Dario: Palmera, the docks, then Canela. The Comet stays yours after.'],
    steps: [
      { t: 'pickups', points: [[152, -98], [198, 102], [-52, 148]], label: 'Make the three drops' },
      { t: 'goto', x: 75, z: 140, r: 8, label: 'Return to St. Azur Hospital' },
    ],
    standing: ['Port Azur', 4],
  },
  {
    title: 'Dockside Manners', giver: 'Marisol Vega', where: { x: 100, z: 178 }, payout: 800,
    dialog: ['Marisol: A Hauler driver is skimming my cargo at Port Azur.', 'Marisol: Catch him and persuade his truck to stop. Hard.'],
    steps: [{ t: 'chase', cls: 'hauler', x: 150, z: 200, label: 'Disable the skimming Hauler' }],
    standing: ['Port Azur', 5],
  },
  {
    title: 'The Collector', giver: 'Marisol Vega', where: { x: -125, z: 92 }, payout: 1000,
    dialog: ['Marisol: Three debts in Old Canela. Knock, collect, leave.', 'Marisol: The VBPD patrol there — expect two stars of attention.'],
    steps: [
      { t: 'wanted', n: 2 },
      { t: 'pickups', points: [[-152, -22], [-198, 62], [-102, 128]], label: 'Collect the three debts' },
    ],
    standing: ['Old Canela', 6],
  },
  {
    title: 'Palmera Lights', giver: 'Sable Okafor', where: { x: 175, z: -10 }, payout: 1200,
    dialog: ['Sable: Casino drop tonight. El Faro\'s boys will try to crash it.', 'Sable: Put them down, then meet me at the Strip marker.'],
    steps: [
      { t: 'goto', x: 168, z: -8, r: 7, label: 'Reach the casino service lane' },
      { t: 'kill', targets: [[160, -44], [182, -40]], label: 'Drop El Faro\'s ambushers' },
      { t: 'goto', x: 175, z: 62, r: 8, label: 'Meet Sable on the Strip' },
    ],
    standing: ['Palmera Strip', 6],
  },
  {
    title: 'Harbor Run', giver: 'Foreman Ilya', where: { x: 60, z: 205 }, payout: 1500,
    dialog: ['Ilya: That Hauler carries "machine parts" for the Heights crew.', 'Ilya: The moment you roll, VBPD will care. Three stars. Drive clean.'],
    steps: [
      { t: 'steal', cls: 'hauler', x: 34, z: 212, color: 0xc96f2e, label: 'Take the loaded Hauler', thenWanted: 3 },
      { t: 'deliver', x: 75, z: -152, label: 'Deliver to Solara Heights' },
    ],
    standing: ['Solara Heights', 5],
  },
  {
    title: 'Static', giver: 'Dario Ferreira', where: { x: 25, z: 44 }, payout: 1800,
    dialog: ['Dario: El Faro runs three signal vans flooding my radios with static.', 'Dario: Wreck all three. He cannot coordinate what he cannot hear.'],
    steps: [
      { t: 'chase', cls: 'sedan', x: -60, z: -160, label: 'Wreck signal van 1 of 3' },
      { t: 'chase', cls: 'sedan', x: 130, z: 60, label: 'Wreck signal van 2 of 3' },
      { t: 'chase', cls: 'sedan', x: -160, z: -60, label: 'Wreck signal van 3 of 3' },
    ],
    standing: ['Marina Verde', 5],
  },
  {
    title: 'The Vault Job', giver: 'Marisol Vega', where: { x: 75, z: -104 }, payout: 2500,
    dialog: ['Marisol: Heights Bank, service door, one bag. That is the whole plan.', 'Marisol: Four stars the second you move. Lose them, then come home.'],
    steps: [
      { t: 'goto', x: 75, z: -104, r: 6, label: 'Reach the bank service door' },
      { t: 'escape', n: 4, label: 'Lose the VBPD' },
    ],
    standing: ['Solara Heights', 8],
  },
  {
    title: 'Brothers in Arms', giver: 'Sable Okafor', where: { x: -175, z: 122 }, payout: 3000,
    dialog: ['Sable: El Faro is coming for the Canela depot himself — three cars.', 'Sable: Hold the yard. Nothing of his leaves on wheels.'],
    steps: [{ t: 'defend', x: -175, z: 110, secs: 90, label: 'Hold the Canela yard' }],
    standing: ['Old Canela', 9],
  },
  {
    title: 'Solara Sunset', giver: 'Marisol Vega', where: { x: -125, z: 92 }, payout: 5000,
    dialog: ['Marisol: Last run, Ren. The lighthouse, before sunset — with every VBPD badge in the bay behind you.', 'Marisol: Make it, and Solara Bay is yours.'],
    steps: [{ t: 'timed', x: 190, z: 290, r: 9, secs: 170, wanted: 5, label: 'Reach the lighthouse' }],
    standing: ['Port Azur', 8],
  },
];

export function createMissions(ctx) {
  const { scene, W, S } = ctx;
  const rng = W.rng;
  const cars = [];       // mission-spawned cars (steal targets, chase targets, rivals)
  const targets = [];    // mission target peds
  let active = null;     // { def, stepIdx, step, ents: [], timer }
  let beam = null;

  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc44d, transparent: true, opacity: 0.35, depthWrite: false });
  function setBeam(x, z, color = 0xffc44d) {
    if (!beam) {
      beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 42, 12, 1, true), beamMat);
      scene.add(beam);
    }
    beam.visible = true;
    beam.position.set(x, 21, z);
    beamMat.color.setHex(color);
  }
  function hideBeam() { if (beam) beam.visible = false; }

  function buildTargetPed(x, z) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.74, 0.3), new THREE.MeshLambertMaterial({ color: 0x111827 }));
    torso.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), new THREE.MeshLambertMaterial({ color: 0xe0ac69 }));
    head.position.y = 1.68;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.28), new THREE.MeshLambertMaterial({ color: 0x374151 }));
    legs.position.y = 0.35;
    g.add(torso, head, legs);
    g.position.set(x, 0, z);
    scene.add(g);
    const ped = { mesh: g, pos: g.position, health: 100, down: 0, hostile: true };
    targets.push(ped);
    return ped;
  }

  function cleanupStep() {
    if (!active) return;
    for (const e of active.ents) {
      if (e.mesh) scene.remove(e.mesh);
      const ci = cars.indexOf(e); if (ci >= 0) cars.splice(ci, 1);
      const ti = targets.indexOf(e); if (ti >= 0) targets.splice(ti, 1);
    }
    active.ents = [];
  }

  function beginStep() {
    const step = active.def.steps[active.stepIdx];
    active.step = step;
    active.timer = 0;
    active.ents = [];
    if (step.t === 'wanted') {
      if (ctx.systems.police) ctx.systems.police.setWanted(step.n);
      nextStep();
      return;
    }
    if (step.t === 'steal') {
      const car = spawnCar(scene, step.cls, step.x, step.z, rng() * 6.28, step.color, rng);
      car.driver = 'parked';
      active.car = car;
      cars.push(car);
      active.ents.push(car);
    } else if (step.t === 'chase') {
      const car = spawnCar(scene, step.cls, step.x, step.z, rng() * 6.28, undefined, rng);
      car.driver = 'target';
      car.health = 70;
      active.car = car;
      cars.push(car);
      active.ents.push(car);
    } else if (step.t === 'kill') {
      active.peds = step.targets.map(([x, z]) => buildTargetPed(x, z));
      active.ents.push(...active.peds);
    } else if (step.t === 'escape') {
      if (ctx.systems.police) ctx.systems.police.setWanted(step.n);
    } else if (step.t === 'defend') {
      active.wave = 0;
      active.rivals = [];
    } else if (step.t === 'timed') {
      active.timeLeft = step.secs;
      if (step.wanted && ctx.systems.police) ctx.systems.police.setWanted(step.wanted);
    }
    ctx.hud.setObjective(step.label || active.def.title);
  }

  function nextStep() {
    cleanupStep();
    active.stepIdx += 1;
    if (active.stepIdx >= active.def.steps.length) { completeMission(); return; }
    beginStep();
  }

  function completeMission() {
    const def = active.def;
    S.cash += def.payout;
    if (def.standing) {
      const [d, delta] = def.standing;
      S.standing[d] = Math.max(-100, Math.min(100, (S.standing[d] || 0) + delta));
    }
    ctx.hud.toast('Mission complete: ' + def.title + '  +$' + def.payout);
    if (ctx.audio) ctx.audio.cash();
    active = null;
    S.activeMission = null;
    S.missionIndex += 1;
    ctx.systems.save.write(S);
    hideBeam();
    ctx.hud.setObjective('');
    if (S.missionIndex >= MISSIONS.length) {
      S.freeRoam = true;
      ctx.onFinale();
    }
  }

  function failMission(reason) {
    if (!active) return;
    cleanupStep();
    active = null;
    S.activeMission = null;
    hideBeam();
    ctx.hud.setObjective('');
    ctx.hud.toast('Mission failed — ' + reason + '. Return to the gold marker.');
  }

  const api = {
    cars,
    targets,
    MISSIONS,
    get active() { return active; },
    startMission(idx = S.missionIndex) {
      if (active || idx >= MISSIONS.length) return false;
      const def = MISSIONS[idx];
      active = { def, stepIdx: 0, step: null, ents: [], timer: 0 };
      S.activeMission = active;
      ctx.hud.showDialog([def.giver + ' — ' + def.title, ...def.dialog], () => beginStep());
      return true;
    },
    onEnterCar(car) {
      if (active && active.step && active.step.t === 'steal' && active.car === car) {
        const step = active.step;
        active.ents = active.ents.filter((e) => e !== car); // the car stays in the world
        cars.splice(cars.indexOf(car), 1);
        ctx.parkedCars.includes(car) && ctx.parkedCars.splice(ctx.parkedCars.indexOf(car), 1);
        if (step.thenWanted && ctx.systems.police) ctx.systems.police.setWanted(step.thenWanted);
        nextStep();
      }
    },
    onPlayerDown() { if (active) failMission('you went down'); },
    objectivePos() {
      if (!active) {
        if (S.missionIndex < MISSIONS.length) return MISSIONS[S.missionIndex].where;
        return null;
      }
      const step = active.step;
      if (!step) return active.def.where;
      if (step.t === 'goto' || step.t === 'deliver' || step.t === 'timed') return { x: step.x, z: step.z };
      if (step.t === 'steal' || step.t === 'chase') return active.car ? { x: active.car.pos.x, z: active.car.pos.z } : null;
      if (step.t === 'pickups') return { x: step.points[active.pickIdx || 0][0], z: step.points[active.pickIdx || 0][1] };
      if (step.t === 'kill') { const p = active.peds.find((q) => q.down <= 0); return p ? { x: p.pos.x, z: p.pos.z } : null; }
      if (step.t === 'defend') return { x: step.x, z: step.z };
      return null;
    },
    liveTargets() {
      const out = [];
      for (const p of targets) if (p.down <= 0) out.push({ kind: 'ped', ref: p, x: p.pos.x, y: 1.05, z: p.pos.z, r: 0.95 });
      return out;
    },
    update(dt, t) {
      // Giver marker when idle.
      if (!active) {
        if (S.mode === 'play' && S.missionIndex < MISSIONS.length && !S.dialogOpen) {
          const w = MISSIONS[S.missionIndex].where;
          setBeam(w.x, w.z, 0xffc44d);
          if (Math.hypot(S.player.pos.x - w.x, S.player.pos.z - w.z) < 3.2) api.startMission();
        } else if (!active) hideBeam();
        return;
      }
      const step = active.step;
      if (!step || S.dialogOpen) return;
      const obj = api.objectivePos();
      if (obj) setBeam(obj.x, obj.z, step.t === 'deliver' || step.t === 'timed' ? 0x37b24d : 0xffc44d);
      const p = S.player.pos;
      active.timer += dt;
      if (step.t === 'goto') {
        if (Math.hypot(p.x - step.x, p.z - step.z) < (step.r || 6)) nextStep();
      } else if (step.t === 'deliver') {
        const car = S.player.car;
        if (car && Math.hypot(car.pos.x - step.x, car.pos.z - step.z) < 9) nextStep();
      } else if (step.t === 'chase') {
        const car = active.car;
        // Flee from the player along the road grid.
        const away = { x: car.pos.x + (car.pos.x - p.x), z: car.pos.z + (car.pos.z - p.z) };
        const road = W.nearestRoad(away.x, away.z);
        steerToward(car, road.x, road.z, dt, W, { arrive: 2 });
        if (car.dead || car.health <= 20) {
          car.dead = true;
          car.driver = 'parked';
          nextStep();
        }
      } else if (step.t === 'kill') {
        let alive = 0;
        for (const ped of active.peds) {
          if (ped.down > 0) continue;
          alive++;
          const d = Math.hypot(ped.pos.x - p.x, ped.pos.z - p.z);
          if (d < 36 && ctx.systems.combat && !W.losBlocked(ped.pos.x, ped.pos.z, p.x, p.z)) {
            ped.mesh.lookAt(p.x, 0, p.z);
            ctx.systems.combat.hostileFire(ped.pos, dt);
          }
        }
        if (alive === 0) nextStep();
      } else if (step.t === 'pickups') {
        const idx = active.pickIdx || 0;
        const [x, z] = step.points[idx];
        ctx.hud.setObjective(step.label + ' (' + (idx + 1) + '/' + step.points.length + ')');
        if (Math.hypot(p.x - x, p.z - z) < 7) {
          if (ctx.audio) ctx.audio.blip();
          if (idx + 1 >= step.points.length) nextStep();
          else active.pickIdx = idx + 1;
        }
      } else if (step.t === 'escape') {
        ctx.hud.setObjective(step.label + ' — stay out of sight');
        if (S.wanted === 0) nextStep();
      } else if (step.t === 'defend') {
        if (active.wave < 3 && active.timer > active.wave * 18) {
          const car = spawnCar(scene, 'sedan', step.x + (rng() < 0.5 ? -70 : 70), step.z + (rng() * 60 - 30), 0, 0x374151, rng);
          car.driver = 'target';
          active.rivals.push(car);
          cars.push(car);
          active.wave += 1;
        }
        let alive = 0;
        for (const car of active.rivals) {
          if (car.dead || car.health <= 15) { car.dead = true; continue; }
          alive++;
          steerToward(car, step.x, step.z, dt, W, { arrive: 6 });
        }
        ctx.hud.setObjective(step.label + ' — rivals left: ' + alive + ' (' + Math.max(0, Math.ceil(step.secs - active.timer)) + 's)');
        if ((alive === 0 && active.wave >= 3) || active.timer > step.secs) {
          for (const car of active.rivals) { scene.remove(car.mesh); const ci = cars.indexOf(car); if (ci >= 0) cars.splice(ci, 1); }
          active.rivals = [];
          nextStep();
        }
      } else if (step.t === 'timed') {
        active.timeLeft -= dt;
        ctx.hud.setObjective(step.label + ' — ' + Math.max(0, Math.ceil(active.timeLeft)) + 's');
        if (Math.hypot(p.x - step.x, p.z - step.z) < (step.r || 9)) { nextStep(); return; }
        if (active.timeLeft <= 0) failMission('out of time');
      }
    },
  };
  return api;
}
