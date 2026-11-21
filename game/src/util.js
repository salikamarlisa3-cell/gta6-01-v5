// util.js — small shared helpers for SOLARA BAY: a seeded RNG so the island is
// identical on every load, plus math and collision primitives used by all systems.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// Shortest-path angle interpolation (radians).
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
}

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Push a circle (x, z, radius r) out of an AABB; returns true if it was inside.
export function pushOutOfBox(p, r, box) {
  const nx = clamp(p.x, box.minX, box.maxX);
  const nz = clamp(p.z, box.minZ, box.maxZ);
  const dx = p.x - nx, dz = p.z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return false;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    p.x = nx + (dx / d) * r;
    p.z = nz + (dz / d) * r;
  } else {
    // Centre inside the box: exit through the nearest face.
    const left = p.x - box.minX, right = box.maxX - p.x;
    const top = p.z - box.minZ, bottom = box.maxZ - p.z;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = box.minX - r;
    else if (m === right) p.x = box.maxX + r;
    else if (m === top) p.z = box.minZ - r;
    else p.z = box.maxZ + r;
  }
  return true;
}

// 2D segment vs AABB (slab test) — used for police line-of-sight through buildings.
export function segmentHitsBox(ax, az, bx, bz, box) {
  const dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) {
    if (ax < box.minX || ax > box.maxX) return false;
  } else {
    let ta = (box.minX - ax) / dx, tb = (box.maxX - ax) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (az < box.minZ || az > box.maxZ) return false;
  } else {
    let ta = (box.minZ - az) / dz, tb = (box.maxZ - az) / dz;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

// Format helpers for HUD text.
export const fmtCash = (n) => '$' + Math.round(n).toLocaleString('en-US');
export function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
