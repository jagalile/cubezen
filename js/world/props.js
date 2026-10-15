// Hand-built details: the farm's fence, scarecrow, pumpkins and hay bales, a little wooden
// dock on the river with a moored rowboat, a camping tent by the meadow, fences along the
// path and the mine's yard (rails, a minecart, tools, ore). Seasonal bits are toggled in setSeason.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './textures.js';

const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const tmp = new THREE.Color();

// A box baked into world space with a flat vertex colour, ready to be merged.
function piece(w, h, d, x, y, z, color, rotY = 0, rotZ = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  tmp.set(color);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function merged(pieces) {
  const m = new THREE.Mesh(mergeGeometries(pieces), vcMat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function pixelTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const r = rng(808);
// Greyscale ribs so one texture can be tinted green (summer) or orange (autumn).
const pumpkinTex = pixelTexture((g) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    g.fillStyle = x % 4 === 0 ? '#b8b8b8' : r() < 0.15 ? '#e8e8e8' : '#ffffff';
    g.fillRect(x, y, 1, 1);
  }
});
const hayTex = pixelTexture((g) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const band = y === 4 || y === 11;
    g.fillStyle = band ? '#7a5a2a' : ['#e8c860', '#d8b450', '#f0d478', '#c8a040'][Math.floor(r() * 4)];
    g.fillRect(x, y, 1, 1);
  }
});

export function createProps(scene, world) {
  const { farm, dock, ground, WL } = world;
  const seasonal = { autumn: [], winter: [] };

  // ---- farm fence (gate on the side facing the campfire) ----
  const wood = ['#8a6440', '#7d5a38', '#946c46'];
  const fence = [];
  const cells = [];
  for (let x = farm.x0 - 1; x <= farm.x1 + 1; x++) cells.push([x, farm.z0 - 1, 'x'], [x, farm.z1 + 1, 'x']);
  for (let z = farm.z0; z <= farm.z1; z++) cells.push([farm.x0 - 1, z, 'z'], [farm.x1 + 1, z, 'z']);
  const isGate = (x, z) => x === farm.x1 + 1 && (z === farm.z0 + 4 || z === farm.z0 + 5);
  // Short runs beside the path.
  for (const [x0, z0, x1, z1] of world.fences) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) cells.push([x, z]);
  }
  const posts = new Set(cells.filter(([x, z]) => !isGate(x, z)).map(([x, z]) => x + ',' + z));
  for (const [x, z] of cells) {
    if (isGate(x, z)) continue;
    const y = ground(x + 0.5, z + 0.5);
    fence.push(piece(0.25, 1.15, 0.25, x + 0.5, y + 0.575, z + 0.5, wood[(x + z) % 3]));
    for (const [dx, dz] of [[1, 0], [0, 1]]) {                       // rails to the next post
      if (!posts.has(x + dx + ',' + (z + dz))) continue;
      for (const h of [0.45, 0.85]) {
        fence.push(dx
          ? piece(1, 0.1, 0.08, x + 1, y + h, z + 0.5, wood[1])
          : piece(0.08, 0.1, 1, x + 0.5, y + h, z + 1, wood[1]));
      }
    }
  }
  scene.add(merged(fence));

  // ---- scarecrow ----
  const sx = farm.x0 + 5.5, sz = farm.z0 + 5.5, sy = ground(sx, sz);
  scene.add(merged([
    piece(0.14, 2.0, 0.14, sx, sy + 1.0, sz, '#6b4a2b'),
    piece(1.5, 0.12, 0.12, sx, sy + 1.5, sz, '#6b4a2b'),
    piece(0.5, 0.6, 0.28, sx, sy + 1.35, sz, '#5a7ab0'),
    piece(0.5, 0.12, 0.29, sx, sy + 1.1, sz, '#7a5a3a'),
    piece(0.18, 0.18, 0.16, sx - 0.78, sy + 1.5, sz, '#e0c060'),
    piece(0.18, 0.18, 0.16, sx + 0.78, sy + 1.5, sz, '#e0c060'),
    piece(0.42, 0.42, 0.42, sx, sy + 1.88, sz, '#d8c08a'),
    piece(0.06, 0.06, 0.02, sx - 0.1, sy + 1.92, sz + 0.215, '#2a2a2a'),
    piece(0.06, 0.06, 0.02, sx + 0.1, sy + 1.92, sz + 0.215, '#2a2a2a'),
    piece(0.66, 0.06, 0.66, sx, sy + 2.12, sz, '#5a3e24'),
    piece(0.36, 0.24, 0.36, sx, sy + 2.27, sz, '#5a3e24'),
  ]));
  const scarecrowSnow = merged([piece(0.38, 0.06, 0.38, sx, sy + 2.42, sz, '#f4f8fc'), piece(0.5, 0.05, 0.3, sx, sy + 1.68, sz, '#f4f8fc')]);
  scene.add(scarecrowSnow);
  seasonal.winter.push(scarecrowSnow);

  // ---- pumpkins along the front row ----
  const pumpkinMat = new THREE.MeshLambertMaterial({ map: pumpkinTex });
  const pumpkins = [];
  for (let x = farm.x0; x <= farm.x1; x += 2) {
    const px = x + 0.5 + (r() - 0.5) * 0.2, pz = farm.z1 + 0.5, py = ground(px, pz);
    const p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.6, 0.72), pumpkinMat);
    body.position.y = 0.3;
    body.castShadow = true;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), new THREE.MeshLambertMaterial({ color: 0x5a6a2a }));
    stem.position.y = 0.66;
    p.add(body, stem);
    p.position.set(px, py, pz);
    p.rotation.y = r() * 0.6 - 0.3;
    scene.add(p);
    pumpkins.push(p);
  }

  // ---- hay bales stacked by the field after the harvest ----
  const hayMat = new THREE.MeshLambertMaterial({ map: hayTex });
  const hay = new THREE.Group();
  for (const [dx, dy, dz, rot] of [[0, 0, 0, 0], [1.05, 0, 0.1, 0.1], [0.5, 1, 0.05, -0.05], [0.2, 0, 1.1, 1.57]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hayMat);
    b.position.set(dx, dy + 0.5, dz);
    b.rotation.y = rot;
    b.castShadow = b.receiveShadow = true;
    hay.add(b);
  }
  hay.position.set(farm.x0 - 3.2, ground(farm.x0 - 3, farm.z0 + 1), farm.z0 + 0.5);
  scene.add(hay);
  seasonal.autumn.push(hay);

  // ---- the dock: a plank pier on posts, with a barrel and a moored rowboat ----
  const deckY = WL + 1.15, waterY = WL + 1 - 0.14;
  const planks = ['#9c7448', '#8a6640', '#a8804f', '#94704a'];
  const deck = [];
  // Walkway from the bank, ending in a wider T-shaped landing over the water.
  for (let x = dock.x + 2.0, i = 0; x < dock.x + 6.2; x += 0.34, i++) {
    deck.push(piece(0.3, 0.12, 1.7, x, deckY, dock.z, planks[i % 4], (r() - 0.5) * 0.03));
  }
  for (let x = dock.x + 0.45, i = 0; x < dock.x + 2.0; x += 0.34, i++) {
    deck.push(piece(0.3, 0.12, 3.3, x, deckY, dock.z, planks[(i + 2) % 4], (r() - 0.5) * 0.02));
  }
  for (const dz of [-0.7, 0.7]) deck.push(piece(4.4, 0.14, 0.14, dock.x + 4.1, deckY - 0.13, dock.z + dz, '#6b4a2b'));
  for (const dz of [-1.5, 1.5]) deck.push(piece(1.7, 0.14, 0.14, dock.x + 1.2, deckY - 0.13, dock.z + dz, '#6b4a2b'));
  for (const [px, dz] of [[0.4, -1.62], [0.4, 1.62], [1.95, -1.62], [1.95, 1.62], [3.4, -0.82], [3.4, 0.82], [4.9, -0.82], [4.9, 0.82]]) {
    deck.push(piece(0.24, deckY + 0.3 - (WL - 1), 0.24, dock.x + px, (deckY + 0.3 + WL - 1) / 2, dock.z + dz, '#5c3f24'));
  }
  // barrel at the land end, a coil of rope and the mooring line to the boat
  deck.push(piece(0.6, 0.75, 0.6, dock.x + 5.3, deckY + 0.43, dock.z - 0.35, '#7a5232'));
  deck.push(piece(0.62, 0.07, 0.62, dock.x + 5.3, deckY + 0.25, dock.z - 0.35, '#3a3a40'));
  deck.push(piece(0.62, 0.07, 0.62, dock.x + 5.3, deckY + 0.62, dock.z - 0.35, '#3a3a40'));
  deck.push(piece(0.4, 0.08, 0.4, dock.x + 4.4, deckY + 0.1, dock.z + 0.4, '#c8b080'));
  deck.push(piece(0.05, 0.05, 0.6, dock.x + 1.95, deckY + 0.25, dock.z - 1.95, '#c8b080'));
  scene.add(merged(deck));
  const deckSnow = merged([piece(4.2, 0.05, 1.7, dock.x + 4.1, deckY + 0.085, dock.z, '#f4f8fc'), piece(1.6, 0.05, 3.3, dock.x + 1.2, deckY + 0.085, dock.z, '#f4f8fc'), piece(0.6, 0.05, 0.6, dock.x + 5.3, deckY + 0.83, dock.z - 0.35, '#f4f8fc')]);
  scene.add(deckSnow);
  seasonal.winter.push(deckSnow);

  // ---- camp: an A-frame tent facing the fire, a woodpile, crates and a chopping stump ----
  const { camp } = world;
  const tx = camp.x0 + 3.2, tz = camp.z0 + 3.6, ty = ground(tx, tz);
  const facing = Math.atan2(58 - tx, 90 - tz);                        // open towards the fire and the viewer
  const tent = new THREE.Group();
  const canvas = '#dccaa0', shade = '#b9a47c', inside = '#4a3826', trim = '#a8553a';
  const half = 1.35, tall = 1.9, len = 3.0, slant = Math.hypot(half, tall), pitch = Math.atan2(tall, half);
  const tentParts = [
    piece(slant, 0.08, len, -half / 2, tall / 2, 0, canvas, 0, pitch),
    piece(slant, 0.08, len, half / 2, tall / 2, 0, shade, 0, -pitch),
    piece(0.1, 0.12, len, -half + 0.05, 0.06, 0, trim),                 // red hems along the bottom
    piece(0.1, 0.12, len, half - 0.05, 0.06, 0, trim),
    piece(0.12, 0.12, len + 0.5, 0, tall + 0.02, 0, '#6b4a2b'),       // ridge pole
    piece(0.1, tall + 0.1, 0.1, 0, (tall + 0.1) / 2, len / 2 + 0.2, '#6b4a2b'),
    piece(0.1, tall + 0.1, 0.1, 0, (tall + 0.1) / 2, -len / 2 - 0.2, '#6b4a2b'),
    piece(2.2, 0.04, len - 0.2, 0, 0.02, 0, inside),                   // groundsheet
    piece(0.8, 0.14, 1.8, -0.25, 0.09, -0.3, '#5d7aa8'),               // bedroll and pillow
    piece(0.5, 0.12, 0.35, -0.25, 0.2, -1.0, '#e8e0d0'),
  ];
  // Stepped back wall and front flaps tied open (blocky triangles).
  for (let i = 0; i < 5; i++) {
    const w = (half * 2 - 0.1) * (1 - i / 5), y = (i + 0.5) * (tall / 5);
    tentParts.push(piece(w, tall / 5, 0.06, 0, y, -len / 2 + 0.03, shade));
    const fw = w * 0.32;
    for (const side of [-1, 1]) tentParts.push(piece(fw, tall / 5, 0.06, side * (w / 2 - fw / 2), y, len / 2 - 0.03, side < 0 ? canvas : shade));
  }
  tent.add(merged(tentParts));
  const tentSnow = merged([
    piece(slant * 0.9, 0.06, len + 0.05, -half / 2 - 0.03, tall / 2 + 0.05, 0, '#f4f8fc', 0, pitch),
    piece(slant * 0.9, 0.06, len + 0.05, half / 2 + 0.03, tall / 2 + 0.05, 0, '#f4f8fc', 0, -pitch),
  ]);
  tent.add(tentSnow);
  seasonal.winter.push(tentSnow);
  tent.position.set(tx, ty, tz);
  tent.rotation.y = facing;
  tent.scale.setScalar(1.2);
  scene.add(tent);

  const camping = [];
  // Woodpile: logs stacked 3-2-1 with light cut ends, against the side of the tent.
  const wx = camp.x0 + 6.2, wz = camp.z0 + 2.4, wy = ground(wx, wz);
  [[-0.36, 0], [0, 0], [0.36, 0], [-0.18, 1], [0.18, 1], [0, 2]].forEach(([dx, row], i) => {
    const y = wy + 0.17 + row * 0.31;
    camping.push(piece(0.32, 0.32, 1.3, wx + dx, y, wz, wood[i % 3]));
    for (const e of [-0.655, 0.655]) camping.push(piece(0.24, 0.24, 0.02, wx + dx, y, wz + e, '#d8b888'));
  });
  // Crates by the tent's front corner, one on top of the other.
  const cx = camp.x0 + 0.6, cz = camp.z0 + 4.4, cy = ground(cx, cz);
  for (const [dx, dy, dz, s, rot] of [[0, 0, 0, 0.75, 0.15], [0.85, 0, 0.2, 0.65, -0.2], [0.05, 0.75, 0.05, 0.6, 0.5]]) {
    camping.push(piece(s, s, s, cx + dx, cy + dy + s / 2, cz + dz, '#a07446', rot));
    camping.push(piece(s + 0.02, 0.08, s + 0.02, cx + dx, cy + dy + s * 0.75, cz + dz, '#6b4a2b', rot));
    camping.push(piece(s + 0.02, 0.08, s + 0.02, cx + dx, cy + dy + s * 0.25, cz + dz, '#6b4a2b', rot));
  }
  // Chopping stump with an axe, near the woodpile.
  const kx = camp.x0 + 5.6, kz = camp.z0 + 6.0, ky = ground(kx, kz);
  camping.push(piece(0.7, 0.5, 0.7, kx, ky + 0.25, kz, '#6e4c2c'));
  camping.push(piece(0.6, 0.02, 0.6, kx, ky + 0.51, kz, '#c8a070'));
  camping.push(piece(0.08, 0.75, 0.08, kx + 0.12, ky + 0.82, kz, '#8a6440', 0, -0.35));
  camping.push(piece(0.3, 0.2, 0.06, kx + 0.02, ky + 0.56, kz, '#9aa0aa', 0, -0.35));
  scene.add(merged(camping));

  // ---- bushes along the path: evergreen clumps, with berries in autumn and snow in winter ----
  const bushGreens = ['#3f6e34', '#4b7d3a', '#365f2e'];
  const berries = [], bushSnow = [], bushParts = [];
  world.bushes.forEach(([x, z, big], i) => {
    const bx = x + 0.5, bz = z + 0.5, by = ground(bx, bz), s = big ? 1.25 : 0.85;
    for (const [dx, dy, dz, w] of [[0, 0, 0, 1], [0.35, -0.12, 0.2, 0.75], [-0.3, -0.1, -0.15, 0.8], [0.05, 0.3, -0.05, 0.6]]) {
      const size = w * s;
      bushParts.push(piece(size, size * 0.8, size, bx + dx * s, by + size * 0.4 + dy * s + (dy > 0 ? 0.25 * s : 0), bz + dz * s, bushGreens[(i + Math.round(w * 10)) % 3], i + w));
    }
    for (let k = 0; k < 5; k++) {
      const a = k * 2.4 + i, rad = 0.52 * s;
      berries.push(piece(0.1, 0.1, 0.1, bx + Math.cos(a) * rad, by + (0.35 + (k % 3) * 0.18) * s, bz + Math.sin(a) * rad, '#c8322a'));
    }
    bushSnow.push(piece(0.7 * s, 0.07, 0.7 * s, bx, by + 0.86 * s, bz, '#f4f8fc', i));
  });
  scene.add(merged(bushParts));
  const berryMesh = merged(berries), snowMesh = merged(bushSnow);
  scene.add(berryMesh, snowMesh);
  seasonal.autumn.push(berryMesh);
  seasonal.winter.push(snowMesh);

  // ---- the mine's yard: a track out of the tunnel, a loaded minecart, tools and ore piles ----
  const { mine } = world;
  const yard = [], yardSnow = [];
  const ORE = { coal: '#2a2a30', copper: '#c87533', gold: '#e8c040', crystal: '#8fd8e8', rock: '#85858c' };
  const mz = mine.z + 0.5, railIn = mine.face + 7, railOut = mine.face - 6;   // the track runs west out of the hill
  for (let x = railOut + 0.25; x < railIn; x += 0.5) {                   // sleepers
    yard.push(piece(0.22, 0.08, 1.1, x, world.G + 1.04, mz, wood[Math.round(x * 2) % 3]));
  }
  for (const dz of [-0.32, 0.32]) {
    yard.push(piece(railIn - railOut, 0.1, 0.08, (railIn + railOut) / 2, world.G + 1.12, mz + dz, '#5a5a62'));
  }
  yard.push(piece(0.25, 0.4, 1.0, railOut - 0.1, world.G + 1.2, mz, '#6b4a2b'));   // buffer at the end
  // Minecart: an iron tub on little wheels, heaped with ore.
  const cartX = mine.face - 3.2, cartY = world.G + 1.22;
  yard.push(piece(1.25, 0.55, 0.95, cartX, cartY + 0.38, mz, '#6e6e76'));
  yard.push(piece(1.3, 0.1, 1.0, cartX, cartY + 0.62, mz, '#4a4a52'));
  yard.push(piece(1.1, 0.1, 0.8, cartX, cartY + 0.6, mz, '#3a2a1e'));
  for (const [dx, dz] of [[-0.38, -0.45], [0.38, -0.45], [-0.38, 0.45], [0.38, 0.45]]) {
    yard.push(piece(0.26, 0.26, 0.1, cartX + dx, cartY, mz + dz, '#2d2d33'));
  }
  const kinds = Object.keys(ORE);
  const chunk = (x, y, z, size, kind, i) => yard.push(piece(size, size, size, x, y + size / 2, z, ORE[kind], i * 0.7));
  for (let i = 0; i < 9; i++) {                                        // the cart's load
    chunk(cartX + (Math.floor(i / 3) - 1) * 0.32, cartY + 0.62 + (i % 2) * 0.08, mz + ((i % 3) - 1) * 0.26, 0.26, kinds[i % 4], i);
  }
  // Ore piles on both sides of the track, sorted roughly by kind, plus spoil rock.
  [[mine.face - 1.8, mine.z - 1.6, 'coal'], [mine.face - 4.4, mine.z - 1.8, 'copper'], [mine.face - 2.4, mine.z + 3.4, 'rock'], [mine.face - 4.6, mine.z + 4.2, 'gold']].forEach(([px, pz, kind], p) => {
    const py = world.G + 1;
    for (let i = 0; i < 9; i++) {
      const a = i * 2.3 + p, rad = i < 6 ? 0.45 : 0.18, size = kind === 'rock' ? 0.36 : 0.3;
      chunk(px + Math.cos(a) * rad, py + (i < 6 ? 0 : 0.26), pz + Math.sin(a) * rad, size, kind, i + p);
    }
    yardSnow.push(piece(0.7, 0.06, 0.7, px, py + 0.5, pz, '#f4f8fc', p));
  });
  // A crate of gold and crystal chunks, and a barrel.
  const crateX = mine.face - 0.7, crateZ = mine.z - 2.2, crateY = world.G + 1;
  yard.push(piece(0.8, 0.55, 0.8, crateX, crateY + 0.275, crateZ, '#a07446', 0.2));
  yard.push(piece(0.82, 0.08, 0.82, crateX, crateY + 0.5, crateZ, '#6b4a2b', 0.2));
  for (let i = 0; i < 4; i++) chunk(crateX + ((i % 2) - 0.5) * 0.3, crateY + 0.52, crateZ + (Math.floor(i / 2) - 0.5) * 0.3, 0.22, i % 2 ? 'gold' : 'crystal', i);
  yard.push(piece(0.6, 0.8, 0.6, mine.face - 5.5, world.G + 1.4, mine.z - 2.3, '#7a5232'));
  yard.push(piece(0.62, 0.07, 0.62, mine.face - 5.5, world.G + 1.6, mine.z - 2.3, '#3a3a40'));
  // Tools leaning on the rock face beside the mouth: a pickaxe and a shovel.
  const toolX = mine.face - 0.12, toolY = world.G + 1;
  yard.push(piece(0.08, 1.4, 0.08, toolX, toolY + 0.68, mine.z + 2.95, '#8a6440', 0, 0));
  yard.push(piece(0.1, 0.12, 0.85, toolX, toolY + 1.34, mine.z + 3.05, '#7c8088'));
  yard.push(piece(0.1, 0.1, 0.14, toolX, toolY + 1.28, mine.z + 2.62, '#7c8088'));
  yard.push(piece(0.1, 0.1, 0.14, toolX, toolY + 1.28, mine.z + 3.48, '#7c8088'));
  yard.push(piece(0.07, 1.25, 0.07, toolX, toolY + 0.72, mine.z - 1.0, '#8a6440'));
  yard.push(piece(0.05, 0.38, 0.3, toolX, toolY + 0.2, mine.z - 1.0, '#7c8088'));
  yard.push(piece(0.07, 0.06, 0.24, toolX, toolY + 1.35, mine.z - 1.0, '#6b4a2b'));
  // A pickaxe left stuck in the coal pile.
  const pickX = mine.face - 1.8, pickZ = mine.z - 1.6, pickY = world.G + 1;
  yard.push(piece(0.07, 1.0, 0.07, pickX + 0.1, pickY + 0.85, pickZ, '#8a6440', 0, -0.5));
  yard.push(piece(0.7, 0.1, 0.09, pickX + 0.34, pickY + 1.3, pickZ, '#7c8088', 0, -0.5 + Math.PI / 2 - 0.25));
  // The darkness inside the tunnel, past the last timber set.
  yard.push(piece(0.1, 3, 3, mine.face + 7.4, world.G + 2.5, mz, '#0e0c10'));
  scene.add(merged(yard));
  const yardSnowMesh = merged(yardSnow);
  scene.add(yardSnowMesh);
  seasonal.winter.push(yardSnowMesh);

  // ---- around the cabin: the west terrace, the balcony, the porch and flower boxes ----
  const { G, cabin, terrace } = world;
  const home = [], blooms = [], homeSnow = [];
  const flowerColors = ['#e8607a', '#f0c040', '#f4f0f8', '#b07ad8', '#ff8a4c'];
  const pot = (x, y, z, i, big) => {                                    // clay pot with a leafy plant
    const s = big ? 1.3 : 1;
    home.push(piece(0.36 * s, 0.32 * s, 0.36 * s, x, y + 0.16 * s, z, '#b8643c'));
    home.push(piece(0.4 * s, 0.07, 0.4 * s, x, y + 0.31 * s, z, '#a0522d'));
    home.push(piece(0.42 * s, 0.3 * s, 0.42 * s, x, y + 0.48 * s, z, bushGreens[i % 3], i));
    for (let k = 0; k < 3; k++) blooms.push(piece(0.1, 0.1, 0.1, x + (k - 1) * 0.13 * s, y + (0.62 + (k % 2) * 0.06) * s, z + ((k * 7) % 3 - 1) * 0.12, flowerColors[(i + k) % 5]));
    homeSnow.push(piece(0.36 * s, 0.05, 0.36 * s, x, y + 0.66 * s, z, '#f4f8fc', i));
  };
  // Terrace: a table with a teapot and mugs, two chairs and pots along the railing.
  const tbx = terrace.x0 + 2, tbz = terrace.z0 + 3.5, fy = G + 1;
  home.push(piece(1.3, 0.1, 1.0, tbx, fy + 0.75, tbz, '#a8804f'));
  for (const [dx, dz] of [[-0.5, -0.36], [0.5, -0.36], [-0.5, 0.36], [0.5, 0.36]]) home.push(piece(0.1, 0.72, 0.1, tbx + dx, fy + 0.36, tbz + dz, '#6b4a2b'));
  home.push(piece(0.24, 0.2, 0.24, tbx + 0.2, fy + 0.9, tbz, '#5d7aa8'), piece(0.08, 0.08, 0.2, tbx + 0.36, fy + 0.95, tbz, '#5d7aa8'));
  home.push(piece(0.12, 0.13, 0.12, tbx - 0.3, fy + 0.865, tbz - 0.2, '#f0e8d8'), piece(0.12, 0.13, 0.12, tbx - 0.25, fy + 0.865, tbz + 0.25, '#e8a07a'));
  for (const side of [-1, 1]) {                                          // chairs on either side of the table
    const chz = tbz + side * 1.0;
    home.push(piece(0.6, 0.08, 0.55, tbx, fy + 0.45, chz, '#946c46'));
    for (const [dx, dz] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) home.push(piece(0.08, 0.45, 0.08, tbx + dx, fy + 0.22, chz + dz, '#6b4a2b'));
    home.push(piece(0.6, 0.55, 0.08, tbx, fy + 0.75, chz + side * 0.26, '#946c46'));
    home.push(piece(0.5, 0.06, 0.45, tbx, fy + 0.52, chz, side < 0 ? '#c8504a' : '#5d8a5a'));   // cushions
  }
  pot(terrace.x0 + 0.5, fy, terrace.z0 + 1.5, 0, true);
  pot(terrace.x1 - 0.1, fy, terrace.z0 + 0.6, 1);
  pot(terrace.x0 + 0.5, fy, terrace.z1 - 0.6, 2, true);
  pot(terrace.x1 - 0.4, fy, terrace.z1 + 0.4, 3);
  // A string of lights from the cabin's corner to a post at the terrace's far corner.
  const lightPost = [terrace.x0 + 0.35, terrace.z0 + 0.35];
  home.push(piece(0.18, 2.9, 0.18, lightPost[0], fy + 1.45, lightPost[1], '#6b4a2b'));
  const bulbs = [];
  const strand = (ax, ay, az, bx, by, bz, n) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n, sag = Math.sin(t * Math.PI) * 0.45;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t - sag, z = az + (bz - az) * t;
      if (i < n) {
        const t2 = (i + 1) / n, x2 = ax + (bx - ax) * t2, y2 = ay + (by - ay) * t2 - Math.sin(t2 * Math.PI) * 0.45, z2 = az + (bz - az) * t2;
        const len = Math.hypot(x2 - x, y2 - y, z2 - z), g = new THREE.BoxGeometry(0.03, 0.03, len);
        g.lookAt(new THREE.Vector3(x2 - x, y2 - y, z2 - z));
        g.translate((x + x2) / 2, (y + y2) / 2, (z + z2) / 2);
        tmp.set('#2d2d33');
        const c = new Float32Array(g.attributes.position.count * 3);
        for (let k = 0; k < c.length; k += 3) { c[k] = tmp.r; c[k + 1] = tmp.g; c[k + 2] = tmp.b; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        home.push(g);
      }
      if (i > 0 && i < n) bulbs.push({ x, y: y - 0.1, z });
    }
  };
  strand(lightPost[0], fy + 2.8, lightPost[1], cabin.x0 - 0.05, fy + 4.2, cabin.z1 - 0.5, 9);
  strand(lightPost[0], fy + 2.8, lightPost[1], cabin.x0 - 0.05, fy + 4.2, cabin.z0 + 0.5, 4);
  // Balcony railing around the planks in front of the dormer, a chair and a pot.
  const by = G + 7, bx0 = 67, bx1 = 71, bz1 = cabin.z1 + 3;
  for (let x = bx0; x <= bx1 + 1; x++) home.push(piece(0.14, 0.75, 0.14, x + (x > bx1 ? -0.07 : 0.07), by + 0.375, bz1 + 0.93, wood[x % 3]));
  for (let z = cabin.z1 + 1; z <= bz1; z++) for (const x of [bx0 + 0.07, bx1 + 0.93]) home.push(piece(0.14, 0.75, 0.14, x, by + 0.375, z, wood[z % 3]));
  for (const h of [0.35, 0.7]) {
    home.push(piece(bx1 - bx0 + 1, 0.08, 0.08, (bx0 + bx1 + 1) / 2, by + h, bz1 + 0.93, wood[1]));
    for (const x of [bx0 + 0.07, bx1 + 0.93]) home.push(piece(0.08, 0.08, 2.9, x, by + h, cabin.z1 + 2.45, wood[1]));
  }
  home.push(piece(0.55, 0.08, 0.5, bx0 + 0.9, by + 0.42, bz1 + 0.2, '#946c46'), piece(0.55, 0.5, 0.08, bx0 + 0.9, by + 0.7, bz1 - 0.06, '#946c46'));
  for (const [dx, dz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) home.push(piece(0.07, 0.42, 0.07, bx0 + 0.9 + dx, by + 0.21, bz1 + 0.2 + dz, '#6b4a2b'));
  pot(bx1 + 0.4, by, bz1 + 0.4, 4);
  pot(bx1 + 0.45, by, cabin.z1 + 1.5, 2, true);
  // Porch: a bench under the left window, a doormat, a pot by the door and some firewood.
  const pz = cabin.z1 + 1.5;
  home.push(piece(1.8, 0.1, 0.5, 66.5, fy + 0.45, pz - 0.2, '#946c46'));
  for (const dx of [-0.75, 0.75]) home.push(piece(0.12, 0.42, 0.42, 66.5 + dx, fy + 0.21, pz - 0.2, '#6b4a2b'));
  home.push(piece(0.8, 0.03, 0.55, 69.5, fy + 0.015, cabin.z1 + 1.4, '#a8553a'));
  pot(70.6, fy, cabin.z1 + 1.3, 1, true);
  [[-0.3, 0], [0.05, 0], [0.4, 0], [-0.12, 1], [0.22, 1]].forEach(([dx, row], i) => home.push(piece(0.3, 0.3, 0.9, 73.2 + dx, fy + 0.15 + row * 0.28, cabin.z1 + 1.4, wood[i % 3])));
  // Flower boxes under the front and side windows.
  const windowBox = (x, z, alongX, i) => {
    const w = alongX ? 2.1 : 0.4, d = alongX ? 0.4 : 2.1, y = G + 1.82;
    home.push(piece(w, 0.3, d, x, y, z, '#7a5232'));
    for (let k = 0; k < 6; k++) {
      const o = (k - 2.5) * 0.33;
      home.push(piece(0.28, 0.2, 0.28, x + (alongX ? o : 0), y + 0.22, z + (alongX ? 0 : o), bushGreens[(k + i) % 3], k));
      blooms.push(piece(0.12, 0.12, 0.12, x + (alongX ? o : 0), y + 0.36, z + (alongX ? 0 : o), flowerColors[(k + i) % 5]));
    }
    homeSnow.push(piece(w, 0.06, d, x, y + 0.36, z, '#f4f8fc'));
  };
  windowBox(67, cabin.z1 + 1.2, true, 0);
  windowBox(72, cabin.z1 + 1.2, true, 2);
  windowBox(cabin.x0 - 0.2, cabin.z0 + 4, false, 1);
  scene.add(merged(home));
  const bloomMesh = merged(blooms), homeSnowMesh = merged(homeSnow);
  scene.add(bloomMesh, homeSnowMesh);
  seasonal.winter.push(homeSnowMesh);
  seasonal.flowers = [bloomMesh];

  // ---- along the side paths: a signpost, a bench by the river view, a wheelbarrow, a bucket ----
  const trail = [];
  const sgx = 61.5, sgz = 62.5, sgy = ground(sgx, sgz);                // signpost where the paths split
  trail.push(piece(0.16, 1.9, 0.16, sgx, sgy + 0.95, sgz, '#6b4a2b'));
  for (const [dy, rot, col] of [[1.6, 0.5, '#a8804f'], [1.25, -0.6, '#946c46'], [0.92, 2.2, '#a8804f']]) {
    const sign = piece(0.9, 0.24, 0.06, 0.38, 0, 0, col);
    sign.rotateY(rot);
    sign.translate(sgx, sgy + dy, sgz);
    const tip = piece(0.14, 0.14, 0.06, 0.88, 0, 0, col, 0, Math.PI / 4);
    tip.rotateY(rot);
    tip.translate(sgx, sgy + dy, sgz);
    trail.push(sign, tip);
  }
  const bnx = 52.5, bnz = 56.9, bny = ground(bnx, bnz);                 // bench looking out over the farm
  trail.push(piece(1.6, 0.12, 0.45, bnx, bny + 0.45, bnz, '#946c46'));
  trail.push(piece(1.6, 0.35, 0.08, bnx, bny + 0.75, bnz - 0.22, '#946c46'));
  for (const dx of [-0.65, 0.65]) trail.push(piece(0.12, 0.45, 0.4, bnx + dx, bny + 0.22, bnz, '#6b4a2b'));
  const wbx = 82.5, wbz = 64.2, wby = ground(wbx, wbz);               // wheelbarrow of ore on the way to the mine
  trail.push(piece(1.0, 0.4, 0.7, wbx, wby + 0.5, wbz, '#7a5232', 0.3));
  trail.push(piece(0.18, 0.36, 0.1, wbx + 0.55 * Math.cos(0.3), wby + 0.2, wbz - 0.55 * Math.sin(0.3), '#2d2d33', 0.3));
  for (const s of [-0.25, 0.25]) {
    trail.push(piece(1.1, 0.06, 0.06, wbx - 0.45 * Math.cos(0.3) + s * Math.sin(0.3), wby + 0.38, wbz + 0.45 * Math.sin(0.3) + s * Math.cos(0.3), '#6b4a2b', 0.3));
  }
  for (let i = 0; i < 5; i++) trail.push(piece(0.24, 0.24, 0.24, wbx + (i % 3 - 1) * 0.25, wby + 0.78 + (i > 2 ? 0.1 : 0), wbz + (i % 2 - 0.5) * 0.25, ['#2a2a30', '#c87533', '#85858c'][i % 3], i));
  // A bucket and fishing rod at the land end of the dock.
  const fx = dock.x + 5.7, fz = dock.z + 0.55;
  trail.push(piece(0.36, 0.34, 0.36, fx, deckY + 0.23, fz, '#7c8088'), piece(0.3, 0.02, 0.3, fx, deckY + 0.39, fz, '#3a6aa0'));
  trail.push(piece(0.04, 0.04, 2.2, fx - 1.4, deckY + 0.45, fz + 0.2, '#8a6440', 0.15));
  scene.add(merged(trail));

  // The rowboat is painted, so it stands out from the bare planks of the dock.
  const boat = merged([
    piece(2.5, 0.1, 0.95, 0, 0.05, 0, '#4f93b0'),
    piece(2.5, 0.38, 0.1, 0, 0.24, -0.5, '#2f6f8a'),
    piece(2.5, 0.38, 0.1, 0, 0.24, 0.5, '#2f6f8a'),
    piece(2.52, 0.08, 0.12, 0, 0.42, -0.5, '#f2ece0'),
    piece(2.52, 0.08, 0.12, 0, 0.42, 0.5, '#f2ece0'),
    piece(2.54, 0.07, 0.12, 0, 0.14, -0.5, '#c8443a'),
    piece(2.54, 0.07, 0.12, 0, 0.14, 0.5, '#c8443a'),
    piece(0.1, 0.38, 1.0, -1.25, 0.24, 0, '#2f6f8a'),
    piece(0.12, 0.08, 1.02, -1.25, 0.42, 0, '#f2ece0'),
    piece(0.1, 0.3, 0.7, 1.32, 0.28, 0, '#2f6f8a'),
    piece(0.12, 0.42, 0.12, 1.4, 0.3, 0, '#f2ece0'),
    piece(0.3, 0.06, 0.9, 0.1, 0.32, 0, '#e8d8b0'),
    piece(0.3, 0.06, 0.9, -0.85, 0.32, 0, '#e8d8b0'),
    piece(1.7, 0.05, 0.08, -0.1, 0.36, 0.22, '#e8d8b0', 0.12),
    piece(1.7, 0.05, 0.08, -0.1, 0.36, -0.22, '#e8d8b0', -0.12),
  ]);
  const boatHome = new THREE.Vector3(dock.x + 1.9, waterY - 0.12, dock.z - 2.45);   // upstream side, clear against the water
  boat.position.copy(boatHome);
  scene.add(boat);

  function setSeason(name) {
    for (const o of seasonal.winter) o.visible = name === 'winter';
    for (const o of seasonal.autumn) o.visible = name === 'autumn';
    for (const o of seasonal.flowers) o.visible = name !== 'winter';
    const grown = { spring: 0, summer: 0.6, autumn: 1, winter: 0 }[name];
    pumpkins.forEach((p, i) => {
      p.visible = grown > 0;
      p.scale.setScalar(grown === 1 ? 0.85 + (i % 3) * 0.1 : grown);
    });
    pumpkinMat.color.set(name === 'summer' ? '#7fb04a' : '#e8892a');
  }

  let frozen = false;
  return {
    bulbs,
    setSeason(name) { frozen = name === 'winter'; setSeason(name); },
    update(dt, time) {
      if (frozen) { boat.position.copy(boatHome); boat.rotation.set(0, 0.05, 0); return; }
      boat.position.y = boatHome.y + Math.sin(time * 1.1) * 0.035;
      boat.rotation.set(Math.sin(time * 0.9) * 0.03, 0.05 + Math.sin(time * 0.23) * 0.04, Math.sin(time * 0.7 + 1) * 0.02);
    },
  };
}
