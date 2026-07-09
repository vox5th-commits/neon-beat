export const state = {
  screen: "title",
  songs: [],
  selectedSong: null,
  selectedDiff: "normal",
  audioOffsetMs: Number(localStorage.getItem("neonbeat_offset") || 0),
  lastResult: null,
};

export function setOffset(ms) {
  state.audioOffsetMs = Math.max(-300, Math.min(300, ms));
  localStorage.setItem("neonbeat_offset", String(state.audioOffsetMs));
}
