# PPT 부록 초안 — BTC 잔고 증명서의 Ethereum 검증기록

> 2026-11-06 기준. 이 문서는 발표용 문안 초안이다. `Ethereum`은 기획상 검증정보 기록 체인이고, **Sepolia는 그 설계를 시험한 테스트 네트워크**다. 구조도와 주된 설명은 Ethereum으로 표기하고, 실제 실행 환경과 거래·서명 근거에는 Sepolia임을 구분해 밝힌다. 아래 선정 이유는 이번 기획의 설계 근거이며 KODA의 확정 운영 정책이나 대표님의 직접 발언으로 인용하지 않는다.

## 한 장으로 먼저 말할 내용

법인 고객의 자산 예시는 Bitcoin 네트워크의 네이티브 BTC다. Ethereum에는 BTC나 PDF 원문을 옮기지 않는다. `register(...)`의 입력은 **SHA-256 해시, 문서 ID, 발급 기재시각, 발급자 서명**이고, DocumentRegistry의 저장값은 **문서 ID별 SHA-256 해시와 발급 기재시각**이다. 제3자는 제출받은 PDF를 다시 해시해 공개 기록과 대조한다.

이로써 제3자는 발급기관의 현재 시스템 응답만 기다리지 않고, 합의된 공개 기록을 독립적으로 다시 읽을 수 있다. 다만 이 데모가 증명하는 것은 “특정 발급 원본과 제출 파일의 동일성·등록 출처”이며, 실제 BTC 보유량, KODA의 공식 신원, 모든 변경 이력이나 현재 유효성은 아니다.

---

## 부록 1. 자산과 체인의 역할을 분리한다

**슬라이드 문안**  
`BTC는 증명 대상, Ethereum은 검증 기준을 기록하는 인프라다.`

- 증명 대상: 법인 1곳의 KODA 수탁 **Bitcoin 네트워크 네이티브 BTC** 전체 잔고라는 가상 사례.
- 기록 대상: PDF 전체의 SHA-256 해시와 검증에 필요한 최소 메타데이터.
- 제외: BTC 이전·랩드 BTC 발행·Bitcoin 잔고 온체인 조회·PDF 원문/고객명/잔고의 Ethereum 공개.

**발표자 메모**  
“BTC와 Ethereum을 나란히 놓으면 자산을 Ethereum에 옮긴 것으로 오해할 수 있습니다. BTC는 증명서 안의 자산 예시이고, Ethereum은 증명서를 나중에 대조하기 위한 공개 등록부입니다.”

## 부록 2. 전체 처리 순서

**슬라이드 문안**  
`PDF 확정 → SHA-256 → EIP-712 서명 → register(...) → 블록 확정 → 제3자 재해시·조회·대조`

1. KODA의 기존 업무로 BTC 잔고 증명서 PDF를 발급한다.
2. PDF의 **완전한 바이트열**을 SHA-256으로 해시한다.
3. `(documentId, documentHash, issuedAt)`을 EIP-712 구조화 데이터로 시험 발급자가 서명한다.
4. 권한 있는 발급자만 `register(...)`를 호출해 컨트랙트에 기록한다.
5. 제3자는 제출 PDF의 해시를 계산하고 서명에서 발급자 주소를 로컬 복구한다. 이어 확정된 체인의 허용 발급자·등록 기록을 조회해 신뢰 기준과 세 해시(`Hfile`, `Hsigned`, `Hchain`)를 대조한다.

**발표자 메모**  
PDF의 파일명이나 화면에 보이는 잔고만 비교하지 않는다. 파일 전체 바이트에 대한 해시를 비교한다. 화면이 똑같아도 재저장 등으로 바이트가 달라진 파일은 원본과 다른 것으로 판정될 수 있다. 해시 충돌에 대한 보안 전제는 부록 3에서 구분한다.

## 부록 3. SHA-256: 원본 PDF를 대조 가능한 값으로 만든다

**슬라이드 문안**  
`SHA-256(PDF 전체 바이트) = documentHash. 같은 바이트는 같은 해시를 내고, 서로 다른 바이트가 같은 해시가 되는 충돌은 현재 보안 전제에서 실용적으로 무시한다.`

- NIST SHA-2 계열의 256비트 메시지 다이제스트를 사용한다.
- 해시는 원문을 복원하는 암호화가 아니다. 해시값·문서 ID·발급시각은 공개 데이터로 취급해야 하며, 작은 후보군의 민감정보는 대입 공격으로 추측될 수 있다.
- 따라서 원문 PDF와 고객·잔고 정보는 체인 밖에 두고, 제출 파일은 제3자 브라우저에서 처리한다.

**발표자 메모**  
“해시는 개인정보를 자동으로 익명화하지 않습니다. 이 설계의 프라이버시 선택은 ‘원문을 체인에 올리지 않는다’는 데 있고, 해시와 메타데이터 공개 위험은 별도로 검토해야 합니다. PDF 바이트가 하나라도 달라지면 해시도 달라진다는 충돌 저항성 전제 아래 원본과 다른 제출본으로 판정하며, 이는 수학적으로 절대적인 ‘서로 다른 입력이면 반드시 다른 해시’ 주장은 아닙니다.”

**근거:** [NIST SHA-2 표준](https://csrc.nist.gov/pubs/fips/180-4/upd1/final).

## 부록 4. EIP-712과 ECDSA: 누가 어떤 검증정보를 승인했는가

**슬라이드 문안**  
`서명 메시지 = Document(documentId, documentHash, issuedAt) + domain(chainId, verifyingContract).`

- EIP-712은 사람이 읽을 수 있는 필드 구조와 도메인을 포함해 서명하는 Ethereum 표준이다.
- 도메인의 `chainId`와 `verifyingContract`는 같은 필드가 다른 체인·컨트랙트에서 재사용되는 범위를 분리한다. EIP-712 자체가 모든 재생 공격을 해결하는 것은 아니다.
- 컨트랙트는 OpenZeppelin `EIP712`의 `_hashTypedDataV4`와 `ECDSA.recover`로 서명자 주소를 복구하고, 호출자와 고정 발급자가 일치하는지 확인한다. EVM의 ECDSA는 secp256k1을 사용한다.
- 선정 이유: 이번 Ethereum 지갑의 EIP-712 서명과 컨트랙트·브라우저의 주소 복구를 같은 검증 규칙으로 연결하기 위해 이 조합을 쓴다. 현재 구현에는 Ed25519나 별도의 문서 서명 알고리즘을 추가하지 않았다.

**중요한 구분**  
`SHA-256(PDF)`와 EIP-712 안의 `keccak256`은 같은 값이 아니다. 전자는 파일 동일성 기준, 후자는 Solidity 구조체·도메인을 묶어 서명 검증에 쓰는 Ethereum 해시다.

**근거:** [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [OpenZeppelin EIP712·ECDSA](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography).

## 부록 5. Solidity/EVM 컨트랙트가 강제하는 규칙

**슬라이드 문안**  
`DocumentRegistry: 고정 발급자만 등록 · 0값 거부 · 같은 documentId 재등록 거부 · 서명자 확인.`

- `authorizedIssuer`는 배포 때 설정되는 불변 주소다.
- `records[documentId]`에는 `documentHash`와 `issuedAt`을 저장한다.
- `AlreadyRegistered`는 같은 ID의 덮어쓰기를 막는다. 이는 이번 **컨트랙트 설계 규칙**이며 Ethereum 프로토콜이 모든 애플리케이션에 자동으로 제공하는 기능은 아니다.
- `DocumentRegistered` 이벤트는 거래 영수증에서 등록 사실을 대조하는 보조 증거다.

**발표자 메모**  
현재 구현에는 철회·정정·키 교체·다중승인·업그레이드가 없다. 이것은 데모에서 일부러 확장하지 않은 운영 의사결정 항목이다.

## 부록 6. 저장값·이벤트·거래·영수증은 서로 다르다

**슬라이드 문안**  
`Storage는 현재 기록, calldata는 등록 요청, event/receipt는 실행 증거, block은 포함 위치다.`

| 항목 | 이 데모에서 확인하는 것 |
| --- | --- |
| calldata | `register(documentId, documentHash, issuedAt, signature)`로 제출됐는가 |
| storage | `records(documentId)`의 해시·발급 기재시각이 서명 메시지와 같은가 |
| event/receipt | 실행 성공 영수증에 같은 값의 `DocumentRegistered` 이벤트가 있는가 |
| block/finality | 해당 영수증 블록이 조회한 finalized 범위에 들어오는가 |

**발표자 메모**  
이 네 가지를 한 단어로 “체인에 저장됐다”고 뭉개지 않는다. 각각 검증하는 대상이 다르므로 조회 단계도 구분한다.

## 부록 7. 블록 포함과 finality를 구분한다

**슬라이드 문안**  
`거래가 블록에 포함됨 ≠ 최종 확정. 데모는 등록 블록과 finalized 헤드를 비교한 뒤 판정한다.`

- Ethereum JSON-RPC는 `latest`, `safe`, `finalized` 같은 블록 태그를 지원한다.
- `finalized`는 Ethereum의 PoS 합의에서 확정된 체크포인트에 연결된 상태다. 단순히 최신 블록이나 거래 성공을 뜻하지 않는다. 데모는 합의 투표를 직접 검증하는 노드가 아니라 RPC가 제공하는 확정 상태를 이용한다.
- 데모는 등록 거래 영수증의 블록 번호가 조회한 `finalized` 블록 번호 이하인지 확인하고, 영수증의 블록 해시를 같은 번호의 정식(canonical) 블록 해시와 대조한다.
- 문서 검증 전에 배포 거래·배포 코드·constructor에 고정한 허용 발급자도 확인한다. 이후 서명에서 로컬 복구한 주소, 컨트랙트의 `authorizedIssuer`, 등록 요청의 호출자를 함께 대조한다.
- 그러므로 “몇 초 기다리면 확정”이라고 말하지 않고, 그 시점의 조회 결과로만 판정한다.

**근거:** [Ethereum JSON-RPC의 block parameter와 finalized 태그](https://ethereum.org/developers/docs/apis/json-rpc/), [Ethereum PoS finality](https://ethereum.org/developers/docs/consensus-mechanisms/pos/).

## 부록 8. 제3자의 읽기 전용 검증 경로

**슬라이드 문안**  
`지갑·블록체인 가스비 없이: PDF 로컬 해시 → 서명자 로컬 복구 → finalized 상태의 eth_call → 체인 기록·파일 해시 대조.`

- 제3자는 EIP-712 서명에서 주소를 **브라우저에서 로컬 복구**하고, 체인에서 `authorizedIssuer()`를 읽어 그 주소와 대조한다. 서명자를 체인에서 읽어 오는 것이 아니다.
- 읽기 전용 `eth_call`은 체인 상태를 실행해 읽는 JSON-RPC 요청이고 거래를 만들지 않는다. 데모는 같은 finalized 블록 번호에서 `authorizedIssuer()`와 `records(documentId)`를 읽어 시점 혼합을 줄인다.
- 문서 EIP-712 서명은 지갑으로 승인하지만 블록체인 가스비가 들지 않는다. 가스는 컨트랙트 **배포와 등록 거래**에만 든다. 제3자의 `eth_call`은 블록체인 가스를 내지 않지만 RPC 운영비·호출 제한·단일 노드 의존성은 별도 고려사항이다.

**발표자 메모**  
데모는 **원본 한 건의 등록정보**(시험 문서 ID·서명·등록 거래·신뢰할 발급자와 컨트랙트 주소)를 앱에 미리 로드한다. 원본과 120 BTC 변경본을 같은 기준에 대조하며 변경본을 별도로 등록한 것은 아니다. 임의 PDF의 문서 ID를 자동 탐색하는 서비스는 아니다. 기획상 제3자는 KODA 대시보드의 검증 화면에서 이 흐름을 사용한다. 운영 대시보드와 실제 연동한 것은 아니며, 외부 검증 패키지 배포도 아직 구현하지 않았다.

**근거:** [Ethereum JSON-RPC와 eth_call](https://ethereum.org/developers/docs/apis/json-rpc/). 사전 로드 범위는 로컬 구현 `recorded-evidence.ts` 기준이다.

## 부록 9. 왜 중앙 DB나 서명만으로 끝내지 않는가

**슬라이드 문안**  
`디지털서명만으로도 출처·원본 대조는 가능하다. Ethereum은 공개된 확정 등록 기준과 재조회 경로를 추가한다.`

| 방식 | 제3자 대조의 전제 |
| --- | --- |
| 발급기관 DB | 발급기관 API/DB가 그 시점에 제공하는 응답과 권한 체계 |
| 서명 패키지 | 신뢰할 발급자 공개키와 원본 서명 패키지의 전달·보관 |
| 이번 Ethereum 등록 | 정해진 컨트랙트·발급자 기준의 공개 상태를 제3자가 다시 읽고, 동일 ID의 덮어쓰기 거부를 확인 |

**발표자 메모**  
블록체인이 서명을 대체하거나 BTC 보유 사실을 자동 보증한다는 주장은 하지 않는다. 가치 제안은 ‘공통의 조회 가능한 등록 기준’이다.

## 부록 10. 왜 기획은 Ethereum L1이고 실증은 Sepolia인가

**슬라이드 문안**  
`기획 체인: Ethereum L1 / 실증 환경: Ethereum Sepolia 테스트넷.`

- **업무 목적:** KODA의 현재 서버 응답에만 의존하지 않고 여러 제3자가 동일한 발급 기준을 조회할 수 있어야 한다. 고객 자산이 어느 체인에 있느냐와 별개로 문서 검증정보를 기록할 공통 인프라가 필요하다.
- **기술과 선정 이유:** Ethereum의 EVM 스마트컨트랙트로 허용 발급자·서명 확인·동일 ID 재등록 금지를 공개된 코드에 넣고, 제3자는 JSON-RPC로 그 계약의 확정 상태를 조회한다. 별도 허가형 체인의 검증자 집합을 우리가 운영하는 대신 공개 Ethereum 합의를 등록 기준의 기반으로 쓰는 설계다.
- **L1을 기획 기준으로 삼은 이유:** 등록 기록을 Ethereum L1 상태에 직접 두고 그 `finalized` 상태를 검증 기준으로 삼는다. 별도 L2의 시퀀서·업그레이드 권한·정산 절차에 따른 추가 신뢰 가정을 운영 모델에 넣지 않는다는 선택이다. 이는 실제 서비스의 신뢰 구조에 관한 설계 판단이며, 발표를 쉽게 하거나 테스트 ETH를 무료로 얻기 위한 이유가 아니다.
- EVM·EIP-712은 L2에서도 사용할 수 있다. 해당 기술만으로 Ethereum L1이 유일한 선택이라고 결론 내릴 수 없고, 위 신뢰 구조와 비용을 함께 판단해야 한다.
- Sepolia는 메인넷 ETH 대신 테스트 ETH를 쓰는 별도 시험 네트워크다. 이번에는 같은 계열의 기술로 배포·서명·등록·조회를 실행해 구현을 검증했다. **운영 기록을 Sepolia에 두겠다는 제안이 아니다.**
- L1은 등록 가스비와 처리량의 비용이 있고, L2는 보통 비용을 낮추지만 운영·정산·데이터 가용성 등 설계 전제를 함께 검토해야 한다. 상용 배포의 비용·처리량·키 거버넌스·보존 기간은 아직 운영 준비 항목이다.

**근거:** [Ethereum PoS finality](https://ethereum.org/developers/docs/consensus-mechanisms/pos/), [Ethereum scaling과 rollup](https://ethereum.org/roadmap/scaling/).

기술의 일반 성질과 이번 프로젝트의 선정 판단을 구분한다. 실제 예상 발급량·가스 예산·서비스 수준을 아직 산정하지 않았으므로 비용 적합성 검증을 마쳤다고 주장하지 않는다.

## 부록 11. 시간의 의미를 섞지 않는다

**슬라이드 문안**  
`잔고 기준시점(as-of) · 발급 기재시각(issuedAt) · 체인 포함 시각은 서로 다른 값이다.`

- `as-of`: 증명서가 말하는 잔고 측정 기준시점. PDF 안의 업무 데이터다.
- `issuedAt`: 발급자가 EIP-712 메시지에 넣어 서명한 기재시각. 컨트랙트는 이 값을 저장하지만 그 시각 자체의 외부 사실성을 판정하지 않는다.
- 블록 시각/포함 시각: 등록 거래가 블록에 포함된 시점이다. 발급 시각이나 잔고 기준시점을 대신하지 않는다.

## 부록 12. 보장 범위와 운영 전 공백

**슬라이드 문안**  
`검증되는 것: 시험 발급자 서명, 고정 컨트랙트의 확정 기록, 제출 PDF 바이트 일치 여부.`

- 검증하지 않는 것: 실제 BTC 잔고·수탁 사실, KODA 공식 법인/키 신원, PDF가 거친 모든 변경 이력, 철회·정정 상태, 현재의 법적·회계적 유효성. 화면의 ‘원본 일치’와 ‘제출본 차이 없음/있음’은 동일한 파일 바이트 대조를 두 방식으로 표현한 것이지, 모든 중간 변경 이력을 증명하는 별도 검사가 아니다.
- 남는 신뢰 가정: 신뢰할 컨트랙트 주소와 발급자 키를 어떤 절차로 공표·교체·폐기할지, 어떤 RPC/다중 조회 정책을 운영할지. 원본 PDF는 고객사가 보관·제출하는 것으로 확정되어 있으며, KODA의 추가 사본 보관 여부·보관 기간·운영 접근 정책은 미정이다.
- 다음 설계 과제: 키 회전·철회/정정 모델, 다중승인, 계약 감사, RPC 다중화/독립 노드, 개인정보·보존·규제 검토, 외부 재현 패키지의 규격화.

---

## 예상 질문과 짧은 답

**Q. 해시만 올리면 개인정보 문제는 끝나나?**  
A. 아니다. 원문은 올리지 않지만, 해시와 연결 메타데이터의 재식별·대입 가능성은 데이터 특성에 따라 검토해야 한다.

**Q. Sepolia 거래가 있으니 실제 운영 서비스가 된 것 아닌가?**  
A. 아니다. 기획 체인은 Ethereum L1으로 정했고, Sepolia는 테스트넷 실증이다. 상용 배포 주소·키 거버넌스·감사·수탁 업무 연동과 운영 정책은 아직 준비되지 않았다.

**Q. 컨트랙트가 BTC 잔고를 증명하나?**  
A. 아니다. 컨트랙트는 서명된 PDF 해시와 발급 기재시각의 등록만 검증한다.

**Q. 발급자가 잘못된 PDF를 발급하면 막을 수 있나?**  
A. 막지 못한다. 이 기술은 등록된 원본과 같은지·누가 등록했는지를 검증한다. 기초 잔고 산정의 정확성은 수탁·회계 통제의 영역이다.

**Q. 블록체인이 없으면 검증 자체가 불가능한가?**  
A. 아니다. 신뢰할 공개키와 서명 패키지가 있으면 서명 검증은 가능하다. 블록체인은 발급기관 외부에서도 읽을 수 있는 확정 등록 기준을 추가한다.

**Q. 등록 거래에도 서명이 있는데 왜 EIP-712 문서 서명을 따로 하나?**  
A. 등록 호출자 제한만으로도 누가 등록할 수 있는지는 통제할 수 있다. 별도 EIP-712 서명은 발급자가 승인한 문서 ID·해시·발급 기재시각을 하나의 구조화 메시지로 확인하기 위한 추가 근거다. 제3자가 등록 거래와 구분해 메시지의 서명자를 복구할 수 있으며, Ethereum 등록에 반드시 필요한 별도 절차라고 주장하지 않는다. 외부 검증 패키지로 전달하는 기능은 후속 범위다.

## 근거 및 버전 주석

- [NIST FIPS 180-4 Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) — SHA-2 다이제스트가 메시지 변경 탐지에 쓰인다는 근거. 2015 최종판이며 NIST는 2023년 개정 계획을 공지했다.
- [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712) — 구조화 데이터, domain separator, `chainId`, `verifyingContract`, typed-data 서명의 범위 및 재생 공격 한계. Final 표준.
- [OpenZeppelin Contracts 5.x Cryptography](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography) — `EIP712._hashTypedDataV4`, `ECDSA`, EVM secp256k1 설명. 이 구현은 OpenZeppelin Contracts 5.x API를 사용한다.
- [ethereum.org JSON-RPC API](https://ethereum.org/developers/docs/apis/json-rpc/) — `eth_call`의 상태 조회와 `finalized` 블록 태그의 의미.
- [ethereum.org Smart contracts](https://ethereum.org/developers/docs/smart-contracts/) — Ethereum 스마트컨트랙트/EVM의 일반 설명.
- [ethereum.org Proof-of-stake finality](https://ethereum.org/developers/docs/consensus-mechanisms/pos/) — Ethereum PoS finalized 상태의 암호경제적 의미와 한계.
- [ethereum.org Scaling Ethereum](https://ethereum.org/roadmap/scaling/) — rollup/L2의 배치 처리·비용 절감과 중앙화 구성요소에 관한 설명. L1·L2 비교의 일반 근거이며, 이 문서가 특정 L2 채택을 권고하는 것은 아니다.

로컬 구현 근거: `packages/chain/contracts/DocumentRegistry.sol`, `packages/chain/src/document-registry.ts`, `apps/web/src/live/verification.ts`, `certificate.ts`, `wallet.ts`, `recorded-evidence.ts`. 외부 근거 확인일은 2026-11-06이다.
