// Cubezen's 3D voxel background: day/night cycle, seasons, weather and cosy lights.
import * as THREE from 'three';
import { createAtlas, SEASONS, rng } from './textures.js';
import { generateWorld, buildTerrain, buildWater, buildPlants, buildFar } from './build.js';
import { createCritters } from './critters.js';

const PIXEL = 0.5;            // render at half resolution for a soft pixel look
const DAY_LENGTH = 20 * 60;   // seconds per full day in cycle mode
const params = new URLSearchParams(location.search);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(PIXEL);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 40, 230);
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 900);
const CAM_POS = new THREE.Vector3(52, 25, 101), CAM_TARGET = new THREE.Vector3(63, 10, 46);

// ---------- world ----------
const world = generateWorld();
const atlas = createAtlas();
const blockMat = new THREE.MeshLambertMaterial({
  map: atlas.map, vertexColors: true, alphaTest: 0.5,
  emissive: 0xffffff, emissiveMap: atlas.emissiveMap, emissiveIntensity: 0,
});
const terrain = new THREE.Mesh(buildTerrain(world), blockMat);
terrain.castShadow = terrain.receiveShadow = true;
scene.add(terrain);

const waterMat = new THREE.MeshLambertMaterial({ map: atlas.waterMap, transparent: true, opacity: 0.82, vertexColors: true });
const water = new THREE.Mesh(buildWater(world), waterMat);
water.receiveShadow = true;
scene.add(water);

const plantMat = new THREE.MeshLambertMaterial({ map: atlas.map, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
let plants = null, far = null;
const farMat = new THREE.MeshLambertMaterial({ vertexColors: true });

const critters = createCritters(scene, world);

// ---------- small props: lantern posts, lanterns, campfire ----------
const woodMat = new THREE.MeshLambertMaterial({ color: 0x5a3b22 });
const ironMat = new THREE.MeshLambertMaterial({ color: 0x2d2d33 });
const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffc66e });
const glowTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const glows = [];
function addGlow(x, y, z, size, color, strength) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
  }));
  s.position.set(x, y, z);
  s.scale.setScalar(size);
  s.userData.strength = strength;
  scene.add(s);
  glows.push(s);
  return s;
}
const box = (w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  scene.add(m);
  return m;
};
for (const d of world.decor) {
  if (d.type === 'post') {
    box(0.22, 1.5, 0.22, woodMat, d.x, d.y + 0.75, d.z);
  } else {
    box(0.42, 0.08, 0.42, ironMat, d.x, d.y + 0.27, d.z);
    box(0.42, 0.06, 0.42, ironMat, d.x, d.y - 0.22, d.z);
    box(0.32, 0.42, 0.32, lanternMat, d.x, d.y, d.z).castShadow = false;
    if (d.hanging) box(0.05, 0.3, 0.05, ironMat, d.x, d.y + 0.45, d.z);
    addGlow(d.x, d.y, d.z, 3.2, 0xffb35c, 0.9);
  }
}
for (const w of world.windows) addGlow(w.x, w.y, w.z - 0.9, 7, 0xffb35c, 0.55);

// Campfire: crossed logs, a stone ring and animated pixel flames.
const F = world.fire;
box(1.0, 0.18, 0.22, woodMat, F.x, F.y + 0.09, F.z).rotation.y = 0.5;
box(1.0, 0.18, 0.22, woodMat, F.x, F.y + 0.09, F.z).rotation.y = -0.6;
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x77777e });
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  box(0.25, 0.18, 0.25, stoneMat, F.x + Math.cos(a) * 0.62, F.y + 0.09, F.z + Math.sin(a) * 0.62);
}
const fireCanvas = document.createElement('canvas');
fireCanvas.width = 16;
fireCanvas.height = 24;
const fireTex = new THREE.CanvasTexture(fireCanvas);
fireTex.magFilter = fireTex.minFilter = THREE.NearestFilter;
fireTex.colorSpace = THREE.SRGBColorSpace;
const fireMat = new THREE.MeshBasicMaterial({ map: fireTex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
const flames = [Math.PI / 4, -Math.PI / 4].map((rot) => {
  const geo = new THREE.PlaneGeometry(0.85, 1.3);
  geo.translate(0, 0.65, 0);                             // grow upwards from the logs
  const p = new THREE.Mesh(geo, fireMat);
  p.position.set(F.x, F.y + 0.03, F.z);
  p.rotation.y = rot;
  scene.add(p);
  return p;
});
// level 0–1 follows the fire volume: 0 leaves glowing embers and a wisp of smoke.
function drawFire(level) {
  const g = fireCanvas.getContext('2d');
  g.clearRect(0, 0, 16, 24);
  for (let x = 3; x < 13; x++) {                         // embers at the base, always lit
    g.fillStyle = Math.random() < 0.35 ? '#ff8a2c' : Math.random() < 0.5 ? '#c8341a' : '#7a1e12';
    g.fillRect(x, 23, 1, 1);
    if (Math.abs(x - 7.5) < 3 && Math.random() < 0.5) g.fillRect(x, 22, 1, 1);
  }
  if (level < 0.02) { fireTex.needsUpdate = true; return; }
  const scale = 0.2 + level * 0.95;
  for (let x = 2; x < 14; x++) {
    const h = Math.max(0, Math.round((14 - Math.abs(x - 7.5) * 2.4) * (0.6 + Math.random() * 0.5) * scale));
    for (let k = 0; k < h; k++) {
      const f = k / Math.max(1, h);
      g.fillStyle = f < 0.3 && Math.abs(x - 7.5) < 3 ? '#fff4b0' : f < 0.6 ? '#ffb43c' : f < 0.85 ? '#ff6a24' : '#d0401c';
      g.fillRect(x, 23 - k, 1, 1);
    }
  }
  fireTex.needsUpdate = true;
}
const fireLight = new THREE.PointLight(0xff8a3c, 25, 26, 1.6);
fireLight.position.set(F.x, F.y + 1.2, F.z);
scene.add(fireLight);
const fireGlow = addGlow(F.x, F.y + 0.8, F.z, 9, 0xff8a3c, 0.75);
const windowLight = new THREE.PointLight(0xffb35c, 0, 16, 1.6);
windowLight.position.set(69.5, world.G + 3, 62);
scene.add(windowLight);

// ---------- sky, sun, moon, stars, clouds ----------
const skyUniforms = {
  top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3() }, sunColor: { value: new THREE.Color() },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vDir;
    void main(){
      float h = clamp(vDir.y, 0.0, 1.0);
      vec3 col = mix(horizon, top, pow(h, 0.55));
      float s = max(dot(normalize(vDir), sunDir), 0.0);
      col += sunColor * (pow(s, 8.0) * 0.45 + pow(s, 64.0) * 0.4) * smoothstep(-0.2, 0.15, sunDir.y);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -1;
scene.add(sky);

const sun = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false, toneMapped: false }));
const moon = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false, toneMapped: false, transparent: true }));
scene.add(sun, moon);

const stars = (() => {
  const r = rng(9), pos = [];
  for (let i = 0; i < 900; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, y = Math.abs(u) * 0.95 + 0.05;
    const rad = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * rad * 520, y * 520, Math.sin(a) * rad * 520);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
})();
scene.add(stars);

const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, emissive: 0xffffff, emissiveIntensity: 0.25 });
const clouds = new THREE.Group();
const CLOUD_SPAN = 320;
(() => {
  const r = rng(77), geos = [];
  const cell = 8;
  for (let copy = 0; copy < 2; copy++) for (let i = 0; i < 36; i++) {
    const cx = r() * CLOUD_SPAN, cz = -90 + r() * 170;
    const n = 2 + Math.floor(r() * 5);
    for (let j = 0; j < n; j++) {
      const g = new THREE.BoxGeometry(cell * (1 + Math.floor(r() * 2)), 2.5, cell * (1 + Math.floor(r() * 2)));
      g.translate(cx + (j % 3) * cell + copy * CLOUD_SPAN, 0, cz + Math.floor(j / 3) * cell);
      geos.push(g);
    }
  }
  // Merge all boxes into one mesh.
  const merged = new THREE.BufferGeometry();
  const attrs = { position: [], normal: [] }, index = [];
  let offset = 0;
  for (const g of geos) {
    attrs.position.push(...g.attributes.position.array);
    attrs.normal.push(...g.attributes.normal.array);
    index.push(...Array.from(g.index.array, (i) => i + offset));
    offset += g.attributes.position.count;
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(attrs.position, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(attrs.normal, 3));
  merged.setIndex(index);
  const m = new THREE.Mesh(merged, cloudMat);
  m.position.set(-CLOUD_SPAN, 62, 0);
  clouds.add(m);
})();
scene.add(clouds);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(innerWidth < 800 ? 1024 : 2048, innerWidth < 800 ? 1024 : 2048);
Object.assign(sunLight.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.04;
sunLight.target.position.set(56, 8, 55);
scene.add(sunLight, sunLight.target);

// ---------- time of day ----------
// t: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.
const KEYS = [
  { t: 0.00, top: '#060a1e', hor: '#1a2150', light: '#9fb4ff', li: 0.75, hs: '#5566aa', hg: '#20203a', hi: 1.0, night: 1 },
  { t: 0.21, top: '#141a48', hor: '#4b4580', light: '#9fb4ff', li: 0.65, hs: '#5a68b0', hg: '#26223a', hi: 0.95, night: 0.95 },
  { t: 0.25, top: '#3a4590', hor: '#e58a7a', light: '#ff9a7a', li: 0.35, hs: '#a08ac0', hg: '#3a2c30', hi: 0.85, night: 0.6 },
  { t: 0.29, top: '#5a78c8', hor: '#ffbf90', light: '#ffc08a', li: 1.7, hs: '#f0c0cc', hg: '#6a4a3a', hi: 1.0, night: 0.1 },
  { t: 0.36, top: '#4a8de6', hor: '#bfe0ff', light: '#fff1d8', li: 2.4, hs: '#bcd8ff', hg: '#6a5a40', hi: 1.0, night: 0 },
  { t: 0.50, top: '#3f86e8', hor: '#cbe6ff', light: '#ffffff', li: 2.7, hs: '#c4ddff', hg: '#6a5a40', hi: 1.05, night: 0 },
  { t: 0.63, top: '#4a88e0', hor: '#ffe2bc', light: '#fff0d0', li: 2.4, hs: '#c8d8f0', hg: '#6a5a40', hi: 1.0, night: 0 },
  { t: 0.70, top: '#7a64c0', hor: '#ffa07a', light: '#ffa868', li: 2.0, hs: '#e8b4d4', hg: '#6a4040', hi: 1.05, night: 0.05 },
  { t: 0.75, top: '#3c3480', hor: '#d0708a', light: '#ff8a70', li: 0.4, hs: '#a07ab8', hg: '#3a2a30', hi: 0.85, night: 0.55 },
  { t: 0.79, top: '#141a48', hor: '#4b3f78', light: '#9fb4ff', li: 0.65, hs: '#5a68b0', hg: '#26223a', hi: 0.95, night: 0.95 },
  { t: 1.00, top: '#060a1e', hor: '#1a2150', light: '#9fb4ff', li: 0.75, hs: '#5566aa', hg: '#20203a', hi: 1.0, night: 1 },
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function sample(t) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const f = (t - a.t) / (b.t - a.t);
  const c = (k) => tmpA.set(a[k]).lerp(tmpB.set(b[k]), f).clone();
  const n = (k) => a[k] + (b[k] - a[k]) * f;
  return { top: c('top'), hor: c('hor'), light: c('light'), li: n('li'), hs: c('hs'), hg: c('hg'), hi: n('hi'), night: n('night') };
}

const state = {
  timeMode: 'cycle', season: 'auto', rain: 0, fire: 0.35,
  t: 0.62, resolvedSeason: null,
};
const FIXED_TIMES = { day: 0.45, sunset: 0.715, night: 0.92 };

function seasonFromDate() {
  const m = new Date().getMonth();
  return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
}

// ---------- particles ----------
const AREA = { x0: 20, x1: 100, y0: 6, y1: 34, z0: 40, z1: 96 };
const MAX_P = 700;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAX_P * 3), pCol = new Float32Array(MAX_P * 3), pVel = new Float32Array(MAX_P * 4);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false });
const weather = new THREE.Points(pGeo, pMat);
weather.frustumCulled = false;
scene.add(weather);
let pKind = 'petal', pCount = 0;
function resetParticle(i, anywhere) {
  pPos[i * 3] = AREA.x0 + Math.random() * (AREA.x1 - AREA.x0);
  pPos[i * 3 + 1] = anywhere ? AREA.y0 + Math.random() * (AREA.y1 - AREA.y0) : AREA.y1;
  pPos[i * 3 + 2] = AREA.z0 + Math.random() * (AREA.z1 - AREA.z0);
  pVel[i * 4] = Math.random() * Math.PI * 2;
  pVel[i * 4 + 1] = 0.6 + Math.random() * 0.8;
}
function setupParticles(seasonName) {
  const p = SEASONS[seasonName].particles;
  pKind = p.kind;
  pCount = p.count;
  for (let i = 0; i < MAX_P; i++) {
    resetParticle(i, true);
    tmpA.set(p.colors[i % p.colors.length]);
    pCol[i * 3] = tmpA.r; pCol[i * 3 + 1] = tmpA.g; pCol[i * 3 + 2] = tmpA.b;
  }
  pMat.size = pKind === 'snow' ? 0.16 : pKind === 'pollen' ? 0.09 : 0.2;
  pGeo.setDrawRange(0, pCount);
  pGeo.attributes.color.needsUpdate = true;
}
function updateParticles(dt, time) {
  const fall = pKind === 'snow' ? 1.6 : pKind === 'pollen' ? -0.05 : 0.9;
  for (let i = 0; i < pCount; i++) {
    const ph = pVel[i * 4], sp = pVel[i * 4 + 1];
    pPos[i * 3] += (Math.sin(time * 0.7 * sp + ph) * 0.6 + 0.5) * dt;
    pPos[i * 3 + 1] -= fall * sp * dt + (pKind === 'pollen' ? Math.sin(time + ph) * 0.1 * dt : 0);
    pPos[i * 3 + 2] += Math.cos(time * 0.5 * sp + ph) * 0.4 * dt;
    if (pPos[i * 3 + 1] < AREA.y0 - 2 || pPos[i * 3 + 1] > AREA.y1 + 1 || pPos[i * 3] > AREA.x1) resetParticle(i, pKind === 'pollen');
  }
  pGeo.attributes.position.needsUpdate = true;
}

// Fireflies (spring/summer nights).
const FLIES = 70;
const fGeo = new THREE.BufferGeometry();
const fPos = new Float32Array(FLIES * 3), fCol = new Float32Array(FLIES * 3), fBase = [];
for (let i = 0; i < FLIES; i++) {
  fBase.push({ x: 35 + Math.random() * 55, z: 55 + Math.random() * 35, y: world.G + 1 + Math.random() * 3, ph: Math.random() * 6.28, sp: 0.5 + Math.random() });
}
fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
const fireflies = new THREE.Points(fGeo, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
fireflies.frustumCulled = false;
scene.add(fireflies);
function updateFireflies(time, strength) {
  fireflies.visible = strength > 0.01;
  if (!fireflies.visible) return;
  fBase.forEach((f, i) => {
    fPos[i * 3] = f.x + Math.sin(time * 0.3 * f.sp + f.ph) * 3;
    fPos[i * 3 + 1] = f.y + Math.sin(time * 0.5 * f.sp + f.ph * 2) * 0.8;
    fPos[i * 3 + 2] = f.z + Math.cos(time * 0.25 * f.sp + f.ph) * 3;
    const b = Math.max(0, Math.sin(time * 1.4 * f.sp + f.ph * 3)) * strength;
    fCol[i * 3] = 0.85 * b; fCol[i * 3 + 1] = 1.0 * b; fCol[i * 3 + 2] = 0.45 * b;
  });
  fGeo.attributes.position.needsUpdate = fGeo.attributes.color.needsUpdate = true;
}

// Rain streaks.
const RAIN = 1800;
const rGeo = new THREE.BufferGeometry();
const rPos = new Float32Array(RAIN * 6);
for (let i = 0; i < RAIN; i++) setDrop(i, true);
function setDrop(i, anywhere) {
  const x = AREA.x0 + Math.random() * (AREA.x1 - AREA.x0), z = AREA.z0 + Math.random() * (AREA.z1 - AREA.z0);
  const y = anywhere ? AREA.y0 + Math.random() * 36 : AREA.y1 + 8 + Math.random() * 6;
  rPos.set([x, y, z, x - 0.05, y - 0.7, z], i * 6);
}
rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ color: 0xaac4ee, transparent: true, opacity: 0.45, depthWrite: false }));
rain.frustumCulled = false;
scene.add(rain);
function updateRain(dt) {
  const n = Math.round(RAIN * state.rain);
  rGeo.setDrawRange(0, n * 2);
  rain.visible = n > 0;
  for (let i = 0; i < n; i++) {
    const dy = 26 * dt;
    rPos[i * 6 + 1] -= dy; rPos[i * 6 + 4] -= dy;
    rPos[i * 6] -= dy * 0.07; rPos[i * 6 + 3] -= dy * 0.07;
    if (rPos[i * 6 + 1] < AREA.y0 - 3) setDrop(i, false);
  }
  rGeo.attributes.position.needsUpdate = true;
}

// Chimney smoke, campfire smoke and embers.
const SMOKE = 40, EMBERS = 24, WISPS = 30;
const sGeo = new THREE.BufferGeometry(), sPos = new Float32Array(SMOKE * 3), sAge = new Float32Array(SMOKE);
const ch = world.chimney;
for (let i = 0; i < SMOKE; i++) { sAge[i] = Math.random() * 7; }
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const smoke = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xd6d6de, size: 0.7, transparent: true, opacity: 0.4, depthWrite: false }));
const wGeo = new THREE.BufferGeometry(), wPos = new Float32Array(WISPS * 3), wAge = new Float32Array(WISPS);
for (let i = 0; i < WISPS; i++) wAge[i] = Math.random() * 5;
wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
const wisps = new THREE.Points(wGeo, new THREE.PointsMaterial({ color: 0xc8c8d0, size: 0.32, transparent: true, opacity: 0.35, depthWrite: false }));
wisps.frustumCulled = false;
scene.add(wisps);
smoke.frustumCulled = false;
scene.add(smoke);
const eGeo = new THREE.BufferGeometry(), ePos = new Float32Array(EMBERS * 3), eAge = new Float32Array(EMBERS);
for (let i = 0; i < EMBERS; i++) eAge[i] = Math.random() * 2;
eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
const embers = new THREE.Points(eGeo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.08, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
embers.frustumCulled = false;
scene.add(embers);
function updateSmokeAndEmbers(dt, time, level) {
  // Chimney: a thin trail when the fire is low, a fuller plume when it's high.
  sGeo.setDrawRange(0, Math.round(14 + level * (SMOKE - 14)));
  smoke.material.opacity = 0.22 + level * 0.25;
  smoke.material.size = 0.5 + level * 0.35;
  // Campfire: smoke is most visible when it's only smouldering.
  wisps.material.opacity = 0.12 + (1 - level) * 0.3;
  for (let i = 0; i < WISPS; i++) {
    wAge[i] = (wAge[i] + dt) % 5;
    const a = wAge[i];
    wPos[i * 3] = F.x + a * 0.25 + Math.sin(a * 1.7 + i) * 0.18;
    wPos[i * 3 + 1] = F.y + 0.3 + a * (0.55 + level * 0.4);
    wPos[i * 3 + 2] = F.z + Math.cos(a * 1.3 + i * 2.1) * 0.18;
  }
  wGeo.attributes.position.needsUpdate = true;
  eGeo.setDrawRange(0, Math.round(EMBERS * level));
  for (let i = 0; i < SMOKE; i++) {
    sAge[i] = (sAge[i] + dt) % 7;
    const a = sAge[i];
    sPos[i * 3] = ch.x + 0.5 + a * 0.55 + Math.sin(a * 1.3 + i) * 0.2;
    sPos[i * 3 + 1] = world.G + 14 + a * 1.1;
    sPos[i * 3 + 2] = ch.z + 0.5 + Math.cos(a + i) * 0.2;
  }
  sGeo.attributes.position.needsUpdate = true;
  for (let i = 0; i < EMBERS; i++) {
    eAge[i] += dt;
    if (eAge[i] > 2) eAge[i] = 0;
    const a = eAge[i];
    ePos[i * 3] = F.x + Math.sin(i * 7.1 + time) * 0.25 + a * 0.1;
    ePos[i * 3 + 1] = F.y + 0.6 + a * (0.8 + level * 0.9);
    ePos[i * 3 + 2] = F.z + Math.cos(i * 3.3) * 0.25;
  }
  eGeo.attributes.position.needsUpdate = true;
}

// ---------- apply time & season ----------
function applySeason(name) {
  if (state.resolvedSeason === name) return;
  state.resolvedSeason = name;
  atlas.paint(name);
  if (plants) { scene.remove(plants); plants.geometry.dispose(); }
  plants = new THREE.Mesh(buildPlants(world, name), plantMat);
  plants.receiveShadow = true;
  scene.add(plants);
  if (far) { scene.remove(far); far.geometry.dispose(); }
  far = new THREE.Mesh(buildFar(world, name), farMat);
  scene.add(far);
  const winter = name === 'winter';
  waterMat.opacity = winter ? 0.96 : 0.82;
  setupParticles(name);
  renderer.shadowMap.needsUpdate = true;
}

const sunDir = new THREE.Vector3();
function applyTime(t) {
  const k = sample(t);
  const winter = state.resolvedSeason === 'winter';
  const wet = state.rain;
  const grey = new THREE.Color(0x5a6270);
  const hor = k.hor.clone().lerp(grey, wet * 0.55), top = k.top.clone().lerp(grey, wet * 0.6);
  if (winter) { hor.lerp(new THREE.Color(0xdde8f5), 0.15 * (1 - k.night)); }
  skyUniforms.top.value.copy(top);
  skyUniforms.horizon.value.copy(hor);
  scene.fog.color.copy(hor);
  scene.fog.near = 40 - wet * 22;
  scene.fog.far = 230 - wet * 120;

  const a = (t - 0.25) * Math.PI * 2;
  sunDir.set(Math.cos(a) * 0.95, Math.sin(a), -0.3).normalize();
  skyUniforms.sunDir.value.copy(sunDir);
  skyUniforms.sunColor.value.copy(k.light).multiplyScalar((1 - k.night) * (1 - wet));
  const day = sunDir.y > 0;
  // Light from the sun's (or moon's) direction but never grazing, so golden hour stays bright.
  const lightDir = (day ? sunDir.clone() : sunDir.clone().negate());
  lightDir.y = Math.max(lightDir.y, 0.5);
  lightDir.normalize();
  sunLight.position.copy(sunLight.target.position).addScaledVector(lightDir, 150);
  sunLight.color.copy(k.light);
  sunLight.intensity = k.li * (1 - wet * 0.7);
  sun.position.copy(camera.position).addScaledVector(sunDir, 500);
  sun.lookAt(camera.position);
  sun.visible = sunDir.y > -0.1 && wet < 0.6;
  moon.position.copy(camera.position).addScaledVector(sunDir, -500);
  moon.lookAt(camera.position);
  moon.material.opacity = k.night * (1 - wet);
  moon.visible = k.night > 0.05;
  stars.material.opacity = Math.max(0, k.night - 0.2) * (1 - wet);
  stars.visible = stars.material.opacity > 0.01;

  hemi.color.copy(k.hs);
  hemi.groundColor.copy(k.hg);
  hemi.intensity = k.hi * (1 - wet * 0.3);
  cloudMat.color.copy(k.hor).lerp(new THREE.Color(0xffffff), 0.6 * (1 - k.night)).lerp(grey, wet * 0.6);
  cloudMat.emissive.copy(k.hor);
  cloudMat.emissiveIntensity = 0.35;

  blockMat.emissiveIntensity = 0.05 + k.night * 1.1;
  lanternMat.color.setScalar(0.55 + k.night * 0.45).multiply(new THREE.Color(0xffc66e));
  windowLight.intensity = k.night * 18;
  for (const g of glows) g.material.opacity = g.userData.strength * (g === fireGlow ? (0.5 + k.night * 0.5) * (0.3 + fireLevel * 0.7) : k.night);
  return k;
}

// ---------- loop ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  // Keep the scene framed on narrow (portrait) screens.
  camera.fov = camera.aspect < 1 ? 62 : 48;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now(), time = 0, acc = 0, fireTimer = 1, shadowTimer = 0, fireLevel = 0.35;
const camOffset = new THREE.Vector3();

function resolveTime(dt) {
  if (state.timeMode === 'cycle') state.t = (state.t + dt / DAY_LENGTH) % 1;
  else if (state.timeMode === 'clock') { const d = new Date(); state.t = (d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600) / 24; }
  else state.t = FIXED_TIMES[state.timeMode];
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  if (acc < 1 / 30) return;                 // cap at ~30 fps: it's a background
  update(acc);
  acc = 0;
}

function update(step) {
  time += step;

  resolveTime(step);
  applySeason(state.season === 'auto' ? seasonFromDate() : state.season);
  const k = applyTime(state.t);

  camOffset.set(Math.sin(time * 0.05) * 1.2, Math.sin(time * 0.07) * 0.4, 0);   // slow, gentle sway
  camera.position.copy(CAM_POS).add(camOffset);
  camera.lookAt(CAM_TARGET);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);

  fireTimer += step;
  if (fireTimer > 0.09) {
    fireTimer = 0;
    drawFire(fireLevel);
    for (const f of flames) f.scale.set(0.8 + fireLevel * 0.45, 0.7 + fireLevel * 0.7, 1);
    fireLight.intensity = (16 + Math.random() * 10) * (0.15 + k.night * 0.95) * (0.12 + fireLevel * 0.95);
    fireGlow.scale.setScalar((3 + fireLevel * 6) * (1 + Math.random() * 0.18));
  }
  atlas.waterMap.offset.x = state.resolvedSeason === 'winter' ? 0 : time * 0.02;
  atlas.waterMap.offset.y = state.resolvedSeason === 'winter' ? 0 : Math.sin(time * 0.3) * 0.05;
  clouds.position.x = (time * 0.6) % CLOUD_SPAN;

  updateParticles(step, time);
  const s = state.resolvedSeason;
  updateFireflies(time, (s === 'summer' || s === 'spring' ? 1 : 0) * Math.max(0, k.night - 0.3) * (1 - state.rain));
  updateRain(step);
  fireLevel += (state.fire - fireLevel) * Math.min(1, step * 2);   // ease towards the slider
  updateSmokeAndEmbers(step, time, fireLevel);
  critters.update(step, time, { night: k.night, rain: state.rain, season: s });

  shadowTimer += step;
  if (shadowTimer > 0.5) { shadowTimer = 0; renderer.shadowMap.needsUpdate = true; }
  renderer.render(scene, camera);
}

// URL overrides, e.g. ?time=sunset&season=spring (handy for screenshots).
if (params.get('time')) state.timeMode = params.get('time');
if (params.get('season')) state.season = params.get('season');
if (params.get('fire')) state.fire = fireLevel = Number(params.get('fire'));
if (params.get('t')) { state.timeMode = 'cycle'; state.t = Number(params.get('t')); }
applySeason(state.season === 'auto' ? seasonFromDate() : state.season);
renderer.shadowMap.needsUpdate = true;
if (params.get('critter')) {                    // e.g. ?critter=deer&advance=12, for previews
  const env = { night: 0, rain: 0, season: state.resolvedSeason };
  critters.spawn(params.get('critter'), env);
  for (let i = 0; i < Number(params.get('advance') || 0) * 10; i++) critters.update(0.1, i * 0.1, env);
}
update(1 / 30);
requestAnimationFrame(frame);

window.Scene = {
  setRain(level) { state.rain = Math.max(0, Math.min(1, level)); },
  setFire(level) { state.fire = Math.max(0, Math.min(1, level)); },
  setTimeMode(mode) { if (!params.get('time')) state.timeMode = mode; },
  setSeason(season) { if (!params.get('season')) state.season = season; },
  get state() { return { ...state, season: state.season, resolved: state.resolvedSeason }; },
};
