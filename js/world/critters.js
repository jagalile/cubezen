// Small voxel animals that bring the valley to life without stealing attention:
// a cat asleep by the fire, butterflies on warm days, and an occasional visitor
// (rabbit, birds, ducks or a deer) every so often.
import * as THREE from 'three';

const mats = new Map();
const mat = (c) => {
  if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c }));
  return mats.get(c);
};
function box(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// Soft round "blob" shadow: cheap, and it never lags behind like a shadow map would.
const blobTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
function blob(parent, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), blobMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  parent.add(m);
  return m;
}

// Models face +x. heading(dx, dz) turns them towards a direction.
const heading = (dx, dz) => Math.atan2(-dz, dx);
const lerp = (a, b, t) => a + (b - a) * t;

function makeCat() {
  const g = new THREE.Group();
  const fur = '#d98a3a', stripe = '#b0682a';
  const body = box(g, 0.56, 0.26, 0.36, fur, 0, 0.13, 0);
  box(body, 0.07, 0.27, 0.37, stripe, -0.14, 0, 0);
  box(body, 0.07, 0.27, 0.37, stripe, 0.04, 0, 0);
  const head = box(g, 0.26, 0.23, 0.26, fur, 0.3, 0.12, 0.07);
  box(head, 0.07, 0.08, 0.06, fur, 0.01, 0.15, -0.08);
  box(head, 0.07, 0.08, 0.06, fur, 0.01, 0.15, 0.08);
  box(head, 0.02, 0.015, 0.06, '#3a2a20', 0.131, 0.03, -0.06);
  box(head, 0.02, 0.015, 0.06, '#3a2a20', 0.131, 0.03, 0.06);
  box(head, 0.02, 0.03, 0.04, '#e8a090', 0.131, -0.04, 0);
  const tail = pivot(g, -0.26, 0.05, 0.14);
  box(tail, 0.46, 0.08, 0.08, fur, 0.23, 0, 0.08);
  blob(g, 1.0);
  g.scale.setScalar(1.4);
  return { g, body, tail };
}

function makeRabbit(snowy) {
  const g = new THREE.Group();
  const fur = snowy ? '#eeeeee' : '#a08466', inner = snowy ? '#e0c8c8' : '#c9a98a';
  box(g, 0.42, 0.3, 0.28, fur, 0, 0.18, 0);
  const head = pivot(g, 0.24, 0.32, 0);
  box(head, 0.22, 0.2, 0.2, fur, 0.04, 0, 0);
  box(head, 0.05, 0.22, 0.07, fur, 0.0, 0.2, -0.05);
  box(head, 0.05, 0.22, 0.07, fur, 0.0, 0.2, 0.05);
  box(head, 0.051, 0.16, 0.03, inner, 0.0, 0.2, -0.05);
  box(head, 0.02, 0.03, 0.03, '#202020', 0.15, 0.03, -0.07);
  box(head, 0.02, 0.03, 0.03, '#202020', 0.15, 0.03, 0.07);
  box(g, 0.1, 0.1, 0.1, '#f4f4f4', -0.24, 0.24, 0);
  const shadow = blob(g, 0.8);
  g.scale.setScalar(1.5);
  return { g, head, shadow };
}

function makeBird() {
  const g = new THREE.Group();
  box(g, 0.34, 0.12, 0.12, '#2c2c36', 0, 0, 0);
  box(g, 0.1, 0.08, 0.08, '#2c2c36', 0.2, 0.03, 0);
  const wings = [-1, 1].map((side) => {
    const w = pivot(g, 0, 0.04, side * 0.06);
    box(w, 0.16, 0.02, 0.36, '#3a3a46', 0, 0, side * 0.18);
    return { w, side };
  });
  return { g, wings };
}

function makeDuck(duckling) {
  const g = new THREE.Group();
  const body = duckling ? '#e6cf6a' : '#8a6a4a', headC = duckling ? '#e6cf6a' : '#2f6a42';
  box(g, 0.48, 0.24, 0.3, body, 0, 0.08, 0);
  box(g, 0.14, 0.1, 0.22, duckling ? '#d8be58' : '#6a5038', -0.26, 0.16, 0);
  const head = pivot(g, 0.22, 0.3, 0);
  box(head, 0.18, 0.18, 0.18, headC, 0, 0, 0);
  box(head, 0.12, 0.05, 0.1, '#e8a030', 0.13, -0.03, 0);
  if (!duckling) box(g, 0.05, 0.04, 0.31, '#f0f0f0', 0.14, 0.18, 0);
  g.scale.setScalar(duckling ? 0.8 : 1.45);
  return { g, head };
}

function makeDeer() {
  const g = new THREE.Group();
  const coat = '#8a5a36', light = '#c9a27a';
  box(g, 1.0, 0.45, 0.38, coat, 0, 0.85, 0);
  box(g, 0.2, 0.12, 0.2, '#f2eadc', -0.52, 0.95, 0);
  const neck = pivot(g, 0.42, 0.95, 0);
  box(neck, 0.18, 0.5, 0.18, coat, 0.06, 0.2, 0);
  const head = pivot(neck, 0.1, 0.48, 0);
  box(head, 0.34, 0.2, 0.2, coat, 0.1, 0, 0);
  box(head, 0.1, 0.08, 0.12, light, 0.26, -0.04, 0);
  box(head, 0.05, 0.14, 0.12, coat, -0.04, 0.15, -0.12);
  box(head, 0.05, 0.14, 0.12, coat, -0.04, 0.15, 0.12);
  const legs = [[0.38, -0.12], [0.38, 0.12], [-0.38, -0.12], [-0.38, 0.12]].map(([x, z], i) => {
    const p = pivot(g, x, 0.65, z);
    box(p, 0.1, 0.65, 0.1, i < 2 ? coat : '#7a4e2e', 0, -0.32, 0);
    return p;
  });
  blob(g, 1.6);
  g.scale.setScalar(1.4);
  return { g, neck, legs };
}

function makeButterfly(color) {
  const g = new THREE.Group();
  box(g, 0.03, 0.03, 0.12, '#3a2a2a', 0, 0, 0);
  const wings = [-1, 1].map((side) => {
    const w = pivot(g, 0, 0, 0);
    box(w, 0.13, 0.01, 0.12, color, side * 0.065, 0, 0);
    return { w, side };
  });
  g.scale.setScalar(1.6);
  return { g, wings };
}

export function createCritters(scene, world) {
  const { ground, riverX, fire } = world;
  const waterY = world.WL + 1 - 0.14;

  // ---- the cat, always asleep by the fire ----
  const cat = makeCat();
  cat.g.position.set(fire.x + 1.4, ground(fire.x + 1.4, fire.z + 1.2), fire.z + 1.2);
  cat.g.rotation.y = 2.4;
  scene.add(cat.g);

  // ---- butterflies on warm days ----
  const butterflies = ['#f5d76e', '#f0a0c8', '#ffffff', '#a8c8ff'].map((c) => {
    const b = makeButterfly(c);
    b.home = { x: 42 + Math.random() * 30, z: 74 + Math.random() * 14 };
    b.ph = Math.random() * 10;
    scene.add(b.g);
    return b;
  });

  // ---- visitors ----
  const VISITORS = {
    rabbit(env) {
      const r = makeRabbit(env.season === 'winter');
      const z0 = 68 + Math.random() * 3;               // between the mine and the tent
      const stops = [
        { x: 72 + Math.random() * 10, z: z0 + (Math.random() - 0.5) * 4, rest: 4 + Math.random() * 5 },
        { x: 66 + Math.random() * 8, z: z0 + (Math.random() - 0.5) * 5, rest: Math.random() < 0.5 ? 3 + Math.random() * 3 : 0 },
        { x: 96, z: z0 + (Math.random() - 0.5) * 6, rest: 0 },
      ];
      let x = 95, z = z0, phase = 'pause', timer = 0.4, from = null, to = null, stop = 0;
      r.g.position.set(x, ground(x, z), z);
      return {
        obj: r.g,
        update(dt, time) {
          timer -= dt;
          if (phase === 'hop') {
            const p = Math.min(1, 1 - timer / 0.32);
            x = lerp(from.x, to.x, p);
            z = lerp(from.z, to.z, p);
            const lift = Math.sin(p * Math.PI) * 0.35;
            r.g.position.set(x, ground(x, z) + lift, z);
            r.shadow.position.y = 0.02 - lift / 1.5;
            if (timer <= 0) { phase = 'pause'; timer = 0.08 + Math.random() * 0.3; }
            return true;
          }
          // Nibbling / sniffing while resting.
          r.head.rotation.z = phase === 'rest' ? -0.35 + Math.sin(time * 8) * 0.08 * (Math.sin(time * 0.9) > 0 ? 1 : 0) : 0;
          if (timer > 0) return true;
          const target = stops[stop];
          const dx = target.x - x, dz = target.z - z, dist = Math.hypot(dx, dz);
          if (dist < 0.5) {
            if (stop === stops.length - 1) return false;
            if (phase !== 'rest' && target.rest) { phase = 'rest'; timer = target.rest; return true; }
            stop++;
            phase = 'pause';
            return true;
          }
          const step = Math.min(0.9, dist);
          from = { x, z };
          to = { x: x + (dx / dist) * step, z: z + (dz / dist) * step };
          r.g.rotation.y = heading(dx, dz);
          phase = 'hop';
          timer = 0.32;
          return true;
        },
      };
    },

    birds() {
      const flock = new THREE.Group();
      const birds = [];
      const n = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const b = makeBird();
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        b.g.position.set(-row * 1.4, Math.random() * 0.4, side * row * 1.2);
        b.ph = Math.random() * 6;
        birds.push(b);
        flock.add(b.g);
      }
      flock.scale.setScalar(1.5);
      const dir = Math.random() < 0.5 ? 1 : -1;
      let x = dir > 0 ? -30 : 150;
      const y = 32 + Math.random() * 8, z = 20 + Math.random() * 30;
      flock.rotation.y = heading(dir, 0);
      return {
        obj: flock,
        update(dt, time) {
          x += dir * 6 * dt;
          flock.position.set(x, y + Math.sin(time * 0.6) * 0.8, z + Math.sin(time * 0.3) * 2);
          for (const b of birds) {
            const flap = Math.sin(time * 9 + b.ph);
            const glide = Math.sin(time * 0.7 + b.ph) > 0.3 ? 0.15 : 1;  // birds glide now and then
            for (const w of b.wings) w.w.rotation.x = w.side * flap * 0.7 * glide;
          }
          return dir > 0 ? x < 150 : x > -30;
        },
      };
    },

    ducks() {
      const family = [makeDuck(false), makeDuck(true), makeDuck(true), makeDuck(true)];
      const group = new THREE.Group();
      family.forEach((d) => group.add(d.g));
      let zLead = 10;
      return {
        obj: group,
        update(dt, time) {
          zLead += 0.75 * dt;
          family.forEach((d, i) => {
            const z = zLead - i * (i ? 0.8 : 1.2);
            const x = riverX(z) - 1.7 + Math.sin(z * 0.4 + i) * 0.3;   // keep clear of the dock and boat
            const dx = riverX(z + 0.5) - riverX(z - 0.5);
            d.g.position.set(x, waterY - 0.02 + Math.sin(time * 2 + i) * 0.02, z);
            d.g.rotation.y = heading(dx, 1);
            d.head.rotation.z = Math.sin(time * 1.3 + i * 2) > 0.92 ? -0.6 : 0;  // a quick dip now and then
          });
          return zLead < world.D + 3;
        },
      };
    },

    deer() {
      const d = makeDeer();
      const zt = 38 + Math.random() * 12;              // the stretch of river in view
      const bank = { x: riverX(zt) - 4.3, z: zt };
      const forest = { x: bank.x - 12, z: zt + (Math.random() - 0.5) * 6 };
      let phase = 'in', t = 0, drink = 9 + Math.random() * 6;
      const walkTime = Math.hypot(bank.x - forest.x, bank.z - forest.z) / 1.1;
      return {
        obj: d.g,
        update(dt, time) {
          t += dt;
          const walking = phase === 'in' || phase === 'out';
          if (walking) {
            const p = Math.min(1, t / walkTime);
            const [a, b] = phase === 'in' ? [forest, bank] : [bank, forest];
            const x = lerp(a.x, b.x, p), z = lerp(a.z, b.z, p);
            d.g.position.set(x, ground(x, z), z);
            d.g.rotation.y = heading(b.x - a.x, b.z - a.z);
            d.legs.forEach((l, i) => { l.rotation.z = Math.sin(time * 6 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.35; });
            d.neck.rotation.z = 0;
            if (p >= 1) {
              if (phase === 'out') return false;
              phase = 'drink';
              t = 0;
            }
          } else {
            d.legs.forEach((l) => { l.rotation.z = 0; });
            const lookUp = Math.sin(t * 0.8) > 0.75;                  // glances up every few seconds
            d.neck.rotation.z = lerp(d.neck.rotation.z, lookUp ? 0 : -1.25, Math.min(1, dt * 3));
            if (t > drink) { phase = 'out'; t = 0; }
          }
          return true;
        },
      };
    },
  };

  let active = null, nextIn = 6 + Math.random() * 6, lastKind = null;

  function eligible(env) {
    const day = env.night < 0.5, dry = env.rain < 0.5;
    const list = [];
    if (day && dry) list.push(['rabbit', 3], ['birds', 3]);
    if (day && dry && env.season !== 'winter') list.push(['ducks', 2]);
    if (day) list.push(['deer', 1.5]);
    return list.filter(([k]) => k !== lastKind || list.length === 1);
  }

  function spawn(kind, env) {
    if (active) { scene.remove(active.obj); active = null; }
    active = VISITORS[kind](env);
    lastKind = kind;
    scene.add(active.obj);
  }

  return {
    spawn,
    update(dt, time, env) {
      // Cat: slow breathing and a lazy tail.
      cat.body.scale.y = 1 + Math.sin(time * 1.6) * 0.04;
      cat.tail.rotation.y = Math.sin(time * 0.5) * 0.12 + (Math.sin(time * 0.13) > 0.9 ? Math.sin(time * 6) * 0.15 : 0);

      const warm = (env.season === 'spring' || env.season === 'summer') && env.night < 0.3 && env.rain < 0.3;
      butterflies.forEach((b, i) => {
        b.g.visible = warm;
        if (!warm) return;
        const t = time * 0.35 + b.ph;
        const x = b.home.x + Math.sin(t) * 3 + Math.sin(t * 2.3) * 0.8;
        const z = b.home.z + Math.cos(t * 0.8) * 2.5;
        b.g.position.set(x, ground(x, z) + 0.6 + Math.sin(t * 3.1) * 0.25, z);
        b.g.rotation.y = heading(Math.cos(t), -Math.sin(t * 0.8));
        const flap = Math.sin(time * 18 + i) * 0.9;
        for (const w of b.wings) w.w.rotation.x = w.side * flap;
      });

      if (active) {
        if (!active.update(dt, time)) {
          scene.remove(active.obj);
          active = null;
          nextIn = 15 + Math.random() * 20;
        }
        return;
      }
      nextIn -= dt;
      if (nextIn > 0) return;
      const options = eligible(env);
      if (!options.length) { nextIn = 10; return; }
      let roll = Math.random() * options.reduce((s, [, w]) => s + w, 0);
      const kind = options.find(([, w]) => (roll -= w) < 0)[0];
      spawn(kind, env);
    },
  };
}
