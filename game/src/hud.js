// hud.js — the on-screen interface: health/armour bars, cash, VBPD stars, clock,
// weapon and speed readouts, objective line, prompts, toasts, dialogue cards,
// the bust meter, the damage vignette, end cards (BUSTED / WASTED / finale) and
// a live canvas minimap with roads, water and blips for police, traffic, crew
// and the current objective.

import { ROAD_LINES } from './world.js';
import { fmtCash, fmtClock } from './util.js';

export function createHud(ctx) {
  const { S, W } = ctx;
  const el = (id) => document.getElementById(id);
  const els = {
    health: el('healthfill'), armor: el('armorfill'), cash: el('cash'), stars: el('stars'),
    clock: el('clock'), district: el('district'), weapon: el('weapon'), speed: el('speed'),
    objective: el('objective'), prompt: el('prompt'), toast: el('toast'),
    bust: el('bust'), bustfill: el('bustfill'), dialog: el('dialog'), dialogtext: el('dialogtext'),
    vignette: el('vignette'), mission: el('missionname'), minimap: el('minimap'),
    crewcd: el('crewcd'),
  };
  const mm = els.minimap.getContext('2d');
  let toastTimer = 0;
  let dialogLines = null;
  let dialogIdx = 0;
  let dialogDone = null;
  let mmTimer = 0;
  let flashT = 0;

  const api = {
    els,
    toast(msg, secs = 3.4) {
      els.toast.textContent = msg;
      els.toast.style.opacity = '1';
      toastTimer = secs;
    },
    setObjective(text) { els.objective.textContent = text || ''; },
    setPrompt(text) { els.prompt.textContent = text || ''; },
    damageFlash() { flashT = 0.55; },
    showDialog(lines, onDone) {
      dialogLines = lines;
      dialogIdx = 0;
      dialogDone = onDone || null;
      S.dialogOpen = true;
      els.dialog.style.display = 'block';
      els.dialogtext.textContent = lines[0];
    },
    dialogAdvance() {
      if (!dialogLines) return;
      dialogIdx += 1;
      if (dialogIdx >= dialogLines.length) {
        dialogLines = null;
        S.dialogOpen = false;
        els.dialog.style.display = 'none';
        if (dialogDone) dialogDone();
      } else {
        els.dialogtext.textContent = dialogLines[dialogIdx];
      }
    },
    get dialogOpen() { return !!dialogLines; },
    showOverlay(id) {
      for (const o of ['title', 'pause', 'endcard']) {
        const n = el(o);
        if (n) n.style.display = o === id ? 'flex' : 'none';
      }
    },
    setEnd(title, sub) {
      el('endtitle').textContent = title;
      el('endsub').textContent = sub;
      api.showOverlay('endcard');
    },
    update(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) els.toast.style.opacity = '0';
      }
      if (flashT > 0) {
        flashT -= dt;
        els.vignette.style.opacity = String(Math.max(0, flashT));
      }
      els.health.style.width = Math.max(0, S.health) + '%';
      els.armor.style.width = Math.max(0, S.armor) + '%';
      els.cash.textContent = fmtCash(S.cash);
      els.stars.textContent = '★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted);
      els.stars.style.color = S.wanted > 0 ? '#ffd34d' : '#5a6270';
      els.clock.textContent = fmtClock(S.timeH) + (S.rain > 0.25 ? ' · RAIN' : '');
      const district = W.districtAt(S.player.pos.x, S.player.pos.z);
      const standing = S.standing[district] || 0;
      els.district.textContent = district + ' · standing ' + (standing >= 0 ? '+' : '') + standing;
      els.weapon.textContent = S.player.inCar ? '—' : (S.reloading > 0 ? 'RELOADING' : 'PISTOL ' + S.ammo + '/12 · F fists');
      els.speed.textContent = S.player.inCar ? Math.round(S.speedKmh) + ' km/h' : '';
      els.mission.textContent = S.activeMission ? S.activeMission.def.title : (S.freeRoam ? 'Free Roam' : (S.missionIndex < 10 ? 'Next: ' + ctx.systems.missions.MISSIONS[S.missionIndex].title : ''));
      const cd = ctx.systems.crew ? ctx.systems.crew.cd : { rook: 0, sable: 0 };
      els.crewcd.textContent = 'CREW  Z Rook ' + (cd.rook > 0 ? Math.ceil(cd.rook) + 's' : '$120') + ' · X Sable ' + (cd.sable > 0 ? Math.ceil(cd.sable) + 's' : '$200');
      if (S.bust > 0.02 && S.wanted > 0) {
        els.bust.style.display = 'block';
        els.bustfill.style.width = (S.bust * 100).toFixed(0) + '%';
      } else els.bust.style.display = 'none';
      mmTimer -= dt;
      if (mmTimer <= 0) { mmTimer = 0.12; api.drawMinimap(); }
    },
    drawMinimap() {
      const c = mm, SZ = 184, half = 300;
      const px = (x) => ((x + half) / (half * 2)) * SZ;
      c.fillStyle = '#155e75';
      c.fillRect(0, 0, SZ, SZ);
      c.fillStyle = '#9aa08f';
      c.fillRect(px(-252), px(-252), (504 / 600) * SZ, (504 / 600) * SZ);
      c.strokeStyle = '#3a3f46';
      c.lineWidth = 2;
      for (const r of ROAD_LINES) {
        c.beginPath(); c.moveTo(px(r), px(-252)); c.lineTo(px(r), px(252)); c.stroke();
        c.beginPath(); c.moveTo(px(-252), px(r)); c.lineTo(px(252), px(r)); c.stroke();
      }
      const dot = (x, z, color, r = 2.4) => {
        c.fillStyle = color;
        c.beginPath(); c.arc(px(x), px(z), r, 0, 6.29); c.fill();
      };
      if (ctx.systems.traffic) for (const car of ctx.systems.traffic.cars) dot(car.pos.x, car.pos.z, '#c8ccd2', 1.6);
      if (ctx.systems.police) for (const u of ctx.systems.police.units) dot(u.pos.x, u.pos.z, '#3b82f6', 2.6);
      if (ctx.systems.crew && ctx.systems.crew.cars[0]) dot(ctx.systems.crew.cars[0].pos.x, ctx.systems.crew.cars[0].pos.z, '#37b24d', 2.6);
      let obj = null;
      if (ctx.systems.missions) obj = ctx.systems.missions.objectivePos();
      if (!obj && ctx.systems.races) obj = ctx.systems.races.objectivePos();
      if (obj) dot(obj.x, obj.z, '#ffc44d', 3.6);
      // Player arrow.
      const p = S.player.pos;
      c.save();
      c.translate(px(p.x), px(p.z));
      c.rotate(Math.atan2(Math.sin(S.player.heading), -Math.cos(S.player.heading)) + Math.PI);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(0, -5); c.lineTo(3.6, 4); c.lineTo(-3.6, 4);
      c.closePath(); c.fill();
      c.restore();
    },
  };
  return api;
}
