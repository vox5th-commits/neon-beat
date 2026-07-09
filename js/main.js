import { state } from "./state.js";
import { loadSongIndex, loadSongBundle } from "./chart.js";
import { createGame } from "./game.js";
import * as audio from "./audio.js";
import { applyEmbeddedAssets } from "./assets.js";
import {
  showScreen,
  renderSongList,
  renderDiffScreen,
  renderResult,
  bindSettings,
  setPauseVisible,
  runCountdown,
  setBanner,
} from "./ui.js";

const canvas = document.getElementById("game-canvas");
let bundleCache = new Map();
let game = null;
let pendingBundle = null;
let songsReady = false;

async function boot() {
  applyEmbeddedAssets();
  bindSettings();
  bindNav();
  bindButtons();

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

  try {
    state.songs = await loadSongIndex();
    renderSongList(state.songs, onPickSong);
    songsReady = true;
    setBanner("");
  } catch (err) {
    console.error(err);
    songsReady = false;
    setBanner(
      "곡 목록을 불러오지 못했습니다. index.html을 더블클릭하지 말고, start.bat을 실행한 뒤 http://127.0.0.1:8080 으로 접속하세요."
    );
  }
}

function bindButtons() {
  document.getElementById("btn-start").addEventListener("click", async () => {
    try {
      await audio.ensureAudio();
    } catch (err) {
      console.warn(err);
    }
    if (!songsReady || !state.songs?.length) {
      setBanner(
        "아직 곡을 불러오지 못했습니다. start.bat 실행 후 주소창에 http://127.0.0.1:8080 을 입력하세요."
      );
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
        await startGameplay(bundle, diff);
      } catch (err) {
        console.error(err);
        setBanner("차트/오디오 로드 실패: " + (err?.message || err));
        showScreen("songs");
      }
    });
  }
}

function bindNav() {
  for (const btn of document.querySelectorAll("[data-nav]")) {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-nav");
      showScreen(target);
    });
  }
}

function onPickSong(song) {
  state.selectedSong = song;
  renderDiffScreen(song);
  showScreen("diff");
}

async function getBundle(song) {
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
  await game.start(bundle, diff);
}

boot();
