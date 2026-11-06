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

## 제3자 검증 중심의 일곱 장면 — 2026-11-06

사용자는 발급 과정이 여러 장면을 차지하는 반면 핵심인 제3자 검증은 체크리스트 하나에 압축돼 있다는 문제를 지적했다. 장면을 나누는 기준을 청중이 이해해야 할 질문으로 통일하고, 발급 준비 세 장면과 제3자 검증 네 장면으로 재구성했다.

- 구현 소스: [`d676690`](https://github.com/KODA-INHA-2026/koda-project/commit/d6766900b7d7758c94d5e613c66018061b5a0763).
- Pages: `a821f9f22cad734dff5f1e25d63c4bab5ae63c91`. [배포 실행](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42152176305).
- 검증 네 장면에서 같은 KODA 대시보드와 입력 상태를 유지하면서 제출 파일 계산, 발급서명 확인, Ethereum 요청·상태·응답, 세 해시 대조를 실제 처리 기록과 연결했다. 최종 결과는 즉시 표시하고 실행한 과정만 3.5초씩 다시 보여준다.
- 원본 일치·불일치·검증 미완료·확정 대기를 구분했다. 변경본에서 원본 검증정보의 서명이 유효하더라도 제출 파일의 발급 출처가 확인됐다고 표시하지 않는다.
- 왼쪽 구조도에는 고객사·KODA·Bitcoin의 수탁 관계를 정적인 업무 배경으로 추가했다. Ethereum의 문서 검증정보와 분리하며 Bitcoin 잔고를 조회하는 연출은 추가하지 않았다.
- 전체 live 테스트 **39/39**, TypeScript·배포 빌드 통과. 실제 원본·변경본 조회, 강제 조회 오류, 재생·초기화·입력 보존·추가 RPC 없음·키보드·동작 줄이기·1440px/1280px/390px 화면을 확인했다. 기존 단일 번들 크기 경고는 남는다.
- 새 서명이나 거래를 제출하지 않았고, 실제 KODA 운영 연동과 청중 이해도 실측은 이번 검증에 포함하지 않았다. 피그마 작업은 중단 상태를 유지했다.
- [설계·기여 기록](../../design/verification-centered-story-2026-11-06.md), [로컬 브라우저 관측 기록](../../design/verification-story-2026-11-06/browser-check.json).
- 설계·기여 기록을 작업 폴더와 지정된 G: 볼트 최종결과물 폴더에 `제3자 검증 중심 7장면 재설계 기록.md`로 보존하고 두 사본의 SHA-256 일치를 확인했다.
- 첫 Pages 게시 시도는 GitHub의 `syncing_files` 상태에서 10분 제한을 넘어 2026-11-06 11:54:44 KST 실패했다. 빌드·아티팩트 업로드는 성공했으며, 11:56:28 KST 실패한 게시 작업만 재실행했다. 공개 페이지 검증 결과는 게시 완료 후 별도로 기록한다.

## 두 장면 버전 공개 — 2026-11-06

사용자가 로컬에서 확인한 두 장면 버전의 링크를 요청해 같은 공유 주소에 게시했다. 발급·등록·고객사 전달과 제3자 대시보드 검증으로 발표를 나누고, 구조도에는 동일한 업무 주체를 Bitcoin과 Ethereum에 직접 연결했다.

- 구현 소스: [`00b8a79`](https://github.com/KODA-INHA-2026/koda-project/commit/00b8a79ffe3fb522387bda1b1db130ca67154c3c).
- 최종 Pages: `43a576a1b0b45cb5d07ccfe074af976c6f257483`. [게시 실행](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42166939459)은 **14:12:19 KST** 성공했다. 빌드 복사에 섞인 과거 데모 PDF 자료는 현재 공유 범위에서 제외했다.
- 공개 주소: https://koda-inha-2026.github.io/koda-project/sepolia-20261106/?revision=00b8a79
- 공유 경로용 TypeScript·빌드 통과. 기존 번들 크기 경고는 남는다. 로컬 기능 검증은 [두 장면 재설계 기록](../../design/two-act-demo-reset-2026-11-06.md)을 따른다.
- 공개 HTTPS 페이지에서 새 소스 버전·두 장면을 확인하고 실제 RPC 조회로 원본 `match`, 변경본 `file-mismatch`를 확인했다. 브라우저 예외와 새 지갑 요청은 없었다.
- [공개 관측 기록](../../design/two-act-demo-2026-11-06/public-check.json), [공개 원본 판정](../../design/two-act-demo-2026-11-06/public-match.png), [공개 변경본 판정](../../design/two-act-demo-2026-11-06/public-mismatch.png).

## 조회 요청과 응답의 연속 동작 — 2026-11-06

- 사용자 판단: 두 장면 유지, 전달·조회의 연속 동작을 개선의 중심으로 삼고 새 비교 사례는 보조 시나리오로 미룬다. 이번에는 제3자 검증 버튼부터 Ethereum 응답·PDF 대조·결과까지 이어지는 동작을 구현했다.
- 구현 소스: `df982fff4bb38a332b8c7eb4343aec6c0bc7c857`. Pages: `b368df0f2d2bf26777d8d857b21301b117147ba0`.
- [공개 링크](https://koda-inha-2026.github.io/koda-project/sepolia-20261106/?revision=df982ff). [게시 실행](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42170052917) 2026-11-06 14:43:47 KST 성공.
- 실제 trace가 전이를 허용하고 최소 표시시간이 가독성을 확보한다. 실제 결과는 즉시 접근 가능하며 연출이 네트워크 실행시간인 것처럼 표시하지 않는다. 재생은 추가 RPC를 만들지 않는다.
- 회귀 41/41, TypeScript·빌드 통과. 실제 원본·변경본, 늦은 record 응답, 오류, pause/replay/skip, 입력 교체, reduced motion 전환, 1440/1280/390px를 확인했다. 기존 번들 크기 경고는 남는다.
- 공개 HTTPS 페이지에서도 실제 응답 이동·원본 match·변경본 file-mismatch 확인. 새 서명·등록 거래 없음. 기존 eth_accounts 자동 복원과 승인·서명 요청을 구분해 검사했다.
- [설계·기여 기록](../../design/continuous-verification-2026-11-06.md), [브라우저 검사](../../design/continuous-verification-2026-11-06/browser-check.json), [공개 확인](../../design/continuous-verification-2026-11-06/public-check.json).
- 지정 작업 폴더와 G: 볼트에 `검증 요청과 응답의 연속 동작 개선 기록.md`를 보존했다. 최종 기록의 두 사본 SHA-256 일치를 확인했다.

## 실제 자료 전달과 수신자 입력 — 2026-11-06

- 대표님 최종 답변의 발급·서명·블록체인 기록·제3자 대조를 기준으로, 고객사가 PDF와 검증정보를 받아 제출하는 구간을 실제 다운로드·파일 입력으로 연결했다. JSON 동봉은 우리 기술 설계이며 대표님이 지정한 파일 형식이라고 주장하지 않는다. 외부 재현 코드·규격 패키지는 보류 상태다.
- 구현 소스 `f1559be8f9fcf9c5c360fcbe568adcbbf7fd3119`, Pages `5adec458c51f1f0bc697a80fa3b2fc02706ccbe3`. [공유 링크](https://koda-inha-2026.github.io/koda-project/sepolia-20261106/?revision=f1559be), [게시 실행](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42174535827).
- live 회귀 47/47, TypeScript·빌드, 실제 새 브라우저 수신 입력과 RPC 원본·변경본 판정, 잘못된 파일·읽기 경합·등록 실패·무관 거래·localStorage 신뢰 경계 확인. 기존 번들 크기 경고는 남음.
- 공개 HTTPS에서 실제 파일 다운로드 → 깨끗한 수신자 세션 → 원본 일치·변경본 불일치를 2026-11-06 15:28 KST 확인. 새 서명·등록 거래 없음.
- [설계·기여 기록](../../design/document-handoff-2026-11-06.md), [공개 확인](../../design/document-handoff-2026-11-06/public-check.json). 같은 기여 기록을 지정 작업 폴더와 G: 볼트에 `PDF와 검증정보 전달 및 제3자 입력 구현 기록.md`로 보존한다.

## 두 검증 환경과 기술 부록 — 2026-11-06

- 제3자의 KODA 대시보드 이용을 당연한 전제로 두지 않고, 대시보드와 외부 실행을 함께 준비해 현업 피드백을 받도록 구성했다. 이전 절의 외부 패키지 보류는 이번 요청으로 해제됐다.
- 02는 제공된 KODA 화면의 조직·좌측 메뉴·본문 틀에 현재 검증 흐름을 결합했다. 03은 같은 검증 함수를 별도 Node.js에서 실행할 규격·소스·번들과 실제 실행 기록을 제공한다. 화면에서 보존 기록을 새 실시간 실행처럼 표현하지 않는다.
- 구현 소스 `74ff79940a79657c3f72bdd39aeb41058450bf23`, Pages `50d20a945b464e2e3cd311d98219c600889371f6`. [공유 링크](https://koda-inha-2026.github.io/koda-project/sepolia-20261106/?revision=74ff799), [게시 실행](https://github.com/KODA-INHA-2026/koda-project/actions/runs/42180712624), 16:25 KST 성공.
- live 회귀 47/47, TypeScript·공유 빌드, 외부 패키지 원본·변경본 실행과 입력 거절 6건, 세 화면의 1440/1280/390px 레이아웃 확인. 기존 번들 크기 경고는 남는다.
- 16:27 KST 공개 페이지에서 실제 PDF·JSON 다운로드, 새 수신자 입력과 원본 일치·변경본 불일치, 03 보고서 전환과 ZIP 해시 일치를 확인했다. 브라우저 예외·새 지갑 승인·등록 거래 없음.
- 기술 기준은 유지하고 기획서 8.7에 최신 두 경로를 기록했다. 기술 부록 14장은 편집 가능한 프레젠테이션으로 저장하고 전 장을 렌더링해 검토했다. 원고·기여 기록과 14장 미리보기를 지정 G: 볼트 폴더에도 보존했다.
- [설계·기여 기록](../../design/two-verification-options-2026-11-06.md), [공개 관측](../../design/two-verification-options-2026-11-06/public-check.json), [기술 기준](../../presentation/technology-baseline-2026-11-06.md), [외부 검증 구현](../../external-verification/IMPLEMENTATION.md).
