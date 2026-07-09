export const JUDGE = {
  PERFECT: { name: "PERFECT", window: 0.04, score: 1000, acc: 100, color: "#00f0ff" },
  GREAT: { name: "GREAT", window: 0.08, score: 700, acc: 75, color: "#7dff6a" },
  GOOD: { name: "GOOD", window: 0.12, score: 400, acc: 50, color: "#ffc14a" },
  MISS: { name: "MISS", window: Infinity, score: 0, acc: 0, color: "#ff4d6d" },
};

export function judgeTiming(deltaSec) {
  const abs = Math.abs(deltaSec);
  if (abs <= JUDGE.PERFECT.window) return JUDGE.PERFECT;
  if (abs <= JUDGE.GREAT.window) return JUDGE.GREAT;
  if (abs <= JUDGE.GOOD.window) return JUDGE.GOOD;
  return JUDGE.MISS;
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
  };
}

export function applyJudge(stats, judge) {
  stats.judged += 1;
  stats.accSum += judge.acc;

  if (judge.name === "MISS") {
    stats.miss += 1;
    stats.combo = 0;
  } else {
    if (judge.name === "PERFECT") stats.perfect += 1;
    else if (judge.name === "GREAT") stats.great += 1;
    else stats.good += 1;

    stats.combo += 1;
    stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
    const mult = 1 + Math.min(stats.combo, 50) * 0.01;
    stats.score += Math.round(judge.score * mult);
  }
}

export function accuracyOf(stats) {
  if (stats.judged === 0) return 0;
  return stats.accSum / stats.judged;
}

export function rankOf(stats) {
  const acc = accuracyOf(stats);
  if (stats.miss === 0 && stats.good === 0 && stats.great === 0 && stats.perfect > 0) return "SS";
  if (acc >= 95) return "S";
  if (acc >= 90) return "A";
  if (acc >= 80) return "B";
  if (acc >= 70) return "C";
  if (acc >= 50) return "D";
  return "F";
}
