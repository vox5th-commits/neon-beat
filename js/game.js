import * as audio from "./audio.js";
import { createInput } from "./input.js";
import { prepareNotes } from "./chart.js";
import { createRenderer } from "./render.js";
import { createFx } from "./fx.js";
import {
  applyJudge,
  createScoreState,
  judgeTiming,
  accuracyOf,
  rankOf,
  JUDGE,
} from "./scores.js";
import { state } from "./state.js";

export function createGame(canvas, hooks = {}) {
  const renderer = createRenderer(canvas);
  const fx = createFx();
  let chart = null;
  let notes = [];
  let stats = null;
  let songMeta = null;
  let diffName = "normal";
  let running = false;
  let paused = false;
  let finished = false;
  let raf = 0;
  let lastTs = 0;
  let pixelsPerSec = 520;
  let musicStarted = false;
  let songOffset = 0;
  let pauseGameTime = 0;

  const input = createInput(
    (lane) => {
      if (!running || paused || finished) return;
      handleHit(lane);
    },
    () => {}
  );

  function handleHit(lane) {
    const now = gameTime();
    let best = null;
    let bestAbs = Infinity;
    for (const n of notes) {
      if (n.hit || n.missed || n.lane !== lane) continue;
      const d = n.t - now;
      const abs = Math.abs(d);
      if (abs <= JUDGE.GOOD.window && abs < bestAbs) {
        bestAbs = abs;
        best = n;
      }
    }
    const lay = renderer.layout();
    const pos = renderer.notePos(lane, lay);

    if (!best) {
      return;
    }

    const delta = best.t - now;
    const j = judgeTiming(delta);
    best.hit = true;
    applyJudge(stats, j);
    const intensity = j.name === "PERFECT" ? 1.1 : j.name === "GREAT" ? 0.8 : 0.5;
    if (j.name !== "MISS") {
      fx.spawnHit(pos.x, pos.y, lane, intensity);
    }
    fx.spawnJudge(j.name, j.color, pos.x, pos.y - 50);
    hooks.onJudge?.(j, stats);
  }

  function autoMiss(now) {
    const lay = renderer.layout();
    for (const n of notes) {
      if (n.hit || n.missed) continue;
      if (now - n.t > JUDGE.GOOD.window) {
        n.missed = true;
        applyJudge(stats, JUDGE.MISS);
        const pos = renderer.notePos(n.lane, lay);
        fx.spawnJudge("MISS", JUDGE.MISS.color, pos.x, pos.y - 50);
      }
    }
  }

  function gameTime() {
    if (!musicStarted) return 0;
    if (paused) return pauseGameTime;
    return audio.currentTime() + songOffset + state.audioOffsetMs / 1000;
  }

  async function start(bundle, difficulty) {
    stopLoop();
    songMeta = bundle;
    diffName = difficulty;
    const raw = bundle.charts[difficulty];
    chart = prepareNotes(raw);
    notes = chart.notes.map((n) => ({ ...n }));
    stats = createScoreState(notes.length);
    songOffset = (bundle.offsetMs || 0) / 1000;
    pixelsPerSec = 480 * (chart.scrollSpeed || 1);
    finished = false;
    paused = false;
    musicStarted = false;
    pauseGameTime = 0;
    fx.clear();

    await audio.ensureAudio();
    await audio.loadTrack(bundle.audioUrl, {
      bpm: bundle.bpm,
      notes: notes.map((n) => ({ t: n.t, lane: n.lane })),
      songId: bundle.id,
    });
    audio.stop();

    renderer.resize();
    input.attach();
    running = true;
    lastTs = performance.now();
    musicStarted = true;
    audio.play(0);
    loop(lastTs);
  }

  function checkFinish(now) {
    if (finished) return;
    const allDone = notes.every((n) => n.hit || n.missed);
    const audioDone = musicStarted && !audio.isPlaying() && audio.currentTime() >= audio.getDuration() - 0.05;
    if ((allDone && now > (notes.at(-1)?.t || 0) + 1.0) || (allDone && audioDone)) {
      finished = true;
      running = false;
      audio.stop();
      const result = {
        score: stats.score,
        maxCombo: stats.maxCombo,
        accuracy: accuracyOf(stats),
        perfect: stats.perfect,
        great: stats.great,
        good: stats.good,
        miss: stats.miss,
        rank: rankOf(stats),
        songTitle: songMeta.title,
        diff: diffName,
      };
      hooks.onComplete?.(result);
    }
  }

  function loop(ts) {
    if (!running && !paused) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if (paused) {
      drawFrame(gameTime());
      return;
    }

    const now = gameTime();
    autoMiss(now);
    fx.update(dt);
    drawFrame(now);
    checkFinish(now);
  }

  function drawFrame(now) {
    const lay = renderer.layout();
    renderer.drawBackground(Math.max(0, now), songMeta?.bpm || 128);
    renderer.drawHighway(input.held, lay);
    for (const n of notes) {
      if (n.hit || n.missed) continue;
      renderer.drawNote(n, now, pixelsPerSec, lay);
    }
    fx.draw(renderer.ctx);
    renderer.drawHud(stats, songMeta?.title || "", diffName);
  }

  function pause() {
    if (!running || paused || finished) return;
    pauseGameTime = gameTime();
    paused = true;
    if (musicStarted) audio.pause();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    lastTs = performance.now();
    if (musicStarted) audio.resume();
  }

  function stopLoop() {
    running = false;
    paused = false;
    cancelAnimationFrame(raf);
    input.detach();
    audio.stop();
  }

  function destroy() {
    stopLoop();
    fx.clear();
  }

  function onResize() {
    renderer.resize();
  }

  return {
    start,
    pause,
    resume,
    destroy,
    onResize,
    get paused() {
      return paused;
    },
    get running() {
      return running;
    },
  };
}
