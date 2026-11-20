// city.js — the city of Solmara, built once from a fixed seed.
// 9x9 blocks of 40 units with 12-wide roads between them (pitch 52),
// so the city spans -240..240. East of x=240 is the beach and the sea.
// Buildings sit inside blocks, never on intersections. Every mesh here
// is procedural: boxes, cylinders and canvas textures, nothing loaded.
import * as THREE from 'three';
import { makeRng, range } from './rng.js';
import { buildingTexture, groundTexture } from './textures.js';

export const BLOCK = 40;
export const ROAD = 12;
export const PITCH = 52;
export const HALF = 234;
export const ROAD_CENTERS = [-234, -182, -130, -78, -26, 26, 78, 130, 182, 234];
export const BLOCK_CENTERS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];

// The seven districts, by block column (bx) and row (bz), 0..8.
export function districtForBlock(bx, bz) {
  if (bx <= 2 && bz <= 2) return 'Palm Row';
  if (bx >= 6 && bz <= 2) return 'Marina Bay';
  if (bx >= 3 && bx <= 5 && bz <= 1) return 'Coral Heights';
  if (bx >= 3 && bx <= 5 && bz >= 3 && bz <= 5) return 'Neon Mile';
  if (bx <= 2 && bz >= 3 && bz <= 5) return 'Sunset Strip';
  if (bx <= 2 && bz >= 6) return 'Old Harbor';
  if (bx >= 6 && bz >= 6) return 'The Docks';
  if (bx >= 6 && bz >= 3) return 'Marina Bay';
  return 'Sunset Strip';
}

// District name for a world position.
export function districtAt(x, z) {
  if (x > 240) return 'Solmara Beach';
  const bx = Math.max(0, Math.min(8, Math.floor((x + 234) / PITCH)));
  const bz = Math.max(0, Math.min(8, Math.floor((z + 234) / PITCH)));
  return districtForBlock(bx, bz);
}

// Height range and wall palette per district.
const DISTRICT_STYLE = {
  'Palm Row': { hMin: 6, hMax: 14, wall: '#e8dcc8', lit: '#ffd98a' },
  'Marina Bay': { hMin: 14, hMax: 30, wall: '#cfd8e0', lit: '#bfe8ff' },
  'Coral Heights': { hMin: 24, hMax: 52, wall: '#e8c8b8', lit: '#ffe0b8' },
  'Neon Mile': { hMin: 28, hMax: 68, wall: '#3a3f52', lit: '#ff5fa2' },
  'Sunset Strip': { hMin: 8, hMax: 20, wall: '#f0c8a0', lit: '#ffb36b' },
  'Old Harbor': { hMin: 6, hMax: 14, wall: '#a8886a', lit: '#ffd98a' },
  'The Docks': { hMin: 8, hMax: 13, wall: '#7a8288', lit: '#cfe8ff' },
  'Solmara Beach': { hMin: 4, hMax: 8, wall: '#e8dcc8', lit: '#ffd98a' },
};

const NEON_COLORS = [0xff2e88, 0x22d3ee, 0xa3e635, 0xffb020, 0xc084fc];

export function buildCity(scene) {
  const rng = makeRng(20261120);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Sky, sun and air.
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x9fc3dd, 260, 700);
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.4);
  sun.position.set(180, 260, 90);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbdd8f0, 0x8a7a5a, 1.1);
  scene.add(hemi);

  // Ground: one painted plane for roads, blocks, beach and sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(540, 540),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Sea: a translucent sheet east of the beach, gently moving.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 540),
    new THREE.MeshLambertMaterial({ color: 0x1e7fa8, transparent: true, opacity: 0.85 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(280, 0.4, 0);
  sea.name = 'sea';
  group.add(sea);

  // Shared geometry: one unit box, scaled per building.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const materials = {};
  for (const [name, style] of Object.entries(DISTRICT_STYLE)) {
    materials[name] = new THREE.MeshLambertMaterial({
      map: buildingTexture(style.wall, style.lit, makeRng(1000 + name.length * 77)),
    });
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x555a60 });

  // Buildings: 1-3 per block, inset from the roads.
  for (let bx = 0; bx < 9; bx++) {
    for (let bz = 0; bz < 9; bz++) {
      const district = districtForBlock(bx, bz);
      const style = DISTRICT_STYLE[district];
      const cx = BLOCK_CENTERS[bx];
      const cz = BLOCK_CENTERS[bz];
      const count = district === 'The Docks' ? 1 : 1 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const w = district === 'The Docks' ? 30 : range(rng, 12, 22);
        const d = district === 'The Docks' ? 24 : range(rng, 12, 22);
        const h = range(rng, style.hMin, style.hMax);
        const ox = count === 1 ? 0 : range(rng, -8, 8);
        const oz = count === 1 ? 0 : range(rng, -8, 8);
        const x = cx + ox;
        const z = cz + oz;
        const mesh = new THREE.Mesh(boxGeo, materials[district]);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        group.add(mesh);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.6, d + 0.6);
        roof.position.set(x, h + 0.3, z);
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Neon signs on Neon Mile towers: glowing boxes on the facades.
  const neonMat = NEON_COLORS.map(
    (c) => new THREE.MeshBasicMaterial({ color: c }),
  );
  for (let i = 0; i < 14; i++) {
    const bx = 3 + Math.floor(rng() * 3);
    const bz = 3 + Math.floor(rng() * 3);
    const x = BLOCK_CENTERS[bx] + range(rng, -12, 12);
    const z = BLOCK_CENTERS[bz] + range(rng, -12, 12);
    const sign = new THREE.Mesh(boxGeo, neonMat[i % neonMat.length]);
    sign.scale.set(range(rng, 3, 7), range(rng, 1, 2), 0.5);
    sign.position.set(x, range(rng, 12, 30), z);
    group.add(sign);
  }

  // Palm trees: trunks with crossed frond planes, along Palm Row and the beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f, side: THREE.DoubleSide });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const frondGeo = new THREE.PlaneGeometry(6, 2.4);
  function palm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    for (let a = 0; a < 3; a++) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(x, 7.2, z);
      frond.rotation.y = (a * Math.PI) / 3;
      frond.rotation.z = 0.5;
      group.add(frond);
    }
  }
  for (let i = 0; i < 26; i++) {
    const bx = Math.floor(rng() * 3);
    const bz = Math.floor(rng() * 3);
    palm(BLOCK_CENTERS[bx] + range(rng, -16, 16), BLOCK_CENTERS[bz] + range(rng, -16, 16));
  }
  for (let i = 0; i < 12; i++) {
    palm(range(rng, 242, 250), range(rng, -220, 220));
  }

  // Street lamps at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333a42 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const bulbGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const ix of ROAD_CENTERS) {
    for (const iz of ROAD_CENTERS) {
      if (rng() < 0.55) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(ix + 6.5, 3, iz + 6.5);
      group.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.position.set(ix + 6.5, 6.2, iz + 6.5);
      group.add(bulb);
    }
  }

  // Beach umbrellas: a cone on a pole, striped by two cones.
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xff5f6b });
  const umbMat2 = new THREE.MeshLambertMaterial({ color: 0xfff2cc });
  const umbPoleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6);
  const umbConeGeo = new THREE.ConeGeometry(2.2, 1.1, 8);
  for (let i = 0; i < 8; i++) {
    const x = range(rng, 243, 250);
    const z = range(rng, -200, 200);
    const pole = new THREE.Mesh(umbPoleGeo, poleMat);
    pole.position.set(x, 1.2, z);
    group.add(pole);
    const cone = new THREE.Mesh(umbConeGeo, i % 2 ? umbMat : umbMat2);
    cone.position.set(x, 2.8, z);
    group.add(cone);
  }

  scene.add(group);
  return { colliders, group };
}

// --- Road graph: intersections are the nodes, roads the edges. ---
// Node id = iy * 10 + ix, where ix/iz index ROAD_CENTERS.
export function nodeId(ix, iz) {
  return iz * 10 + ix;
}
export function nodePos(id) {
  return { x: ROAD_CENTERS[id % 10], z: ROAD_CENTERS[Math.floor(id / 10)] };
}
export function nearestNode(x, z) {
  let best = 0;
  let bestD = Infinity;
  for (let iz = 0; iz < 10; iz++) {
    for (let ix = 0; ix < 10; ix++) {
      const dx = x - ROAD_CENTERS[ix];
      const dz = z - ROAD_CENTERS[iz];
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = nodeId(ix, iz);
      }
    }
  }
  return best;
}
export function neighbors(id) {
  const ix = id % 10;
  const iz = Math.floor(id / 10);
  const out = [];
  if (ix > 0) out.push(id - 1);
  if (ix < 9) out.push(id + 1);
  if (iz > 0) out.push(id - 10);
  if (iz < 9) out.push(id + 10);
  return out;
}
// Breadth-first path of node ids from start to goal.
export function bfsPath(start, goal) {
  if (start === goal) return [start];
  const prev = new Map([[start, -1]]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const n of neighbors(cur)) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        if (n === goal) {
          const path = [n];
          let p = cur;
          while (p !== -1) {
            path.unshift(p);
            p = prev.get(p);
          }
          return path;
        }
        queue.push(n);
      }
    }
  }
  return [start];
}

// Circle (radius r) pushed out of a building AABB. Returns corrected x/z.
export function collideCircle(x, z, r, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        x = c.maxX + r;
      }
    }
  }
  return { x, z };
}
