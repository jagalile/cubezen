// Generative lofi piano + ambient rain and campfire, all synthesised with Web Audio.
// No audio files: every note is original and generated live in the browser.
window.Ambience = (() => {
  let ctx = null, master, musicBus, musicOut, rainGain, fireGain, reverb, white;
  // Notes of the current play session; dropped on pause so nothing keeps sounding.
  let session = null;
  let playing = false, scheduler = null;
  const vol = { music: 0.6, rain: 0, fire: 0.35 };
  const LEVEL = { music: 0.8, rain: 0.5, fire: 0.7 };
  const pieceListeners = [];

  const BPM = 64, BEAT = 60 / BPM, BEATS_PER_CHORD = 8, CHORDS_PER_PIECE = 16;
  const LOOKAHEAD = 1.2;

  const CHORDS = {
    Fmaj7: { bass: 41, tones: [53, 57, 60, 64] },
    Cmaj9: { bass: 36, tones: [52, 55, 59, 62] },
    Am7:   { bass: 45, tones: [52, 55, 57, 60] },
    Em7:   { bass: 40, tones: [50, 55, 59, 62] },
    Dm9:   { bass: 38, tones: [53, 57, 60, 64] },
    G6:    { bass: 43, tones: [50, 55, 59, 64] },
  };
  const PIECES = [
    { name: 'Mossy Cabin',  chords: ['Fmaj7', 'Cmaj9', 'Am7', 'Em7'] },
    { name: 'Ember Glow',   chords: ['Dm9', 'G6', 'Cmaj9', 'Am7'] },
    { name: 'Lantern Rain', chords: ['Am7', 'Fmaj7', 'Cmaj9', 'G6'] },
    { name: 'Quiet Chunk',  chords: ['Fmaj7', 'Em7', 'Dm9', 'Cmaj9'] },
    { name: 'Firefly Path', chords: ['Cmaj9', 'Am7', 'Dm9', 'G6'] },
  ];
  // C major pentatonic, A3–A5.
  const SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81];

  let piece = null, pieceIdx = -1, beat = 0, nextTime = 0, melody = 5, density = 0.3;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.5, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    reverb.connect(wet).connect(musicOut);

    // Music bus with a slow "tape wow" and a warm lowpass.
    musicBus = ctx.createGain();
    const wow = ctx.createDelay(0.05);
    wow.delayTime.value = 0.012;
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.35;
    lfoDepth.gain.value = 0.0012;
    lfo.connect(lfoDepth).connect(wow.delayTime);
    lfo.start();
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 2400;
    musicBus.connect(wow).connect(warm);
    warm.connect(musicOut);
    warm.connect(reverb);

    white = noiseBuffer(4);

    // Rain: band-limited noise.
    rainGain = ctx.createGain();
    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 450;
    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 3200;
    loopNoise().connect(rainHp).connect(rainLp).connect(rainGain).connect(master);

    // Fire: low rumble + random crackles.
    fireGain = ctx.createGain();
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

  // A soft, felt-piano-ish voice.
  function voice(midi, t, velocity, duration, dest) {
    const f = mtof(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(velocity, t + 0.012);
    env.gain.exponentialRampToValueAtTime(velocity * 0.3, t + 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(8000, f * 6), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + duration);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = f;
    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.value = f * 2;
    overtone.detune.value = 4;
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.18;

    body.connect(lp);
    overtone.connect(overtoneGain).connect(lp);
    lp.connect(env).connect(dest || session.input);
    for (const o of [body, overtone]) {
      o.start(t);
      o.stop(t + duration + 0.05);
      if (!dest) {
        const notes = session.notes;
        notes.add(o);
        o.onended = () => notes.delete(o);
      }
    }
  }

  function nextPiece() {
    let i;
    do { i = Math.floor(Math.random() * PIECES.length); } while (i === pieceIdx && PIECES.length > 1);
    pieceIdx = i;
    piece = PIECES[i];
    density = 0.18 + Math.random() * 0.25;
    pieceListeners.forEach((cb) => cb(piece.name));
  }

  // Nearest scale index whose pitch class belongs to the chord.
  function snapToChord(idx, chord) {
    const pcs = new Set([chord.bass, ...chord.tones].map((m) => m % 12));
    for (let d = 0; d < SCALE.length; d++) {
      for (const j of [idx - d, idx + d]) {
        if (j >= 0 && j < SCALE.length && pcs.has(SCALE[j] % 12)) return j;
      }
    }
    return idx;
  }

  function scheduleBeat(t) {
    const pos = beat % BEATS_PER_CHORD;
    const chordNum = Math.floor(beat / BEATS_PER_CHORD);
    if (pos === 0 && chordNum > 0 && chordNum % CHORDS_PER_PIECE === 0) nextPiece();
    const chord = CHORDS[piece.chords[chordNum % piece.chords.length]];

    if (pos === 0) {
      voice(chord.bass, t, 0.22, 7);
      chord.tones.forEach((m, i) => voice(m, t + 0.06 + i * 0.12 + Math.random() * 0.03, 0.065, 6.5));
    } else if (pos === 4 && Math.random() < 0.5) {
      chord.tones.forEach((m, i) => voice(m, t + i * 0.09, 0.04, 4));
    }

    if (Math.random() < density) {
      const offset = Math.random() < 0.3 ? BEAT * 0.5 : 0;
      melody = Math.max(0, Math.min(SCALE.length - 1, melody + pick([-2, -1, -1, 0, 1, 1, 2])));
      if (pos === 0 || pos === 4) melody = snapToChord(melody, chord);
      voice(SCALE[melody], t + offset, 0.09 + Math.random() * 0.05, 3.5);
      if (Math.random() < 0.15) {
        const neighbour = Math.max(0, Math.min(SCALE.length - 1, melody + pick([-1, 1])));
        voice(SCALE[neighbour], t + offset + BEAT * 0.5, 0.07, 3);
      }
    }
    beat++;
  }

  function tick() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleBeat(nextTime);
      nextTime += BEAT;
    }
  }

  function play() {
    init();
    if (playing) return;
    playing = true;
    session = { input: ctx.createGain(), notes: new Set() };
    session.input.connect(musicBus);
    musicOut.gain.cancelScheduledValues(ctx.currentTime);
    musicOut.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
    if (!piece) nextPiece();
    else pieceListeners.forEach((cb) => cb(piece.name));
    nextTime = ctx.currentTime + 0.1;
    tick();
    scheduler = setInterval(tick, 250);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    clearInterval(scheduler);
    // Quick fade (~150ms) instead of letting already-scheduled notes ring out.
    const old = session;
    session = null;
    musicOut.gain.cancelScheduledValues(ctx.currentTime);
    musicOut.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    old.input.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => {
      old.notes.forEach((o) => { try { o.stop(); } catch {} });
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
    [72, 76, 79, 84].forEach((m, i) => voice(m, t + i * 0.18, 0.18, 2.5, master));
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
