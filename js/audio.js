// Synthesised piano + pad that perform Composer's pieces, plus ambient rain and campfire.
// No audio files: every sound is generated live with the Web Audio API.
window.Ambience = (() => {
  let ctx = null, master, musicBus, musicOut, rainGain, fireGain, white, pianoWave;
  // Sources of the current play session; dropped on pause so nothing keeps sounding.
  let session = null;
  let playing = false, scheduler = null, nameTimer = null;
  const vol = { music: 0.6, rain: 0, fire: 0.35 };
  const LEVEL = { music: 0.9, rain: 0.5, fire: 0.7 };
  const pieceListeners = [];
  const LOOKAHEAD = 1.2;

  // Current piece and its playback position.
  let piece = null, queue = [], qi = 0, pieceStart = 0, pieceEnd = 0;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0.8;
    // Gentle safety limiter only: a heavy compressor flattens the volume sliders.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);

    // Play/pause gate after the reverb, so pausing also cuts the reverb tail.
    musicOut = ctx.createGain();
    musicOut.gain.value = 0;
    musicOut.connect(master);

    // Music bus → soft top-end → dry + large, dark hall reverb.
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;                               // fades in to the slider value
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 6500;
    musicBus.connect(soft);
    const dry = ctx.createGain();
    dry.gain.value = 0.75;
    soft.connect(dry).connect(musicOut);
    const preDelay = ctx.createDelay(0.1);
    preDelay.delayTime.value = 0.03;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 3800;
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(5, 3);
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    soft.connect(preDelay).connect(dark).connect(reverb).connect(wet).connect(musicOut);

    // Piano timbre: harmonics falling off with order; a lowpass then makes them decay.
    const harmonics = [0, 1, 0.55, 0.3, 0.2, 0.12, 0.08, 0.05, 0.035, 0.02];
    pianoWave = ctx.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));

    white = noiseBuffer(4);

    // Rain: band-limited noise.
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 450;
    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 3200;
    loopNoise().connect(rainHp).connect(rainLp).connect(rainGain).connect(master);

    // Fire: low rumble + random crackles.
    fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'lowpass';
    rumble.frequency.value = 220;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.9;
    loopNoise().connect(rumble).connect(rumbleGain).connect(fireGain);
    fireGain.connect(master);
    crackle();

    for (const k of Object.keys(vol)) setVolume(k, vol[k]);
  }

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // White noise loops seamlessly, so every texture is filtered white noise.
  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function loopNoise() {
    const src = ctx.createBufferSource();
    src.buffer = white;
    src.loop = true;
    src.loopStart = Math.random();
    src.start();
    return src;
  }

  function crackle() {
    if (vol.fire > 0.01 && ctx.state === 'running') {
      const t = ctx.currentTime;
      const pops = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pops; i++) {
        const start = t + 0.01 + i * Math.random() * 0.05;
        const src = ctx.createBufferSource();
        src.buffer = white;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1500 + Math.random() * 3500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2 + Math.random() * 0.6, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.01 + Math.random() * 0.04);
        src.connect(hp).connect(g).connect(fireGain);
        src.start(start, Math.random() * 3, 0.08);
      }
    }
    setTimeout(crackle, 80 + Math.random() * 520);
  }

  // Start a source and, if it belongs to the music session, remember it for pause.
  function launch(src, t, stopAt, tracked) {
    src.start(t);
    src.stop(stopAt);
    if (tracked && session) {
      const set = session.sources;
      set.add(src);
      src.onended = () => set.delete(src);
    }
  }

  // Piano: rich tone + a slightly detuned second "string" + a felt hammer thump.
  function piano(midi, t, velocity, hold, dest) {
    const f = mtof(midi);
    const out = dest || session.input;
    const decay = clamp(11 - (midi - 30) * 0.14, 1.8, 10);   // low notes sustain longer
    const end = t + Math.min(hold, decay);
    const stopAt = end + 0.6;
    const peak = velocity * velocity * 1.2;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.005);
    env.gain.setTargetAtTime(0, t + 0.005, decay / 3.5);
    env.gain.setTargetAtTime(0, end, 0.12);                 // damper

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.Q.value = 0.3;
    tone.frequency.setValueAtTime(Math.min(14000, f * (2.5 + velocity * 9)), t);
    tone.frequency.setTargetAtTime(Math.max(180, f * 1.3), t, decay / 4);

    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp((midi - 62) / 40, -0.45, 0.45);
    env.connect(pan).connect(out);

    const string1 = ctx.createOscillator();
    string1.setPeriodicWave(pianoWave);
    string1.frequency.value = f;
    string1.detune.value = -1.2;
    const string2 = ctx.createOscillator();
    string2.frequency.value = f;
    string2.detune.value = 1.6;
    const string2Gain = ctx.createGain();
    string2Gain.gain.value = 0.45;
    string1.connect(tone);
    string2.connect(string2Gain).connect(tone);
    tone.connect(env);

    const hammer = ctx.createBufferSource();
    hammer.buffer = white;
    const hammerTone = ctx.createBiquadFilter();
    hammerTone.type = 'bandpass';
    hammerTone.frequency.value = Math.min(5000, f * 3);
    hammerTone.Q.value = 0.8;
    const hammerEnv = ctx.createGain();
    hammerEnv.gain.setValueAtTime(peak * 0.25, t);
    hammerEnv.gain.setTargetAtTime(0, t, 0.012);
    hammer.connect(hammerTone).connect(hammerEnv).connect(pan);

    const tracked = !dest;
    launch(string1, t, stopAt, tracked);
    launch(string2, t, stopAt, tracked);
    hammer.start(t, Math.random() * 3, 0.1);
  }

  // Pad: two detuned saws through a dark filter, slow swell and release.
  function pad(midi, t, velocity, dur) {
    const f = mtof(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(velocity, t + 2.5);
    env.gain.setValueAtTime(velocity, t + dur);             // explicit hold before the release
    env.gain.setTargetAtTime(0, t + dur, 1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    filter.Q.value = 0.4;
    filter.connect(env).connect(session.input);
    for (const detune of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(filter);
      launch(o, t, t + dur + 5, true);
    }
  }

  function startPiece(at) {
    piece = Composer.compose();
    queue = piece.events;
    qi = 0;
    pieceStart = at;
    pieceEnd = at + piece.length + 4 + Math.random() * 8;  // a quiet gap between pieces
    const name = piece.name;
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => pieceListeners.forEach((cb) => cb(name)), Math.max(0, (at - ctx.currentTime) * 1000));
  }

  function tick() {
    const horizon = ctx.currentTime + LOOKAHEAD;
    for (;;) {
      if (qi >= queue.length) {
        if (pieceEnd > horizon) break;
        startPiece(pieceEnd);
        continue;
      }
      const e = queue[qi];
      const at = pieceStart + e.t;
      if (at > horizon) break;
      const when = Math.max(at, ctx.currentTime + 0.01);
      if (e.kind === 'pad') pad(e.midi, when, e.v, e.dur);
      else piano(e.midi, when, e.v, e.dur);
      qi++;
    }
  }

  function play() {
    init();
    if (playing) return;
    playing = true;
    session = { input: ctx.createGain(), sources: new Set() };
    session.input.connect(musicBus);
    musicOut.gain.cancelScheduledValues(ctx.currentTime);
    musicOut.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
    startPiece(ctx.currentTime + 0.15);
    tick();
    scheduler = setInterval(tick, 250);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    clearInterval(scheduler);
    clearTimeout(nameTimer);
    // Quick fade (~150ms) instead of letting already-scheduled notes ring out.
    const old = session;
    session = null;
    musicOut.gain.cancelScheduledValues(ctx.currentTime);
    musicOut.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    old.input.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => {
      old.sources.forEach((s) => { try { s.stop(); } catch {} });
      old.input.disconnect();
    }, 300);
  }

  function setVolume(kind, value) {
    vol[kind] = value;
    if (!ctx) return;
    const node = { music: musicBus, rain: rainGain, fire: fireGain }[kind];
    node.gain.setTargetAtTime(value * value * LEVEL[kind], ctx.currentTime, 0.03);
  }

  function chime() {
    init();
    const t = ctx.currentTime + 0.05;
    [72, 76, 79, 84].forEach((m, i) => piano(m, t + i * 0.18, 0.7, 3, master));
  }

  return {
    init,
    play,
    pause,
    toggle() { playing ? pause() : play(); return playing; },
    get playing() { return playing; },
    setVolume,
    chime,
    onPiece(cb) { pieceListeners.push(cb); },
  };
})();
