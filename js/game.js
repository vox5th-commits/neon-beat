import * as audio from "./audio.js";
import { createInput } from "./input.js";
import { prepareNotes, countJudgable } from "./chart.js";
import { createRenderer } from "./render.js";
import { createFx } from "./fx.js";
import * as sfx from "./sfx.js";
import {
  applyJudge,
  createScoreState,
  judgeTiming,
  timingLabel,
  accuracyOf,
  rankOf,
  JUDGE,
  saveHighscore,
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
  let activeHolds = new Map(); // lane -> note
  let practice = null;
  let playRate = 1;

  const input = createInput(
    (lane) => {
      if (!running || paused || finished) return;
      handleHit(lane);
    },
    (lane) => {
      if (!running || paused || finished) return;
      handleRelease(lane);
    },
    () => renderer.layout()
  );

  function handleHit(lane) {
    const now = gameTime();
    let best = null;
    let bestAbs = Infinity;
    for (const n of notes) {
      if (n.missed || n.lane !== lane) continue;
      if (n.dur > 0.05) {
        if (n.headJudged || n.holdDone) continue;
      } else if (n.hit) continue;
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
      sfx.playHit("empty");
      return;
    }

    const delta = best.t - now;
    const j = judgeTiming(delta);
    const isLong = best.dur > 0.05;

    if (isLong) {
      best.headJudged = true;
      best.holding = j.name !== "MISS";
      if (j.name === "MISS") {
        best.missed = true;
        applyJudge(stats, j, { lifeEnabled: state.lifeEnabled });
        sfx.playHit("miss");
        fx.spawnJudge("MISS", j.color, pos.x, pos.y - 50);
      } else {
        applyJudge(stats, j, { lifeEnabled: state.lifeEnabled });
        activeHolds.set(lane, best);
        sfx.playHit(j.name.toLowerCase());
        fx.spawnHit(pos.x, pos.y, lane, 0.9);
        const tl = timingLabel(delta, j.name);
        fx.spawnJudge(tl ? `${j.name}\n${tl}` : j.name, j.color, pos.x, pos.y - 50);
      }
    } else {
      best.hit = true;
      applyJudge(stats, j, { lifeEnabled: state.lifeEnabled });
      if (j.name === "MISS") sfx.playHit("miss");
      else {
        sfx.playHit(j.name.toLowerCase());
        fx.spawnHit(pos.x, pos.y, lane, j.name === "PERFECT" ? 1.15 : 0.8);
      }
      const tl = timingLabel(delta, j.name);
      fx.spawnJudge(tl ? `${j.name} ${tl}` : j.name, j.color, pos.x, pos.y - 50);
    }

    checkMilestones();
    hooks.onJudge?.(j, stats);
    if (stats.failed) endGame(true);
  }

  function handleRelease(lane) {
    const note = activeHolds.get(lane);
    if (!note) return;
    activeHolds.delete(lane);
    const now = gameTime();
    const end = note.t + note.dur;
    const lay = renderer.layout();
    const pos = renderer.notePos(lane, lay);

    if (!note.holding || note.holdDone || note.missed) return;

    const delta = end - now;
    // release window: a bit wider
    if (Math.abs(delta) <= JUDGE.GOOD.window * 1.4 || (now >= end - JUDGE.GOOD.window && now <= end + JUDGE.GREAT.window)) {
      const j = judgeTiming(Math.max(-JUDGE.GOOD.window, Math.min(JUDGE.GOOD.window, delta)));
      note.holdDone = true;
      note.hit = true;
      note.holding = false;
      applyJudge(stats, j, { lifeEnabled: state.lifeEnabled });
      sfx.playHit("hold");
      fx.spawnHit(pos.x, pos.y, lane, 0.7);
      fx.spawnJudge(j.name, j.color, pos.x, pos.y - 50);
    } else if (now < end - JUDGE.GOOD.window) {
      // released early
      note.missed = true;
      note.holding = false;
      applyJudge(stats, JUDGE.MISS, { lifeEnabled: state.lifeEnabled });
      sfx.playHit("miss");
      fx.spawnJudge("BREAK", JUDGE.MISS.color, pos.x, pos.y - 50);
      stats.combo = 0;
    } else {
      note.holdDone = true;
      note.hit = true;
      note.holding = false;
      applyJudge(stats, JUDGE.GOOD, { lifeEnabled: state.lifeEnabled });
      sfx.playHit("good");
      fx.spawnJudge("GOOD", JUDGE.GOOD.color, pos.x, pos.y - 50);
    }
    checkMilestones();
    if (stats.failed) endGame(true);
  }

  function autoMiss(now) {
    const lay = renderer.layout();
    for (const n of notes) {
      if (n.missed || n.hit || n.holdDone) continue;
      const isLong = n.dur > 0.05;
      if (isLong) {
        if (!n.headJudged && now - n.t > JUDGE.GOOD.window) {
          n.missed = true;
          applyJudge(stats, JUDGE.MISS, { lifeEnabled: state.lifeEnabled });
          const pos = renderer.notePos(n.lane, lay);
          fx.spawnJudge("MISS", JUDGE.MISS.color, pos.x, pos.y - 50);
          sfx.playHit("miss");
        } else if (n.holding && now > n.t + n.dur + JUDGE.GOOD.window) {
          // held past end without release event — auto complete
          n.holdDone = true;
          n.hit = true;
          n.holding = false;
          activeHolds.delete(n.lane);
          applyJudge(stats, JUDGE.PERFECT, { lifeEnabled: state.lifeEnabled });
          const pos = renderer.notePos(n.lane, lay);
          fx.spawnJudge("PERFECT", JUDGE.PERFECT.color, pos.x, pos.y - 50);
        }
      } else if (now - n.t > JUDGE.GOOD.window) {
        n.missed = true;
        applyJudge(stats, JUDGE.MISS, { lifeEnabled: state.lifeEnabled });
        const pos = renderer.notePos(n.lane, lay);
        fx.spawnJudge("MISS", JUDGE.MISS.color, pos.x, pos.y - 50);
        sfx.playHit("miss");
      }
    }
    if (stats.failed) endGame(true);
  }

  function checkMilestones() {
    const c = stats.combo;
    if (c > 0 && c % 50 === 0) {
      fx.spawnMilestone(c);
    }
  }

  function gameTime() {
    if (!musicStarted) return practice?.start || 0;
    if (paused) return pauseGameTime;
    return audio.currentTime() + songOffset + state.audioOffsetMs / 1000;
  }

  async function start(bundle, difficulty, opts = {}) {
    stopLoop();
    songMeta = bundle;
    diffName = difficulty;
    practice = opts.practice || state.practice || null;
    playRate = practice?.rate || 1;

    const raw = bundle.charts[difficulty];
    chart = prepareNotes(raw);
    let allNotes = chart.notes.map((n) => ({ ...n }));
    if (practice) {
      const a = practice.start ?? 0;
      const b = practice.end ?? Infinity;
      allNotes = allNotes.filter((n) => n.t >= a && n.t <= b);
      for (const n of allNotes) {
        // keep relative — music starts at practice.start
      }
    }
    notes = allNotes;
    stats = createScoreState(countJudgable(notes));
    songOffset = (bundle.offsetMs || 0) / 1000;
    const mobile = typeof window !== "undefined" && window.innerWidth <= 720;
    // Slightly slower scroll on phone so notes stay readable with wider lanes
    const mobileScroll = mobile ? 0.88 : 1;
    pixelsPerSec =
      480 * (chart.scrollSpeed || 1) * (state.scrollSpeed || 1) * mobileScroll;
    finished = false;
    paused = false;
    musicStarted = false;
    pauseGameTime = 0;
    activeHolds.clear();
    fx.clear();

    const ctx = await audio.ensureAudio();
    await sfx.ensureSfx(ctx);
    sfx.setSfxVolume(state.sfxVolume);

    const startAt = practice?.start || 0;
    await audio.loadTrack(bundle.audioUrl, {
      bpm: bundle.bpm,
      notes: notes.map((n) => ({ t: n.t, lane: n.lane })),
      songId: bundle.id,
      audioBuffer: bundle.audioBuffer,
      playbackRate: playRate,
      duration: bundle.audioBuffer?.duration,
    });
    audio.stop();

    renderer.resize();
    input.attach(canvas);
    running = true;
    lastTs = performance.now();
    musicStarted = true;
    audio.play(startAt);
    loop(lastTs);
  }

  function endGame(failed) {
    if (finished) return;
    finished = true;
    running = false;
    audio.stop();
    input.detach();
    const result = {
      score: stats.score,
      maxCombo: stats.maxCombo,
      accuracy: accuracyOf(stats),
      perfect: stats.perfect,
      great: stats.great,
      good: stats.good,
      miss: stats.miss,
      rank: failed ? "F" : rankOf(stats),
      songTitle: songMeta.title,
      songId: songMeta.id,
      diff: diffName,
      failed: !!failed || stats.failed,
      isNewBest: false,
    };
    result.isNewBest = saveHighscore(songMeta.id, diffName, result);
    hooks.onComplete?.(result);
  }

  function checkFinish(now) {
    if (finished) return;
    if (practice?.end && now >= practice.end) {
      endGame(false);
      return;
    }
    const allDone = notes.every((n) => n.hit || n.missed || n.holdDone);
    const lastT = notes.reduce((m, n) => Math.max(m, n.t + (n.dur || 0)), 0);
    const audioDone =
      musicStarted &&
      !audio.isPlaying() &&
      audio.currentTime() >= audio.getDuration() - 0.08;
    if ((allDone && now > lastT + 1.0) || (allDone && audioDone)) {
      endGame(false);
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
      const isLong = n.dur > 0.05;
      if (n.missed) continue;
      if (isLong) {
        if (n.holdDone) continue;
      } else if (n.hit) {
        continue;
      }
      renderer.drawNote(n, now, pixelsPerSec, lay, { holding: n.holding });
    }
    fx.draw(renderer.ctx);
    const progress = audio.getDuration()
      ? Math.min(1, Math.max(0, now / audio.getDuration()))
      : 0;
    renderer.drawHud(stats, songMeta?.title || "", diffName, {
      progress,
      lifeEnabled: state.lifeEnabled,
    });
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
    activeHolds.clear();
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
