# KODA × INHA 2026

인하대학교 디지털자산 마이크로디그리 KODA 산학 프로젝트 학생팀의 공동 개발 저장소입니다.
제안 서비스의 시연과 프로토타입을 준비하는 공간이며, KODA나 인하대학교의 공식 운영 시스템 저장소가 아닙니다.

## 현재 상태

- 현재 웹 UI는 v12입니다. 홈은 브랜드 이미지, 원자료의 신뢰·요청과의 일치·확인 범위를 읽는 세 관점의 근거 열람기, 세 기업의 실무 흐름 순서로 구성합니다. 서비스 원리에서는 자료 검사와 외부 거래 사실의 증거를 구분합니다.
- 주소·발급처·서명·유효시간·거래 대상을 확인하고, 받은 파일을 다시 검사하는 웹 프로토타입입니다.
- 수출 제조의 받은 대금 확인, 게임·콘텐츠의 정산 주소 확인과 두 명 승인, 자산운용의 감사 자료 준비를 제공합니다.
- 합성 자료의 ECDSA P-256/SHA-256 서명 검증은 실제 WebCrypto로 실행합니다. 발급처는 `산학프로젝트 샘플 발급키`입니다.
- 후속 승인·처리 상태는 브라우저 안의 시연 상태이며, 실제 KODA·블록체인·결제·LLM·ZK 서비스와 연결하지 않습니다.
- 실제 요청 접수·조직 승인·수탁 서명과 전송·블록체인 기록·상대방 수령·내부 장부 대사의 여섯 외부 사실은 모두 미확인으로 표시합니다.
- 받은 자료 화면에서는 공개 합성 예시를 불러온 뒤, 별도의 확인 버튼으로 원자료부터 다시 검사할 수 있습니다.

시연에서는 실제로 구현한 기능, 가상 데이터로 처리한 부분, 목업, 추후 구현 계획을 구분합니다.

## 공통 링크

| 공간 | 링크·상태 | 용도 |
| --- | --- | --- |
| GitHub 조직 | [KODA-INHA-2026](https://github.com/KODA-INHA-2026) | 팀 공동 관리 공간 |
| 개발 저장소 | [koda-project](https://github.com/KODA-INHA-2026/koda-project) | 코드·개발 문서·변경 이력 |
| Google Drive | [팀 공동 작업 폴더](https://drive.google.com/drive/folders/1fl7Cx1Iven9TYFBXJs-MV222u8SYiVWH?usp=sharing) | 발표자료·이미지·시연 영상 등 파일 |
| 공동 Google 슬라이드 | [KODA 1024 공동 발표자료](https://docs.google.com/presentation/d/1-HxONos-pEA9OlyIPW4XS_Th8nf-ItAW42_Y8_Kqdos/edit?slide=id.h7f535652ed8e08af_0_0#slide=id.h7f535652ed8e08af_0_0) | 발표에 들어갈 내용 공동 작성 |
| 협업 안내 | [CONTRIBUTING.md](CONTRIBUTING.md) | 작업 공유·문서·데이터 관리 기준 |
| 공개 웹 | [KODA Workspace](https://koda-inha-demo-oct28.insiapark.chatgpt.site) | 주소·거래 확인과 받은 자료 재검증 |
| 30초 영상 | [제품 시연 영상](https://koda-inha-demo-oct28.insiapark.chatgpt.site/assets/koda-concept-demo-30s-v7.mp4) | 핵심 확인 흐름 |

Drive와 슬라이드의 접근 권한은 GitHub 접근 권한과 별개입니다.

## 개발 참여 및 역할

아래는 현재 공유된 기본 역할이며, 개별 기능의 개발 분담은 아직 확정되지 않았습니다.

| 참여자 | 기본 역할 |
| --- | --- |
| 의혁 · [Insia88](https://github.com/Insia88) | 시나리오 영상 준비·공동 데모 개발 |
| 범찬 · [0xarkstar](https://github.com/0xarkstar) | 서비스 구상·발표·공동 데모 개발 |
| 기호 · [sghtao](https://github.com/sghtao) | GitHub 준비·개발 범위 정리 후 공통 실행환경 구성·공동 데모 개발 |

GitHub 관리 권한과 특정 기능의 개발 담당은 별개입니다.

## 주요 일정

중간점검 공지 기준이며, 시간은 한국 표준시(KST)입니다.

| 일정 | 내용 |
| --- | --- |
| 2026-10-27 13:00 | 중간점검 발표자료 PDF 제출 |
| 2026-10-28 12:00 | 중간점검: 발표 10분·교수진 피드백 20분 |
| 2026-11-08 | 1차 결과물. 프로토타입 구현 범위와 세부 계획은 팀에서 구체화 |

## 개발환경과 실행 방법

Node.js 22 이상과 npm을 사용합니다. API 키와 환경변수는 필요하지 않습니다. 아래 명령은 저장소 최상위에서 실행합니다.

```sh
npm install
npm run media:fetch
npm run build
npm run dev
```

[http://localhost:4389](http://localhost:4389)를 엽니다. `file://`로 열면 JSON 로드와 WebCrypto 동작이 제한되므로 로컬 서버를 사용합니다. 다른 포트는 `PORT` 환경변수로 지정할 수 있습니다.

`npm install`은 `landing/package-lock.json`에 고정된 패키지를 설치합니다. `media:fetch`는 이미지·폰트·30초 영상을 공개 웹에서 내려받아 SHA-256을 확인합니다. 미디어 없이도 소스 빌드와 도메인 테스트는 가능하지만 화면과 전체 정적 자산 검사는 미디어가 필요합니다. 영상·이미지 바이너리는 Git에 포함하지 않습니다.

공개 영상은 기존 `koda-concept-demo-30s-v7.mp4` 한 편입니다. UI의 v12 표시는 영상 파일 버전과 별개입니다.

브랜드 제목은 자체 호스팅 IBM Plex Sans KR을, 한국어 본문과 업무 UI는 Pretendard Variable을 사용합니다. 정확한 주소·거래 ID는 IBM Plex Mono로 표시합니다. 글꼴의 SIL Open Font License 고지는 `landing/dist/assets/fonts-v11/IBM-Plex-OFL-1.1.txt`, `landing/dist/assets/IBMPlex-OFL.txt`, `landing/dist/assets/licenses/Pretendard-OFL.txt`에 보존합니다.

```sh
npm test
npm run check
npm run media:verify
```

`npm test`는 실제 검증 코어의 정상·유사 주소·스팸·서명 변조·유효시간·대상 불일치·수신 파일 조작을 검사합니다. `check`는 페이지 참조와 자산·합성 데이터의 일관성을 검사합니다.

## 편집할 파일

| 작업 | 파일 |
| --- | --- |
| 홈 레이아웃·스타일 | `landing/dist/index.html`, `landing/dist/home.css`, `landing/dist/brand-v11.css` |
| 홈 원자료·주소 대조·모션 | `landing/dist/home-folio.js`, `landing/build-motion.mjs`, `landing/motion-source.js`, `landing/dist/home-assurance.js` |
| 홈 근거 열람기 | `landing/evidence-section.html`, `landing/dist/evidence-reader.css`, `landing/dist/evidence-reader.js` |
| 서비스 원리의 증거 구조·외부 사실 | `landing/dist/research.html`, `landing/dist/evidence-research.css` |
| 업무 콘솔·상태 전환 | `landing/dist/workspace.html`, `landing/dist/blueprint.js`, `landing/dist/workspace-v6.css` |
| 공통 검증 입력·결과 표현 | `landing/dist/assurance-ui.js`, `landing/dist/assurance-ui.css` |
| 받은 파일 재검증 | `landing/dist/verification.html`, `landing/dist/app.js` |
| 검증 규칙·공개 데이터 | `landing/dist/assurance-core.js`, `landing/dist/assets/assurance-fixtures.json`, `landing/dist/assets/assurance-keyring.json` |
| 색상·문구·설명 | `landing/design/visual-tokens.json`, `landing/product-copy.json`, `landing/global-evidence.html`, `landing/brand-direction.html` |

빌드는 `tokens.css`, `fixtures.js`, `commercial-data.js`, `product-copy.js`, `product-motion.js`, `brand.html`과 홈·서비스 원리의 지정 구간을 갱신합니다. 홈 근거 열람기의 HTML 원본은 `landing/evidence-section.html`입니다. 생성 파일을 직접 고치면 다음 빌드에서 덮어쓸 수 있으므로 해당 원본을 편집합니다. 자세한 동작 계약은 [개발 안내](docs/DEVELOPMENT.md), 외부 라이선스는 [고지](THIRD_PARTY_NOTICES.md)를 따릅니다.

## 검증 범위

원자료 서명과 요청한 주소·거래의 일치는 별도로 확인합니다. 서명이 유효해도 다른 주소나 거래라면 통과하지 않습니다. 확인 기준은 **2026-10-24 14:30 KST**의 고정된 시연 시각이며 실시간 조회가 아닙니다.

내보낸 JSON에는 수신자가 서명을 재검증할 수 있도록 공개 합성 원자료 전체가 포함됩니다. 표시 항목을 해제해도 원자료의 값이 사라지지 않습니다. 원자료만 발급키로 서명되며 출력 파일의 체크섬은 발신자 인증이나 원래 선택값의 서명이 아닙니다. 실제 지갑 소유권·온체인 실행·비밀보호·ZK 증명을 제공하지 않습니다.

## 자료·보안 기준

- 프로토타입에는 가상 고객·모의 거래 데이터를 사용하고 모의 자료임을 표시합니다.
- 실제 고객 정보, 개인키, 복구 구문, 비밀번호, API 키, 인증 토큰, 회사 내부 운영 자료는 올리지 않습니다.
- PPT·PDF·이미지·영상 등 발표 파일은 Drive에 두고 필요한 링크를 문서에 남깁니다.
- 외부 공개 범위와 라이선스는 팀에서 별도로 결정합니다.
