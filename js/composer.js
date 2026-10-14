// Generative composer in the style of calm game soundtracks: sparse pedalled piano,
// open maj7/add9 voicings, lots of lydian, short motifs that come back with variations,
// and pieces with a beginning and an end. It writes original music; it never quotes
// existing pieces.
//
// compose() returns { name, length, events }, where each event is
// { t: seconds from piece start, midi, v: velocity 0–1, dur: seconds, kind: 'piano' | 'pad' }.
globalThis.Composer = (() => {
  const r = Math.random;
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const mod = (n, m) => ((n % m) + m) % m;

  function weighted(table) {
    const entries = Object.entries(table);
    let x = r() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [key, w] of entries) if ((x -= w) < 0) return key;
    return entries[0][0];
  }

  const MODES = {
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    ionian:     [0, 2, 4, 5, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    aeolian:    [0, 2, 3, 5, 7, 8, 10],
  };
  const MODE_WEIGHTS = { lydian: 3, ionian: 3, aeolian: 2, dorian: 1.5, mixolydian: 1 };

  // Chord progressions as scale degrees (0 = tonic). Mode-typical moves, nothing borrowed.
  const PROGRESSIONS = {
    lydian:     [[0, 1], [0, 1, 6, 0], [0, 1, 0, 4], [0, 6, 1, 1], [0, 2, 1, 0]],
    ionian:     [[0, 3], [0, 5, 3, 4], [3, 0, 5, 2], [0, 2, 3, 3], [5, 3, 0, 4], [3, 4, 2, 5]],
    mixolydian: [[0, 6, 3, 0], [0, 3], [0, 6]],
    dorian:     [[0, 3], [0, 6, 3, 3], [0, 2, 3, 0]],
    aeolian:    [[0, 5, 2, 6], [0, 3, 5, 4], [5, 6, 0, 0], [0, 6, 5, 6], [0, 5]],
  };

  const RHYTHMS = [
    [1, 1, 2], [0.5, 0.5, 1, 2], [1.5, 0.5, 2], [1, 0.5, 0.5, 2],
    [2, 1, 1, 2], [1, 1, 1, 1], [0.5, 1, 0.5, 2], [3, 1, 2], [1, 2, 1],
  ];

  const NAME_A = ['Moss', 'Ember', 'Lantern', 'Firefly', 'Birch', 'Hearth', 'Willow', 'Cobble',
    'Meadow', 'Drizzle', 'Dusk', 'Fern', 'Amber', 'Pine', 'Clover', 'Lichen', 'Hollow', 'Cinder'];
  const NAME_B = ['Lullaby', 'Path', 'Glow', 'Waltz', 'Song', 'Light', 'Haze', 'Morning',
    'Dream', 'Rest', 'Hush', 'Drift', 'Echo', 'Hymn', 'Hollow', 'Window'];

  function makeName() {
    let a, b;
    do { a = pick(NAME_A); b = pick(NAME_B); } while (a === b);
    return `${a} ${b}`;
  }

  function compose() {
    const modeName = weighted(MODE_WEIGHTS);
    const scale = MODES[modeName];
    const tonic = 36 + Math.floor(r() * 12);              // C2–B2
    const deg = (k) => tonic + Math.floor(k / 7) * 12 + scale[mod(k, 7)];
    const pc = (k) => mod(deg(k), 12);

    const prog = pick(PROGRESSIONS[modeName]);
    const beat = 60 / (54 + r() * 20);                    // 54–74 BPM
    const leftHand = weighted({ roll: 3, arp: 2, pulse: 1 });
    const hasPad = r() < 0.4;
    const chords = r() < 0.5 ? 16 : 20;
    const events = [];

    const add = (t, midi, v, dur, kind = 'piano') => {
      const jitter = kind === 'piano' ? (r() - 0.5) * 0.05 : 0;
      events.push({ t: Math.max(0, t + jitter), midi, v: Math.min(1, v * (0.9 + r() * 0.2)), dur, kind });
    };

    function voicing(d) {
      let bass = deg(d);
      while (bass > 47) bass -= 12;
      while (bass < 33) bass += 12;
      const fifth = bass + mod(pc(d + 4) - bass, 12);
      const upper = [];
      let floor = 53;
      for (const k of [d + 2, d + 6, d + 8]) {          // 3rd, 7th, 9th: open and airy
        let m = floor;
        while (mod(m, 12) !== pc(k)) m++;
        if (m > 77) m -= 12;
        if (!upper.includes(m)) upper.push(m);
        floor = m + 3;
      }
      upper.sort((a, b) => a - b);
      return { bass, fifth, upper, tones: new Set([d, d + 2, d + 4, d + 6, d + 8].map(pc)) };
    }

    // Melody lives on scale degrees 7–15 (an octave above the voicings).
    const melodyMidi = (k) => deg(k) + 12;
    const clampK = (k) => Math.max(7, Math.min(15, k));
    function nearestChordDegree(k, chord) {
      for (let d = 0; d < 8; d++) {
        for (const j of [k - d, k + d]) if (j >= 7 && j <= 15 && chord.tones.has(pc(j))) return j;
      }
      return k;
    }

    // One motif per piece: a few notes and a rhythm that keep coming back.
    const motif = (() => {
      const rhythm = pick(RHYTHMS);
      const steps = [0];
      let s = 0;
      for (let i = 1; i < rhythm.length; i++) { s += pick([-2, -1, -1, 1, 1, 2, 3, -3, 0]); steps.push(s); }
      return { rhythm, steps, offset: pick([0, 0, 0.5, 1, 2]) };
    })();
    let melodyK = 9 + Math.floor(r() * 4);

    function phrase(chord) {
      let steps = motif.steps.slice();
      const rhythm = motif.rhythm.slice();
      const v = r();
      if (v < 0.2) steps = steps.map((x) => -x);                         // inversion
      else if (v < 0.35) steps[steps.length - 1] += pick([-1, 1, 2]);     // new ending
      else if (v < 0.45 && steps.length > 2) { steps.pop(); rhythm.pop(); rhythm[rhythm.length - 1] += 1; }
      const anchor = nearestChordDegree(melodyK, chord);
      const notes = steps.map((st, i) => ({ k: clampK(anchor + st), len: rhythm[i] }));
      const last = notes[notes.length - 1];
      last.k = nearestChordDegree(last.k, chord);
      melodyK = last.k;
      return notes;
    }

    function playPhrase(start, b, chord, loud) {
      let t = start;
      phrase(chord).forEach((n, i) => {
        const v = (i === 0 ? 0.62 : 0.52) * loud;
        add(t, melodyMidi(n.k), v, Math.min(n.len * b * 1.6 + 0.6, 6));
        t += n.len * b;
      });
      return t - start;
    }

    let t = 0;
    for (let i = 0; i < chords; i++) {
      const section = i < 2 ? 'intro' : i >= chords - 2 ? 'outro' : i < chords / 2 ? 'A' : 'B';
      // Gentle rubato, and a ritardando into the ending.
      const stretch = 1 + 0.03 * Math.sin(i * 0.9) + (i === chords - 2 ? 0.08 : 0) + (i === chords - 1 ? 0.18 : 0);
      const b = beat * stretch;
      const len = 8 * b;
      const hold = len + 0.4;                               // pedal is lifted at the chord change
      const chord = voicing(prog[i % prog.length]);
      const quiet = section === 'intro' || section === 'outro';
      const lhVel = quiet ? 0.32 : 0.4;

      if (leftHand === 'roll' || quiet) {
        add(t, chord.bass, lhVel * 1.15, hold);
        if (r() < 0.7) add(t + 0.05, chord.fifth, lhVel * 0.7, hold);
        chord.upper.forEach((m, j) => add(t + 0.14 + j * (0.09 + r() * 0.1), m, lhVel * 0.8, hold));
        if (!quiet && r() < 0.4) chord.upper.forEach((m, j) => add(t + 4 * b + j * 0.11, m, lhVel * 0.5, hold - 4 * b));
      } else if (leftHand === 'arp') {
        const top = chord.upper[chord.upper.length - 1];
        const seq = [chord.bass, chord.fifth, chord.upper[0], chord.upper[1] ?? top, top, chord.upper[1] ?? top, chord.upper[0], chord.fifth];
        seq.forEach((m, j) => add(t + j * b, m, lhVel * (j === 0 ? 1.15 : 0.6), hold - j * b));
      } else {
        add(t, chord.bass, lhVel * 1.15, hold);
        for (const k of [0, 3, 6]) {
          chord.upper.forEach((m, j) => add(t + k * b + j * 0.02, m, lhVel * (k === 0 ? 0.6 : 0.42), k === 6 ? len - k * b + 0.4 : 3 * b + 0.05));
        }
      }

      if (hasPad) {
        for (const m of [chord.bass + 12, chord.fifth + 12, chord.upper[0]]) add(t, m, 0.025, len + 1.5, 'pad');
      }

      if ((section === 'A' && r() < 0.75) || (section === 'B' && r() < 0.9)) {
        const used = motif.offset + playPhrase(t + motif.offset * b, b, chord, section === 'B' ? 1.05 : 1) / b;
        if (section === 'B' && used <= 4.5 && r() < 0.55) playPhrase(t + 5 * b, b, chord, 0.85); // answer
      }

      if (section === 'B' && r() < 0.3) {                   // a high, soft twinkle
        const k = 14 + Math.floor(r() * 4);
        add(t + (2 + Math.floor(r() * 5)) * b, melodyMidi(nearestChordDegree(Math.min(15, k), chord)) + 12, 0.28, 3);
      }

      t += len;
    }

    // Final tonic chord, left to ring.
    const fin = voicing(0);
    add(t, fin.bass, 0.38, 9);
    add(t + 0.06, fin.fifth, 0.28, 9);
    fin.upper.forEach((m, j) => add(t + 0.2 + j * 0.16, m, 0.3, 9));
    if (r() < 0.6) add(t + 1.4, melodyMidi(nearestChordDegree(melodyK, fin)), 0.36, 8);
    if (hasPad) for (const m of [fin.bass + 12, fin.fifth + 12]) add(t, m, 0.025, 8, 'pad');

    events.sort((a, b) => a.t - b.t);
    return { name: makeName(), length: t + 9, events, mode: modeName, tonic, leftHand, hasPad };
  }

  return { compose };
})();
