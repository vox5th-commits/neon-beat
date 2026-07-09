import { state, setOffset } from "./state.js";
import { loadSongIndex, loadSongBundle } from "./chart.js";
import { createGame } from "./game.js";
import * as audio from "./audio.js";
import * as sfx from "./sfx.js";
import { applyEmbeddedAssets } from "./assets.js";
import {
  listCustomSongs,
  importCustomSong,
  buildCustomBundle,
} from "./custom-song.js";
import {
  showScreen,
  renderSongList,
  renderDiffScreen,
  renderResult,
  bindSettings,
  setPauseVisible,
  runCountdown,
  setBanner,
  readPracticeOptions,
} from "./ui.js";

const canvas = document.getElementById("game-canvas");
let bundleCache = new Map();
let game = null;
let pendingBundle = null;
let songsReady = false;
let importFile = null;

async function boot() {
  applyEmbeddedAssets();
  bindSettings();
  bindNav();
  bindButtons();
  bindImport();
  bindCalibrate();

  window.addEventListener("keydown", (e) => {
    if (state.screen !== "game") return;
    if (e.key === "Escape") {
      if (!game) return;
      if (game.paused) {
        game.resume();
        setPauseVisible(false);
      } else if (game.running) {
        game.pause();
        setPauseVisible(true);
      }
    }
  });
  window.addEventListener("resize", () => game?.onResize());

  await refreshSongs();
}

async function refreshSongs() {
  try {
    const builtIn = await loadSongIndex();
    const custom = await listCustomSongs();
    state.songs = [...custom, ...builtIn];
    renderSongList(state.songs, onPickSong);
    songsReady = true;
    setBanner("");
  } catch (err) {
    console.error(err);
    try {
      const custom = await listCustomSongs();
      state.songs = custom;
      renderSongList(state.songs, onPickSong);
      songsReady = custom.length > 0;
    } catch {
      songsReady = false;
    }
    if (!songsReady) {
      setBanner(
        "곡 목록을 불러오지 못했습니다. start.bat 실행 후 http://127.0.0.1:8080 으로 접속하세요."
      );
    }
  }
}

function bindButtons() {
  document.getElementById("btn-start").addEventListener("click", async () => {
    try {
      const ctx = await audio.ensureAudio();
      await sfx.ensureSfx(ctx);
      sfx.setSfxVolume(state.sfxVolume);
    } catch (err) {
      console.warn(err);
    }
    if (!songsReady || !state.songs?.length) {
      setBanner("곡이 없습니다. 내 음악을 불러오거나 로컬 서버로 실행하세요.");
      return;
    }
    setBanner("");
    showScreen("songs");
  });

  document.getElementById("btn-resume").addEventListener("click", () => {
    game?.resume();
    setPauseVisible(false);
  });

  document.getElementById("btn-quit-song").addEventListener("click", () => {
    game?.destroy();
    setPauseVisible(false);
    showScreen("songs");
  });

  document.getElementById("btn-retry").addEventListener("click", async () => {
    if (pendingBundle && state.selectedDiff) {
      await startGameplay(pendingBundle, state.selectedDiff);
    }
  });

  document.getElementById("btn-to-songs").addEventListener("click", () => {
    showScreen("songs");
  });

  for (const btn of document.querySelectorAll("[data-diff]")) {
    btn.addEventListener("click", async () => {
      const diff = btn.getAttribute("data-diff");
      state.selectedDiff = diff;
      try {
        const bundle = await getBundle(state.selectedSong);
        pendingBundle = bundle;
        state.practice = readPracticeOptions();
        await startGameplay(bundle, diff);
      } catch (err) {
        console.error(err);
        setBanner("로드 실패: " + (err?.message || err));
        showScreen("songs");
      }
    });
  }
}

function bindImport() {
  const modal = document.getElementById("import-modal");
  const fileInput = document.getElementById("file-audio");

  document.getElementById("btn-import-song").addEventListener("click", () => {
    modal.classList.remove("hidden");
    document.getElementById("import-status").textContent = "";
  });
  document.getElementById("import-close").addEventListener("click", () => {
    modal.classList.add("hidden");
  });
  document.getElementById("import-pick").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    importFile = fileInput.files?.[0] || null;
    document.getElementById("import-filename").textContent = importFile
      ? importFile.name
      : "파일 없음";
    if (importFile && !document.getElementById("import-title").value) {
      document.getElementById("import-title").value = importFile.name.replace(/\.[^.]+$/, "");
    }
  });

  document.getElementById("import-confirm").addEventListener("click", async () => {
    if (!importFile) {
      document.getElementById("import-status").textContent = "먼저 파일을 선택하세요.";
      return;
    }
    const status = document.getElementById("import-status");
    status.textContent = "디코딩 & 차트 생성 중…";
    try {
      await audio.ensureAudio();
      const meta = await importCustomSong(importFile, {
        title: document.getElementById("import-title").value,
        bpm: document.getElementById("import-bpm").value,
      });
      status.textContent = `추가됨: ${meta.title} (${meta.bpm} BPM)`;
      importFile = null;
      fileInput.value = "";
      await refreshSongs();
      setTimeout(() => modal.classList.add("hidden"), 600);
    } catch (err) {
      console.error(err);
      status.textContent = "실패: " + (err?.message || err);
    }
  });
}

function bindCalibrate() {
  const modal = document.getElementById("calib-modal");
  let active = false;
  let taps = [];
  let beats = [];
  let timer = null;

  document.getElementById("btn-calibrate").addEventListener("click", () => {
    modal.classList.remove("hidden");
    document.getElementById("calib-count").textContent = "0 / 8";
    document.getElementById("calib-result").textContent = "";
  });
  document.getElementById("calib-close").addEventListener("click", () => {
    active = false;
    clearInterval(timer);
    modal.classList.add("hidden");
  });

  document.getElementById("calib-start").addEventListener("click", async () => {
    const ctx = await audio.ensureAudio();
    await sfx.ensureSfx(ctx);
    taps = [];
    beats = [];
    active = true;
    document.getElementById("calib-result").textContent = "탭하세요…";
    let n = 0;
    clearInterval(timer);
    timer = setInterval(() => {
      if (!active) return;
      sfx.playMetronome();
      beats.push(performance.now());
      n += 1;
      if (n >= 10) {
        clearInterval(timer);
        active = false;
        finishCalib();
      }
    }, 500);
  });

  window.addEventListener("keydown", (e) => {
    if (!active) return;
    if (e.repeat) return;
    taps.push(performance.now());
    document.getElementById("calib-count").textContent = `${Math.min(taps.length, 8)} / 8`;
  });

  function finishCalib() {
    if (taps.length < 4 || beats.length < 4) {
      document.getElementById("calib-result").textContent = "탭이 부족합니다. 다시 시도하세요.";
      return;
    }
    const pairs = Math.min(taps.length, beats.length);
    let sum = 0;
    let c = 0;
    for (let i = 0; i < pairs; i++) {
      // compare tap i to nearest beat
      let best = Infinity;
      for (const b of beats) best = Math.min(best, taps[i] - b);
      if (Math.abs(best) < 200) {
        sum += best;
        c += 1;
      }
    }
    if (!c) {
      document.getElementById("calib-result").textContent = "측정 실패";
      return;
    }
    const avg = sum / c;
    // if user taps late (positive), increase offset so notes wait
    const ms = Math.round(avg);
    setOffset(state.audioOffsetMs + ms);
    document.getElementById("calib-result").textContent = `평균 ${ms}ms → Offset ${state.audioOffsetMs}ms 적용`;
  }
}

function bindNav() {
  for (const btn of document.querySelectorAll("[data-nav]")) {
    btn.addEventListener("click", () => showScreen(btn.getAttribute("data-nav")));
  }
}

function onPickSong(song) {
  state.selectedSong = song;
  renderDiffScreen(song);
  showScreen("diff");
}

async function getBundle(song) {
  if (song.custom) {
    return buildCustomBundle(song);
  }
  if (bundleCache.has(song.id)) return bundleCache.get(song.id);
  const bundle = await loadSongBundle(song);
  bundleCache.set(song.id, bundle);
  return bundle;
}

async function startGameplay(bundle, diff) {
  showScreen("game");
  setPauseVisible(false);
  if (game) game.destroy();
  game = createGame(canvas, {
    onComplete: (result) => {
      state.lastResult = result;
      renderResult(result);
      showScreen("result");
    },
  });
  game.onResize();
  await runCountdown(3);
  await game.start(bundle, diff, { practice: state.practice });
}

boot();
