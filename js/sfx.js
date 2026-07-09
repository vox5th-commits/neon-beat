/** Lightweight hit SFX on a separate gain bus. */
let ctx = null;
let bus = null;

export async function ensureSfx(audioCtx) {
  ctx = audioCtx;
  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = 0.55;
    bus.connect(ctx.destination);
  }
}

export function setSfxVolume(v) {
  if (bus) bus.gain.value = Math.max(0, Math.min(1, v));
}

export function playHit(kind = "perfect") {
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const map = {
    perfect: { f: 880, d: 0.06, type: "square", vol: 0.22 },
    great: { f: 660, d: 0.05, type: "square", vol: 0.16 },
    good: { f: 440, d: 0.05, type: "triangle", vol: 0.12 },
    miss: { f: 120, d: 0.12, type: "sawtooth", vol: 0.14 },
    empty: { f: 220, d: 0.03, type: "sine", vol: 0.06 },
    hold: { f: 520, d: 0.04, type: "triangle", vol: 0.1 },
  };
  const m = map[kind] || map.perfect;
  osc.type = m.type;
  osc.frequency.setValueAtTime(m.f, t);
  if (kind === "miss") osc.frequency.exponentialRampToValueAtTime(60, t + m.d);
  g.gain.setValueAtTime(m.vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + m.d);
  osc.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + m.d + 0.02);
}

export function playMetronome() {
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 1000;
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + 0.06);
}
