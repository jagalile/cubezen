// Pixel-art night scene: cabin, campfire, fireflies, chimney smoke and optional rain.
// Everything is drawn at 320x180 and scaled up with CSS (image-rendering: pixelated).
window.Scene = (() => {
  const W = 320, H = 180, GROUND = 146;
  const canvas = document.getElementById('scene');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Seeded RNG so the static layout is the same on every visit.
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  // ---------- static background (drawn once) ----------
  const bg = document.createElement('canvas');
  bg.width = W;
  bg.height = H;
  const b = bg.getContext('2d');
  const r = rng(7);

  // Sky in 6px colour bands.
  const skyTop = [10, 12, 34], skyBottom = [62, 46, 94];
  for (let y = 0; y < GROUND; y += 6) {
    const t = Math.min(1, y / (GROUND - 30));
    rect(b, 0, y, W, 6, `rgb(${skyTop.map((v, i) => Math.round(v + (skyBottom[i] - v) * t))})`);
  }

  // Moon.
  const MX = 246, MY = 20;
  rect(b, MX - 6, MY - 6, 26, 26, 'rgba(233,228,196,0.05)');
  rect(b, MX - 3, MY - 3, 20, 20, 'rgba(233,228,196,0.07)');
  rect(b, MX, MY, 14, 14, '#ece6c6');
  rect(b, MX + 3, MY + 3, 3, 3, '#d4cda8');
  rect(b, MX + 8, MY + 7, 4, 3, '#d4cda8');
  rect(b, MX + 4, MY + 10, 2, 2, '#d4cda8');

  // Blocky hills.
  function ridge(seed, base, amp, color) {
    const rr = rng(seed);
    let h = amp * (0.4 + rr() * 0.4);
    for (let x = 0; x < W; x += 8) {
      h = Math.max(amp * 0.25, Math.min(amp, h + (rr() - 0.5) * amp * 0.6));
      const y = base - Math.round(h / 4) * 4;
      rect(b, x, y, 8, GROUND - y, color);
    }
  }
  ridge(3, GROUND - 12, 56, '#1d1d3c');
  ridge(11, GROUND, 34, '#242a4a');

  // Cube trees.
  function tree(x, base) {
    rect(b, x + 8, base - 16, 4, 16, '#2b211f');
    rect(b, x, base - 32, 20, 16, '#1f3b36');
    rect(b, x + 4, base - 36, 12, 4, '#1f3b36');
    for (let i = 0; i < 7; i++) {
      rect(b, x + 2 + Math.floor(r() * 8) * 2, base - 34 + Math.floor(r() * 8) * 2, 2, 2, '#29504a');
    }
  }
  [6, 28, 136, 230, 266, 296].forEach((x) => tree(x, GROUND));

  // Ground: grass strip over dirt, with a faint block grid.
  rect(b, 0, GROUND, W, H - GROUND, '#3a281d');
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(r() * W / 2) * 2;
    const y = GROUND + 4 + Math.floor(r() * (H - GROUND) / 2) * 2;
    rect(b, x, y, 2, 2, r() < 0.5 ? '#2f2017' : '#47321f');
  }
  for (let x = 0; x < W; x += 16) rect(b, x, GROUND + 4, 1, H - GROUND, 'rgba(0,0,0,0.12)');
  for (let y = GROUND + 20; y < H; y += 16) rect(b, 0, y, W, 1, 'rgba(0,0,0,0.12)');
  rect(b, 0, GROUND, W, 4, '#2f5a33');
  for (let x = 0; x < W; x++) {
    if (r() < 0.3) rect(b, x, GROUND - 1, 1, 1, '#2f5a33');
    if (r() < 0.25) rect(b, x, GROUND + 1, 1, 1, '#3f7342');
    if (r() < 0.15) rect(b, x, GROUND + 4, 1, 1 + Math.floor(r() * 2), '#2f5a33');
  }
  for (const [x, c] of [[24, '#e0676b'], [41, '#f2d16b'], [140, '#e0676b'], [214, '#b38cf0'], [252, '#f2d16b'], [288, '#e0676b']]) {
    rect(b, x, GROUND - 2, 1, 2, '#2f5a33');
    rect(b, x, GROUND - 3, 1, 1, c);
  }

  // Cabin.
  const CX = 52, CW = 72, WT = GROUND - 36;
  rect(b, CX + 50, WT - 34, 9, 26, '#4f4f5c');              // chimney
  for (let y = WT - 30; y < WT - 8; y += 4) rect(b, CX + 50, y, 9, 1, '#3d3d48');
  rect(b, CX + 49, WT - 36, 11, 3, '#5d5d6b');
  for (let y = WT; y < GROUND - 4; y += 4) {                 // log walls
    rect(b, CX, y, CW, 4, (y / 4) % 2 ? '#6b4a2e' : '#62432a');
    rect(b, CX, y + 3, CW, 1, '#3f2b1b');
  }
  rect(b, CX - 2, WT, 4, GROUND - WT, '#4a3220');
  rect(b, CX + CW - 2, WT, 4, GROUND - WT, '#4a3220');
  rect(b, CX - 2, GROUND - 4, CW + 4, 4, '#4d4d58');         // stone footing
  for (let x = CX - 2; x < CX + CW + 2; x += 6) rect(b, x, GROUND - 4, 1, 4, '#3a3a44');
  for (let i = 0; ; i++) {                                    // stepped roof
    const x0 = CX - 8 + i * 6, x1 = CX + CW + 8 - i * 6;
    if (x1 - x0 < 8) break;
    const y = WT - 4 - i * 4;
    rect(b, x0, y, x1 - x0, 4, '#7d3a2c');
    rect(b, x0, y + 3, x1 - x0, 1, '#5a2820');
    rect(b, x0, y, 4, 4, '#6a3226');
    rect(b, x1 - 4, y, 4, 4, '#6a3226');
  }
  const WX = CX + 12, WY = WT + 9;                            // window frame (glass is animated)
  rect(b, WX - 2, WY - 2, 18, 16, '#3f2b1b');
  rect(b, CX + 44, GROUND - 26, 14, 22, '#3f2b1b');          // door
  rect(b, CX + 46, GROUND - 24, 10, 20, '#5a3b22');
  rect(b, CX + 50, GROUND - 24, 1, 20, '#4a3120');
  rect(b, CX + 54, GROUND - 15, 1, 2, '#c9a24a');
  const LX = CX + 63, LY = GROUND - 27;                       // lantern
  rect(b, LX + 1, LY - 3, 1, 3, '#2b2b33');
  rect(b, LX - 1, LY, 5, 1, '#2b2b33');
  rect(b, LX - 1, LY + 5, 5, 1, '#2b2b33');

  // Campfire and a log seat.
  const FX = 184;
  rect(b, FX - 13, GROUND - 3, 4, 3, '#5a5a66');
  rect(b, FX + 9, GROUND - 3, 4, 3, '#5a5a66');
  rect(b, FX - 9, GROUND - 2, 3, 2, '#4a4a55');
  rect(b, FX + 6, GROUND - 2, 3, 2, '#4a4a55');
  rect(b, FX - 9, GROUND - 4, 18, 2, '#4a2f1d');
  rect(b, FX - 6, GROUND - 6, 12, 2, '#5c3a22');
  rect(b, FX - 9, GROUND - 4, 1, 2, '#8a6040');
  rect(b, FX + 8, GROUND - 4, 1, 2, '#8a6040');
  rect(b, FX + 22, GROUND - 6, 18, 6, '#5c3a22');
  rect(b, FX + 22, GROUND - 6, 18, 1, '#6e4a2c');
  rect(b, FX + 22, GROUND - 6, 3, 6, '#a07850');
  rect(b, FX + 23, GROUND - 4, 1, 2, '#7d5a3a');

  // ---------- animated layer ----------
  const sr = rng(21);
  const stars = Array.from({ length: 70 }, () => {
    let x, y;
    do { x = Math.floor(sr() * W); y = Math.floor(sr() * 66); }
    while (x > MX - 8 && x < MX + 22 && y > MY - 8 && y < MY + 22);
    return { x, y, big: sr() < 0.12, phase: sr() * 6.28, speed: 0.6 + sr() * 1.6 };
  });

  const fireflies = Array.from({ length: 10 }, () => ({
    x: 20 + Math.random() * 280, y: 112 + Math.random() * 28,
    phase: Math.random() * 6.28, speed: 0.6 + Math.random() * 0.8,
  }));

  let flame = [], flicker = 1;
  function updateFlame() {
    flame = [];
    for (let c = -5; c <= 5; c++) {
      const base = 14 - Math.abs(c) * 2.3;
      flame.push(Math.max(0, Math.round(base * (0.55 + Math.random() * 0.5))));
    }
    flicker = 0.8 + Math.random() * 0.25;
  }
  updateFlame();

  const sparks = [], smoke = [], splashes = [];
  let smokeTimer = 0, sparkTimer = 0, flameTimer = 0;
  let shootingStar = null, nextShootingStar = 8 + Math.random() * 20;

  let rain = 0;
  const drops = Array.from({ length: 240 }, () => newDrop(true));
  function newDrop(anywhere) {
    return {
      x: Math.random() * (W + 50),
      y: anywhere ? Math.random() * H : -4 - Math.random() * 30,
      v: 150 + Math.random() * 60,
      floor: GROUND + Math.random() * (H - GROUND),
    };
  }

  function glow(x, y, radius, rgb, alpha) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, radius);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  let last = performance.now(), time = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    flameTimer += dt;
    if (flameTimer > 0.09) { flameTimer = 0; updateFlame(); }

    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);

    // Stars.
    for (const s of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase));
      ctx.globalAlpha = a * (1 - rain * 0.7);
      rect(ctx, s.x, s.y, 1, 1, '#fff6d8');
      if (s.big && a > 0.8) {
        ctx.globalAlpha *= 0.5;
        rect(ctx, s.x - 1, s.y, 3, 1, '#fff6d8');
        rect(ctx, s.x, s.y - 1, 1, 3, '#fff6d8');
      }
    }
    ctx.globalAlpha = 1;

    // Shooting star.
    nextShootingStar -= dt;
    if (!shootingStar && nextShootingStar <= 0 && rain < 0.3) {
      shootingStar = { x: 60 + Math.random() * 180, y: 6 + Math.random() * 20, t: 0 };
    }
    if (shootingStar) {
      shootingStar.t += dt;
      const p = shootingStar.t / 0.7;
      for (let i = 0; i < 8; i++) {
        ctx.globalAlpha = (1 - i / 8) * (1 - p);
        rect(ctx, Math.round(shootingStar.x + p * 50 - i * 2), Math.round(shootingStar.y + p * 20 - i * 0.8), 1, 1, '#fff6d8');
      }
      ctx.globalAlpha = 1;
      if (p >= 1) { shootingStar = null; nextShootingStar = 20 + Math.random() * 40; }
    }

    // Chimney smoke.
    smokeTimer += dt;
    if (smokeTimer > 0.4) {
      smokeTimer = 0;
      smoke.push({ x: CX + 53, y: WT - 38, age: 0, life: 4 + Math.random() * 2, drift: 2 + Math.random() * 3 });
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.age += dt;
      if (p.age > p.life) { smoke.splice(i, 1); continue; }
      p.y -= 6 * dt;
      p.x += p.drift * dt + Math.sin(time + i) * 0.05;
      const size = Math.round(2 + p.age * 0.8);
      ctx.globalAlpha = 0.3 * (1 - p.age / p.life);
      rect(ctx, Math.round(p.x), Math.round(p.y), size, size, '#b8b6c8');
    }
    ctx.globalAlpha = 1;

    // Window and lantern light.
    const winFlicker = 0.92 + Math.sin(time * 3.1) * 0.04 + Math.sin(time * 7.3) * 0.03;
    glow(WX + 7, WY + 6, 28, '255,200,110', 0.16 * winFlicker);
    rect(ctx, WX, WY, 14, 12, winFlicker > 0.95 ? '#ffd986' : '#ffcf72');
    rect(ctx, WX, WY + 8, 14, 4, '#f5b85c');
    rect(ctx, WX + 6, WY, 2, 12, '#3f2b1b');
    rect(ctx, WX, WY + 5, 14, 2, '#3f2b1b');
    glow(LX + 1.5, LY + 3, 14, '255,190,100', 0.22 * winFlicker);
    rect(ctx, LX, LY + 1, 3, 4, '#ffd27a');

    // Campfire light, flames and sparks.
    glow(FX, GROUND - 8, 64, '255,140,60', 0.2 * flicker);
    flame.forEach((h, i) => {
      const c = i - 5;
      for (let k = 0; k < h; k++) {
        const f = k / Math.max(1, h);
        const col = f < 0.3 && Math.abs(c) < 3 ? '#fff1a8' : f < 0.6 ? '#ffb43c' : f < 0.85 ? '#ff6a24' : '#c8341a';
        rect(ctx, FX + c, GROUND - 6 - k, 1, 1, col);
      }
    });
    sparkTimer += dt;
    if (sparkTimer > 0.25) {
      sparkTimer = 0;
      if (Math.random() < 0.7) sparks.push({ x: FX + (Math.random() - 0.5) * 6, y: GROUND - 14, age: 0, life: 1 + Math.random() * 1.2, vx: (Math.random() - 0.5) * 8 });
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age > s.life) { sparks.splice(i, 1); continue; }
      s.y -= 18 * dt;
      s.x += s.vx * dt + Math.sin(time * 4 + i) * 0.1;
      ctx.globalAlpha = 1 - s.age / s.life;
      rect(ctx, Math.round(s.x), Math.round(s.y), 1, 1, '#ffb43c');
    }
    ctx.globalAlpha = 1;

    // Fireflies (fewer when it rains).
    const visibleFlies = Math.round(fireflies.length * (1 - rain * 0.8));
    for (let i = 0; i < visibleFlies; i++) {
      const f = fireflies[i];
      const x = Math.round(f.x + Math.sin(time * 0.3 * f.speed + f.phase) * 18);
      const y = Math.round(f.y + Math.sin(time * 0.5 * f.speed + f.phase * 2) * 7);
      const a = Math.sin(time * 1.3 * f.speed + f.phase * 3);
      if (a <= 0.1) continue;
      ctx.globalAlpha = a * 0.25;
      rect(ctx, x - 1, y - 1, 3, 3, '#e9ff8a');
      ctx.globalAlpha = a;
      rect(ctx, x, y, 1, 1, '#f4ffc0');
    }
    ctx.globalAlpha = 1;

    // Rain.
    if (rain > 0) {
      ctx.fillStyle = `rgba(12,16,36,${0.22 * rain})`;
      ctx.fillRect(0, 0, W, H);
      const n = Math.round(drops.length * rain);
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        d.y += d.v * dt;
        d.x -= d.v * dt * 0.2;
        if (d.y > d.floor) {
          splashes.push({ x: Math.round(d.x), y: Math.round(d.floor), age: 0 });
          Object.assign(d, newDrop(false));
        }
        rect(ctx, Math.round(d.x), Math.round(d.y), 1, 3, 'rgba(165,185,235,0.5)');
      }
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.age += dt;
      if (s.age > 0.15) { splashes.splice(i, 1); continue; }
      rect(ctx, s.x - 1, s.y - 1, 1, 1, 'rgba(165,185,235,0.6)');
      rect(ctx, s.x + 1, s.y - 1, 1, 1, 'rgba(165,185,235,0.6)');
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setRain(level) { rain = Math.max(0, Math.min(1, level)); },
  };
})();
