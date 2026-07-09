"""Generate WAV demos and rhythm charts for NEON BEAT."""
from __future__ import annotations

import json
import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SONGS = ROOT / "assets" / "songs"
SR = 44100


def env_adsr(n, a=0.01, d=0.05, s=0.6, r=0.08):
    out = [0.0] * n
    a_n = max(1, int(a * n))
    d_n = max(1, int(d * n))
    r_n = max(1, int(r * n))
    s_n = max(1, n - a_n - d_n - r_n)
    i = 0
    for k in range(a_n):
        out[i] = k / a_n
        i += 1
    for k in range(d_n):
        out[i] = 1.0 - (1.0 - s) * (k / d_n)
        i += 1
    for _ in range(s_n):
        out[i] = s
        i += 1
    for k in range(r_n):
        if i >= n:
            break
        out[i] = s * (1.0 - k / r_n)
        i += 1
    return out


def tone(freq, dur, vol=0.2, wave_type="square"):
    n = int(SR * dur)
    e = env_adsr(n)
    samples = []
    for i in range(n):
        t = i / SR
        phase = 2 * math.pi * freq * t
        if wave_type == "square":
            v = 1.0 if math.sin(phase) >= 0 else -1.0
        elif wave_type == "saw":
            v = 2.0 * ((freq * t) % 1.0) - 1.0
        elif wave_type == "tri":
            v = 2.0 * abs(2.0 * ((freq * t) % 1.0) - 1.0) - 1.0
        else:
            v = math.sin(phase)
        samples.append(v * e[i] * vol)
    return samples


def noise_hit(dur=0.05, vol=0.15):
    n = int(SR * dur)
    e = env_adsr(n, a=0.001, d=0.2, s=0.1, r=0.4)
    return [(random.uniform(-1, 1) * e[i] * vol) for i in range(n)]


def kick(dur=0.18, vol=0.45):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        # pitch drop
        f = 120 * (1.0 - t / dur) + 40
        e = math.exp(-t * 18)
        out.append(math.sin(2 * math.pi * f * t) * e * vol)
    return out


def mix_at(buf, samples, at_sec):
    start = int(at_sec * SR)
    for i, v in enumerate(samples):
        idx = start + i
        if 0 <= idx < len(buf):
            buf[idx] += v


def write_wav(path: Path, buf):
    path.parent.mkdir(parents=True, exist_ok=True)
    # normalize
    peak = max(1e-6, max(abs(x) for x in buf))
    scale = 0.92 / peak
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for x in buf:
            s = max(-1.0, min(1.0, x * scale))
            frames += struct.pack("<h", int(s * 32767))
        w.writeframes(frames)


def build_track(bpm: float, bars: int, seed: int, style: str):
    random.seed(seed)
    beat = 60.0 / bpm
    duration = bars * 4 * beat + 1.0
    buf = [0.0] * int(SR * duration)

    # scale
    if style == "pulse":
        scale = [65.41, 82.41, 98.00, 130.81, 164.81]  # C2-ish
        lead_notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]
    else:
        scale = [73.42, 87.31, 110.00, 146.83, 174.61]
        lead_notes = [293.66, 349.23, 440.00, 587.33, 440.00, 349.23]

    events = []  # (time, lane) for chart base

    t = 0.0
    for bar in range(bars):
        for b in range(4):
            # kick every beat
            mix_at(buf, kick(vol=0.5), t)
            events.append((t, 0 if b % 2 == 0 else 3))

            # hat offbeats
            mix_at(buf, noise_hit(0.04, 0.1), t + beat * 0.5)
            if style == "neon" or b % 2 == 1:
                events.append((t + beat * 0.5, 1 if b < 2 else 2))

            # bass
            bass_f = scale[(bar + b) % len(scale)]
            mix_at(buf, tone(bass_f, beat * 0.45, 0.18, "saw"), t)

            t += beat

        # bar lead phrase
        lead_t = (bar * 4) * beat
        pattern = [0, 1, 2, 1, 3, 2, 1, 0]
        if style == "neon":
            pattern = [0, 2, 1, 3, 2, 0, 3, 1]
        step = beat / 2
        dens = 8 if bar % 2 == 0 else 6
        for i in range(dens):
            lt = lead_t + i * step
            freq = lead_notes[i % len(lead_notes)] * (1.0 if style == "pulse" else 1.0)
            wt = "square" if style == "pulse" else "tri"
            mix_at(buf, tone(freq, step * 0.85, 0.12, wt), lt)
            lane = pattern[i % len(pattern)]
            events.append((lt, lane))
            # occasional double
            if style == "neon" and i % 3 == 0:
                events.append((lt, (lane + 2) % 4))
                mix_at(buf, tone(freq * 1.5, step * 0.4, 0.06, "sine"), lt)

    # intro pad
    for i in range(int(SR * min(2.0, duration))):
        tsec = i / SR
        buf[i] += 0.03 * math.sin(2 * math.pi * 110 * tsec) * (tsec / 2.0)

    return buf, events, duration


def quantize_events(events, density="normal"):
    # sort unique-ish notes
    events = sorted(events, key=lambda x: (round(x[0], 4), x[1]))
    cleaned = []
    seen = set()
    for t, lane in events:
        key = (round(t, 3), lane)
        if key in seen:
            continue
        seen.add(key)
        cleaned.append({"t": round(t, 4), "lane": int(lane)})

    if density == "easy":
        # keep mostly downbeats-ish: every other note, prefer lanes 0/3 sometimes
        out = []
        for i, n in enumerate(cleaned):
            if i % 2 == 0:
                out.append(n)
        return out
    if density == "hard":
        # denser: keep all + add syncopation ghosts from neighbors
        out = list(cleaned)
        extra = []
        for i, n in enumerate(cleaned):
            if i % 4 == 0 and i + 1 < len(cleaned):
                t = round((n["t"] + cleaned[i + 1]["t"]) / 2, 4)
                lane = (n["lane"] + 1) % 4
                extra.append({"t": t, "lane": lane})
        out.extend(extra)
        out.sort(key=lambda x: (x["t"], x["lane"]))
        # dedupe
        final = []
        seen = set()
        for n in out:
            key = (n["t"], n["lane"])
            if key in seen:
                continue
            seen.add(key)
            final.append(n)
        return final
    # normal: light thin
    return [n for i, n in enumerate(cleaned) if i % 3 != 2]


def write_song(song_id, title, artist, bpm, bars, seed, style, offset_ms=0):
    folder = SONGS / song_id
    folder.mkdir(parents=True, exist_ok=True)
    buf, events, duration = build_track(bpm, bars, seed, style)
    audio_name = "audio.wav"
    write_wav(folder / audio_name, buf)

    for diff, dens, speed in [
        ("easy", "easy", 0.85),
        ("normal", "normal", 1.0),
        ("hard", "hard", 1.15),
    ]:
        notes = quantize_events(events, dens)
        # skip notes before 1.0s and after duration-1
        notes = [n for n in notes if 1.0 <= n["t"] <= duration - 1.0]
        chart = {"scrollSpeed": speed, "notes": notes}
        (folder / f"{diff}.json").write_text(json.dumps(chart, indent=2), encoding="utf-8")

    meta = {
        "id": song_id,
        "title": title,
        "artist": artist,
        "bpm": bpm,
        "audio": audio_name,
        "jacket": "jacket.png",
        "offsetMs": offset_ms,
        "previewStart": 8,
        "durationLabel": f"{int(duration)}s",
        "difficulties": {
            "easy": "easy.json",
            "normal": "normal.json",
            "hard": "hard.json",
        },
    }
    (folder / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def main():
    songs = [
        write_song(
            "pulse-drive",
            "Pulse Drive",
            "NEON BEAT",
            bpm=128,
            bars=16,
            seed=7,
            style="pulse",
        ),
        write_song(
            "neon-grid",
            "Neon Grid",
            "NEON BEAT",
            bpm=140,
            bars=16,
            seed=21,
            style="neon",
        ),
    ]
    index = []
    for m in songs:
        index.append(
            {
                "id": m["id"],
                "title": m["title"],
                "artist": m["artist"],
                "bpm": m["bpm"],
                "audio": m["audio"],
                "jacket": m["jacket"],
                "offsetMs": m["offsetMs"],
                "previewStart": m["previewStart"],
                "durationLabel": m["durationLabel"],
                "difficulties": m["difficulties"],
            }
        )
    (SONGS / "songs.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    print("Generated:")
    for s in index:
        print(" -", s["id"], s["durationLabel"], "BPM", s["bpm"])


if __name__ == "__main__":
    main()
