export async function loadSongIndex() {
  const res = await fetch("assets/songs/songs.json");
  if (!res.ok) throw new Error("songs.json load failed");
  return res.json();
}

export async function loadSongBundle(songMeta) {
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
      hit: false,
      missed: false,
    }))
    .sort((a, b) => a.t - b.t || a.lane - b.lane);
  return {
    scrollSpeed: chart.scrollSpeed ?? 1,
    notes,
  };
}
