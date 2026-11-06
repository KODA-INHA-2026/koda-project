# 기술 기준과 두 검증 환경 — 2026-11-06

02 대시보드와 03 외부 실행 초안은 같은 검증 로직을 사용한다. 이번 변경은 사용 환경과 전달 방식의 확장이며, 서명 알고리즘·문서 해시·컨트랙트·판정 규칙을 바꾸지 않는다.

| 항목 | 현재 기준 | 구현 위치 |
| --- | --- | --- |
| 증명 대상 | Bitcoin 네트워크의 네이티브 BTC를 기재한 가상 잔고 증명서 | certificate.ts |
| 기록 체인 | 기획은 Ethereum 기반, 실제 실행은 Sepolia 11155111 | recorded-evidence.ts / wallet.ts |
| PDF 지문 | 전체 파일 바이트의 SHA-256, 32바이트 | verification.ts |
| 서명할 구조 | EIP-712 Document(documentId, documentHash, issuedAt), 체인·계약에 결합 | packages/chain/src/document-registry.ts |
| 문서 발급서명 | ECDSA/secp256k1, 서명자 주소 복구 | OpenZeppelin / viem |
| 등록 계약 | Solidity 0.8.28, DocumentRegistry, OpenZeppelin 5.6.1 | packages/chain/contracts/DocumentRegistry.sol |
| 등록 규칙 | 고정 발급자·요청자·서명자 확인, 같은 ID 재등록 거절, 덮어쓰기·삭제·업그레이드 없음 | DocumentRegistry |
| 검증 입력 | PDF + koda-document-verification/v1 JSON, 등록 거래 해시 필수 | verification-file.ts |
| 신뢰 기준 | 공개한 시험 발급자·계약·배포 거래·배포 코드, 제출 JSON과 분리 | recorded-evidence.ts / inspectDeployment |
| 조회와 판정 | viem 2.57.14, JSON-RPC, 거래 입력·receipt·event·정식 블록·finalized·records 대조 | verification.ts |
| 02 | KODA 대시보드 적용안, 브라우저에서 실제 검증 | VerificationExperience.tsx |
| 03 | 공개 규격·소스·별도 Node.js 실행 번들, 실제 실행 결과를 보여주는 검토용 초안 | tools/external-verifier / ExternalVerification.tsx |

Ethereum 상용 운영과 KODA 공식 발급자 인증은 확정·구현했다고 주장하지 않는다. 제3자의 계정 발급·접근 권한, 공식 신뢰 목록 배포, 키 교체·폐기, RPC 운영 정책은 KODA 피드백을 받을 부분이다.

## 화면 제안과 근거

실제 제공된 대시보드 이미지의 조직 식별, 흰 좌측 메뉴, 감사/메시지 서명 검증 문맥, 회색 본문을 참고했다. 새 ‘증빙 문서 검증’은 제안 기능으로 표시한다. 외부 수신자가 고객 자산 화면이나 결재 기능을 사용할 수 있다고 가정하지 않는다.

현재 평가가 좋았던 PDF 입력 → 검증 버튼 → Ethereum 조회·응답 → PDF 대조 → 세 질문의 결과를 유지한다. 03은 화면상 버튼으로 별도 컴퓨터의 실행을 한 것처럼 꾸미지 않고, 실제 Node.js 실행 기록과 사용자가 직접 실행할 자료를 제공한다. 두 환경에서 같은 기준을 재현한다는 뜻이며 독립 기관의 보안 감사를 의미하지 않는다.

## 기술 어펜딕스

최신 부록은 피칭 설명이 아닌 기술 참고용이다. [기술 명세 원고](technical-reference-2026-11-06.md)에 각 장의 공식 문헌, 코드의 고정 커밋 링크와 추가 설명을 보존한다.

16장: 기술 기준, 데이터 모델, SHA-256, EIP-712, ECDSA/secp256k1, EVM/ABI, DocumentRegistry 저장 구조, 거래·영수증·이벤트, finality, JSON-RPC/eth_call, 검증 JSON 파서, 배포 검증·발급자 신뢰, 최종 판정 조건, 두 실행 환경의 재현성, viem Public/Wallet Client 분리, 실행 비용과 거래·조회 구분.

계산식·서명 페이로드·호출 데이터·실제 저장 슬롯·검증 순서·신뢰 전제와 미구현 항목을 명시한다. 15장은 `verifyDocument → readContract → ABI → eth_call` 경로와 client 권한을, 16장은 오프체인 서명·등록 거래·가스·조회 비용을 분리한다. 구조도의 회색·녹색/민트 색상을 유지하되 기술 명세를 읽을 수 있는 배치로 바꿨다. 기술이나 현재 데모 동작은 변경하지 않았다.

저장된 슬라이드 Page ID: `page_e2ea284cc66c81918bfacd219cb82695`. 최신 편집 원고는 `technical-reference-slides.mjs`, 이전 설명용 원고는 `technology-slides.mjs`다.

## 피칭에서 실제 체인을 보여주는 방법 — 의견

본 발표에서는 이미 승인한 실제 배포·등록 거래를 근거로 짧게 제시하고, 핵심 장면에서 등록 기록을 새로 조회하는 방식이 적합하다. 발급 준비 화면에 있는 실제 거래 링크와 컨트랙트 주소를 활용할 수 있다. 필요한 경우 등록된 문서 ID·해시와 블록 포함을 확인하는 15~20초 구간을 따로 준비한다.

무대에서 지갑 연결→서명→등록→finality 대기를 모두 요구하면 승인과 네트워크 대기 때문에 흐름이 끊길 수 있다. 새 거래 시연은 사전 녹화나 질의응답용 선택 장면으로 두는 편이 좋다. 녹화·보존된 기록과 현재 실시간 조회는 명확하게 표시한다. 이번 작업에서는 새 배포·서명·거래를 실행하지 않았다.

## 기술 근거

- [SHA-256 / NIST FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [OpenZeppelin Cryptography](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography)
- [Ethereum 스마트컨트랙트](https://ethereum.org/developers/docs/smart-contracts/)
- [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)
- [Ethereum PoS](https://ethereum.org/developers/docs/consensus-mechanisms/pos/)
- [Ethereum 네트워크](https://ethereum.org/developers/docs/networks/)
