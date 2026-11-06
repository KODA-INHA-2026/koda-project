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

## 게시 완료와 공개 주소 검증

- 구현 소스: [`b688772`](https://github.com/KODA-INHA-2026/koda-project/commit/b688772).
- 정적 배포: [`994ebff`](https://github.com/KODA-INHA-2026/koda-project/commit/994ebff7bb55028f89b5007318c9c0564a724cb2).
- [Pages 실행 #9](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42111175659): 2026-11-06 06:21:33 KST `success`. GitHub 파일 동기화에 약 4분이 걸렸으며 기존 경로의 변경은 없다.
- 배포 전 live 테스트 21/21, 웹 TypeScript 검사와 배포용 빌드 통과. 단일 번들 500 kB 경고는 남아 있다.
- 공개 HTTPS 주소를 Chrome에서 직접 열어 8개 장면 이동과 한글 PDF 복원을 확인했다.
- 지갑 연결·새 서명·새 거래 없이 원본은 `match`, 120 BTC 변경본은 `file-mismatch`. 두 결과 모두 현재 조회한 finalized 블록 `12072046`에서 등록 기록을 대조했다.
- [공개 페이지 관측 기록](public-page-qa.json), [게시 화면](public-page.jpg)을 보존했다. 외부 사용자의 파일 선택·모든 브라우저 조합을 새로 검수한 것은 아니다.

## 구조도 중심 버전으로 갱신 — 2026-11-06

사용자는 위의 첫 공개본을 팀에 전달하지 않았으며, 전체 구조도와 현재 동작을 함께 보여주는 개선본을 공유하도록 요청했다. 같은 공유 주소를 현재 버전으로 갱신하고 이전 버전은 Git 이력에 보존했다.

- 구현 소스: `cf3e37e` (`feat/first-demo`).
- 정적 배포: `7641acd5a5370ccb8a28ff557197ed6c8e628aa5` (`gh-pages`).
- [Pages 실행 #10](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42137054862): 2026-11-06 09:28:55 KST `success`.
- 공개 경로: https://koda-inha-2026.github.io/koda-project/sepolia-20261106/
- 배포용 TypeScript 검사와 빌드 통과. live 테스트 22개 통과 후 로컬 체인 연결 대기에서 4개가 시간 초과됐다. 동일한 컨트랙트 테스트 4개를 샌드박스 밖에서 재실행해 모두 통과했다. 테스트·제품 코드 변경 없이 총 26개 검증을 완료했다. 번들 크기 경고는 남아 있다.
- 발표는 KODA 대시보드를 가정한 제3자 검증 화면에 집중한다. 운영 대시보드 연동은 아니며, 외부 검증 패키지는 미구현 확장 방향으로만 설명한다.
- [연출 설계·기여 기록](../../design/architecture-led-storyboard.md), [로컬 화면 검수](architecture-led/browser-qa.json)를 함께 보존한다.
- 공개 HTTPS 페이지에서 새 구조도·장면 구성이 표시되는 것을 확인했다. 실제 공개 RPC 대조에서 원본은 `발급 원본과 일치해요`, 변경본은 `발급 원본과 달라요`로 표시됐다. [공개 검수 기록](architecture-led/public-browser-qa.json)과 [공개 첫 화면](architecture-led/public-page.jpg)을 보존했다.

## Ethereum 기획 체인과 테스트 실행 표현 구분

- 사용자가 구조도 중심 버전을 다음 고도화의 초안으로 정했다. 화면의 주된 체인 표기를 Ethereum으로 정리하고 실제 실행 환경만 Sepolia 테스트넷으로 구분했다.
- 소스 `e6ffa69`, Pages `26aa78822f39363ecaa7b3d12d797b0c276639d1`. [Pages 실행 #11](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42138946905)은 2026-11-06 09:44:37 KST 성공했다.
- 같은 공유 주소를 Chrome에서 새로고침해 `KODA · Ethereum 증빙 검증` 제목과 별도 실행 환경 표기를 확인했다. 실제 chainId·RPC·지갑·등록 증거·검증 조건은 변경하지 않았다.
- 웹 TypeScript·배포 빌드·diff 검사와 로컬 첫 화면/서명/블록/제3자 장면 확인을 수행했다. 동작 변경이 없는 표기 수정이므로 전체 컨트랙트 테스트와 실제 RPC 대조를 이번 수정에서 반복하지 않았다. 직전 공개본의 검증 결과는 위 기록을 따른다.
- [고도화 검토](../../design/refinement-review-2026-11-06.md), [PPT 기술 부록 초안](../../presentation/blockchain-technology-appendix-draft.md)을 함께 남겼다.

## 추가 토스 리서치와 내용 중심 개선 — 2026-11-06

사용자가 기존 리서치로 충분한지 다시 판단하고, 부족하면 추가 조사 후 수정하도록 요청했다. 공식 자료 두 편을 새로 읽고 기존 세 편을 재확인한 뒤 8개 장면의 문구와 제3자 검증 과정 표현을 수정했다. 대표님 답변의 세 질문과 KODA 색상, 문서 검증 범위는 유지했다.

- 소스: [`eaceaa3`](https://github.com/KODA-INHA-2026/koda-project/commit/eaceaa33c571b1f3c5d25f2a5090bc1129aa694c).
- Pages: `9e07ca2b66d126beeed136c857d7500d55f54e34`. [Pages 실행 #12](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42143954774)은 2026-11-06 **10:28:17 KST**에 성공했다.
- 구조도에서 Ethereum의 역할을 구체적으로 설명하고 내부 설계 메모 같은 표현을 걷어냈다. 번호는 하단 1~8로 통일했다.
- 제3자 UI 옆에서 실제 배포 확인·SHA-256·ECDSA 주소 복구·확정 기록 조회·세 해시 대조를 표시한다. 사전 로드된 검증정보, 시험 발급자, 현재 파일 비교의 의미를 명시했다.
- 전체 live 테스트 **30/30**, TypeScript·배포 빌드 통과. 브라우저에서 8개 장면, 실제 원본/변경본, 강제로 주입한 조회 오류, 1280px·390px 가로 넘침, 키보드·reduced motion을 확인했다. 기존 번들 크기 경고는 남아 있다.
- 배포 후 공개 HTTPS 페이지에서 소스 커밋과 새 문구를 확인했다. 실제 RPC 재조회 결과 원본은 일치, 변경본은 불일치였다. 새 서명·거래를 제출하지 않았다.
- [리서치·반영 상세](../../design/toss-research-application-2026-11-06.md), [공개 확인 기록](../../design/content-refinement-2026-11-06/public-check.json), [공개 첫 화면](../../design/content-refinement-2026-11-06/public-intro.jpg), [공개 원본 검증 화면](../../design/content-refinement-2026-11-06/public-original-match.jpg).

실제 청중의 이해도·피로도 개선은 아직 조사하지 않았다. 문구와 처리 상태의 정확성을 검증한 단계이며, 기존 등록 증거·컨트랙트·검증 함수·지갑 로직은 유지했다.

## 검증 과정 다시 보기와 자산 범위 설명 — 2026-11-06

사용자가 검증 과정의 빠른 전환과 ‘체인 밖 BTC 수량’의 오해 가능성을 지적했다. 실제 결과는 즉시 표시하고, 실행한 기록만 단계당 3.5초씩 다시 보여주는 동작을 추가했다. 일시정지·수동 선택을 지원하며 재생 중 추가 RPC는 없다. 구조도에는 Bitcoin의 BTC와 Ethereum의 문서 검증정보를 구분하고, 등록·조회·응답은 직각 경로로 정리했다.

- 소스: [`9c04fce`](https://github.com/KODA-INHA-2026/koda-project/commit/9c04fceb2396f5c4f26232df78d126c76b4edb05).
- Pages: `faa2a495f52e7bd47163cc750912225d73d20f48`. [Pages 실행 #13](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42148219287)은 2026-11-06 **11:07:57 KST** 성공했다.
- 전체 live 테스트 30/30, TypeScript·배포 빌드 통과. 브라우저에서 재생 간격·정지·수동 조작·초기화·추가 RPC 없음·오류 상태·동작 줄이기·키보드·1280px/390px 레이아웃을 확인했다. 기존 번들 크기 경고는 남는다.
- 공개 HTTPS 페이지에서 새 소스 커밋과 문구, 기록 선택과 구조도 연동을 확인했다. 실제 원본은 일치, 변경본은 불일치. 새 지갑 서명이나 거래는 제출하지 않았다.
- [설계·기여 기록](../../design/verification-review-2026-11-06.md), [공개 관측 기록](../../design/verification-review-2026-11-06/public-check.json), [공개 검증 화면](../../design/verification-review-2026-11-06/public-review.png).
- 설계 기록은 작업 폴더와 지정된 G: 볼트 최종결과물 폴더에 `검증 과정 재생과 체인 역할 표현 개선 기록.md`로 보존했고 두 사본의 SHA-256 일치를 확인했다. 피그마 작업은 중단 상태를 유지했다.
