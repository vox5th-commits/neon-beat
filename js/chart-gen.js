/**
 * Pattern-aware chart generator for built-in and custom songs.
 */

const PATTERNS = {
  easy: [
    [0],
    [1],
    [2],
    [3],
    [0, 3],
    [1, 2],
  ],
  normal: [
    [0],
    [1],
    [2],
    [3],
    [0, 1],
    [2, 3],
    [0, 3],
    [1, 2],
    [0, 2],
    [1, 3],
    [3, 2, 1, 0],
    [0, 1, 2, 3],
  ],
  hard: [
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 3],
    [0, 2],
    [1, 3],
    [0, 1, 2],
    [1, 2, 3],
    [0, 1, 2, 3],
    [0, 3, 1, 2],
    [3, 2, 1, 0],
    [0, 2, 1, 3],
  ],
};

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {{ bpm: number, duration: number, difficulty?: string, seed?: number, longNoteChance?: number }} opts
 */
export function generateChart(opts) {
  const bpm = opts.bpm || 120;
  const duration = Math.max(8, opts.duration || 30);
  const difficulty = opts.difficulty || "normal";
  const rand = mulberry32(opts.seed ?? Math.floor(bpm * 1000 + duration));
  const beat = 60 / bpm;
  const step = difficulty === "hard" ? beat / 2 : difficulty === "easy" ? beat : beat / 2;
  const densitySkip =
    difficulty === "easy" ? 0.45 : difficulty === "hard" ? 0.08 : 0.22;
  const longChance =
    opts.longNoteChance ??
    (difficulty === "hard" ? 0.12 : difficulty === "easy" ? 0.04 : 0.08);
  const patterns = PATTERNS[difficulty] || PATTERNS.normal;

  const notes = [];
  let t = beat * 2; // lead-in silence
  let patIdx = 0;
  let laneCursor = 0;

  while (t < duration - 1.5) {
    if (rand() < densitySkip) {
      t += step;
      continue;
    }

    // stream staircase sometimes
    if (difficulty !== "easy" && rand() < 0.18) {
      const dir = rand() < 0.5 ? 1 : -1;
      let lane = Math.floor(rand() * 4);
      const len = difficulty === "hard" ? 4 + Math.floor(rand() * 4) : 3;
      for (let i = 0; i < len && t < duration - 1.5; i++) {
        notes.push({ t: round4(t), lane });
        lane = (lane + dir + 4) % 4;
        t += step;
      }
      continue;
    }

    const pat = patterns[patIdx % patterns.length];
    patIdx += 1 + Math.floor(rand() * 2);
    for (const lane of pat) {
      const useLong = rand() < longChance && pat.length === 1;
      if (useLong) {
        const dur = step * (2 + Math.floor(rand() * 3));
        notes.push({ t: round4(t), lane, dur: round4(dur) });
      } else {
        notes.push({ t: round4(t), lane: (lane + laneCursor) % 4 });
      }
    }
    if (rand() < 0.3) laneCursor = (laneCursor + 1) % 4;
    t += step * (difficulty === "hard" && rand() < 0.35 ? 1 : 1 + Math.floor(rand() * 2) * 0.5);
  }

  // dedupe same t+lane
  const seen = new Set();
  const cleaned = [];
  for (const n of notes.sort((a, b) => a.t - b.t || a.lane - b.lane)) {
    const key = `${n.t}|${n.lane}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(n);
  }

  const scrollSpeed =
    difficulty === "hard" ? 1.2 : difficulty === "easy" ? 0.85 : 1.0;

  return { scrollSpeed, notes: cleaned };
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}

/** Simple energy-based BPM estimate (rough). */
export function estimateBpm(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;
  const hop = Math.floor(sr * 0.01);
  const energies = [];
  for (let i = 0; i + hop < data.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += data[i + j] * data[i + j];
    energies.push(e / hop);
  }
  // peak pick interval histogram for 70-180 BPM
  const peaks = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1] && energies[i] > 0.0001) {
      peaks.push(i);
    }
  }
  const hist = new Map();
  for (let i = 1; i < peaks.length; i++) {
    const dt = (peaks[i] - peaks[i - 1]) * 0.01;
    if (dt < 0.33 || dt > 0.86) continue; // 70-180
    const bpm = Math.round(60 / dt);
    hist.set(bpm, (hist.get(bpm) || 0) + 1);
  }
  let best = 128;
  let bestC = 0;
  for (const [bpm, c] of hist) {
    if (c > bestC) {
      bestC = c;
      best = bpm;
    }
  }
  // snap to common
  if (best < 90) best *= 2;
  if (best > 180) best = Math.round(best / 2);
  return Math.max(70, Math.min(200, best));
}
