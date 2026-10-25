# 웹 개발 안내

앱은 정적 HTML/CSS/JavaScript로 구성됩니다. `npm run build`로 공유 토큰·문구·모션을 생성하고 `npm run dev`로 실행합니다. `landing/dist`가 웹 루트입니다. 서버는 로컬 파일만 제공하며 금융 데이터·계정·지갑을 연결하지 않습니다.

현재 UI는 v13이며 공개 수탁 기반에서 산업별 활용 가능성과 세 가지 합성 업무 시연으로 이어지는 구성을 제공합니다. 별도 `industries.html`에서는 세 산업·세부 업종·기업명을 탐색합니다. 근거 열람기는 같은 자료를 원자료의 신뢰·요청과의 일치·확인 범위로 나누어 읽습니다. 서비스 원리에서는 자료의 검사 구조와 외부 거래 사실을 구분합니다. 기존 `assurance-core.js`의 서명·주소·거래 검증과 업무 진행 조건을 유지하며 공개 영상은 v7의 단일 30초 파일을 그대로 사용합니다.

공개 제목의 서체는 SUIT Variable 2.040이며 2,668개 한글 음절을 포함합니다. 나머지 글자는 Pretendard Variable로 표시합니다. `fonts.displayFallback`까지 포함한 공유 토큰에서 표시용 서체 스택을 생성하며 공개 스타일은 `landing/dist/public-type-v13.css`가 담당합니다. 한국어 본문·업무 UI의 Pretendard Variable과 정확한 식별자의 IBM Plex Mono는 유지합니다. SUIT 파일과 원본 OFL은 `landing/dist/assets/fonts-v13/`에 함께 전달하고 기존 Plex 고지도 보존합니다.

## 데이터와 화면

`assurance-core.js`가 검증 결과의 기준입니다. 화면의 선택 상태나 색상으로 통과 판정을 만들지 않습니다. `blueprint.js`는 업무 상태, `assurance-ui.js`는 입력·검사 항목 표시, `app.js`는 수신 파일 검사를 담당합니다. 업무 시연의 고객·주소·거래 자료는 공개 합성 예시이며 아래 실재 기업의 산업별 조사 자료와 구분합니다.

산업별 잠재 활용 기업의 canonical 원본은 `landing/prospect-companies-v13.json`입니다. 세 업종에 100개씩 총 300개를 포함하며 `classification`은 `prospective`입니다. 기업의 공개 출처·업종 분류와 프로젝트가 제안한 활용 장면을 함께 제공하며 고객·제휴·도입 관계를 확인한 목록이 아닙니다. `landing/build-industries.mjs`가 중복과 수량·출처 URL을 검사하고 공개 사본 `landing/dist/assets/prospect-companies-v13.json`을 생성합니다. `industries.js`는 세부 업종 필터·이름 검색·가로 목록 탐색을 담당합니다.

수탁 기반의 HTML 원본은 `landing/capability-section.html`입니다. 86.6%와 국내 1위 표시는 KODA 공개 자료의 2024년 하반기 수탁고 기준이며 현재 수치가 아닙니다. 해당 기준 시점과 외부 보고서의 발행 주체·시점을 제거하지 않습니다. 공식 서비스의 기능·공개 자료는 활용 제안의 배경이며 합성 시연이 실제 KODA 서비스와 연결되었다는 의미가 아닙니다.

빌드는 `build-tokens.mjs` → `build-motion.mjs` → `build-industries.mjs` 순서입니다. 마지막 단계가 홈의 수탁 기반·산업별 미리보기, 산업 페이지의 공개 근거 구간과 공개 네 페이지의 공통 탐색을 반영합니다. 공통 메뉴의 열기·닫기와 키보드 처리는 `landing/dist/public-ui-v13.js`에서 관리합니다. 생성 구간과 공개 JSON을 수정할 때는 canonical 원본을 먼저 편집합니다.

홈 근거 열람기의 HTML 원본은 `landing/evidence-section.html`이며 빌드가 홈의 지정 구간에 반영합니다. `landing/dist/evidence-reader.css`와 `evidence-reader.js`는 세 관점의 배치와 키보드 탭 전환, 코어 검사 결과의 표시를 담당합니다. 서비스 원리의 증거 구조와 외부 사실 목록은 `landing/dist/research.html`, 표현은 `landing/dist/evidence-research.css`에서 편집합니다. 하단 배경 자료의 원본인 `landing/global-evidence.html`은 별도로 빌드에 반영합니다.

실제 요청 접수·조직 정책에 따른 승인·수탁 시스템 서명과 전송·블록체인 거래 기록·상대방 자산 수령·내부 장부 대사는 모두 미확인입니다. 각각 필요한 증거와 기준 시점을 별도로 표시하며 원자료 서명 통과나 JSON 재검증으로 이 사실들을 완료 처리하지 않습니다.

받은 자료의 공개 예시 불러오기는 코어가 만든 합성 출력 JSON을 입력란에 넣는 동작입니다. 불러오기만으로 수신 검사 결과를 만들지 않으며, 사용자가 받은 자료 확인 버튼을 눌러 `verifyOutput`을 별도로 실행합니다. 입력이 있거나 파일을 선택한 상태에서는 예시가 덮어쓰지 못하도록 막습니다. 법인 업무에서 상세로 전환할 때는 좁은 화면에서도 표시되는 법인 제목으로 초점을 옮깁니다.

검사 입력 오류가 접힌 상세 영역 안에 있으면 해당 영역을 열고 오류 입력에 초점을 옮긴 뒤 화면 중앙으로 이동합니다. 좁은 화면에서는 상단 작업 탐색에 오류 입력이 가려지지 않는지 함께 확인합니다.

```js
await window.KODA_ASSURANCE.ready;
const api = window.KODA_ASSURANCE;
const item = api.getCase('export', 'normal');
const result = await api.verify('export', 'normal', {request: item.request});
if (result.passed) {
  const output = await api.createOutput('export', 'normal', result, {
    company: true,
    amount: false
  });
  const received = await api.verifyOutput(output);
  console.log(received.passed);
}
```

법인 ID는 `export`, `game`, `audit`이며 상황은 `normal`, `lookalike`, `spam`, `network`, `asset`, `tampered`, `stale`, `untrusted`입니다. `createOutput`에는 같은 코어 인스턴스가 발급한 실제 결과 객체를 전달해야 합니다. 복제하거나 직접 만든 `passed` 객체는 거부됩니다.

## 검증 계약

- ECDSA P-256/SHA-256으로 원자료의 서명을 검증합니다. 공개키의 SPKI fingerprint도 다시 계산합니다.
- EVM 주소는 전체 40자리 16진수를 소문자로 정규화해 대조하고 거래 ID는 전체 64자리 16진수를 대조합니다. 주소 앞뒤 일부만 비교하지 않습니다. EIP-55나 지갑 소유 증명은 제공하지 않습니다.
- 발급키와 원자료의 유효시간은 시작 포함·종료 제외입니다. 기본 기준은 `2026-10-24T05:30:00.000Z`입니다.
- 발급처·서명·시간 검사가 실패하면 종속 사실 항목은 `not_checked`입니다. 서명이 유효하더라도 주소·자산·네트워크·수량이 다르면 업무 진행을 차단합니다.
- 수출 제조는 받은 대금 기록, 게임은 지급 전 등록·요청 스냅샷, 자산운용은 수탁 기록을 대조합니다. 게임의 두 승인과 결과는 실제 송금 실행이 아닙니다.
- 원자료만 서명됩니다. `outputDigest`는 일관성 체크섬이고 발신자의 인증 서명이 아닙니다. `verifyOutput`은 원자료 서명과 시간, 요청 대상, 선택 표시값, 체크섬과 고정 범위 플래그를 다시 검사합니다.
- 출력의 `sourceEnvelope`에는 전체 공개 원자료가 남습니다. 항목 선택은 표시 범위이며 비밀보호나 ZK가 아닙니다.

## 상태 변경 규칙

주소·거래·상황·표시 항목을 바꾸면 기존 결과·승인·출력을 무효화하고 다시 검사합니다. 비동기 검증·파일 읽기·저장 세션 복원은 현재 요청의 revision과 법인·상황을 확인해 오래된 응답을 폐기합니다. 저장 세션의 `passed` 값만으로 완료 상태를 복원하지 않습니다.

URL에 `client`, `view`, `scenario`가 명시되면 저장 세션보다 우선합니다. 예를 들어 `workspace.html?client=export&view=detail&scenario=lookalike`는 서명은 유효하지만 거래 상대 주소가 다른 상황으로 진입합니다.

## 변경 후 확인

`npm test`로 도메인 검증을 실행하고 `npm run build` 후 `npm run check`로 생성 결과와 참조를 확인합니다. 실제 화면에서는 세 법인의 목록→상세→확인→후속 업무, 입력 변경에 따른 무효화, JSON 다운로드와 수신 재검증, 키보드 조작과 좁은 화면을 확인합니다. 기능 테스트만으로 화면·영상·음향의 검수를 대신하지 않습니다.

산업별 활용은 각 산업 100개와 총 300개, 고객·제휴 아님 문구, 출처 링크와 원본/공개 JSON 일치를 확인합니다. 산업 탭·세부 업종·검색·빈 결과·불러오기 실패·재시도·가로 목록의 키보드 및 터치 조작을 점검하고, 실제 공개 페이지에서 SUIT와 대체 글자의 표시·모바일 메뉴·넘침을 확인합니다.

기존 합성 자료의 서명된 값을 직접 편집하면 의도대로 서명 검증이 실패합니다. 공개 저장소에는 샘플 공개키만 있으며 발급용 개인키는 제공하지 않습니다. 새 발급 체계를 도입할 때는 키 관리와 신뢰 근거를 별도로 설계해야 합니다.
