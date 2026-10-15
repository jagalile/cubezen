// Procedural 16x16 pixel textures (all original), repainted per season.
import * as THREE from 'three';

export function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const T = {
  grassTop: 0, grassSide: 1, dirt: 2, stone: 3, sand: 4, logSide: 5, logTop: 6, leaves0: 7,
  leaves1: 8, leaves2: 9, planks: 10, cobble: 11, roof: 12, window: 13, path: 14, birch: 15,
  door: 16, tallGrass: 17, flower0: 18, flower1: 19, flower2: 20, bush: 21,
  farmland: 22, wheat0: 23, wheat1: 24, wheat2: 25, wheat3: 26, stubble: 27,
  oreCoal: 28, oreCopper: 29, oreGold: 30, oreCrystal: 31,
};
const COLS = 8, ROWS = 4, S = 16;

export function tileUV(tile) {
  const c = tile % COLS, r = Math.floor(tile / COLS);
  const e = 0.02 / (COLS * S);
  return [c / COLS + e, 1 - (r + 1) / ROWS + e, (c + 1) / COLS - e, 1 - r / ROWS - e];
}

export const SEASONS = {
  spring: {
    grass: ['#74c95c', '#62b84d', '#88d86c', '#57a846'],
    leaves: [
      ['#f4a9cb', '#ea92ba', '#fbc7de', '#d97aa6'],   // blossom
      ['#7ccc5c', '#68b84c', '#94dc72', '#57a443'],
      ['#f7bfd8', '#eea3c6', '#fde0ec', '#e08ab2'],
    ],
    tallGrass: ['#6cc457', '#5ab148', '#86d86a'],
    flowers: ['#ff9ec7', '#ffffff', '#ffe066'],
    flowerChance: 0.45, plantChance: 0.9, snow: false,
    particles: { kind: 'petal', colors: ['#ffc0dc', '#f7a1c8', '#ffe3ef'], count: 260 },
  },
  summer: {
    grass: ['#5fb043', '#4f9c39', '#73c454', '#47902f'],
    leaves: [
      ['#3f9a3a', '#348533', '#55b04a', '#2c7a2c'],
      ['#4ea640', '#3f9136', '#64bc52', '#37802f'],
      ['#2f8a48', '#27783e', '#3f9e58', '#226a36'],
    ],
    tallGrass: ['#5aaa42', '#4a9636', '#70c052'],
    flowers: ['#ffd23f', '#ff6b6b', '#9ec9ff'],
    flowerChance: 0.25, plantChance: 1, snow: false,
    particles: { kind: 'pollen', colors: ['#fff3b0', '#ffffff'], count: 110 },
  },
  autumn: {
    grass: ['#9fae4c', '#8b9a40', '#b3bd5c', '#7a8a38'],
    leaves: [
      ['#ec8a2c', '#d7721f', '#f6a744', '#c45f1a'],
      ['#cf4a2c', '#b53b22', '#e2653e', '#9e3020'],
      ['#e9c443', '#d4ab2e', '#f5d965', '#bf9524'],
    ],
    tallGrass: ['#b4a04a', '#9c8a3c', '#c8b25a'],
    flowers: ['#ec8a2c', '#cf4a2c', '#f0d060'],
    flowerChance: 0.15, plantChance: 0.6, snow: false,
    particles: { kind: 'leaf', colors: ['#ec8a2c', '#cf4a2c', '#e9c443', '#d7721f'], count: 200 },
  },
  winter: {
    grass: ['#f2f6fb', '#e3ebf5', '#ffffff', '#d6e1ee'],
    leaves: [
      ['#2f5f48', '#28533f', '#3a6e55', '#21473a'],
      ['#3a6a4a', '#30593f', '#467a57', '#284d36'],
      ['#2a5546', '#234a3d', '#356452', '#1d4034'],
    ],
    tallGrass: ['#8a7a5a', '#7a6a4a', '#9a8a6a'],
    flowers: ['#ffffff', '#ffffff', '#ffffff'],
    flowerChance: 0, plantChance: 0.12, snow: true,
    particles: { kind: 'snow', colors: ['#ffffff', '#eef4ff'], count: 700 },
  },
};

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * S;
  canvas.height = ROWS * S;
  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = canvas.width;
  emissiveCanvas.height = canvas.height;
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = waterCanvas.height = S;

  const tex = (c, repeat) => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const map = tex(canvas), emissiveMap = tex(emissiveCanvas), waterMap = tex(waterCanvas, true);

  function paint(seasonName) {
    const season = SEASONS[seasonName];
    const g = canvas.getContext('2d');
    const eg = emissiveCanvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    eg.fillStyle = '#000';
    eg.fillRect(0, 0, canvas.width, canvas.height);
    const r = rng(42);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];

    const tile = (id, draw) => {
      const ox = (id % COLS) * S, oy = Math.floor(id / COLS) * S;
      const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < S && y < S) { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); } };
      const glow = (x, y, c) => { eg.fillStyle = c; eg.fillRect(ox + x, oy + y, 1, 1); };
      draw(px, glow);
    };
    const noiseFill = (px, palette, weights) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let v = r(), i = 0;
        if (weights) { while (i < weights.length - 1 && (v -= weights[i]) > 0) i++; } else i = Math.floor(v * palette.length);
        px(x, y, palette[i]);
      }
    };

    const DIRT = ['#8a5a3a', '#7a4e32', '#966644', '#6b432b'];
    const grassW = [0.58, 0.22, 0.12, 0.08];

    tile(T.grassTop, (px) => {
      noiseFill(px, season.grass, grassW);
      if (season.snow) for (let i = 0; i < 6; i++) px(Math.floor(r() * S), Math.floor(r() * S), '#c9d8ea');
    });
    tile(T.grassSide, (px) => {
      noiseFill(px, DIRT, [0.4, 0.3, 0.2, 0.1]);
      for (let x = 0; x < S; x++) {
        const depth = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 1 : 0) + (r() < 0.08 ? 2 : 0);
        for (let y = 0; y < depth; y++) px(x, y, pick(season.grass));
      }
    });
    tile(T.dirt, (px) => {
      noiseFill(px, DIRT, [0.4, 0.3, 0.2, 0.1]);
      for (let i = 0; i < 6; i++) px(Math.floor(r() * S), Math.floor(r() * S), '#5a3822');
    });
    const stoneFill = (px) => {
      noiseFill(px, ['#8f8f93', '#828287', '#9c9ca0', '#76767b'], [0.35, 0.3, 0.2, 0.15]);
      for (let i = 0; i < 5; i++) {
        const y = Math.floor(r() * S), x0 = Math.floor(r() * S), len = 2 + Math.floor(r() * 4);
        for (let x = x0; x < x0 + len; x++) px(x % S, y, '#6a6a70');
      }
    };
    tile(T.stone, stoneFill);
    tile(T.sand, (px) => noiseFill(px, ['#e8d7a0', '#dccb92', '#f0e2b0', '#d2c088'], [0.4, 0.3, 0.2, 0.1]));
    tile(T.logSide, (px) => {
      const cols = ['#6b4a2b', '#5c3f24', '#7a5633', '#523720'];
      for (let x = 0; x < S; x++) {
        const base = cols[(x * 7 + 3) % 4 === 0 ? 3 : x % 3];
        for (let y = 0; y < S; y++) px(x, y, r() < 0.12 ? pick(cols) : base);
      }
    });
    tile(T.logTop, (px) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        px(x, y, d > 6.5 ? '#5c3f24' : Math.floor(d) % 2 ? '#b08a5a' : '#9c7748');
      }
    });
    [T.leaves0, T.leaves1, T.leaves2].forEach((id, i) => tile(id, (px) => {
      const pal = season.leaves[i];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (season.snow && r() < (y < 6 ? 0.55 : 0.12)) { px(x, y, r() < 0.8 ? '#ffffff' : '#dfe9f5'); continue; }
        // Soft clusters: light on top-left, darker towards bottom-right, little noise.
        const v = r() + (x + y - 15) * 0.02;
        px(x, y, pal[v < 0.2 ? 2 : v < 0.75 ? 0 : v < 0.93 ? 1 : 3]);
      }
    }));
    tile(T.planks, (px) => {
      const cols = ['#b5874f', '#a67a46', '#c09358'];
      for (let row = 0; row < 4; row++) {
        const base = cols[row % 3], seam = (row * 5 + 3) % S;
        for (let y = row * 4; y < row * 4 + 4; y++) for (let x = 0; x < S; x++) {
          const edge = y % 4 === 3 || x === seam;
          px(x, y, edge ? '#7d5a33' : r() < 0.1 ? '#9c6f40' : base);
        }
      }
    });
    tile(T.cobble, (px) => {
      noiseFill(px, ['#5f5f64'], null);
      for (let i = 0; i < 9; i++) {
        const cx = Math.floor(r() * S), cy = Math.floor(r() * S), rad = 2 + Math.floor(r() * 2);
        const c = pick(['#8f8f95', '#7d7d83', '#9c9ca2', '#86868c']);
        for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
          if (x * x + y * y <= rad * rad) px(mod(cx + x), mod(cy + y), c);
        }
      }
      if (seasonName === 'spring' || seasonName === 'summer') for (let i = 0; i < 6; i++) px(Math.floor(r() * S), Math.floor(r() * S), '#4f8a3a');
    });
    tile(T.roof, (px) => {
      const cols = ['#7a3b2a', '#6b3324', '#8a4532'];
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let y = row * 4; y < row * 4 + 4; y++) for (let x = 0; x < S; x++) {
          const edge = y % 4 === 3 || (x + off) % 8 === 0;
          px(x, y, edge ? '#4a2318' : y % 4 === 0 ? '#9a5540' : cols[(row + (x + off >> 3)) % 3]);
        }
      }
      if (season.snow) for (let x = 0; x < S; x++) for (let y = 0; y < 3 + (r() < 0.5 ? 1 : 0); y++) px(x, y, '#f4f8fc');
    });
    tile(T.window, (px, glow) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const frame = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8 || y === 7 || y === 8;
        if (frame) px(x, y, '#5a3d24');
        else {
          px(x, y, (x + y) % 7 === 0 ? '#d4ecfa' : '#8fb9d6');
          glow(x, y, (x + y) % 5 === 0 ? '#ffe2a0' : '#ffc66e');
        }
      }
    });
    tile(T.path, (px) => {
      noiseFill(px, ['#9c7b4f', '#8c6d45', '#ab8a5c', '#7f6240'], [0.35, 0.3, 0.2, 0.15]);
      for (let i = 0; i < 4; i++) px(Math.floor(r() * S), Math.floor(r() * S), '#b9b2a2');
      if (season.snow) for (let i = 0; i < 70; i++) px(Math.floor(r() * S), Math.floor(r() * S), '#eef3f9');
    });
    tile(T.birch, (px) => {
      noiseFill(px, ['#e8e4dc', '#d8d4cc', '#f2efe8'], [0.5, 0.3, 0.2]);
      for (let i = 0; i < 6; i++) {
        const y = Math.floor(r() * S), x0 = Math.floor(r() * S), len = 2 + Math.floor(r() * 3);
        for (let x = x0; x < x0 + len; x++) px(x % S, y, '#3a3a3a');
      }
    });
    tile(T.door, (px) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 0 || x === 15 || x % 5 === 0;
        px(x, y, edge ? '#4a3220' : r() < 0.1 ? '#5c3f26' : '#6b4a2b');
      }
      px(12, 8, '#d0b060');
      px(12, 9, '#a08840');
    });
    tile(T.tallGrass, (px) => {
      const pal = season.tallGrass;
      for (let i = 0; i < 8; i++) {
        let x = 1 + Math.floor(r() * 14);
        const h = 6 + Math.floor(r() * 9);
        const c = pick(pal);
        for (let y = 15; y > 15 - h; y--) {
          px(x, y, c);
          if (r() < 0.15) x += r() < 0.5 ? -1 : 1;
        }
      }
    });
    [T.flower0, T.flower1, T.flower2].forEach((id, i) => tile(id, (px) => {
      const stem = season.tallGrass[0];
      for (let y = 8; y < 16; y++) px(7, y, stem);
      px(6, 12, stem); px(5, 11, stem); px(8, 13, stem); px(9, 12, stem);
      const c = season.flowers[i];
      for (let y = 4; y < 8; y++) for (let x = 5; x < 10; x++) if (!((x === 5 || x === 9) && (y === 4 || y === 7))) px(x, y, c);
      px(7, 5, '#f7d04a'); px(7, 6, '#e0a830');
    }));
    tile(T.bush, (px) => {
      for (let i = 0; i < 6; i++) {
        let x = 4 + Math.floor(r() * 8);
        for (let y = 15; y > 7 + Math.floor(r() * 4); y--) { px(x, y, '#7a5a3a'); if (r() < 0.3) x += r() < 0.5 ? -1 : 1; }
      }
    });

    // ---- crops ----
    tile(T.farmland, (px) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const ridge = y % 4 === 0 || y % 4 === 1;
        let c = ridge ? (r() < 0.5 ? '#6e4a2e' : '#674429') : (r() < 0.5 ? '#4a301d' : '#523520');
        if (season.snow && (ridge ? r() < 0.95 : r() < 0.7)) c = r() < 0.85 ? '#f2f6fb' : '#dde6f0';
        px(x, y, c);
      }
    });
    const stalks = (px, count, minH, maxH, stem, head) => {
      for (let i = 0; i < count; i++) {
        const x = 1 + Math.floor(r() * 14), h = minH + Math.floor(r() * (maxH - minH + 1));
        for (let y = 15; y > 15 - h; y--) px(x, y, pick(stem));
        if (head) for (let y = 16 - h; y < 16 - h + 3; y++) { px(x, y, pick(head)); if (r() < 0.5) px(x + 1, y, pick(head)); }
      }
    };
    tile(T.wheat0, (px) => stalks(px, 6, 2, 4, ['#6cc04f', '#5aa843'], null));
    tile(T.wheat1, (px) => stalks(px, 11, 6, 10, ['#6cc04f', '#5aa843', '#7cd05e'], null));
    tile(T.wheat2, (px) => stalks(px, 14, 11, 15, ['#8fb848', '#a3c050', '#7aa83e'], ['#d6d070', '#c8c060']));
    tile(T.wheat3, (px) => stalks(px, 14, 12, 15, ['#c8a040', '#d8b450', '#b89038'], ['#e8c860', '#f0d470', '#d0a840']));
    tile(T.stubble, (px) => stalks(px, 12, 1, 3, ['#c8a040', '#a88a3a'], null));

    // ---- ores: stone with chunky veins; the crystal glows a little at night ----
    const ore = (id, pal, glowColor) => tile(id, (px, glow) => {
      stoneFill(px);
      for (let k = 0; k < 6; k++) {
        const cx = 1 + ((k % 3) * 5 + Math.floor(r() * 3)), cy = 2 + (Math.floor(k / 3) * 7 + Math.floor(r() * 4));
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [2, 1], [1, 2]]) {
          if (Math.abs(dx) + Math.abs(dy) > 1 && r() < 0.4) continue;
          const c = dy < 0 || dx < 0 ? pal[0] : dx && dy ? pal[2] : pal[1];   // lit top-left, shaded corner
          px(cx + dx, cy + dy, c);
          if (glowColor) glow(cx + dx, cy + dy, glowColor);
        }
      }
    });
    ore(T.oreCoal, ['#56565e', '#26262c', '#141418']);
    ore(T.oreCopper, ['#ffb070', '#e07f3a', '#6cc4a4']);
    ore(T.oreGold, ['#fff6b0', '#ffd23e', '#c09020']);
    ore(T.oreCrystal, ['#e8fbff', '#8fe4f4', '#4ab0d8'], '#4a9ab0');

    // Water (or ice in winter): its own repeating texture.
    const wg = waterCanvas.getContext('2d');
    const wr = rng(7);
    const wpal = season.snow ? ['#cfe6f5', '#bcdcf0', '#e2f1fa', '#c4e0f2'] : ['#3f76c4', '#4a82cf', '#3a6bb5', '#5b93da'];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { wg.fillStyle = wpal[Math.floor(wr() * 4)]; wg.fillRect(x, y, 1, 1); }
    wg.fillStyle = season.snow ? '#a6c8e0' : '#8ab8ec';
    for (let i = 0; i < 5; i++) {
      const y = Math.floor(wr() * S), x0 = Math.floor(wr() * S), len = 3 + Math.floor(wr() * 5);
      for (let x = x0; x < x0 + len; x++) wg.fillRect(x % S, season.snow ? (y + x - x0) % S : y, 1, 1);
    }

    map.needsUpdate = emissiveMap.needsUpdate = waterMap.needsUpdate = true;
  }

  const mod = (v) => ((v % S) + S) % S;
  return { map, emissiveMap, waterMap, paint };
}
