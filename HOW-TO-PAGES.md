# GitHub Pages 주소가 안 보일 때

## 공유 주소 (고정)

https://vox5th-commits.github.io/neon-beat/

Settings 페이지에 초록 링크가 없어도 위 주소로 접속·공유하면 됩니다.

## 스크린샷처럼 설정했는데 404인 이유

설정(main + root)은 맞습니다.  
**첫 배포가 waiting/queued 에서 안 끝나서** 사이트가 아직 안 올라간 상태입니다.

## 해결 순서

### A. Environment 잠금 해제 (중요)

1. https://github.com/vox5th-commits/neon-beat/settings/environments
2. **github-pages** 클릭
3. 있으면 삭제:
   - Required reviewers (승인자)
   - Wait timer
4. Deployment branches → **All branches** 또는 main 포함
5. Save

### B. 배포 다시 돌리기

**방법 1 — Actions (추천)**

1. Settings → Pages → Source: **GitHub Actions** → Save
2. https://github.com/vox5th-commits/neon-beat/actions
3. **Deploy GitHub Pages** 워크플로 → **Run workflow** (main)
4. 초록색 Success 될 때까지 대기 (보통 1~3분)

**방법 2 — Branch 배포**

1. Settings → Pages → Deploy from a branch
2. main + /(root) → Save (한 번 다른 값으로 바꿨다 다시 저장해도 됨)
3. Actions 탭에서 pages build 성공 확인

### C. 확인

브라우저에서:

https://vox5th-commits.github.io/neon-beat/

게임이 보이면 이 링크를 친구에게 보내면 됩니다.
