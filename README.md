# NEON BEAT

4-key neon arcade rhythm game (browser).

## Play online (share this link)

After GitHub Pages is enabled:

**https://vox5th-commits.github.io/neon-beat/**

Friends only need a browser — no install.

### Enable GitHub Pages (one-time, repo owner)

1. Open https://github.com/vox5th-commits/neon-beat  
2. **Settings** → **Pages**  
3. Source: **Deploy from a branch**  
4. Branch: **main** / folder: **/ (root)** → **Save**  
5. Wait 1–2 minutes, then open the link above.

## Play on this PC

1. Double-click **`start.bat`** in this folder  
2. Keep the black window open  
3. Browser opens `http://127.0.0.1:8080`  
4. Press **START**

Do **not** open `index.html` by double-click (START will fail to load songs).

Manual server:

```powershell
cd $env:USERPROFILE\Desktop\rhythm-game
& "$env:LOCALAPPDATA\Python\bin\python.exe" -m http.server 8080 --bind 127.0.0.1
```

Then visit http://127.0.0.1:8080

## Controls

| Key | Action |
|-----|--------|
| `D` `F` `J` `K` | Hit lanes 0–3 |
| `Esc` | Pause / resume |

Offset: title screen → **OFFSET SETTINGS**

## Tracks

- **Pulse Drive** — 128 BPM  
- **Neon Grid** — 140 BPM  

Each has Easy / Normal / Hard.  
Online (GitHub Pages) uses built-in synth audio. Local can use `audio.wav` if present.

## Project layout

```
index.html, start.bat
css/  js/  assets/songs/  tools/
```
