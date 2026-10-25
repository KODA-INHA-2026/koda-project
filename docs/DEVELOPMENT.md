# 웹 개발 안내

앱은 정적 HTML/CSS/JavaScript로 구성됩니다. `npm run build`로 공유 토큰·문구·모션을 생성하고 `npm run dev`로 실행합니다. `landing/dist`가 웹 루트입니다. 서버는 로컬 파일만 제공하며 금융 데이터·계정·지갑을 연결하지 않습니다.

현재 UI는 v11이며 홈을 브랜드 이미지 → KODA 기능 → 세 기업의 실무 흐름 순서로 구성합니다. 원자료·전체 주소 대조와 법인 업무의 요청·결과 배치, 받은 자료 수신 화면을 제공합니다. 홈의 자료 전환은 `landing/dist/home-folio.js`, 브랜드 첫 화면의 스타일은 `landing/dist/brand-v11.css`가 담당합니다. 기존 `assurance-core.js`의 서명·주소·거래 검증과 업무 진행 조건을 유지합니다. 공개 영상은 v7의 단일 30초 파일을 그대로 사용합니다.

브랜드 제목은 자체 호스팅 IBM Plex Sans KR Regular 400·Medium 500·SemiBold 600을 사용하며, 한국어 본문·업무 UI의 Pretendard Variable과 정확한 식별자의 IBM Plex Mono는 유지합니다. 글꼴 파일과 OFL 고지를 함께 전달하고 크기·행간·weight는 공유 토큰과 스타일에서 조정합니다.

## 데이터와 화면

`assurance-core.js`가 검증 결과의 기준입니다. 화면의 선택 상태나 색상으로 통과 판정을 만들지 않습니다. `blueprint.js`는 업무 상태, `assurance-ui.js`는 입력·검사 항목 표시, `app.js`는 수신 파일 검사를 담당합니다. 고객·주소·거래 자료는 모두 공개 합성 예시입니다.

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

기존 합성 자료의 서명된 값을 직접 편집하면 의도대로 서명 검증이 실패합니다. 공개 저장소에는 샘플 공개키만 있으며 발급용 개인키는 제공하지 않습니다. 새 발급 체계를 도입할 때는 키 관리와 신뢰 근거를 별도로 설계해야 합니다.
