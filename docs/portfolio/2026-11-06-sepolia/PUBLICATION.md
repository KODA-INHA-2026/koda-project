# 1차 피드백 공유 — 2026-11-06

- 공유 주소: https://koda-inha-2026.github.io/koda-project/sepolia-20261106/
- 소스 브랜치: `feat/first-demo`
- 정적 배포 브랜치: `gh-pages`, 새 폴더 `sepolia-20261106/`.
- 기존 공유 주소와 파일을 보존하고 이번 버전을 별도 경로로 게시한다.

## 공유 범위

현재 8개 장면의 전체 기술 흐름과 제3자 검증 화면을 1차 피드백용으로 공유한다. 새 지갑 연결이나 서명 없이 이미 등록된 가상 BTC 잔고 증명서의 원본·변경본을 실제 Sepolia 기록과 대조할 수 있다. 재생은 이전 실행 기록이며, 대조 버튼은 현재 공개 RPC를 조회한다.

사용자는 다음 디자인 개선 방향으로 **이전의 간결한 표현과 현재 기술 중심 표현의 중간**을 제안했다. 이번 게시 전에는 디자인을 다시 바꾸지 않고 피드백을 먼저 수집한다. 기술 흐름과 업무 주체의 구분은 유지한다.

## 재현 방법

1. `npm ci`
2. `npm run live:test`
3. `npm run live:build:pages`
4. `apps/web/dist-live/`의 `live.html`, `assets/`, `fonts/`를 `gh-pages`의 `sepolia-20261106/`에 복사한다. `live.html`을 같은 폴더의 `index.html`로도 복사한다. 다른 기존 폴더는 그대로 둔다.
5. Pages 배포가 끝나면 공유 주소에서 글꼴 로드, 8개 장면 이동, 원본 일치·변경본 불일치의 실제 조회를 확인한다.

`BASE_URL`을 사용해 하위 배포 경로에서도 PDF 생성용 한글 글꼴을 같은 바이트로 불러온다. 글꼴 또는 과거 PDF 내용이 바뀌면 등록 당시 SHA-256과 달라져 복원 검증에서 오류로 처리한다.

공개 RPC의 장애·제한은 조회 실패로 표시한다. 운영 KODA 시스템 연동, 실물 BTC 잔고 보증, 외부 JSON 패키지 배포를 완료한 서비스가 아니다.

배포 방식 참고: [GitHub Pages 브랜치 게시](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Vite 하위 경로 배포](https://vite.dev/guide/static-deploy.html#github-pages).
