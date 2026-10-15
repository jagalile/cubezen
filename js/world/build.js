// Voxel world generation and meshing.
import * as THREE from 'three';
import { rng, T, tileUV, SEASONS } from './textures.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES0: 6, LEAVES1: 7, LEAVES2: 8,
  PLANKS: 9, COBBLE: 10, ROOF: 11, WINDOW: 12, PATH: 13, BIRCH: 14, DOOR: 15, WATER: 16, FARMLAND: 17,
  ORE_COAL: 18, ORE_COPPER: 19, ORE_GOLD: 20, ORE_CRYSTAL: 21,
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
  [B.FARMLAND]: [T.farmland, T.dirt, T.dirt],
  [B.ORE_COAL]: [T.oreCoal, T.oreCoal, T.oreCoal],
  [B.ORE_COPPER]: [T.oreCopper, T.oreCopper, T.oreCopper],
  [B.ORE_GOLD]: [T.oreGold, T.oreGold, T.oreGold],
  [B.ORE_CRYSTAL]: [T.oreCrystal, T.oreCrystal, T.oreCrystal],
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
  const FIRE = { x: 62, z: 72 };
  const CAMP = { x0: 68, x1: 75, z0: 75, z1: 82 };                 // the tent, woodpile and crates
  // A mine dug into the right-hand slope, its mouth (3 wide, z 55–57) looking west to the meadow.
  const MINE = { face: 94, z: 56 };
  const FARM = { x0: 39, x1: 49, z0: 60, z1: 67, waterZ: 63 };
  const DOCK_Z = 46, dockX = riverX(DOCK_Z);
  const DOCK = { x0: dockX, x1: dockX + 7, z0: DOCK_Z - 2, z1: DOCK_Z + 3 };
  const rectDist = (x, z, q, m) => Math.hypot(Math.max(q.x0 - m - x, 0, x - q.x1 - m), Math.max(q.z0 - m - z, 0, z - q.z1 - m));

  const decor = [];

  // ---- heightmap ----
  // Natural terrain (hills behind, rising edges, the river valley); buildFar continues it past the map.
  const naturalHeight = (x, z) => {
    const d = Math.abs(x - riverX(z));
    let h = 7 + fbm(n1, x * 0.07, z * 0.07) * 2.4;
    h += smooth(64, 12, z) * Math.pow(fbm(n2, x * 0.04, z * 0.04), 1.3) * 30;
    h += smooth(28, 2, Math.min(x, W - 1 - x)) * fbm(n3, x * 0.05, z * 0.05) * 14;
    const carve = smooth(16, 4.5, d);
    h = h * (1 - carve) + (WL - 0.5) * carve;
    if (d < 3.2) h = WL - 2 - (d < 1.6 ? 1 : 0);
    return h;
  };
  const height = new Int16Array(W * D);
  const riverDist = new Float32Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const d = Math.abs(x - riverX(z));
    let h = naturalHeight(x, z);
    const flat = Math.max(smooth(7, 1, rectDist(x, z, CABIN, 3)), smooth(8, 2, Math.hypot(x - FIRE.x, z - FIRE.z)), smooth(5, 1, rectDist(x, z, FARM, 2)), smooth(6, 1, rectDist(x, z, CAMP, 1)));
    h = h * (1 - flat) + G * flat;
    // The yard dug out of the slope in front of the mine.
    if (x >= MINE.face - 6 && x < MINE.face && z >= MINE.z - 3 && z <= MINE.z + 5) h = Math.min(h, G);
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

  // ---- farm plot: tilled rows with a water channel through the middle ----
  for (let z = FARM.z0; z <= FARM.z1; z++) for (let x = FARM.x0; x <= FARM.x1; x++) {
    const h = H_(x, z);
    set(x, h, z, z === FARM.waterZ ? B.WATER : B.FARMLAND);
    if (z === FARM.waterZ) set(x, h - 1, z, B.DIRT);
  }

  // ---- the mine: a stone face with ore veins, a timber-framed mouth and a tunnel into the hill ----
  const rMine = rng(77);
  // The rock face and the walls of the cut (everything below the turf around the yard).
  for (let z = MINE.z - 4; z <= MINE.z + 6; z++) for (let x = MINE.face - 6; x <= MINE.face + 1; x++) {
    for (let y = G + 1; y < H_(x, z); y++) {
      const v = rMine();
      set(x, y, z, v < 0.07 ? B.ORE_COAL : v < 0.12 ? B.ORE_COPPER : v < 0.15 ? B.ORE_GOLD : v < 0.17 ? B.ORE_CRYSTAL : v < 0.35 ? B.COBBLE : B.STONE);
    }
  }
  for (let x = MINE.face - 1; x <= MINE.face + 7; x++) {
    for (let z = MINE.z - 1; z <= MINE.z + 1; z++) {
      if (x >= MINE.face) for (let y = G + 1; y <= G + 3; y++) set(x, y, z, B.AIR);
      set(x, G, z, B.PATH);
    }
    // Timber sets: posts and a cap beam at the mouth and every three blocks inside.
    if (x >= MINE.face && (x - MINE.face) % 3 === 0) {
      for (let y = G + 1; y <= G + 3; y++) { set(x, y, MINE.z - 2, B.LOG); set(x, y, MINE.z + 2, B.LOG); }
      for (let z = MINE.z - 2; z <= MINE.z + 2; z++) set(x, G + 4, z, B.PLANKS);
    }
  }
  // A few veins left showing in the tunnel walls.
  set(MINE.face + 2, G + 2, MINE.z - 2, B.ORE_GOLD);
  set(MINE.face + 4, G + 3, MINE.z + 2, B.ORE_CRYSTAL);
  set(MINE.face + 5, G + 1, MINE.z - 2, B.ORE_COPPER);
  decor.push({ type: 'lantern', x: MINE.face + 3.5, y: G + 3.35, z: MINE.z + 0.5, hanging: true });
  decor.push({ type: 'post', x: MINE.face - 1.4, y: G + 1, z: MINE.z + 3.3 });
  decor.push({ type: 'lantern', x: MINE.face - 1.4, y: G + 2.5, z: MINE.z + 3.3 });

  // ---- stone hearth under the campfire ----
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    if (Math.hypot(dx, dz) > 2.3) continue;
    const x = FIRE.x + dx, z = FIRE.z + dz;
    if (get(x, G, z) === B.GRASS) set(x, G, z, B.COBBLE);
  }

  // ---- path from the viewer, past the campfire, to the door ----
  const pathCells = new Set(), rPath = rng(31);
  const door = { x: 69, z: CABIN.z1 + 3 };
  function path(x0, z0, x1, z1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t + Math.sin(t * 6) * 0.8), z = Math.round(z0 + (z1 - z0) * t);
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (rPath() < 0.12 && dx + dz > 0) continue;
        const px = x + dx, pz = z + dz;
        pathCells.add(px + ',' + pz);
        if (get(px, H_(px, pz), pz) === B.GRASS) set(px, H_(px, pz), pz, B.PATH);
      }
    }
  }
  path(58, 68, door.x, door.z);
  path(57, 79, 58, 68);
  path(55, D - 1, 57, 79);
  // Side paths from the porch: west over the ridge's foot down to the dock, east up to the mine.
  path(60, 63, 54, 59);
  path(54, 59, 46, 57);
  path(46, 57, 46, 46);
  path(71, 62, 80, 62);
  path(80, 62, 88, 56);

  // ---- cabin ----
  const { x0, x1, z0, z1 } = CABIN;
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
  // A dormer breaks up the front of the roof and opens onto a little balcony over the porch.
  const DX0 = 67, DX1 = 71;
  for (let x = DX0; x <= DX1; x++) {
    for (let z = z1 + 1; z <= z1 + 3; z++) { set(x, G + 6, z, B.PLANKS); set(x, G + 7, z, B.AIR); }
    for (let y = G + 6; y <= G + 8; y++) set(x, y, z1, x === DX0 || x === DX1 ? B.LOG : B.PLANKS);
  }
  set(69, G + 6, z1, B.DOOR);
  set(69, G + 7, z1, B.DOOR);
  set(68, G + 7, z1, B.WINDOW);
  set(70, G + 7, z1, B.WINDOW);
  for (let i = 0; i < 3; i++) for (let x = DX0 - 1 + i; x <= DX1 + 1 - i; x++) {
    for (let z = z0 + 3; z <= z1 + 1; z++) set(x, G + 9 + i, z, B.ROOF);
  }
  // A plank terrace along the west wall, looking out over the farm and the river.
  const TERRACE = { x0: x0 - 4, x1: x0 - 1, z0: z0, z1: z1 - 1 };
  for (let z = TERRACE.z0; z <= TERRACE.z1; z++) for (let x = TERRACE.x0; x <= TERRACE.x1; x++) set(x, G, z, B.PLANKS);
  for (const px of [x0, x1]) for (let y = G + 1; y <= G + 4; y++) set(px, y, z1 + 3, B.LOG);
  const chimney = { x: x1 - 2, z: z0 + 2 };
  for (let y = G + 1; y <= G + 13; y++) set(chimney.x, y, chimney.z, B.COBBLE);
  decor.push({ type: 'lantern', x: 66.5, y: G + 4.35, z: z1 + 3.5, hanging: true });
  decor.push({ type: 'lantern', x: 72.5, y: G + 4.35, z: z1 + 3.5, hanging: true });

  // Log benches on two sides of the hearth, facing the view.
  set(FIRE.x + 3, G + 1, FIRE.z - 1, B.LOG);
  set(FIRE.x + 3, G + 1, FIRE.z, B.LOG);
  set(FIRE.x, G + 1, FIRE.z - 3, B.LOG);
  set(FIRE.x + 1, G + 1, FIRE.z - 3, B.LOG);

  // Lantern posts along the path and one by the tent.
  for (const [lx, lz] of [[62, 67], [60, 82], [53, 92], [68, 77], [57, 63], [49, 55], [76, 64], [84, 61]]) {
    const y = H_(lx, lz) + 1;
    decor.push({ type: 'post', x: lx + 0.5, y, z: lz + 0.5 });
    decor.push({ type: 'lantern', x: lx + 0.5, y: y + 1.5, z: lz + 0.5 });
  }

  // Lantern on the dock's end post.
  decor.push({ type: 'post', x: dockX + 0.55, y: WL + 1.25, z: DOCK_Z + 1.45 });
  decor.push({ type: 'lantern', x: dockX + 0.55, y: WL + 2.75, z: DOCK_Z + 1.45 });

  // ---- along the path: a few bushes and short runs of fence ----
  const bushes = [[60, 79, 1], [61, 80, 0], [54, 75, 1], [55, 76, 0], [65, 65, 1], [66, 64, 0], [56, 63, 1], [53, 55, 0], [52, 54, 1], [78, 59, 1], [79, 60, 0], [86, 62, 0], [52, 86, 1], [61, 84, 0], [76, 83, 1], [77, 80, 0]];   // [x, z, big]
  const fences = [[55, 78, 55, 81], [59, 81, 61, 81], [53, 88, 53, 90], [60, 52, 63, 52], [60, 53, 60, 54], [60, 58, 62, 58]];        // [x0, z0, x1, z1], posts at each cell

  // ---- trees ----
  const taken = new Uint8Array(W * D);
  const canGrow = (x, z) => {
    if (x < 2 || z < 2 || x > W - 3 || z > D - 3) return false;
    if (riverDist[z * W + x] < 6.5 || rectDist(x, z, CABIN, 4) < 1 || Math.hypot(x - FIRE.x, z - FIRE.z) < 7) return false;
    if (rectDist(x, z, FARM, 4) < 1 || rectDist(x, z, DOCK, 3) < 1 || rectDist(x, z, CAMP, 3) < 1) return false;
    if (x > MINE.face - 10 && x < MINE.face + 4 && z > MINE.z - 7 && z < MINE.z + 9) return false;   // the mine's mouth and yard
    if (x > 36 && x < 92 && z > 62) return false;                    // keep the foreground meadow open
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (pathCells.has(x + dx + ',' + (z + dz))) return false;
    if (bushes.some(([bx, bz]) => Math.abs(bx - x) < 3 && Math.abs(bz - z) < 3)) return false;
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
    if (rectDist(x, z, FARM, 1) < 0.5 || rectDist(x, z, DOCK, 0) < 0.5 || rectDist(x, z, CAMP, 0) < 0.5) continue;
    if (bushes.some(([bx, bz]) => bx === x && bz === z)) continue;
    if (x >= MINE.face - 7 && x < MINE.face && z >= MINE.z - 3 && z <= MINE.z + 5) continue;  // rails and ore piles
    const density = 0.12 + fbm(n1, x * 0.15 + 40, z * 0.15) * 0.35;
    if (r() < density) plants.push({ x, y: h + 1, z, u: r(), k: r(), s: 0.75 + r() * 0.35, ox: (r() - 0.5) * 0.4, oz: (r() - 0.5) * 0.4 });
  }

  return {
    W, H, D, WL, G, get, plants, decor, chimney, riverX, naturalHeight,
    ground: (x, z) => H_(Math.floor(x), Math.floor(z)) + 1,
    farm: FARM, dock: { x: dockX, z: DOCK_Z }, camp: CAMP, fences, bushes, mine: MINE,
    fire: { x: FIRE.x + 0.5, y: G + 1, z: FIRE.z + 0.5 },
    windows: [{ x: 67, y: G + 3, z: z1 + 1.2 }, { x: 72, y: G + 3, z: z1 + 1.2 }, { x: 69.5, y: G + 7, z: z1 + 1.2 }],
    cabin: CABIN, terrace: TERRACE,
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
  const { W, D, H, get } = world;
  const pos = [], nor = [], uv = [], col = [], index = [];
  for (let wy = 0; wy < H - 1; wy++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (get(x, wy, z) !== B.WATER || get(x, wy + 1, z) !== B.AIR) continue;
    const y = wy + 1 - 0.14;
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

  // Crops: a "#" of four planes per tilled cell, like a dense little field.
  const { farm } = world;
  const crop = (x, z, tile, h) => {
    const [u0, v0, u1, v1] = tileUV(tile);
    const y = world.ground(x, z);
    for (const [ax, o] of [[0, 0.25], [0, 0.75], [1, 0.25], [1, 0.75]]) {
      const base = pos.length / 3;
      if (ax === 0) pos.push(x + o, y, z, x + o, y, z + 1, x + o, y + h, z + 1, x + o, y + h, z);
      else pos.push(x, y, z + o, x + 1, y, z + o, x + 1, y + h, z + o, x, y + h, z + o);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      col.push(0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 1, 1, 1, 1, 1, 1);
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  };
  const r = rng(33);
  for (let z = farm.z0; z <= farm.z1; z++) for (let x = farm.x0; x <= farm.x1; x++) {
    const v = r();
    if (z === farm.waterZ || seasonName === 'winter') continue;
    if (x === farm.x0 + 5 && z === farm.z0 + 5) continue;            // the scarecrow stands here
    if (z === farm.z1) {                                               // pumpkin row: leafy vines
      crop(x, z, seasonName === 'spring' ? T.wheat0 : T.tallGrass, seasonName === 'spring' ? 0.5 : 0.6);
      continue;
    }
    if (seasonName === 'spring') crop(x, z, v < 0.5 ? T.wheat0 : T.wheat1, v < 0.5 ? 0.5 : 0.7);
    else if (seasonName === 'summer') crop(x, z, T.wheat2, 0.95 + v * 0.1);
    else crop(x, z, x <= farm.x0 + 4 ? T.stubble : T.wheat3, x <= farm.x0 + 4 ? 0.3 : 1.0);  // half harvested
  }
  return geometry(pos, nor, uv, col, index);
}

// The land beyond the map: the same hills and river carry on at half the voxel detail, then rise
// into coarser mountains that the fog turns into haze. Forests are individual blocky canopies.
export function buildFar(world, seasonName) {
  const season = SEASONS[seasonName];
  const { W, D, WL, riverX } = world;
  const n = valueNoise(11), nForest = valueNoise(12), nTint = valueNoise(13);
  const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
  const pos = [], nor = [], uv = [], col = [], index = [];
  const waterY = WL + 1 - 0.14;
  const water = new THREE.Color(season.snow ? '#c4e0f2' : '#4a82cf');
  const sand = new THREE.Color('#e0cf98'), stone = new THREE.Color('#8d8f96'), snow = new THREE.Color('#f2f6fb');

  // Terrain only (no trees), so neighbouring cells agree on it.
  const ground = (x, z) => {
    const out = Math.max(-z, -x, x - (W - 1), 0);                       // distance beyond the map
    const t = smooth(10, 200, out), d = Math.abs(x - riverX(z));
    // Past the edge the valley opens into gentle slopes down to the river.
    let h = world.naturalHeight(x, z);
    h -= (h - WL) * smooth(44, 5, d) * smooth(0, 24, out) * 0.75;
    const valley = smooth(60, 6, d) * (1 - t * 0.5);
    return h + t * (6 + Math.pow(fbm(n, x * 0.012, z * 0.012), 1.3) * 90) * (1 - valley);
  };
  const cell = (x, z, S) => {
    const cx = x + S / 2, cz = z + S / 2;
    const d = Math.abs(cx - riverX(cz));
    const h = Math.round(ground(cx, cz));
    if (d < 3.4) return { top: waterY, color: water };
    const c = new THREE.Color();
    let top = h;
    const tint = 0.9 + fbm(nTint, cx * 0.08, cz * 0.08) * 0.2 + (hash(x, z) - 0.5) * 0.06;
    const forest = fbm(nForest, cx * 0.035, cz * 0.035) > 0.47 - Math.min(0.12, h * 0.002);
    if ((season.snow && h > 30) || h > 88) c.copy(snow);
    else if (h > 60) c.copy(stone).multiplyScalar(0.9 + hash(z, x) * 0.2);
    else if (d < 6.5 && h <= WL + 1) c.copy(sand);
    else if (forest && d > 7 && hash(x, z) < 0.8) {
      const leaves = season.leaves[Math.floor(hash(z + 3, x) * 3)];
      c.set(leaves[Math.floor(hash(x + 7, z) * leaves.length)]);
      top = h + (S > 2 ? 4 : 2) + Math.floor(hash(x - 5, z) * 2);       // a canopy above the ground
    } else c.set(season.grass[0]);
    c.multiplyScalar(tint);
    return { top, color: c };
  };
  const quad = (a, b, c, d, normal, color) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) { nor.push(...normal); uv.push(0, 0); col.push(color.r, color.g, color.b); }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const side = new THREE.Color();
  const inMap = (x, z) => x >= 0 && x < W && z >= 0 && z < D;
  // Near band at 2 blocks per cell (around the map too), far band at 4.
  for (const [S, z0, z1, x0, x1] of [[2, -72, D, -100, W + 100], [4, -240, -72, -160, W + 160]]) {
    for (let z = z0; z < z1; z += S) for (let x = x0; x < x1; x += S) {
      if (inMap(x, z)) continue;
      const { top, color } = cell(x, z, S);
      quad([x, top, z + S], [x + S, top, z + S], [x + S, top, z], [x, top, z], [0, 1, 0], color);
      side.copy(color).multiplyScalar(0.72);
      const front = cell(x, z + S, S).top;
      if (front < top && !inMap(x, z + S)) quad([x, front, z + S], [x + S, front, z + S], [x + S, top, z + S], [x, top, z + S], [0, 0, 1], side);
      side.copy(color).multiplyScalar(0.82);
      const left = cell(x - S, z, S).top, right = cell(x + S, z, S).top;
      if (left < top && !inMap(x - S, z)) quad([x, left, z], [x, left, z + S], [x, top, z + S], [x, top, z], [-1, 0, 0], side);
      if (right < top && !inMap(x + S, z)) quad([x + S, right, z + S], [x + S, right, z], [x + S, top, z], [x + S, top, z + S], [1, 0, 0], side);
    }
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
