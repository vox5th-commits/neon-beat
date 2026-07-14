export const JUDGE = {
  PERFECT: { name: "PERFECT", window: 0.04, score: 1000, acc: 100, color: "#00f0ff", life: 2 },
  GREAT: { name: "GREAT", window: 0.08, score: 700, acc: 75, color: "#7dff6a", life: 1 },
  GOOD: { name: "GOOD", window: 0.12, score: 400, acc: 50, color: "#ffc14a", life: -4 },
  MISS: { name: "MISS", window: Infinity, score: 0, acc: 0, color: "#ff4d6d", life: -12 },
};

export function judgeTiming(deltaSec) {
  const abs = Math.abs(deltaSec);
  if (abs <= JUDGE.PERFECT.window) return { ...JUDGE.PERFECT, delta: deltaSec };
  if (abs <= JUDGE.GREAT.window) return { ...JUDGE.GREAT, delta: deltaSec };
  if (abs <= JUDGE.GOOD.window) return { ...JUDGE.GOOD, delta: deltaSec };
  return { ...JUDGE.MISS, delta: deltaSec };
}

export function timingLabel(deltaSec, judgeName) {
  if (judgeName === "MISS" || judgeName === "PERFECT") return "";
  if (deltaSec > 0.012) return "EARLY";
  if (deltaSec < -0.012) return "LATE";
  return "";
}

export function createScoreState(totalNotes) {
  return {
    totalNotes,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    accSum: 0,
    judged: 0,
    life: 100,
    maxLife: 100,
    failed: false,
  };
}

export function applyJudge(stats, judge, opts = {}) {
  const lifeEnabled = opts.lifeEnabled !== false;
  stats.judged += 1;
  stats.accSum += judge.acc;

  // Life is cosmetic only — never force game over on miss
  if (lifeEnabled) {
    stats.life = Math.max(0, Math.min(stats.maxLife, stats.life + (judge.life || 0)));
  }
  stats.failed = false;

  if (judge.name === "MISS") {
    stats.miss += 1;
    stats.combo = 0;
  } else {
    if (judge.name === "PERFECT") stats.perfect += 1;
    else if (judge.name === "GREAT") stats.great += 1;
    else stats.good += 1;

    stats.combo += 1;
    stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
    const mult = 1 + Math.min(stats.combo, 80) * 0.012;
    stats.score += Math.round(judge.score * mult);
  }
}

export function accuracyOf(stats) {
  if (stats.judged === 0) return 100;
  return stats.accSum / stats.judged;
}

export function rankOf(stats) {
  if (stats.failed) return "F";
  const acc = accuracyOf(stats);
  if (stats.miss === 0 && stats.good === 0 && stats.great === 0 && stats.perfect > 0) return "SS";
  if (acc >= 95) return "S";
  if (acc >= 90) return "A";
  if (acc >= 80) return "B";
  if (acc >= 70) return "C";
  if (acc >= 50) return "D";
  return "F";
}

const HS_KEY = "neonbeat_highscores";

export function loadHighscores() {
  try {
    return JSON.parse(localStorage.getItem(HS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveHighscore(songId, diff, result) {
  const all = loadHighscores();
  const key = `${songId}::${diff}`;
  const prev = all[key];
  if (!prev || result.score > prev.score) {
    all[key] = {
      score: result.score,
      rank: result.rank,
      accuracy: result.accuracy,
      maxCombo: result.maxCombo,
    };
    localStorage.setItem(HS_KEY, JSON.stringify(all));
    return true;
  }
  return false;
}

export function getHighscore(songId, diff) {
  const all = loadHighscores();
  return all[`${songId}::${diff}`] || null;
}
