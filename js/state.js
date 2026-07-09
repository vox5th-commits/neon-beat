function num(key, def) {
  const v = localStorage.getItem(key);
  return v == null ? def : Number(v);
}

function bool(key, def) {
  const v = localStorage.getItem(key);
  return v == null ? def : v === "1";
}

export const state = {
  screen: "title",
  songs: [],
  customSongs: [],
  selectedSong: null,
  selectedDiff: "normal",
  audioOffsetMs: num("neonbeat_offset", 0),
  scrollSpeed: num("neonbeat_scroll", 1),
  sfxVolume: num("neonbeat_sfx", 0.55),
  lifeEnabled: bool("neonbeat_life", true),
  lastResult: null,
  practice: null, // { start, end, rate } | null
};

export function setOffset(ms) {
  state.audioOffsetMs = Math.max(-300, Math.min(300, ms));
  localStorage.setItem("neonbeat_offset", String(state.audioOffsetMs));
}

export function setScrollSpeed(v) {
  state.scrollSpeed = Math.max(0.5, Math.min(2.5, v));
  localStorage.setItem("neonbeat_scroll", String(state.scrollSpeed));
}

export function setSfxVolume(v) {
  state.sfxVolume = Math.max(0, Math.min(1, v));
  localStorage.setItem("neonbeat_sfx", String(state.sfxVolume));
}

export function setLifeEnabled(on) {
  state.lifeEnabled = !!on;
  localStorage.setItem("neonbeat_life", on ? "1" : "0");
}
