// world.js — SOLARA BAY island city: procedural road grid, five named districts,
// landmark buildings with colliders, beach + animated water, a pier with a
// lighthouse, neon signage, palms and street lamps. Deterministic (seeded RNG).

import { mulberry32, clamp, pushOutOfBox, segmentHitsBox } from './util.js';

export const ROAD_LINES = [-200, -150, -100, -50, 0, 50, 100, 150, 200];
export const ROAD_W = 14;
export const LAND = 252;      // buildings/roads live inside +/-LAND
export const SHORE = 276;     // sand ends, water begins

export const DISTRICTS = [
  { name: 'Solara Heights', color: 0x8fb7d9, minX: -60, maxX: 110, minZ: -215, maxZ: -40 },
  { name: 'Palmera Strip', color: 0xff5da2, minX: 110, maxX: 240, minZ: -130, maxZ: 90 },
  { name: 'Port Azur', color: 0x5dc8b9, minX: -40, maxX: 240, minZ: 90, maxZ: 245 },
  { name: 'Old Canela', color: 0xffb35c, minX: -240, maxX: -60, minZ: -60, maxZ: 170 },
  { name: 'Marina Verde', color: 0x7dd87d, minX: -240, maxX: -60, minZ: -240, maxZ: -60 },
];

function facadeTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 120; y += 10) {
    for (let x = 5; x < 58; x += 10) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#2b3546';
      g.fillRect(x, y, 6, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture() {
  const S = 2048, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const u = (v) => ((v + 300) / 600) * S; // world -300..300 -> px
  const w2 = (v) => (v / 600) * S;
  g.fillStyle = '#c9b489'; g.fillRect(0, 0, S, S); // sand
  g.fillStyle = '#9aa08f'; g.fillRect(u(-LAND), u(-LAND), w2(LAND * 2), w2(LAND * 2)); // city base
  // District tints
  for (const d of DISTRICTS) {
    g.fillStyle = '#' + d.color.toString(16).padStart(6, '0') + '';
    g.globalAlpha = 0.10;
    g.fillRect(u(d.minX), u(d.minZ), w2(d.maxX - d.minX), w2(d.maxZ - d.minZ));
  }
  g.globalAlpha = 1;
  // Roads: sidewalk border then asphalt then dashed centre line
  for (const r of ROAD_LINES) {
    g.fillStyle = '#7d7f82';
    g.fillRect(u(r - ROAD_W / 2 - 2.5), u(-LAND), w2(ROAD_W + 5), w2(LAND * 2));
    g.fillRect(u(-LAND), u(r - ROAD_W / 2 - 2.5), w2(LAND * 2), w2(ROAD_W + 5));
  }
  for (const r of ROAD_LINES) {
    g.fillStyle = '#33373d';
    g.fillRect(u(r - ROAD_W / 2), u(-LAND), w2(ROAD_W), w2(LAND * 2));
    g.fillRect(u(-LAND), u(r - ROAD_W / 2), w2(LAND * 2), w2(ROAD_W));
  }
  g.strokeStyle = '#d8c95c'; g.lineWidth = 2; g.setLineDash([14, 12]);
  for (const r of ROAD_LINES) {
    g.beginPath(); g.moveTo(u(r), u(-LAND)); g.lineTo(u(r), u(LAND)); g.stroke();
    g.beginPath(); g.moveTo(u(-LAND), u(r)); g.lineTo(u(LAND), u(r)); g.stroke();
  }
  g.setLineDash([]);
  // Pier (wood) running south from Port Azur
  g.fillStyle = '#8a6b46'; g.fillRect(u(182), u(246), w2(16), w2(64));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createWorld(scene, seed = 1) {
  const rng = mulberry32(seed);
  const W = {
    colliders: [],
    buildings: [],
    neonMats: [],
    lampMat: null,
    water: null,
    beacon: null,
    landmarks: {},
    rng,
  };

  // --- ground + water ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const waterC = document.createElement('canvas');
  waterC.width = waterC.height = 128;
  const wg = waterC.getContext('2d');
  wg.fillStyle = '#155e75'; wg.fillRect(0, 0, 128, 128);
  wg.strokeStyle = 'rgba(140,220,255,0.35)';
  for (let i = 0; i < 40; i++) {
    wg.beginPath();
    const y = rng() * 128;
    wg.moveTo(rng() * 60, y); wg.lineTo(60 + rng() * 68, y + 3); wg.stroke();
  }
  const waterTex = new THREE.CanvasTexture(waterC);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(24, 24);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.55;
  scene.add(water);
  W.water = water;
  W.waterTex = waterTex;

  // --- building materials (shared) ---
  const palettes = [
    ['#c8b8a2', 0.25], ['#a2b8c8', 0.3], ['#d9c9b0', 0.22],
    ['#b0a2c8', 0.28], ['#c8a2a2', 0.26], ['#9fb8a8', 0.24],
  ];
  const mats = palettes.map(([base, lit]) => {
    const tex = facadeTexture(rng, base, lit);
    return new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffca7a, emissiveMap: tex, emissiveIntensity: 0 });
  });
  W.windowMats = mats;
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });

  function addBuilding(x, z, w, d, h, mat, name) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, [mat, mat, roofMat, roofMat, mat, mat]);
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    const box = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
    W.colliders.push(box);
    const b = { x, z, w, d, h, box, name: name || '' };
    W.buildings.push(b);
    return b;
  }
  W.addBuilding = addBuilding;

  // Landmark plots reserved by block-centre.
  const reserved = new Map();
  const plot = (bx, bz, key) => reserved.set(bx + ',' + bz, key);
  plot(25, -125, 'tower'); plot(175, -25, 'casino'); plot(-125, 25, 'hq');
  plot(75, 125, 'hospital'); plot(25, 25, 'garage'); plot(-175, 75, 'garage2');
  plot(-125, 75, 'safehouse');

  const centers = [];
  for (let i = 0; i < ROAD_LINES.length - 1; i++) centers.push((ROAD_LINES[i] + ROAD_LINES[i + 1]) / 2);

  for (const bx of centers) {
    for (const bz of centers) {
      const key = reserved.get(bx + ',' + bz);
      if (key) continue;
      const district = DISTRICTS.find((dd) => bx >= dd.minX && bx <= dd.maxX && bz >= dd.minZ && bz <= dd.maxZ);
      const name = district ? district.name : '';
      const inPort = bz >= 150;
      if (name === 'Solara Heights' || (!district && bz < -40)) {
        // Tower block: one tall slab.
        const w = 20 + rng() * 8, d = 20 + rng() * 8, h = 34 + rng() * 46;
        addBuilding(bx, bz, w, d, h, mats[Math.floor(rng() * mats.length)], name);
      } else if (inPort) {
        // Warehouse: long and low.
        addBuilding(bx, bz, 30, 18 + rng() * 6, 7 + rng() * 3, mats[Math.floor(rng() * mats.length)], 'Port Azur');
      } else {
        // Four small buildings per block.
        for (const ox of [-9.5, 9.5]) {
          for (const oz of [-9.5, 9.5]) {
            if (rng() < 0.12) continue; // occasional courtyard gap
            const w = 11 + rng() * 4, d = 11 + rng() * 4;
            const h = 6 + rng() * (name === 'Palmera Strip' ? 20 : 11);
            addBuilding(bx + ox, bz + oz, w, d, h, mats[Math.floor(rng() * mats.length)], name);
          }
        }
      }
    }
  }

  // --- landmarks ---
  function sign(x, y, z, w, h, color, ry = 0) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z); m.rotation.y = ry;
    scene.add(m);
    W.neonMats.push(m.material);
    return m;
  }
  // Torre Solara — the downtown spike with a beacon.
  addBuilding(25, -125, 22, 22, 88, mats[1], 'Torre Solara');
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  beacon.position.set(25, 90, -125);
  scene.add(beacon);
  W.beacon = beacon;
  W.landmarks.tower = new THREE.Vector3(25, 0, -125);
  // Palmera Casino — wide block, big pink neon.
  addBuilding(175, -25, 32, 24, 16, mats[3], 'Palmera Casino');
  sign(175, 13, -37.5, 26, 4, 0xff5da2);
  sign(159, 13, -25, 20, 4, 0xff5da2, Math.PI / 2);
  W.landmarks.casino = new THREE.Vector3(175, 0, -12);
  // VBPD HQ.
  addBuilding(-125, 25, 26, 20, 14, mats[1], 'VBPD HQ');
  sign(-125, 11, 14.6, 16, 3, 0x6ab0ff);
  W.landmarks.hq = new THREE.Vector3(-125, 0, 40);
  // St. Azur Hospital.
  const hosp = addBuilding(75, 125, 28, 20, 12, mats[0], 'St. Azur Hospital');
  sign(75, 9, 114.6, 14, 3.4, 0xff5555);
  W.landmarks.hospital = new THREE.Vector3(75, 0, 140);
  // Garages (respray) — open-front sheds, no collider across the bay.
  function garage(x, z, key) {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(24, 7, 18), new THREE.MeshLambertMaterial({ color: 0x707880 }));
    shed.position.set(x, 3.5, z - 6);
    scene.add(shed);
    W.colliders.push({ minX: x - 12, maxX: x + 12, minZ: z - 15, maxZ: z - 3 });
    sign(x, 6, z + 3.4, 15, 2.6, 0xffc44d);
    W.landmarks[key] = new THREE.Vector3(x, 0, z);
  }
  garage(25, 34, 'garage');
  garage(-175, 84, 'garage2');
  W.landmarks.garages = [W.landmarks.garage, W.landmarks.garage2];
  // Safehouse — Casa Canela, player start.
  addBuilding(-125, 75, 14, 12, 6, mats[4], 'Casa Canela');
  W.landmarks.safehouse = new THREE.Vector3(-125, 0, 86);
  // Lighthouse at the end of the pier.
  const lh = new THREE.Group();
  const lhBody = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 16, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  lhBody.position.y = 8;
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
  lhTop.position.y = 17;
  lh.add(lhBody, lhTop);
  lh.position.set(190, 0, 306);
  scene.add(lh);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(190 + 20, 17, 306);
  scene.add(beam);
  W.lighthouseBeam = beam;
  W.landmarks.lighthouse = new THREE.Vector3(190, 0, 292);
  // Pier posts.
  for (let z = 252; z <= 306; z += 9) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), new THREE.MeshLambertMaterial({ color: 0x6b5233 }));
    post.position.set(183.5, -0.5, z);
    scene.add(post);
    const post2 = post.clone(); post2.position.x = 196.5;
    scene.add(post2);
  }

  // Neon strips on Palmera Strip facades.
  for (let i = 0; i < 14; i++) {
    const bx = 128 + rng() * 100, bz = -120 + rng() * 200;
    if (W.colliders.some((b) => bx > b.minX - 2 && bx < b.maxX + 2 && bz > b.minZ - 2 && bz < b.maxZ + 2)) continue;
    sign(bx, 5 + rng() * 6, bz, 6 + rng() * 6, 1.6, [0xff5da2, 0x39d0ff, 0xffc44d, 0x9dff57][i % 4]);
  }

  // Street lamps — one instanced mesh; emissive driven by time of day.
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.4, 5);
  W.lampMat = new THREE.MeshLambertMaterial({ color: 0x3c4148, emissive: 0xffd9a0, emissiveIntensity: 0 });
  const lampPos = [];
  for (const r of ROAD_LINES) {
    for (let v = -225; v <= 225; v += 45) {
      lampPos.push([r + ROAD_W / 2 + 2, v], [r - ROAD_W / 2 - 2, v + 22]);
      lampPos.push([v, r + ROAD_W / 2 + 2], [v + 22, r - ROAD_W / 2 - 2]);
    }
  }
  const lamps = new THREE.InstancedMesh(lampGeo, W.lampMat, lampPos.length);
  const mtx = new THREE.Matrix4();
  lampPos.forEach(([x, z], i) => { mtx.setPosition(x, 2.7, z); lamps.setMatrixAt(i, mtx); });
  scene.add(lamps);

  // Palms along the shore.
  const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 5, 5);
  const frondG = new THREE.ConeGeometry(2.6, 1.6, 6);
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
  const frondM = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  for (let i = 0; i < 46; i++) {
    const side = i % 4;
    let x, z;
    if (side === 0) { x = -262 + rng() * 524; z = -262; }
    else if (side === 1) { x = -262 + rng() * 524; z = 262; }
    else if (side === 2) { x = -262; z = -262 + rng() * 524; }
    else { x = 262; z = -262 + rng() * 524; }
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkG, trunkM); trunk.position.y = 2.5;
    const frond = new THREE.Mesh(frondG, frondM); frond.position.y = 5.4;
    palm.add(trunk, frond);
    palm.position.set(x, 0, z);
    palm.rotation.y = rng() * 6.28;
    scene.add(palm);
  }

  // --- queries ---
  W.districtAt = (x, z) => {
    const d = DISTRICTS.find((dd) => x >= dd.minX && x <= dd.maxX && z >= dd.minZ && z <= dd.maxZ);
    return d ? d.name : 'Solara Bay';
  };
  W.collide = (p, r) => {
    for (const b of W.colliders) pushOutOfBox(p, r, b);
    p.x = clamp(p.x, -SHORE, SHORE);
    p.z = clamp(p.z, -SHORE, SHORE + 34); // pier extends south
    if (p.z > SHORE && (p.x < 180 || p.x > 200)) p.z = SHORE;
  };
  W.losBlocked = (ax, az, bx, bz) => {
    for (const b of W.colliders) {
      if (segmentHitsBox(ax, az, bx, bz, b)) return true;
    }
    return false;
  };
  W.nearestRoad = (x, z) => {
    let bestX = ROAD_LINES[0], bestZ = ROAD_LINES[0], bd = 1e9;
    for (const r of ROAD_LINES) {
      const d = Math.abs(x - r); if (d < bd) { bd = d; bestX = r; }
    }
    bd = 1e9;
    for (const r of ROAD_LINES) {
      const d = Math.abs(z - r); if (d < bd) { bd = d; bestZ = r; }
    }
    return { x: bestX, z: bestZ };
  };
  W.update = (dt, t) => {
    waterTex.offset.x = (t * 0.008) % 1;
    waterTex.offset.y = (t * 0.005) % 1;
    water.position.y = -0.55 + Math.sin(t * 0.7) * 0.06;
    if (W.beacon) W.beacon.material.color.setHex(Math.sin(t * 4) > 0 ? 0xff4444 : 0x661111);
    if (W.lighthouseBeam) W.lighthouseBeam.rotation.y = t * 0.5;
  };
  return W;
}
