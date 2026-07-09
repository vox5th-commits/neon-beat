import { state, setOffset } from "./state.js";
import { jacketUrl } from "./assets.js";

const screens = {
  title: () => el("screen-title"),
  songs: () => el("screen-songs"),
  diff: () => el("screen-diff"),
  game: () => el("screen-game"),
  result: () => el("screen-result"),
};

function el(id) {
  return document.getElementById(id);
}

export function showScreen(name) {
  state.screen = name;
  for (const [key, get] of Object.entries(screens)) {
    get().classList.toggle("active", key === name);
  }
}

export function setBanner(message) {
  const node = el("app-banner");
  if (!node) return;
  if (!message) {
    node.classList.add("hidden");
    node.textContent = "";
    return;
  }
  node.textContent = message;
  node.classList.remove("hidden");
}

export function renderSongList(songs, onPick) {
  const root = el("song-list");
  root.innerHTML = "";
  for (const song of songs) {
    const card = document.createElement("button");
    card.className = "song-card";
    const img = jacketUrl(song.id);
    card.innerHTML = `
      <img src="${img}" alt="" />
      <div class="body">
        <h3>${escapeHtml(song.title)}</h3>
        <p>${escapeHtml(song.artist)} · ${song.bpm} BPM · ${song.durationLabel || ""}</p>
      </div>
    `;
    card.addEventListener("click", () => onPick(song));
    root.appendChild(card);
  }
}

export function renderDiffScreen(song) {
  el("diff-title").textContent = "DIFFICULTY";
  el("diff-song-name").textContent = song.title;
  el("diff-song-info").textContent = `${song.artist} · ${song.bpm} BPM · ${song.durationLabel || ""}`;
  el("diff-jacket").src = jacketUrl(song.id);
}

export function renderResult(result) {
  el("result-rank").textContent = result.rank;
  el("result-song").textContent = result.songTitle;
  el("result-diff").textContent = result.diff.toUpperCase();
  el("stat-score").textContent = result.score.toLocaleString();
  el("stat-acc").textContent = `${result.accuracy.toFixed(2)}%`;
  el("stat-combo").textContent = String(result.maxCombo);
  el("stat-perfect").textContent = String(result.perfect);
  el("stat-great").textContent = String(result.great);
  el("stat-good").textContent = String(result.good);
  el("stat-miss").textContent = String(result.miss);
}

export function bindSettings() {
  const modal = el("settings-modal");
  const value = el("offset-value");

  function refresh() {
    value.textContent = `${state.audioOffsetMs} ms`;
  }

  el("btn-settings").addEventListener("click", () => {
    modal.classList.remove("hidden");
    refresh();
  });
  el("settings-close").addEventListener("click", () => {
    modal.classList.add("hidden");
  });
  el("offset-minus").addEventListener("click", () => {
    setOffset(state.audioOffsetMs - 10);
    refresh();
  });
  el("offset-plus").addEventListener("click", () => {
    setOffset(state.audioOffsetMs + 10);
    refresh();
  });
  refresh();
}

export function setPauseVisible(v) {
  el("pause-overlay").classList.toggle("hidden", !v);
}

export async function runCountdown(seconds = 3) {
  const node = el("countdown");
  node.classList.remove("hidden");
  for (let i = seconds; i >= 1; i--) {
    node.textContent = String(i);
    await wait(700);
  }
  node.textContent = "GO";
  await wait(400);
  node.classList.add("hidden");
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
