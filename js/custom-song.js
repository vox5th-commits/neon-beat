import { generateChart, estimateBpm } from "./chart-gen.js";
import * as audio from "./audio.js";

const IDB_NAME = "neonbeat_custom";
const IDB_STORE = "songs";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listCustomSongs() {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => {
        const rows = req.result || [];
        resolve(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            artist: r.artist || "Custom",
            bpm: r.bpm,
            durationLabel: `${Math.round(r.duration)}s`,
            custom: true,
            offsetMs: r.offsetMs || 0,
            difficulties: { easy: "easy", normal: "normal", hard: "hard" },
            charts: r.charts,
            // audio reloaded on demand
            _hasBlob: true,
          }))
        );
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function loadCustomAudioBuffer(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = async () => {
      const row = req.result;
      if (!row?.audioBlob) return reject(new Error("no audio"));
      const ctx = await audio.ensureAudio();
      const arr = await row.audioBlob.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      resolve(buf);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Import file → decode → generate 3 diffs → store in IDB.
 */
export async function importCustomSong(file, opts = {}) {
  const ctx = await audio.ensureAudio();
  const arr = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arr.slice(0));
  const duration = buffer.duration;
  let bpm = Number(opts.bpm) || estimateBpm(buffer);
  bpm = Math.round(bpm);
  const title = opts.title || file.name.replace(/\.[^.]+$/, "");
  const seed = Math.floor(Date.now() % 1e9);

  const charts = {
    easy: generateChart({ bpm, duration, difficulty: "easy", seed }),
    normal: generateChart({ bpm, duration, difficulty: "normal", seed: seed + 1 }),
    hard: generateChart({ bpm, duration, difficulty: "hard", seed: seed + 2 }),
  };

  const id = `custom-${seed}`;
  const record = {
    id,
    title,
    artist: "Custom",
    bpm,
    duration,
    offsetMs: Number(opts.offsetMs) || 0,
    charts,
    audioBlob: new Blob([arr], { type: file.type || "audio/mpeg" }),
    createdAt: Date.now(),
  };

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return {
    id,
    title,
    artist: "Custom",
    bpm,
    durationLabel: `${Math.round(duration)}s`,
    custom: true,
    offsetMs: record.offsetMs,
    difficulties: { easy: "easy", normal: "normal", hard: "hard" },
    charts,
  };
}

export async function deleteCustomSong(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Build a playable bundle from custom meta + decoded buffer.
 */
export async function buildCustomBundle(songMeta) {
  const buffer = await loadCustomAudioBuffer(songMeta.id);
  return {
    ...songMeta,
    charts: songMeta.charts,
    audioUrl: null,
    audioBuffer: buffer,
    custom: true,
  };
}
