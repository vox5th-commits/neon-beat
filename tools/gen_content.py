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
    n = max(1, int(SR * dur))
    e = env_adsr(n, a=0.02, d=0.08, s=0.7, r=0.15)
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


def soft_tone(freq, dur, vol=0.12, wave_type="sine"):
    """Longer envelope for classical/pad leads."""
    n = max(1, int(SR * dur))
    e = env_adsr(n, a=0.06, d=0.12, s=0.75, r=0.25)
    samples = []
    for i in range(n):
        t = i / SR
        phase = 2 * math.pi * freq * t
        if wave_type == "tri":
            v = 2.0 * abs(2.0 * ((freq * t) % 1.0) - 1.0) - 1.0
        else:
            v = math.sin(phase)
        # gentle vibrato
        vib = 1.0 + 0.004 * math.sin(2 * math.pi * 5.0 * t)
        samples.append(v * e[i] * vol * vib)
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


def section_of(bar: int, bars: int) -> str:
    """Map bar index to musical section for variety."""
    p = bar / max(1, bars)
    if p < 0.12:
        return "intro"
    if p < 0.35:
        return "verse"
    if p < 0.45:
        return "build"
    if p < 0.65:
        return "drop"
    if p < 0.75:
        return "break"
    if p < 0.92:
        return "drop2"
    return "outro"


def build_track(bpm: float, bars: int, seed: int, style: str):
    """Electronic tracks with intro/verse/build/drop sections."""
    random.seed(seed)
    beat = 60.0 / bpm
    duration = bars * 4 * beat + 1.5
    buf = [0.0] * int(SR * duration)

    if style == "pulse":
        scale = [65.41, 82.41, 98.00, 130.81, 164.81]
        lead_notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 349.23, 440.00]
        alt_lead = [523.25, 493.88, 440.00, 392.00, 349.23, 329.63, 293.66, 261.63]
    else:
        scale = [73.42, 87.31, 110.00, 146.83, 174.61]
        lead_notes = [293.66, 349.23, 440.00, 587.33, 440.00, 349.23, 392.00, 466.16]
        alt_lead = [587.33, 554.37, 493.88, 440.00, 392.00, 349.23, 329.63, 293.66]

    # chart events: (t, lane, dur optional)
    events: list[tuple] = []

    t = 0.0
    for bar in range(bars):
        sec = section_of(bar, bars)
        for b in range(4):
            kick_vol = 0.25 if sec == "intro" else 0.55 if sec in ("drop", "drop2") else 0.42
            if sec != "break" or b % 2 == 0:
                mix_at(buf, kick(vol=kick_vol), t)
                if sec not in ("intro",):
                    events.append((t, 0 if b % 2 == 0 else 3, 0.0))

            # hats / snare-ish
            if sec not in ("intro", "break"):
                mix_at(buf, noise_hit(0.04, 0.08 if sec == "verse" else 0.12), t + beat * 0.5)
                if sec in ("drop", "drop2", "build") or (style == "neon" and b % 2 == 1):
                    events.append((t + beat * 0.5, 1 if b < 2 else 2, 0.0))
            elif sec == "break" and b == 1:
                mix_at(buf, noise_hit(0.08, 0.06), t + beat * 0.5)

            # bass
            bass_f = scale[(bar + b) % len(scale)]
            bass_vol = 0.08 if sec == "intro" else 0.20 if sec in ("drop", "drop2") else 0.15
            mix_at(buf, tone(bass_f, beat * 0.45, bass_vol, "saw"), t)

            # build riser clicks
            if sec == "build":
                mix_at(buf, noise_hit(0.03, 0.08), t + beat * 0.25)
                events.append((t + beat * 0.25, (b + 1) % 4, 0.0))

            t += beat

        lead_t = (bar * 4) * beat
        if sec == "intro":
            # sparse long pads
            if bar % 2 == 0:
                f = lead_notes[bar % len(lead_notes)]
                mix_at(buf, soft_tone(f, beat * 3.5, 0.07, "sine"), lead_t + beat)
                events.append((lead_t + beat, bar % 4, beat * 2.0))
            continue

        if sec == "break":
            # soft arpeggio
            arp = [0, 2, 1, 3, 2, 0]
            for i, lane in enumerate(arp):
                lt = lead_t + i * (beat / 2)
                f = lead_notes[i % len(lead_notes)] * 0.5
                mix_at(buf, soft_tone(f, beat * 0.45, 0.09, "tri"), lt)
                events.append((lt, lane, 0.0))
            continue

        # verse / build / drop / drop2 / outro
        if sec in ("drop", "drop2"):
            pattern = [0, 2, 1, 3, 2, 0, 3, 1] if style == "neon" else [0, 1, 2, 1, 3, 2, 1, 0]
            dens = 8
            step = beat / 2
            leads = alt_lead if sec == "drop2" else lead_notes
        elif sec == "build":
            pattern = [0, 1, 2, 3, 3, 2, 1, 0]
            dens = 8
            step = beat / 2
            leads = lead_notes
        else:  # verse / outro
            pattern = [0, 2, 3, 1, 0, 3] if style == "neon" else [0, 1, 3, 2, 0, 1]
            dens = 6
            step = beat / 2
            leads = lead_notes

        for i in range(dens):
            lt = lead_t + i * step
            if lt >= duration - 1:
                break
            freq = leads[i % len(leads)]
            wt = "square" if style == "pulse" else "tri"
            vol = 0.14 if sec in ("drop", "drop2") else 0.10
            mix_at(buf, tone(freq, step * 0.85, vol, wt), lt)
            lane = pattern[i % len(pattern)]
            # long notes on phrase ends
            long_dur = 0.0
            if i == dens - 1 and sec in ("verse", "drop", "drop2"):
                long_dur = beat * (1.5 if sec == "verse" else 1.0)
                mix_at(buf, soft_tone(freq, long_dur, vol * 0.7, "sine"), lt)
            events.append((lt, lane, long_dur))

            if style == "neon" and sec in ("drop", "drop2") and i % 3 == 0:
                events.append((lt, (lane + 2) % 4, 0.0))
                mix_at(buf, tone(freq * 1.5, step * 0.4, 0.06, "sine"), lt)

            # staircase streams in drop2
            if sec == "drop2" and i == 2:
                for k in range(4):
                    st = lt + k * (step * 0.5)
                    events.append((st, (lane + k) % 4, 0.0))
                    mix_at(buf, tone(leads[(i + k) % len(leads)], step * 0.35, 0.08, wt), st)

    # intro pad bed
    for i in range(int(SR * min(3.0, duration))):
        tsec = i / SR
        buf[i] += 0.03 * math.sin(2 * math.pi * 110 * tsec) * min(1.0, tsec / 2.0)

    return buf, events, duration


# --- Air on the G String (Bach) — public domain composition, original synth arrangement ---
# Frequencies for melody (D major, simplified famous theme + variations)
# Note names → Hz
N = {
    "A3": 220.00,
    "B3": 246.94,
    "C#4": 277.18,
    "D4": 293.66,
    "E4": 329.63,
    "F#4": 369.99,
    "G4": 392.00,
    "A4": 440.00,
    "B4": 493.88,
    "C#5": 554.37,
    "D5": 587.33,
    "E5": 659.25,
    "F#5": 739.99,
}


def air_melody_phrases():
    """
    Beat-relative melody: list of (start_beat, note_name, length_beats).
    Famous opening contour + answer + variation. Composition by J.S. Bach (PD).
    """
    # Phrase A (~8 bars at 4/4)
    a = [
        (0, "D5", 3),
        (3, "C#5", 1),
        (4, "D5", 2),
        (6, "A4", 2),
        (8, "G4", 2),
        (10, "F#4", 2),
        (12, "E4", 2),
        (14, "D4", 2),
        (16, "C#4", 2),
        (18, "D4", 1),
        (19, "E4", 1),
        (20, "F#4", 2),
        (22, "G4", 2),
        (24, "F#4", 2),
        (26, "E4", 2),
        (28, "D4", 2),
        (30, "C#4", 2),
    ]
    # Phrase B answer
    b = [
        (0, "B3", 2),
        (2, "A3", 2),
        (4, "D4", 2),
        (6, "E4", 2),
        (8, "F#4", 3),
        (11, "G4", 1),
        (12, "A4", 4),
        (16, "B4", 2),
        (18, "A4", 2),
        (20, "G4", 2),
        (22, "F#4", 2),
        (24, "E4", 2),
        (26, "D4", 2),
        (28, "C#4", 2),
        (30, "D4", 2),
    ]
    # Phrase C higher flourish
    c = [
        (0, "A4", 2),
        (2, "B4", 1),
        (3, "C#5", 1),
        (4, "D5", 3),
        (7, "E5", 1),
        (8, "F#5", 2),
        (10, "E5", 2),
        (12, "D5", 2),
        (14, "C#5", 2),
        (16, "B4", 2),
        (18, "A4", 2),
        (20, "G4", 2),
        (22, "F#4", 2),
        (24, "E4", 4),
        (28, "D4", 4),
    ]
    return a, b, c


def pitch_to_lane(freq: float) -> int:
    """Map pitch height to 4 lanes (low→0 … high→3)."""
    if freq < 300:
        return 0
    if freq < 380:
        return 1
    if freq < 480:
        return 2
    return 3


def build_air_on_g(bpm: float = 76.0):
    """
    Original synthesizer arrangement of Bach's Air (public domain).
    ~90s with theme A B A C A + soft accompaniment.
    """
    random.seed(42)
    beat = 60.0 / bpm
    # 5 phrases × 32 beats + short intro/outro
    intro_beats = 4
    phrase_beats = 32
    n_phrases = 5  # A B A C A
    total_beats = intro_beats + phrase_beats * n_phrases + 4
    duration = total_beats * beat + 1.0
    buf = [0.0] * int(SR * duration)
    events: list[tuple] = []

    a, b, c = air_melody_phrases()
    phrase_order = [a, b, a, c, a]

    # soft pad throughout
    for i in range(len(buf)):
        tsec = i / SR
        fade = min(1.0, tsec / 2.0) * min(1.0, max(0.0, (duration - tsec) / 2.0))
        buf[i] += 0.025 * math.sin(2 * math.pi * 146.83 * tsec) * fade
        buf[i] += 0.018 * math.sin(2 * math.pi * 220.00 * tsec) * fade

    t0 = intro_beats * beat

    # intro: gentle pizz bass
    for i in range(intro_beats):
        tt = i * beat
        mix_at(buf, soft_tone(146.83, beat * 0.9, 0.08, "sine"), tt)
        if i % 2 == 0:
            events.append((tt + beat * 0.5, 1, 0.0))

    for pi, phrase in enumerate(phrase_order):
        base = t0 + pi * phrase_beats * beat
        # walking bass every beat
        bass_line = [146.83, 164.81, 174.61, 196.00, 220.00, 196.00, 174.61, 164.81]
        for bi in range(phrase_beats):
            bt = base + bi * beat
            bf = bass_line[bi % len(bass_line)]
            vol = 0.10 if pi in (0, 2, 4) else 0.08
            mix_at(buf, soft_tone(bf, beat * 0.85, vol, "tri"), bt)
            # light pulse on downbeats for chart anchors
            if bi % 4 == 0 and pi != 1:
                events.append((bt, 0 if (bi // 4) % 2 == 0 else 3, 0.0))

        # melody
        for start_b, name, length_b in phrase:
            tt = base + start_b * beat
            dur = length_b * beat * 0.95
            freq = N[name]
            mix_at(buf, soft_tone(freq, dur, 0.16, "sine"), tt)
            # soft fifth harmony
            mix_at(buf, soft_tone(freq * 1.5, dur * 0.9, 0.05, "sine"), tt)
            lane = pitch_to_lane(freq)
            # long note if sustained
            long_dur = dur if length_b >= 2 else 0.0
            events.append((tt, lane, long_dur))
            # double for high notes on harder density later
            if length_b >= 3 and freq >= 440:
                events.append((tt, (lane + 1) % 4, 0.0))

        # mid-phrase fill arpeggio on variation (phrase C / even)
        if pi in (1, 3):
            for k in range(8):
                ft = base + (8 + k) * (beat / 2)
                ff = [293.66, 369.99, 440.00, 587.33, 440.00, 369.99, 293.66, 246.94][k]
                mix_at(buf, soft_tone(ff, beat * 0.4, 0.06, "tri"), ft)
                events.append((ft, k % 4, 0.0))

    return buf, events, duration


def quantize_events(events, density="normal"):
    """
    events: (t, lane, dur)
    Produce difficulty-scaled charts with long notes preserved.
    """
    raw = []
    seen = set()
    for item in events:
        if len(item) == 2:
            t, lane = item
            dur = 0.0
        else:
            t, lane, dur = item
        key = (round(t, 3), int(lane))
        if key in seen:
            continue
        seen.add(key)
        n = {"t": round(t, 4), "lane": int(lane)}
        if dur and dur > 0.12:
            n["dur"] = round(dur, 4)
        raw.append(n)
    raw.sort(key=lambda x: (x["t"], x["lane"]))

    if density == "easy":
        out = []
        for i, n in enumerate(raw):
            # keep downs + long notes; skip dense doubles
            if n.get("dur", 0) > 0.12 or i % 3 == 0:
                # prefer single lane (strip doubles loosely)
                if out and abs(out[-1]["t"] - n["t"]) < 0.05:
                    continue
                out.append(n)
        return out

    if density == "hard":
        out = list(raw)
        extra = []
        for i, n in enumerate(raw):
            if i + 1 < len(raw) and i % 3 == 0:
                mid = round((n["t"] + raw[i + 1]["t"]) / 2, 4)
                if mid - n["t"] > 0.08:
                    extra.append({"t": mid, "lane": (n["lane"] + 1) % 4})
            # ghost opposite on long heads
            if n.get("dur", 0) > 0.4 and i % 2 == 0:
                extra.append({"t": n["t"], "lane": (n["lane"] + 2) % 4})
        out.extend(extra)
        out.sort(key=lambda x: (x["t"], x["lane"]))
        final = []
        seen2 = set()
        for n in out:
            key = (n["t"], n["lane"])
            if key in seen2:
                continue
            seen2.add(key)
            final.append(n)
        return final

    # normal: thin some doubles, keep longs
    out = []
    for i, n in enumerate(raw):
        if i % 4 == 3 and not n.get("dur"):
            continue
        out.append(n)
    return out


def write_song_from_build(song_id, title, artist, bpm, buf, events, duration, offset_ms=0, preview_start=8):
    folder = SONGS / song_id
    folder.mkdir(parents=True, exist_ok=True)
    audio_name = "audio.wav"
    write_wav(folder / audio_name, buf)

    for diff, dens, speed in [
        ("easy", "easy", 0.85),
        ("normal", "normal", 1.0),
        ("hard", "hard", 1.15),
    ]:
        notes = quantize_events(events, dens)
        notes = [n for n in notes if 0.8 <= n["t"] <= duration - 1.0]
        chart = {"scrollSpeed": speed, "notes": notes}
        (folder / f"{diff}.json").write_text(
            json.dumps(chart, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    meta = {
        "id": song_id,
        "title": title,
        "artist": artist,
        "bpm": bpm,
        "audio": audio_name,
        "jacket": "jacket.png",
        "offsetMs": offset_ms,
        "previewStart": preview_start,
        "durationSec": round(duration, 1),
        "durationLabel": f"{int(round(duration))}s",
        "difficulties": {
            "easy": "easy.json",
            "normal": "normal.json",
            "hard": "hard.json",
        },
    }
    (folder / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def write_song(song_id, title, artist, bpm, bars, seed, style, offset_ms=0):
    buf, events, duration = build_track(bpm, bars, seed, style)
    return write_song_from_build(
        song_id, title, artist, bpm, buf, events, duration, offset_ms=offset_ms
    )


def write_air():
    bpm = 76
    buf, events, duration = build_air_on_g(bpm=bpm)
    return write_song_from_build(
        "air-on-g",
        "Air on the G String",
        "J.S. Bach (synth arr.)",
        bpm,
        buf,
        events,
        duration,
        offset_ms=0,
        preview_start=12,
    )


def main():
    songs = [
        write_song(
            "pulse-drive",
            "Pulse Drive",
            "NEON BEAT",
            bpm=128,
            bars=32,  # ~1 min
            seed=7,
            style="pulse",
        ),
        write_song(
            "neon-grid",
            "Neon Grid",
            "NEON BEAT",
            bpm=140,
            bars=32,  # ~55s
            seed=21,
            style="neon",
        ),
        write_air(),
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
                "durationSec": m.get("durationSec"),
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
