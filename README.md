# NEON BEAT

4-key neon arcade rhythm game (browser).

## Play / Share link (fixed URL)

**https://vox5th-commits.github.io/neon-beat/**

Settings 화면에 주소가 안 보여도, 공유 링크는 위 주소가 맞습니다.  
배포가 성공한 뒤에야 접속됩니다 (성공 전에는 404).

### If the site is 404 / URL not shown on Settings

배포가 `waiting` / `queued` 에 걸려 있으면 사이트가 안 뜹니다.

1. Open **https://github.com/vox5th-commits/neon-beat/settings/environments**
2. Click **`github-pages`**
3. Remove **Required reviewers**, **Wait timer**, and set **Deployment branches** to allow **All branches** or **main**
4. Save
5. Open **Settings → Pages**
6. Source 를 **GitHub Actions** 로 바꾸거나, 다시 **Deploy from a branch → main / (root) → Save**
7. Open **https://github.com/vox5th-commits/neon-beat/actions** and wait for green **Success**
8. Open **https://vox5th-commits.github.io/neon-beat/**

You can also manually run the workflow: Actions → **Deploy GitHub Pages** → **Run workflow**.

## Play on this PC

1. Double-click **`start.bat`**
2. Keep the black window open
3. Browser: `http://127.0.0.1:8080`
4. Press **START**

Do **not** open `index.html` by double-click.

## Controls

| Key | Action |
|-----|--------|
| `D` `F` `J` `K` | Hit lanes 0–3 |
| `Esc` | Pause / resume |

## Tracks

- **Pulse Drive** — 128 BPM
- **Neon Grid** — 140 BPM

Easy / Normal / Hard. Online uses built-in synth audio.
