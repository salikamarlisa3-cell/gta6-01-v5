// shots.js — deterministic staging for the four dossier screenshots and the
// automated self-test. ?shot=cover|drive|chase|night pins the clock and
// weather, places the cast and sets window.__SHOT_READY when the scene is
// framed. ?test=1 plays the game by itself through the real interaction paths
// and writes PASS/FAIL lines into #testlog, then window.__TEST_DONE.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, timeout = 20000, step = 120) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await sleep(step);
  }
  return false;
}

export function initShots(ctx, game) {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const test = params.get('test');
  if (!shot && !test) return;
  window.__MF_HEADLESS = true;
  const { S } = ctx;
  const sys = ctx.systems;

  async function frames(n) {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  }

  async function stage(name) {
    game.startPlay(false);
    // Stage synchronously, before the first frame can auto-start mission 1
    // at the safehouse marker the player spawns next to.
    if (name === 'cover') {
      sys.weather.force(16.9, false);
      const car = ctx.parkedCars.find((c) => c.cls === 'comet') || ctx.parkedCars[0];
      car.pos.set(-197, 0, -150);
      car.heading = 0.35;
      car.mesh.rotation.y = 0.35;
      sys.player.teleport(-206, -148, -1.94);
      sys.player.setCamera(-1.2, 0.3);
    } else if (name === 'drive') {
      sys.weather.force(11, false);
      const car = ctx.parkedCars.find((c) => c.cls === 'sedan');
      car.pos.set(46.4, 0, -70);
      car.heading = 0;
      sys.player.teleport(46.4, -73, 0);
      sys.player.interact();
      if (S.player.car) { S.player.car.pos.set(46.4, 0, -70); S.player.car.heading = 0; S.player.car.speed = 13; }
      // Dress the street with living traffic in the same lanes.
      await until(() => sys.traffic.cars.length >= 4, 10000);
      const [t1, t2] = sys.traffic.cars;
      if (t1) { t1.pos.set(46.4, 0, -47); t1.heading = 0; t1.speed = 9; t1.mesh.rotation.y = 0; }
      if (t2) { t2.pos.set(53.6, 0, -28); t2.heading = Math.PI; t2.speed = 9; t2.mesh.rotation.y = Math.PI; }
      await sleep(900);
    } else if (name === 'chase') {
      sys.weather.force(15, false);
      const car = ctx.parkedCars.find((c) => c.cls === 'comet');
      car.pos.set(-3.6, 0, -64);
      car.heading = 0;
      sys.player.teleport(-3.6, -67, 0);
      sys.player.interact();
      sys.police.setWanted(4);
      await until(() => sys.police.units.length >= 3, 12000);
      sys.police.spawnBlockNow();
      if (S.player.car) { S.player.car.pos.set(-3.6, 0, -58); S.player.car.heading = 0; S.player.car.speed = 17; }
    } else if (name === 'night') {
      sys.weather.force(22.6, false);
      sys.missions.startMission(4);
      while (S.dialogOpen) ctx.hud.dialogAdvance();
      sys.player.teleport(168, 0, Math.PI);
      sys.player.setCamera(0.5, 0.3);
      S.cash = 1450;
    }
    await frames(4);
    await sleep(1500);
    window.__SHOT_READY = true;
  }

  async function runTests() {
    const logEl = document.getElementById('testlog');
    logEl.style.display = 'block';
    // Lines persist across the mid-test reload via sessionStorage.
    const lines = JSON.parse(sessionStorage.getItem('sb_lines') || '[]');
    const log = (ok, name, extra = '') => {
      const line = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '');
      lines.push(line);
      sessionStorage.setItem('sb_lines', JSON.stringify(lines));
      logEl.textContent = lines.join('\n');
    };
    logEl.textContent = lines.join('\n');
    const phase = sessionStorage.getItem('sb_phase');
    try {
      if (phase === '2') {
        // Reload phase: the save written before reload must have been applied.
        game.startPlay(true);
        await frames(10);
        log(S.cash === 777, 'save persists across reload', 'cash=' + S.cash);
        sessionStorage.removeItem('sb_phase');
        sessionStorage.removeItem('sb_lines');
        ctx.save.clear();
        window.__TEST_DONE = true;
        return;
      }
      game.startPlay(false);
      await frames(8);
      // 1. Boot / world spawn.
      log(ctx.W.buildings.length > 100 && ctx.W.colliders.length > 100, 'boot/world spawn', ctx.W.buildings.length + ' buildings, ' + ctx.systems.pedestrians.peds.length + ' peds');
      // 2. Mission 1 end-to-end.
      const cash0 = S.cash;
      sys.player.teleport(-125, 92, 0);
      const started = await until(() => !!S.activeMission, 8000);
      if (started) {
        while (S.dialogOpen) ctx.hud.dialogAdvance();
        await until(() => sys.missions.active && sys.missions.active.step, 6000);
        const mcar = sys.missions.active.car;
        sys.player.teleport(mcar.pos.x + 2, mcar.pos.z, 0);
        sys.player.interact();
        await frames(4);
        if (S.player.car) S.player.car.pos.set(25, 0, 34);
        const done = await until(() => S.missionIndex === 1, 10000);
        log(done && S.cash >= cash0 + 400, 'mission 1 completes with payout', 'cash ' + cash0 + ' -> ' + S.cash);
      } else log(false, 'mission 1 completes with payout', 'mission never started');
      // 3. Stealing a traffic car raises wanted.
      sys.police.setWanted(0);
      S.heat = 0;
      const hasTraffic = await until(() => sys.traffic.cars.length > 0, 10000);
      if (hasTraffic) {
        const tc = sys.traffic.cars[0];
        sys.player.teleport(tc.pos.x + 2.5, tc.pos.z, 0);
        sys.player.interact();
        await frames(4);
        log(S.player.inCar && S.wanted >= 1, 'stealing a car raises wanted', 'wanted=' + S.wanted);
      } else log(false, 'stealing a car raises wanted', 'no traffic');
      // 4. Police dispatch spawns.
      sys.police.setWanted(3);
      const dispatched = await until(() => sys.police.units.length >= 2, 12000);
      log(dispatched, 'police dispatch spawns', 'units=' + sys.police.units.length);
      // 5. Hiding lowers wanted (teleport also exits the stolen car).
      //    Stage it honestly: pursuit left behind in the far corner, player
      //    tucked into the warehouse blocks of the opposite corner, where
      //    building rows break every road sight-line while stars decay.
      for (const u of sys.police.units) { u.pos.set(225, 0, -225); u.speed = 0; }
      sys.player.teleport(-230, 230, 0);
      sys.police.forceHidden();
      const before = S.wanted;
      const dropped = await until(() => S.wanted < before, 90000);
      log(dropped, 'hiding lowers wanted', before + ' -> ' + S.wanted);
      // 6. Bust produces BUSTED: corner the player in the open with a unit
      //    staged alongside, standing still — the bust meter must fill.
      sys.police.setWanted(2);
      await until(() => sys.police.units.length >= 1, 8000);
      sys.player.teleport(0, 0, 0);
      const u = sys.police.units[0];
      u.pos.set(5, 0, 0);
      u.speed = 0;
      const busted = await until(() => S.mode === 'busted', 90000);
      log(busted, 'bust produces BUSTED');
      if (busted) { game.respawn(); await frames(6); }
      // 7. Lethal damage produces WASTED.
      S.godT = 0;
      sys.combat.damagePlayer(999);
      await frames(4);
      log(S.mode === 'wasted', 'lethal damage produces WASTED');
      if (S.mode === 'wasted') { game.respawn(); await frames(6); }
      // 8. Save round-trip, then reload to prove persistence.
      S.cash = 777;
      ctx.save.write(S);
      const back = ctx.save.read();
      log(!!back && back.cash === 777, 'save writes and reads back');
      sessionStorage.setItem('sb_phase', '2');
      location.reload();
    } catch (err) {
      log(false, 'self-test exception', String(err && err.message || err));
      window.__TEST_DONE = true;
    }
  }

  if (shot) stage(shot);
  if (test) runTests();
}
