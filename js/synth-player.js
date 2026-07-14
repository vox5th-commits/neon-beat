/**
 * Offline Web Audio synth used when WAV files are unavailable (e.g. GitHub Pages).
 */

function kick(ctx, time, gainNode, vol = 0.7) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  osc.connect(g);
  g.connect(gainNode);
  osc.start(time);
  osc.stop(time + 0.2);
}

function hat(ctx, time, gainNode, vol = 0.12) {
  const frames = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  src.connect(g);
  g.connect(gainNode);
  src.start(time);
}

function bass(ctx, time, freq, gainNode, vol = 0.18) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  osc.connect(g);
  g.connect(gainNode);
  osc.start(time);
  osc.stop(time + 0.25);
}

function lead(ctx, time, freq, gainNode, style, dur = 0.16) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = style === "neon" ? "triangle" : style === "classic" ? "sine" : "square";
  osc.frequency.setValueAtTime(freq, time);
  const d = Math.max(0.08, dur);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(style === "classic" ? 0.14 : 0.11, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + d);
  osc.connect(g);
  g.connect(gainNode);
  osc.start(time);
  osc.stop(time + d + 0.02);
}

function padTone(ctx, time, freq, gainNode, dur, vol = 0.04) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.08);
  g.gain.setValueAtTime(vol, time + Math.max(0.1, dur - 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g);
  g.connect(gainNode);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

const SCALE_PULSE = [65.41, 82.41, 98.0, 130.81, 164.81];
const SCALE_NEON = [73.42, 87.31, 110.0, 146.83, 174.61];
const LEAD_PULSE = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 349.23, 440.0];
const LEAD_NEON = [293.66, 349.23, 440.0, 587.33, 440.0, 349.23, 392.0, 466.16];

// Air on the G String melody fragments (Hz) ??PD composition, original synth
const AIR_MELODY = [
  587.33, 554.37, 587.33, 440.0, 392.0, 369.99, 329.63, 293.66, 277.18, 293.66, 329.63, 369.99, 392.0,
  369.99, 329.63, 293.66, 277.18, 246.94, 220.0, 293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 440.0,
  392.0, 369.99, 329.63, 293.66, 277.18, 293.66,
];

function resolveStyle(songId) {
  const id = (songId || "").toLowerCase();
  if (id.includes("air") || id.includes("bach") || id.includes("classic")) return "classic";
  if (id.includes("neon")) return "neon";
  return "pulse";
}

/**
 * @param {AudioContext} ctx
 * @param {{ bpm: number, notes: {t:number,lane:number,dur?:number}[], songId?: string, duration?: number }} opts
 */
export async function renderSynthBuffer(ctx, opts) {
  const bpm = opts.bpm || 128;
  const beat = 60 / bpm;
  const notes = opts.notes || [];
  const lastNote = notes.length
    ? notes.reduce((m, n) => Math.max(m, n.t + (n.dur || 0)), 0)
    : 20;
  const duration = Math.max(opts.duration || 0, lastNote + 2.5, 16);
  const style = resolveStyle(opts.songId);
  const scale = style === "neon" ? SCALE_NEON : style === "classic" ? [146.83, 164.81, 174.61, 196.0, 220.0] : SCALE_PULSE;
  const leadNotes = style === "neon" ? LEAD_NEON : style === "classic" ? AIR_MELODY : LEAD_PULSE;

  const offline = new OfflineAudioContext(1, Math.ceil(duration * ctx.sampleRate), ctx.sampleRate);
  const master = offline.createGain();
  master.gain.value = 0.85;
  master.connect(offline.destination);

  // bed pad + soft sub
  {
    const osc = offline.createOscillator();
    const g = offline.createGain();
    osc.type = "sine";
    osc.frequency.value = style === "neon" ? 110 : style === "classic" ? 146.83 : 98;
    g.gain.value = style === "classic" ? 0.03 : 0.035;
    osc.connect(g);
    g.connect(master);
    osc.start(0);
    osc.stop(duration);
    const sub = offline.createOscillator();
    const sg = offline.createGain();
    sub.type = "sine";
    sub.frequency.value = style === "neon" ? 55 : style === "classic" ? 73.42 : 49;
    sg.gain.value = style === "classic" ? 0.03 : 0.05;
    sub.connect(sg);
    sg.connect(master);
    sub.start(0);
    sub.stop(duration);
  }

  if (style === "classic") {
    // Gentle baroque-ish pulse: soft bass, melody from chart timings
    let t = 0;
    let step = 0;
    while (t < duration - 0.5) {
      const f = scale[step % scale.length];
      bass(offline, t, f, master, 0.09);
      if (step % 4 === 0) {
        padTone(offline, t, f * 2, master, beat * 3.5, 0.035);
      }
      t += beat;
      step += 1;
    }
    for (const n of notes) {
      if (n.t < 0.2 || n.t > duration - 0.1) continue;
      const f = leadNotes[(n.lane + Math.floor(n.t * 1.5)) % leadNotes.length];
      const d = n.dur && n.dur > 0.15 ? n.dur : 0.35;
      lead(offline, n.t, f, master, "classic", d);
      if (n.dur && n.dur > 0.4) {
        padTone(offline, n.t, f * 1.5, master, n.dur * 0.9, 0.03);
      }
    }
    return offline.startRendering();
  }

  // Electronic: section-aware density
  let t = 0;
  let step = 0;
  while (t < duration - 0.5) {
    const p = t / duration;
    const isIntro = p < 0.1;
    const isBreak = p > 0.55 && p < 0.65;
    const isDrop = (p > 0.4 && p < 0.55) || (p > 0.65 && p < 0.88);

    if (!isBreak || step % 2 === 0) {
      kick(offline, t, master, isIntro ? 0.35 : isDrop ? 0.75 : 0.6);
    }
    if (!isIntro && !isBreak) {
      hat(offline, t + beat * 0.5, master, isDrop ? 0.14 : 0.1);
    }
    const f = scale[step % scale.length];
    bass(offline, t, f, master, isIntro ? 0.08 : isDrop ? 0.2 : 0.15);
    if (step % 2 === 0 && !isBreak) {
      lead(offline, t + beat * 0.25, leadNotes[step % leadNotes.length], master, style, isDrop ? 0.18 : 0.14);
    }
    t += beat;
    step += 1;
  }

  for (const n of notes) {
    if (n.t < 0.2 || n.t > duration - 0.1) continue;
    const f = leadNotes[(n.lane + Math.floor(n.t * 2)) % leadNotes.length];
    const d = n.dur && n.dur > 0.12 ? Math.min(n.dur, 1.2) : 0.16;
    lead(offline, n.t, f * (n.lane % 2 === 0 ? 1 : 1.5), master, style, d);
  }

  return offline.startRendering();
}
