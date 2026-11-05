# BTC 증명서의 실제 Sepolia 등록·조회

이 구현은 새 기획서 4.4의 기술 구성을 실증하는 로컬 실행 페이지다. KODA의 PDF 발급에서 검증정보 생성·등록, 고객사 보관·제출, 제3자의 로컬 연산·공개 체인 조회·대조까지 하나의 기술 흐름으로 구성한다. 제3자에게만 서비스 UI를 제공하고, 그 UI에서 검증을 실행할 때 발생하는 연산과 RPC 응답도 함께 표시한다. 기존 데모의 AnchorRegistry·Ed25519·mock 판정을 사용하지 않는다.

## 기존 실증을 바로 보기

`http://127.0.0.1:5190/live.html`에서 **기록 재생** 또는 **직접 검증하기**를 누른다. 시작은 자동 재생이 아니며 이전·다음 장면과 단계 이름으로 이동할 수 있다. 실제 조회는 **공개 체인에서 대조하기**를 눌러 실행한다. 100 BTC 원본과 120 BTC 변경본을 번갈아 선택해 원본 일치와 파일 불일치를 확인할 수 있다.

첫 화면은 KODA가 BTC 잔고 증명서를 발급하는 기존 업무와 우리가 추가한 검증 경로를 연결한다. BTC는 문서의 고객 자산 예시이고, Ethereum은 등록과 조회의 공통 인프라다. Toss 공개 자료를 정보의 읽기 순서와 원인·결과 표현에 적용하되, 기술명·입력·처리·출력을 가리지 않는다. 색은 KODA 초록·민트를 유지했다. [전체 기술 장면 기준](design/technical-storyboard.md), [디자인 기준](../DESIGN.md), [리서치 메모](design/toss-research.md)에 근거를 남긴다.

기본 공개 실증은 코드에 고정된 계약·발급자·거래를 기준으로 한다. 해당 PDF는 등록 당시 정보와 생성기로 재현하고 전체 SHA-256 일치를 먼저 확인한다. 현재 체인 상태는 검증 때 다시 읽는다. 새로 발급한 문서는 PDF·proof·그 문서의 배포 설정을 함께 저장하며, 발표자 도구에서 다시 불러올 수 있다.

## 실행

```powershell
npm ci
npm run live:test
npm run live:dev
```

MetaMask가 설치된 브라우저에서 `http://127.0.0.1:5190/live.html`을 연다. 저장소 권장 Node/npm 버전은 루트 package.json을 따른다. 로컬에 다른 Node 버전이 있으면 저장소 권장 런타임으로 맞춘다. 새 컨트랙트는 `npm run live:compile`, 배포용 페이지는 `npm run live:build`로 생성한다.

1. **공개 RPC 연결 점검**으로 Sepolia 체인 ID와 finalized 블록 조회를 확인한다.
2. MetaMask에서 별도 시험 계정과 **Ethereum Sepolia**를 선택한 뒤 **MetaMask 연결**을 누른다. 개인키·복구 문구를 코드나 입력창에 넣지 않는다.
3. **Sepolia 컨트랙트 배포**를 눌러 MetaMask에 표시된 배포 요청을 직접 승인한다. ETH 전송액은 0이고 Sepolia ETH 가스가 필요하다. 주소가 고정된 발급자 인자로 들어간다.
4. 배포 거래는 즉시 링크로 표시된다. 대기 중에는 12초마다 배포 블록과 finalized 블록을 자동 조회한다. 필요하면 **배포 결과 다시 조회**를 누른다. 네트워크 상황에 따라 확정까지 여러 분이 걸릴 수 있다. 코드·생성 거래·발급자·확정 블록을 확인한 후 발급이 활성화된다. 이는 이 데모가 선택한 기준이며 Ethereum이 모든 계약 호출 전에 최종 확정을 강제하는 것은 아니다. 사이트에 이미 허용한 지갑 연결은 새로고침 후 읽기 전용으로 복원한다.
5. 발표자 도구의 **인하테크홀딩스 증명서 발급·등록**을 누른다. MetaMask 요청은 **EIP-712 문서 서명 1회**와 **컨트랙트 등록 거래 승인 1회**다. 거절하면 성공으로 처리하지 않는다. 문서 서명 뒤 등록 승인을 거절했다면 **서명한 문서 등록 재시도**로 같은 문서를 사용한다. 이미 배포된 계약을 그대로 사용할 때는 재배포하지 않는다.
6. **직접 검증하기**로 제3자 화면을 연 뒤 **공개 체인에서 대조하기**로 실제 기록을 읽는다. 등록이 포함됐지만 확정되지 않았으면 `최종 확정을 기다리고 있어요`다. 시간이 지난 후 다시 조회한다. 조회에는 지갑과 가스가 필요 없다.
7. **내용이 다른 파일 120 BTC**를 선택한 뒤 다시 조회한다. 파일 해시는 달라지지만 발급서명과 체인 기록은 원본의 해시를 유지한다.

지갑 팝업에서 배포·서명·거래 승인은 사용자가 직접 한다. 2026-11-06 사용자가 Sepolia 배포를 승인했으며 실제 주소·거래·상태는 [실행 기록](portfolio/2026-11-06-sepolia/DEPLOYMENT.md)에 보존한다. 배포, 문서 등록, 제3자 검증은 각각 완료 증거를 구분한다.

## 1차 피드백 공유

[공유용 데모](https://koda-inha-2026.github.io/koda-project/sepolia-20261106/)에서 기존 실증 기록을 재생하고, 지갑 없이 원본·변경본을 실제 Sepolia와 대조할 수 있다. [배포와 재현 기록](portfolio/2026-11-06-sepolia/PUBLICATION.md)을 함께 보존한다.

## 어떤 기술이 어디에 쓰이는가

| 처리 | 실제 구현 | 확인할 결과 |
| --- | --- | --- |
| 가상 원본 확정 | 한글 PDF 생성기 | 100 BTC / 기준시점과 발급시각을 구분한 최종 파일 |
| 문서 지문 | 브라우저 Web Crypto SHA-256 | PDF 전체 바이트의 bytes32 해시 |
| 발급서명 | MetaMask + viem EIP-712 / ECDSA secp256k1 | Document 타입의 ID·해시·발급시각 서명 |
| 등록 규칙 | Solidity 0.8.28 + OpenZeppelin 5.6.1 EIP712·ECDSA | 서명 복원 주소 = 요청자 = 고정 발급자, ID 최초 등록 |
| 원장 기록 | Ethereum Sepolia에 실제 등록 트랜잭션 | 거래 해시, 영수증, 이벤트, 블록 |
| 외부 조회 | viem public client → PublicNode JSON-RPC | 거래·블록을 확인하고 하나의 finalized 블록 번호에서 authorizedIssuer·records 대조 |
| 제3자 판정 | 파일 해시 + 서명자 + 확정된 동일 발급 건 결합 확인 | 원본 일치 / 불일치 / 미등록 / 대기 / 조회 불가 구분 |

고객의 자산은 Bitcoin 네트워크의 네이티브 BTC라는 가정이다. Ethereum에 BTC를 옮기거나 BTC를 발행하지 않는다. 실제 BTC 매수·수탁·온체인 잔고 조회도 이 실증에서 하지 않는다.

## 컨트랙트와 기록

`packages/chain/contracts/DocumentRegistry.sol`:

```solidity
mapping(bytes32 documentId => DocumentRecord record) public records;
struct DocumentRecord { bytes32 documentHash; uint64 issuedAt; }
register(bytes32 documentId, bytes32 documentHash, uint64 issuedAt, bytes signature);
```

EIP-712 domain은 `KodaDocumentRegistryDemo`, 버전 `1`, 실제 chainId와 verifyingContract다. Document 타입은 `documentId:bytes32`, `documentHash:bytes32`, `issuedAt:uint64`로 고정했다. `issuedAt`은 발급자가 기재·서명한 시각이며 체인이 그 시각 자체를 인증하지 않는다. 기록의 블록 시간은 별도다.

동일 ID의 덮어쓰기·삭제·발급자 교체·업그레이드 기능은 없다. 고객명·BTC 수량·지갑 주소·PDF 원문은 체인 필드에 넣지 않는다. ID·해시·발급 기재시각과 발급서명은 공개 거래 입력에 남고, 발급자·거래·블록 정보도 공개된다.

시험 발급자 주소는 직접 배포한 설정에서 고정하며 제출 PDF에서 가져오지 않는다. 브라우저는 배포 생성 코드·생성 인자·런타임 코드·허용 발급자·정식 블록·최종 확정을 검사한다. 사용자 키로 KODA 공식 발급자임을 증명하는 것은 아니다.

## 범위와 남은 작업

- 새 가상 PDF와 검증정보·배포 설정은 같은 브라우저의 IndexedDB에 함께 저장한다. 발급용 배포 설정과 대기 거래 해시는 localStorage에 저장한다. 공개 실증 재생은 코드에 고정된 별도 신뢰 기준을 사용하므로 두 저장소의 값이 섞이지 않는다. 새 문서의 브라우저 데이터 삭제 시 복구가 필요하다. 별도 외부 JSON 재현 패키지 배포는 아직 구현 범위가 아니다.
- 제3자 화면은 지갑 없이 RPC로 검증하지만, 실제로 고객사가 다른 사람에게 패키지를 전달하는 연동은 아직 만들지 않았다. 한 브라우저에서 역할을 전환하는 실증이다.
- 키 교체·철회·정정·운영 권한·실제 KODA 연동·보존 정책은 구현하지 않았다.
- PublicNode는 데모용 공개 RPC다. 장애·제한·CORS 문제를 조회 실패로 표시하며 조용히 mock이나 latest 상태로 바꾸지 않는다. 상용 SLA를 보장하지 않는다.
- 이미 등록한 한울테크홀딩스㈜ 문서는 역사적 증거로 보존한다. 다음 인하테크홀딩스㈜ 문서는 새 서명·등록 승인이 필요하다. 과거 기록 재생과 실제 새 거래를 동일한 실행으로 표현하지 않는다.

근거: [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [OpenZeppelin 암호 기능](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography), [MetaMask 구조화 서명](https://docs.metamask.io/metamask-connect/evm/guides/sign-data/), [Ethereum finalized 조회](https://ethereum.org/developers/docs/apis/json-rpc/), [PublicNode](https://ethereum.publicnode.com/).
