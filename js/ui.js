import {
  state,
  setOffset,
  setScrollSpeed,
  setSfxVolume,
  setLifeEnabled,
} from "./state.js";
import { jacketUrl } from "./assets.js";
import { getHighscore } from "./scores.js";
import * as sfx from "./sfx.js";

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
    const img = song.custom
      ? jacketUrl("pulse-drive")
      : jacketUrl(song.id);
    const badge = song.custom ? `<span class="badge">CUSTOM</span>` : "";
    card.innerHTML = `
      <img src="${img}" alt="" />
      <div class="body">
        <h3>${escapeHtml(song.title)} ${badge}</h3>
        <p>${escapeHtml(song.artist || "")} · ${song.bpm} BPM · ${song.durationLabel || ""}</p>
      </div>
    `;
    card.addEventListener("click", () => onPick(song));
    root.appendChild(card);
  }
}

export function renderDiffScreen(song) {
  el("diff-title").textContent = "DIFFICULTY";
  el("diff-song-name").textContent = song.title;
  el("diff-song-info").textContent = `${song.artist || ""} · ${song.bpm} BPM · ${song.durationLabel || ""}`;
  el("diff-jacket").src = song.custom ? jacketUrl("neon-grid") : jacketUrl(song.id);
  const hs = getHighscore(song.id, "normal");
  el("diff-highscore").textContent = hs
    ? `Best (Normal): ${hs.score} · ${hs.rank}`
    : "Best: —";
}

export function renderResult(result) {
  el("result-rank").textContent = result.rank;
  el("result-song").textContent = result.songTitle;
  el("result-diff").textContent =
    (result.failed ? "FAILED · " : "") + result.diff.toUpperCase();
  el("stat-score").textContent = result.score.toLocaleString();
  el("stat-acc").textContent = `${result.accuracy.toFixed(2)}%`;
  el("stat-combo").textContent = String(result.maxCombo);
  el("stat-perfect").textContent = String(result.perfect);
  el("stat-great").textContent = String(result.great);
  el("stat-good").textContent = String(result.good);
  el("stat-miss").textContent = String(result.miss);
  el("result-newbest").classList.toggle("hidden", !result.isNewBest);
}

export function bindSettings() {
  const modal = el("settings-modal");

  function refresh() {
    el("offset-value").textContent = `${state.audioOffsetMs} ms`;
    el("scroll-value").textContent = `${state.scrollSpeed.toFixed(1)}x`;
    el("sfx-volume").value = String(Math.round(state.sfxVolume * 100));
    el("life-enabled").checked = state.lifeEnabled;
  }

  el("btn-settings").addEventListener("click", () => {
    modal.classList.remove("hidden");
    refresh();
  });
  el("settings-close").addEventListener("click", () => modal.classList.add("hidden"));
  el("offset-minus").addEventListener("click", () => {
    setOffset(state.audioOffsetMs - 10);
    refresh();
  });
  el("offset-plus").addEventListener("click", () => {
    setOffset(state.audioOffsetMs + 10);
    refresh();
  });
  el("scroll-minus").addEventListener("click", () => {
    setScrollSpeed(state.scrollSpeed - 0.1);
    refresh();
  });
  el("scroll-plus").addEventListener("click", () => {
    setScrollSpeed(state.scrollSpeed + 0.1);
    refresh();
  });
  el("sfx-volume").addEventListener("input", () => {
    setSfxVolume(Number(el("sfx-volume").value) / 100);
    sfx.setSfxVolume(state.sfxVolume);
  });
  el("life-enabled").addEventListener("change", () => {
    setLifeEnabled(el("life-enabled").checked);
  });
  refresh();
}

export function readPracticeOptions() {
  if (!el("practice-enable").checked) return null;
  return {
    start: Math.max(0, Number(el("practice-start").value) || 0),
    end: Math.max(1, Number(el("practice-end").value) || 30),
    rate: Number(el("practice-rate").value) || 1,
  };
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
