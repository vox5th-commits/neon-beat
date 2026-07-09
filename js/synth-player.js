/**
 * Offline Web Audio synth used when WAV files are unavailable (e.g. GitHub Pages).
 */

function kick(ctx, time, gainNode) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
  g.gain.setValueAtTime(0.7, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  osc.connect(g);
  g.connect(gainNode);
  osc.start(time);
  osc.stop(time + 0.2);
}

function hat(ctx, time, gainNode) {
  const frames = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  g.gain.setValueAtTime(0.12, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  src.connect(g);
  g.connect(gainNode);
  src.start(time);
}

function bass(ctx, time, freq, gainNode) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.18, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  osc.connect(g);
  g.connect(gainNode);
  osc.start(time);
  osc.stop(time + 0.25);
}

function lead(ctx, time, freq, gainNode, style) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = style === "neon" ? "triangle" : "square";
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.11, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
  osc.connect(g);
  g.connect(gainNode);
  osc.start(time);
  osc.stop(time + 0.16);
}

const SCALE_PULSE = [65.41, 82.41, 98.0, 130.81, 164.81];
const SCALE_NEON = [73.42, 87.31, 110.0, 146.83, 174.61];
const LEAD_PULSE = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
const LEAD_NEON = [293.66, 349.23, 440.0, 587.33, 440.0, 349.23];

/**
 * Render a stereo-ish mono buffer for the song.
 * @param {AudioContext} ctx
 * @param {{ bpm: number, notes: {t:number,lane:number}[], songId?: string, duration?: number }} opts
 */
export async function renderSynthBuffer(ctx, opts) {
  const bpm = opts.bpm || 128;
  const beat = 60 / bpm;
  const notes = opts.notes || [];
  const lastNote = notes.length ? notes[notes.length - 1].t : 20;
  const duration = Math.max(opts.duration || 0, lastNote + 2.5, 16);
  const style = (opts.songId || "").includes("neon") ? "neon" : "pulse";
  const scale = style === "neon" ? SCALE_NEON : SCALE_PULSE;
  const leadNotes = style === "neon" ? LEAD_NEON : LEAD_PULSE;

  const offline = new OfflineAudioContext(1, Math.ceil(duration * ctx.sampleRate), ctx.sampleRate);
  const master = offline.createGain();
  master.gain.value = 0.85;
  master.connect(offline.destination);

  // bed pad
  {
    const osc = offline.createOscillator();
    const g = offline.createGain();
    osc.type = "sine";
    osc.frequency.value = style === "neon" ? 110 : 98;
    g.gain.value = 0.04;
    osc.connect(g);
    g.connect(master);
    osc.start(0);
    osc.stop(duration);
  }

  // rhythmic grid from BPM
  let t = 0;
  let step = 0;
  while (t < duration - 0.5) {
    kick(offline, t, master);
    hat(offline, t + beat * 0.5, master);
    const f = scale[step % scale.length];
    bass(offline, t, f, master);
    if (step % 2 === 0) {
      lead(offline, t + beat * 0.25, leadNotes[step % leadNotes.length], master, style);
    }
    t += beat;
    step += 1;
  }

  // accent leads on chart note times
  for (const n of notes) {
    if (n.t < 0.2 || n.t > duration - 0.1) continue;
    const f = leadNotes[(n.lane + Math.floor(n.t * 2)) % leadNotes.length];
    lead(offline, n.t, f * (n.lane % 2 === 0 ? 1 : 1.5), master, style);
  }

  return offline.startRendering();
}
