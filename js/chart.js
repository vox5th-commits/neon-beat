export async function loadSongIndex() {
  const res = await fetch("assets/songs/songs.json");
  if (!res.ok) throw new Error("songs.json load failed");
  return res.json();
}

export async function loadSongBundle(songMeta) {
  if (songMeta.custom && songMeta.charts) {
    return {
      ...songMeta,
      base: null,
      audioUrl: songMeta.audioUrl || null,
      jacketUrl: songMeta.jacketUrl || null,
    };
  }

  const base = `assets/songs/${songMeta.id}`;
  const charts = {};
  for (const [diff, file] of Object.entries(songMeta.difficulties)) {
    const res = await fetch(`${base}/${file}`);
    if (!res.ok) throw new Error(`chart ${file} failed`);
    charts[diff] = await res.json();
  }
  return {
    ...songMeta,
    base,
    charts,
    audioUrl: `${base}/${songMeta.audio}`,
    jacketUrl: `${base}/${songMeta.jacket || "jacket.png"}`,
  };
}

export function prepareNotes(chart) {
  const notes = (chart.notes || [])
    .map((n, i) => ({
      id: i,
      t: n.t,
      lane: n.lane,
      dur: n.dur || 0,
      hit: false,
      missed: false,
      holding: false,
      holdDone: false,
      headJudged: false,
    }))
    .sort((a, b) => a.t - b.t || a.lane - b.lane);
  return {
    scrollSpeed: chart.scrollSpeed ?? 1,
    notes,
  };
}

export function countJudgable(notes) {
  // tap = 1, long = head + tail
  let n = 0;
  for (const note of notes) {
    n += note.dur > 0.05 ? 2 : 1;
  }
  return n;
}
