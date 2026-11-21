// save.js — localStorage persistence: cash, mission progress, district standing,
// player position and time of day. Saved on mission completion and periodically.

const KEY = 'solara-bay-save-v1';

export function createSave() {
  return {
    exists() {
      try { return !!localStorage.getItem(KEY); } catch { return false; }
    },
    write(S) {
      try {
        const data = {
          cash: Math.round(S.cash),
          missionIndex: S.missionIndex,
          standing: S.standing,
          timeH: S.timeH,
          pos: {
            x: +S.player.pos.x.toFixed(1),
            z: +S.player.pos.z.toFixed(1),
            heading: +S.player.heading.toFixed(2),
          },
          freeRoam: !!S.freeRoam,
        };
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch { return false; }
    },
    read() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
    apply(S, data) {
      if (!data) return false;
      S.cash = data.cash ?? S.cash;
      S.missionIndex = data.missionIndex ?? 0;
      if (data.standing) S.standing = data.standing;
      S.timeH = data.timeH ?? S.timeH;
      S.freeRoam = !!data.freeRoam;
      if (data.pos) {
        S.player.pos.set(data.pos.x, 0, data.pos.z);
        S.player.heading = data.pos.heading ?? 0;
      }
      return true;
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    },
  };
}
