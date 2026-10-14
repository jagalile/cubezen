// Voxel world generation and meshing.
import * as THREE from 'three';
import { rng, T, tileUV, SEASONS } from './textures.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES0: 6, LEAVES1: 7, LEAVES2: 8,
  PLANKS: 9, COBBLE: 10, ROOF: 11, WINDOW: 12, PATH: 13, BIRCH: 14, DOOR: 15, WATER: 16,
};
const isLeaves = (id) => id >= B.LEAVES0 && id <= B.LEAVES2;

// [top, bottom, side]
const FACE_TILES = {
  [B.GRASS]: [T.grassTop, T.dirt, T.grassSide],
  [B.DIRT]: [T.dirt, T.dirt, T.dirt],
  [B.STONE]: [T.stone, T.stone, T.stone],
  [B.SAND]: [T.sand, T.sand, T.sand],
  [B.LOG]: [T.logTop, T.logTop, T.logSide],
  [B.LEAVES0]: [T.leaves0, T.leaves0, T.leaves0],
  [B.LEAVES1]: [T.leaves1, T.leaves1, T.leaves1],
  [B.LEAVES2]: [T.leaves2, T.leaves2, T.leaves2],
  [B.PLANKS]: [T.planks, T.planks, T.planks],
  [B.COBBLE]: [T.cobble, T.cobble, T.cobble],
  [B.ROOF]: [T.roof, T.planks, T.roof],
  [B.WINDOW]: [T.planks, T.planks, T.window],
  [B.PATH]: [T.path, T.dirt, T.dirt],
  [B.BIRCH]: [T.logTop, T.logTop, T.birch],
  [B.DOOR]: [T.planks, T.planks, T.door],
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function valueNoise(seed) {
  const hash = (ix, iz) => {
    const s = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  return (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z);
    let fx = x - ix, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx);
    fz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
}
function fbm(noise, x, z) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < 4; o++) { sum += noise(x, z) * amp; norm += amp; amp *= 0.5; x *= 2; z *= 2; }
  return sum / norm;
}

export function generateWorld() {
  const W = 112, H = 46, D = 100, WL = 6, G = 8;
  const blocks = new Uint8Array(W * H * D);
  const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
  const idx = (x, y, z) => (y * D + z) * W + x;
  const get = (x, y, z) => (inside(x, y, z) ? blocks[idx(x, y, z)] : B.AIR);
  const set = (x, y, z, v) => { if (inside(x, y, z)) blocks[idx(x, y, z)] = v; };
  const r = rng(2024);
  const n1 = valueNoise(1), n2 = valueNoise(2), n3 = valueNoise(3);

  const riverX = (z) => 32 + 9 * Math.sin(z * 0.055) + 4 * Math.sin(z * 0.16 + 1);
  const CABIN = { x0: 64, x1: 74, z0: 52, z1: 59 };
  const FIRE = { x: 59, z: 70 };
  const rectDist = (x, z, q, m) => Math.hypot(Math.max(q.x0 - m - x, 0, x - q.x1 - m), Math.max(q.z0 - m - z, 0, z - q.z1 - m));

  // ---- heightmap ----
  const height = new Int16Array(W * D);
  const riverDist = new Float32Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const d = Math.abs(x - riverX(z));
    let h = 7 + fbm(n1, x * 0.07, z * 0.07) * 2.4;
    h += smooth(64, 12, z) * Math.pow(fbm(n2, x * 0.04, z * 0.04), 1.3) * 30;
    h += smooth(28, 2, Math.min(x, W - 1 - x)) * fbm(n3, x * 0.05, z * 0.05) * 14;
    const carve = smooth(16, 4.5, d);
    h = h * (1 - carve) + (WL - 0.5) * carve;
    if (d < 3.2) h = WL - 2 - (d < 1.6 ? 1 : 0);
    const flat = Math.max(smooth(7, 1, rectDist(x, z, CABIN, 3)), smooth(8, 2, Math.hypot(x - FIRE.x, z - FIRE.z)));
    h = h * (1 - flat) + G * flat;
    height[z * W + x] = Math.round(h);
    riverDist[z * W + x] = d;
  }
  const H_ = (x, z) => height[Math.min(D - 1, Math.max(0, z)) * W + Math.min(W - 1, Math.max(0, x))];

  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = H_(x, z), d = riverDist[z * W + x];
    const beach = d < 6 && h <= WL;
    const slope = Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => Math.abs(H_(x + dx, z + dz) - h)));
    for (let y = 0; y <= h; y++) {
      let id = B.STONE;
      if (y === h) id = beach ? B.SAND : slope >= 4 ? B.STONE : B.GRASS;
      else if (y >= h - 3) id = beach ? B.SAND : B.DIRT;
      set(x, y, z, id);
    }
    for (let y = h + 1; y <= WL; y++) set(x, y, z, B.WATER);
  }

  // ---- path from the campfire to the door and towards the viewer ----
  const pathCells = new Set();
  const door = { x: 69, z: CABIN.z1 + 3 };
  function path(x0, z0, x1, z1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t + Math.sin(t * 6) * 0.8), z = Math.round(z0 + (z1 - z0) * t);
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (r() < 0.12 && dx + dz > 0) continue;
        const px = x + dx, pz = z + dz;
        pathCells.add(px + ',' + pz);
        if (get(px, H_(px, pz), pz) === B.GRASS) set(px, H_(px, pz), pz, B.PATH);
      }
    }
  }
  path(FIRE.x + 1, FIRE.z - 2, door.x, door.z);
  path(FIRE.x - 1, FIRE.z + 2, FIRE.x - 6, D - 1);

  // ---- cabin ----
  const { x0, x1, z0, z1 } = CABIN;
  const decor = [];
  for (let z = z0; z <= z1 + 2; z++) for (let x = x0; x <= x1; x++) set(x, G, z, B.PLANKS);
  for (let y = G + 1; y <= G + 5; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const edgeX = x === x0 || x === x1, edgeZ = z === z0 || z === z1;
    if (!edgeX && !edgeZ) continue;
    set(x, y, z, (edgeX && edgeZ) || y === G + 5 || y === G + 1 ? B.LOG : B.PLANKS);
  }
  for (const wx of [x0 + 2, x0 + 3, x1 - 3, x1 - 2]) for (const y of [G + 2, G + 3]) set(wx, y, z1, B.WINDOW);
  for (const wz of [z0 + 3, z0 + 4]) for (const y of [G + 2, G + 3]) { set(x0, y, wz, B.WINDOW); set(x1, y, wz, B.WINDOW); }
  set(69, G + 1, z1, B.DOOR);
  set(69, G + 2, z1, B.DOOR);
  for (let i = 0; ; i++) {                                         // stepped gable roof
    const za = z0 - 2 + i, zb = z1 + 2 - i, y = G + 6 + i;
    if (za > zb) break;
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      set(x, y, za, B.ROOF);
      set(x, y, zb, B.ROOF);
      if (zb - za <= 1) for (let z = za; z <= zb; z++) set(x, y, z, B.ROOF);
    }
    for (let z = za + 1; z < zb; z++) { set(x0, y, z, B.PLANKS); set(x1, y, z, B.PLANKS); }
  }
  // porch roof edge one step lower over the deck
  for (let x = x0 - 1; x <= x1 + 1; x++) set(x, G + 5, z1 + 3, B.ROOF);
  for (const px of [x0, x1]) for (let y = G + 1; y <= G + 4; y++) set(px, y, z1 + 3, B.LOG);
  const chimney = { x: x1 - 2, z: z0 + 2 };
  for (let y = G + 1; y <= G + 13; y++) set(chimney.x, y, chimney.z, B.COBBLE);
  decor.push({ type: 'lantern', x: 66.5, y: G + 4.35, z: z1 + 3.5, hanging: true });
  decor.push({ type: 'lantern', x: 72.5, y: G + 4.35, z: z1 + 3.5, hanging: true });

  // Benches around the fire.
  set(FIRE.x + 3, G + 1, FIRE.z, B.LOG);
  set(FIRE.x + 3, G + 1, FIRE.z + 1, B.LOG);
  set(FIRE.x - 2, G + 1, FIRE.z - 3, B.LOG);
  set(FIRE.x - 1, G + 1, FIRE.z - 3, B.LOG);

  // Lantern posts along the path.
  for (const [lx, lz] of [[63, 66], [57, 80], [55, 90]]) {
    const y = H_(lx, lz) + 1;
    decor.push({ type: 'post', x: lx + 0.5, y, z: lz + 0.5 });
    decor.push({ type: 'lantern', x: lx + 0.5, y: y + 1.5, z: lz + 0.5 });
  }

  // ---- trees ----
  const taken = new Uint8Array(W * D);
  const canGrow = (x, z) => {
    if (x < 2 || z < 2 || x > W - 3 || z > D - 3) return false;
    if (riverDist[z * W + x] < 6.5 || rectDist(x, z, CABIN, 4) < 1 || Math.hypot(x - FIRE.x, z - FIRE.z) < 7) return false;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (pathCells.has(x + dx + ',' + (z + dz))) return false;
    if (get(x, H_(x, z), z) !== B.GRASS) return false;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (taken[(z + dz) * W + x + dx]) return false;
    return true;
  };
  const leaf = (x, y, z, id) => { if (get(x, y, z) === B.AIR) set(x, y, z, id); };

  function tree(x, z, kind, leaves) {
    const base = H_(x, z) + 1;
    taken[z * W + x] = 1;
    if (kind === 'birch') {
      const h = 5 + Math.floor(r() * 3);
      for (let y = 0; y < h; y++) set(x, base + y, z, B.BIRCH);
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy === 1 ? 1 : 2;
        for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || r() < 0.6)) continue;
          leaf(x + dx, base + h + dy, z + dz, leaves);
        }
      }
    } else if (kind === 'wide') {
      const h = 4 + Math.floor(r() * 2);
      for (let y = 0; y < h; y++) set(x, base + y, z, B.LOG);
      const bx = r() < 0.5 ? 1 : -1;
      set(x + bx, base + h, z, B.LOG);
      set(x + bx * 2, base + h + 1, z, B.LOG);
      for (const [cx, cy, rx, ry] of [[x, base + h + 1, 3.6, 1.6], [x + bx * 2, base + h + 2, 2.6, 1.3]]) {
        for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
          const q = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
          if (q <= 1 && !(q > 0.75 && r() < 0.4)) leaf(Math.round(cx + dx), cy + dy, z + dz, leaves);
        }
      }
    } else {
      const h = 4 + Math.floor(r() * 3);
      for (let y = 0; y < h; y++) set(x, base + y, z, B.LOG);
      const rad = 2.4 + r() * 0.8;
      for (let dy = -2; dy <= 2; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const q = (dx * dx + dz * dz + dy * dy * 1.6) / (rad * rad);
        if (q <= 1 && !(q > 0.7 && r() < 0.35)) leaf(x + dx, base + h + dy, z + dz, leaves);
      }
    }
  }

  // A couple of framing trees in the foreground, then a scattered forest.
  // A framing tree at each side of the view, then a forest that thickens towards the hills
  // and the edges and leaves the central meadow open.
  tree(97, 84, 'wide', B.LEAVES0);
  tree(14, 82, 'round', B.LEAVES1);
  for (let i = 0; i < 1200; i++) {
    const x = Math.floor(r() * W), z = Math.floor(r() * D);
    const back = smooth(62, 18, z), side = smooth(30, 8, Math.min(x, W - 1 - x));
    const meadow = x > 36 && x < 92 && z > 44 ? 0.03 : 0.12;
    if (r() > meadow + Math.max(back * 0.4, side * 0.6) || !canGrow(x, z)) continue;
    const v = r();
    const kind = v < 0.15 ? 'birch' : v < 0.4 ? 'wide' : 'round';
    const leaves = kind === 'birch' ? B.LEAVES1 : [B.LEAVES0, B.LEAVES1, B.LEAVES2][Math.floor(r() * 3)];
    tree(x, z, kind, leaves);
  }

  // ---- plant spots (filled per season) ----
  const plants = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = H_(x, z);
    if (get(x, h, z) !== B.GRASS || get(x, h + 1, z) !== B.AIR) continue;
    const density = 0.12 + fbm(n1, x * 0.15 + 40, z * 0.15) * 0.35;
    if (r() < density) plants.push({ x, y: h + 1, z, u: r(), k: r(), s: 0.75 + r() * 0.35, ox: (r() - 0.5) * 0.4, oz: (r() - 0.5) * 0.4 });
  }

  return {
    W, H, D, WL, G, get, plants, decor, chimney, riverX,
    fire: { x: FIRE.x + 0.5, y: G + 1, z: FIRE.z + 0.5 },
    windows: [{ x: 67, y: G + 3, z: z1 + 1.2 }, { x: 72, y: G + 3, z: z1 + 1.2 }],
  };
}

// ---------- meshing ----------

// Corners listed bottom-left, bottom-right, top-right, top-left as seen from outside.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], slot: 2 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], slot: 2 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], slot: 2 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], slot: 2 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], slot: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], slot: 1 },
];
const AO = [0.5, 0.68, 0.84, 1];

export function buildTerrain(world) {
  const { W, H, D, get } = world;
  const pos = [], nor = [], uv = [], col = [], index = [];
  const occ = (x, y, z) => { const id = get(x, y, z); return id !== B.AIR && id !== B.WATER; };
  const outside = (x, y, z) => x < 0 || z < 0 || x >= W || z >= D || y < 0;

  for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const id = get(x, y, z);
    if (id === B.AIR || id === B.WATER) continue;
    const tiles = FACE_TILES[id];
    for (const f of FACES) {
      const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
      if (outside(nx, ny, nz)) continue;
      const nb = get(nx, ny, nz);
      const visible = nb === B.AIR || nb === B.WATER || (isLeaves(nb) && !isLeaves(id));
      if (!visible) continue;

      const [u0, v0, u1, v1] = tileUV(tiles[f.slot]);
      const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2;
      const ta = (axis + 1) % 3, tb = (axis + 2) % 3;
      const base = pos.length / 3;
      const aos = f.c.map((c) => {
        const front = [nx, ny, nz];
        const da = [0, 0, 0], db = [0, 0, 0];
        da[ta] = c[ta] ? 1 : -1;
        db[tb] = c[tb] ? 1 : -1;
        const s1 = occ(front[0] + da[0], front[1] + da[1], front[2] + da[2]);
        const s2 = occ(front[0] + db[0], front[1] + db[1], front[2] + db[2]);
        const cr = occ(front[0] + da[0] + db[0], front[1] + da[1] + db[1], front[2] + da[2] + db[2]);
        return s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
      });
      f.c.forEach((c, i) => {
        pos.push(x + c[0], y + c[1], z + c[2]);
        nor.push(...f.n);
        const shade = AO[aos[i]];
        col.push(shade, shade, shade);
      });
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      if (aos[0] + aos[2] < aos[1] + aos[3]) index.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return geometry(pos, nor, uv, col, index);
}

export function buildWater(world) {
  const { W, D, WL, get } = world;
  const pos = [], nor = [], uv = [], col = [], index = [];
  const y = WL + 1 - 0.14;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (get(x, WL, z) !== B.WATER) continue;
    const base = pos.length / 3;
    pos.push(x, y, z + 1, x + 1, y, z + 1, x + 1, y, z, x, y, z);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    uv.push(x, -z - 1, x + 1, -z - 1, x + 1, -z, x, -z);
    col.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return geometry(pos, nor, uv, col, index);
}

export function buildPlants(world, seasonName) {
  const season = SEASONS[seasonName];
  const pos = [], nor = [], uv = [], col = [], index = [];
  for (const p of world.plants) {
    if (p.u > season.plantChance) continue;
    let tile;
    if (seasonName === 'winter') tile = T.bush;
    else if (p.k < season.flowerChance) tile = [T.flower0, T.flower1, T.flower2][Math.floor((p.k / season.flowerChance) * 3)];
    else tile = T.tallGrass;
    const [u0, v0, u1, v1] = tileUV(tile);
    const cx = p.x + 0.5 + p.ox, cz = p.z + 0.5 + p.oz, h = p.s, w = 0.45 * p.s;
    for (const [dx, dz] of [[w, w], [w, -w]]) {
      const base = pos.length / 3;
      pos.push(cx - dx, p.y, cz - dz, cx + dx, p.y, cz + dz, cx + dx, p.y + h, cz + dz, cx - dx, p.y + h, cz - dz);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      col.push(0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 1, 1, 1, 1, 1, 1);
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return geometry(pos, nor, uv, col, index);
}

// Distant blocky mountains beyond the map: coarse columns that the fog turns into haze.
export function buildFar(world, seasonName) {
  const season = SEASONS[seasonName];
  const n = valueNoise(11), r = rng(5);
  const S = 4, pos = [], nor = [], uv = [], col = [], index = [];
  const top = new THREE.Color(), side = new THREE.Color();
  const heightAt = (x, z) => {
    const t = smooth(0, -150, z);                        // 0 at the map edge, 1 far away
    let h = 7 + t * (8 + Math.pow(fbm(n, x * 0.012, z * 0.012), 1.3) * 85);
    const carve = smooth(34, 6, Math.abs(x - world.riverX(z))) * (1 - t * 0.6);
    h = h * (1 - carve) + 5 * carve;                      // the river valley continues
    return Math.round(h / 2) * 2;
  };
  const quad = (a, b, c, d, normal, color) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) { nor.push(...normal); uv.push(0, 0); col.push(color.r, color.g, color.b); }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let z = -240; z < 0; z += S) for (let x = -160; x < world.W + 160; x += S) {
    const h = heightAt(x, z);
    const forest = r() < 0.7 && h < 60;
    top.set(season.snow && h > 30 ? '#f2f6fb' : forest ? season.leaves[Math.floor(r() * 3)][0] : season.grass[0]);
    side.copy(top).multiplyScalar(0.7);
    quad([x, h, z + S], [x + S, h, z + S], [x + S, h, z], [x, h, z], [0, 1, 0], top);
    if (heightAt(x, z + S) < h && z + S < 0) quad([x, 0, z + S], [x + S, 0, z + S], [x + S, h, z + S], [x, h, z + S], [0, 0, 1], side);
    if (heightAt(x - S, z) < h) quad([x, 0, z], [x, 0, z + S], [x, h, z + S], [x, h, z], [-1, 0, 0], side);
    if (heightAt(x + S, z) < h) quad([x + S, 0, z + S], [x + S, 0, z], [x + S, h, z], [x + S, h, z + S], [1, 0, 0], side);
  }
  return geometry(pos, nor, uv, col, index);
}

function geometry(pos, nor, uv, col, index) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}
