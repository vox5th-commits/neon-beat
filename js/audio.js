import { renderSynthBuffer } from "./synth-player.js";

let ctx = null;
let masterGain = null;
let buffer = null;
let source = null;
let startedAt = 0;
let offsetWhenStarted = 0;
let playing = false;
let duration = 0;
let mode = "none";
let playbackRate = 1;

export async function ensureAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

export function getAudioContext() {
  return ctx;
}

/**
 * @param {string|null} url
 * @param {{ bpm?: number, notes?: any[], songId?: string, forceSynth?: boolean, audioBuffer?: AudioBuffer, playbackRate?: number }} [opts]
 */
export async function loadTrack(url, opts = {}) {
  await ensureAudio();
  stop();
  buffer = null;
  mode = "none";
  playbackRate = opts.playbackRate || 1;

  if (opts.audioBuffer) {
    buffer = opts.audioBuffer;
    duration = buffer.duration;
    mode = "file";
    return duration;
  }

  const forceSynth =
    opts.forceSynth ||
    new URLSearchParams(location.search).has("synth") ||
    location.hostname.endsWith("github.io");

  if (!forceSynth && url) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const arr = await res.arrayBuffer();
        buffer = await ctx.decodeAudioData(arr.slice(0));
        duration = buffer.duration;
        mode = "file";
        return duration;
      }
    } catch (err) {
      console.warn("WAV load failed, using synth:", err);
    }
  }

  buffer = await renderSynthBuffer(ctx, {
    bpm: (opts.bpm || 128) * playbackRate,
    notes: opts.notes || [],
    songId: opts.songId || "",
    duration: opts.duration,
  });
  duration = buffer.duration;
  mode = "synth";
  return duration;
}

export function play(fromSec = 0) {
  if (!ctx || !buffer) return;
  stopSourceOnly();
  source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  source.connect(masterGain);
  offsetWhenStarted = Math.max(0, fromSec);
  startedAt = ctx.currentTime;
  playing = true;
  source.onended = () => {
    if (playing && currentTime() >= getDuration() - 0.05) {
      playing = false;
    }
  };
  source.start(0, offsetWhenStarted);
}

export function pause() {
  if (!playing) return currentTime();
  const t = currentTime();
  stopSourceOnly();
  playing = false;
  offsetWhenStarted = t;
  return t;
}

export function resume() {
  if (playing || !buffer) return;
  play(offsetWhenStarted);
}

export function stop() {
  stopSourceOnly();
  playing = false;
  offsetWhenStarted = 0;
  startedAt = 0;
}

function stopSourceOnly() {
  if (source) {
    try {
      source.onended = null;
      source.stop();
    } catch {
      /* */
    }
    source.disconnect();
    source = null;
  }
}

/** Song timeline seconds (accounts for playbackRate). */
export function currentTime() {
  if (!ctx) return 0;
  if (!playing) return offsetWhenStarted;
  const elapsed = (ctx.currentTime - startedAt) * playbackRate;
  return offsetWhenStarted + elapsed;
}

export function isPlaying() {
  return playing;
}

export function getDuration() {
  return duration;
}

export function getContextTime() {
  return ctx ? ctx.currentTime : 0;
}

export function getMode() {
  return mode;
}
