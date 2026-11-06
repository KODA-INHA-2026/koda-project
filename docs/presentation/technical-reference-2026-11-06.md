# KODA 증빙 검증 기술 부록 — 구현 명세와 근거

기술 참고용 자료. 확인일: 2026-11-06. 기준 소스: `74ff79940a79657c3f72bdd39aeb41058450bf23`. 현재 데모 기술·동작은 변경하지 않았다.

## 1. 기술 부록 · 구현 명세와 검증 근거

기술 검토용 참고자료. 표준의 보장, 현재 코드의 동작, 미구현 운영 요건을 분리한다.

### 검토 기준

기준 소스: 74ff799 (2026-11-06)

PDF 해시: SHA-256 / Web Crypto
문서 서명: EIP-712 + ECDSA / secp256k1
등록 계약: DocumentRegistry / EVM
컴파일러: Solidity 0.8.28 · optimizer 200 · Cancun
라이브러리: OpenZeppelin 5.6.1 · viem 2.57.14
실제 배포·조회: Sepolia, chainId 11155111

이 부록은 기술을 변경하지 않는다.
표준·규격과 저장소의 실제 구현을 대조한다.

### 검증 명제

제출 PDF의 전체 바이트가
신뢰 기준에 지정한 발급자가
서명·등록한 원본과 일치하는가?

체인 기록은 KODA 내부 DB와
분리된 대조 기준이다.

BTC 실재·법인 신원·RPC 응답의
정당성은 별도의 신뢰 전제다.

**범위·한계:** 기획은 Ethereum 기반이다. 실증은 Sepolia에서 수행했다. KODA 상용 시스템 연동·공식 발급자 인증·Mainnet 운영을 구현했다는 의미는 없다.



**공식 근거**

- [EIP-712, Specification / Security Considerations](https://eips.ethereum.org/EIPS/eip-712)
- [Ethereum, JSON-RPC API](https://ethereum.org/developers/docs/apis/json-rpc/)

**현재 구현**

- [package.json](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/package.json)
- [packages/chain/contracts/DocumentRegistry.sol](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/packages/chain/contracts/DocumentRegistry.sol)
- [apps/web/src/live/verification.ts](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification.ts)

## 2. 데이터 모델 · 자산과 증빙 기록의 분리

자산 보관 체인과 문서 검증 체인은 다른 역할이다. BTC 이동·브리지·래핑은 수행하지 않는다.

### 데이터와 저장 위치

PDF 원문 / 오프체인
  법인명 · BTC 수량 · 잔고 기준시점 · 발급 기재시각
  PDF 전체 바이트 M

서명 메시지 / 오프체인
  D = { documentId: bytes32, documentHash: bytes32,
        issuedAt: uint64 }

Ethereum 계약 저장값
  records[documentId] = { documentHash, issuedAt }
  authorizedIssuer: immutable address

BTC 잔고·고객명은 해시로 간접 결속된다.

### 값의 의미

잔고 기준시점
증명서가 설명하는 잔고의 시점.
PDF에만 기재한다.

issuedAt
발급자가 입력하고 서명한 초 단위 값.
계약은 양수만 검사한다.

등록 블록 timestamp
체인에 포함된 블록의 시각.
위 두 시각의 진실성을 보증하지 않는다.

**범위·한계:** 현재 원천 데이터는 가상값이다. 실제 수탁 원장·Bitcoin UTXO·잔고 증명과 연결돼 있지 않다. 공개 해시는 암호화나 익명성 보장도 아니다.



**공식 근거**

- [EIP-712, Specification / Security Considerations](https://eips.ethereum.org/EIPS/eip-712)
- [Solidity 0.8.28, Mappings and Dynamic Arrays](https://docs.soliditylang.org/en/v0.8.28/internals/layout_in_storage.html)

**현재 구현**

- [apps/web/src/live/certificate.ts](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/certificate.ts)
- [packages/chain/contracts/DocumentRegistry.sol](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/packages/chain/contracts/DocumentRegistry.sol)

## 3. SHA-256 · PDF 바이트의 다이제스트

256-bit 출력, 512-bit 메시지 블록, 32-bit 워드 연산과 64라운드 압축 함수를 사용하는 해시다.

### 계산 정의

```text
H_file = SHA256(M)
M = PDF file bytes (no text extraction)

Padding: M || 1 || 0^k || len64(M)
(len(M) + 1 + k) mod 512 = 448

W[t] = sigma1(W[t-2]) + W[t-7]
     + sigma0(W[t-15]) + W[t-16]
T1 = h + Sigma1(e) + Ch(e,f,g) + K[t] + W[t]
T2 = Sigma0(a) + Maj(a,b,c)
32-bit additions are modulo 2^32.

Output: 32 bytes = 64 hexadecimal characters
```

### 현재 적용

crypto.subtle.digest("SHA-256", bytes)

발급 원본과 수신 PDF에
동일한 함수를 적용한다.
텍스트 추출·PDF 정규화는 없다.

보기에는 같은 PDF도 메타데이터나
인코딩 바이트가 다르면 불일치한다.

PDF 제한: 10 MiB
헤더 검사: %PDF-

**범위·한계:** 해시 일치는 충돌 저항성을 전제로 바이트 동일성을 판단하는 근거다. 중간 변경·복원 이력 전체나 PDF에 적힌 잔고의 사실성을 증명하지 않는다.

FIPS 180-4에서 Ch, Maj, Σ0, Σ1, σ0, σ1을 정의한다. 위 W[t] 식은 t=16..63에 적용한다. 함수 표기를 줄인 것은 알고리즘을 변경한 의미가 아니다. PDF 정규화를 하지 않으므로 detached signature와 원본 전체 바이트를 함께 보존해야 한다.

**공식 근거**

- [NIST FIPS 180-4, §§4.1.2, 5, 6.2](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf)

**현재 구현**

- [apps/web/src/live/verification.ts#L141](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification.ts#L141)
- [apps/web/src/live/verification-file.ts#L60](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification-file.ts#L60)

## 4. EIP-712 · 타입 해시와 도메인 분리

PDF의 SHA-256 값과 별도로, 서명용 구조체·도메인에는 Keccak-256을 적용한다.

### 실제 서명 페이로드

```text
T = "Document(bytes32 documentId," +
    "bytes32 documentHash,uint64 issuedAt)"
typeHash = keccak256(T)
structHash = keccak256(abi.encode(
  typeHash, documentId, documentHash, issuedAt))
digest = keccak256(0x1901 || domainSeparator
                  || structHash)

Domain:
  name: "KodaDocumentRegistryDemo"
  version: "1"
  chainId: 11155111
  verifyingContract: trusted.contract
```

### 검증 조건과 범위

서명 대상은 documentId,
documentHash, issuedAt이다.

고객명·수량은 직접 필드가 아니라
PDF 해시를 통해 결속된다.

체인·계약이 달라지면
서명 다이제스트도 달라진다.

ID 중복 거절은 EIP-712이 아닌
DocumentRegistry의 저장 규칙이다.

**범위·한계:** EIP-712 자체에는 재전송 방지가 없다. 도메인 분리와 동일 ID 재등록 거절을 구분해야 한다. 발급자의 EOA 키가 유출되면 유효한 새 서명이 만들어질 수 있다.



**공식 근거**

- [EIP-712, Specification / Security Considerations](https://eips.ethereum.org/EIPS/eip-712)
- [OpenZeppelin Contracts 5.x, ECDSA / EIP712](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography)

**현재 구현**

- [packages/chain/src/document-registry.ts](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/packages/chain/src/document-registry.ts)
- [packages/chain/contracts/DocumentRegistry.sol#L48](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/packages/chain/contracts/DocumentRegistry.sol#L48)

## 5. ECDSA / secp256k1 · 서명자 주소 복구

유효한 서명은 지정된 키와 메시지의 관계를 증명한다. 주소와 법인 신원의 관계는 별도 신뢰 설정이다.

### 서명 수식과 인코딩

```text
Curve: y^2 = x^3 + 7 (mod p)
p = 2^256 - 2^32 - 977
Q = dG  (private key d, public key Q)

z = EIP-712 digest interpreted as an integer
R = kG
r = x(R) mod n
s = k^(-1) * (z + r*d) mod n

signature = r[32] || s[32] || v[1]
OpenZeppelin: low-s and v in {27,28}
address = last20(keccak256(Q_x || Q_y))
```

### 발급·등록·검증

MetaMask가 메시지 서명을 수행한다.
개인키는 앱에 전달하지 않는다.

계약: ECDSA.recover(digest, signature)
복구 주소 = msg.sender
msg.sender = authorizedIssuer

수신자: recoverTypedDataAddress()
복구 주소 = 사전 지정 발급자

현재 발급자는 EOA다.

**범위·한계:** k의 재사용·노출은 개인키 노출로 이어질 수 있다. 앱은 암호 구현을 직접 작성하지 않는다. ERC-1271 계약 지갑, 키 교체·폐기·복구 정책은 현재 범위 밖이다.

n은 secp256k1 생성점 G의 차수이다. z는 이 프로젝트의 Keccak-256 EIP-712 digest이고, PDF 해시를 ECDSA에 곧바로 넣는 구현이 아니다. 서명 정규성 검사는 온체인 OpenZeppelin 경로를 기준으로 설명한다. 제3자 JS 복구가 같은 low-s 정책을 독립적으로 강제한다고 주장하지 않는다.

**공식 근거**

- [Standards for Efficient Cryptography 1, v2, §4.1](https://www.secg.org/sec1-v2.pdf)
- [Standards for Efficient Cryptography 2, v2, §2.4.1](https://www.secg.org/sec2-v2.pdf)
- [OpenZeppelin Contracts 5.x, ECDSA / EIP712](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography)

**현재 구현**

- [packages/chain/contracts/DocumentRegistry.sol](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/packages/chain/contracts/DocumentRegistry.sol)
- [apps/web/src/live/verification.ts#L217](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification.ts#L217)
- [apps/web/src/live/wallet.ts#L89](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/wallet.ts#L89)

## 6. EVM 호출 · ABI 인코딩과 실행 경계

Solidity 소스는 바이트코드로 컴파일된다. ABI는 호출 데이터를 인코딩·디코딩하는 규약이다.

### 현재 계약의 호출 데이터

```text
register(bytes32,bytes32,uint64,bytes)
selector = 0xf0c9379a

calldata = selector || ABI(arguments)
head: documentId | documentHash | issuedAt | 0x80
tail: signature.length | signature | padding
65-byte signature: 4 + 128 + 32 + 96 = 260 bytes

records(bytes32) selector = 0x01e64725
input: selector || documentId
output: bytes32 documentHash, uint64 issuedAt
return ABI length: 64 bytes
```

### 상태 변경과 조회

register 거래
EVM 실행이 성공하면 상태 저장과
로그 발생. 발신자가 가스를 지불한다.

records 조회
eth_call로 지정 블록 상태에서 실행.
새 거래·서명·온체인 가스 납부 없음.

컴파일: 0.8.28, optimizer 200
EVM target: Cancun

**범위·한계:** read-only eth_call도 노드에서 실행 자원을 사용하며 RPC 요금·한도가 있을 수 있다. uint64는 ABI에서 32바이트로 인코딩되며 저장공간의 자료형 크기와 다르다.

위 selector 및 calldata 길이는 현재 소스의 함수 시그니처와 65바이트 서명을 기준으로 계산한 값이다. calldata의 dynamic offset 0x80은 selector 이후 인수 블록의 시작 기준이다.

**공식 근거**

- [Solidity 0.8.28, Contract ABI Specification](https://docs.soliditylang.org/en/v0.8.28/abi-spec.html)
- [Ethereum, JSON-RPC API](https://ethereum.org/developers/docs/apis/json-rpc/)

**현재 구현**

- [apps/web/src/live/generated/DocumentRegistry.json](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/generated/DocumentRegistry.json)
- [packages/chain/src/document-registry.ts](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/packages/chain/src/document-registry.ts)
- [apps/web/src/live/wallet.ts#L94](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/wallet.ts#L94)

## 7. DocumentRegistry · 저장 구조와 불변조건

문서 ID마다 최초 등록한 해시와 발급 기재시각을 저장한다. 발급자 주소는 배포 시 고정한다.

### 실제 상태·슬롯·불변조건

```text
mapping(bytes32 => DocumentRecord) public records;
struct DocumentRecord {
  bytes32 documentHash;
  uint64 issuedAt;
}
Compiler storage layout: records slot p = 2
q = keccak256(abi.encode(documentId, uint256(2)))
slot q: documentHash; slot q+1: issuedAt (low 8 bytes)

register requires:
 sender = issuer = recovered signer
 ID != 0; hash != 0; issuedAt > 0
 records[ID].documentHash == 0
```

### 이 계약이 강제하는 것

같은 ID 재등록은 AlreadyRegistered.
갱신·삭제·발급자 교체 함수가 없다.
프록시 업그레이드 구조도 없다.

문서 ID는 저장 위치를 찾는 키다.
해시·발급시각을 반환한다.

과거 기록의 덮어쓰기 금지와
기록 내용의 진실성은 별개다.
최초 입력 오류를 수정할 경로는 없다.

**범위·한계:** 불변조건은 이 컨트랙트의 코드와 고정 신뢰 주소에 적용된다. 다른 주소에 새 계약을 배포하는 일까지 막지 않는다. 정정·폐기·키 교체는 운영 설계가 필요하다.

records slot 2는 현재 컴파일 산출물의 실제 storageLayout 값이다. 상속된 OpenZeppelin EIP712의 fallback 문자열 슬롯 0,1 다음에 배치된다. immutable authorizedIssuer는 일반 storage 슬롯에 저장되는 변수가 아니다.

**공식 근거**

- [Solidity 0.8.28, Mappings and Dynamic Arrays](https://docs.soliditylang.org/en/v0.8.28/internals/layout_in_storage.html)
- [Solidity 0.8.28, Contract ABI Specification](https://docs.soliditylang.org/en/v0.8.28/abi-spec.html)

**현재 구현**

- [packages/chain/contracts/DocumentRegistry.sol](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/packages/chain/contracts/DocumentRegistry.sol)
- [apps/web/src/live/generated/DocumentRegistry.json](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/generated/DocumentRegistry.json)

## 8. 등록 증거 · 거래 입력, 영수증, 이벤트, 상태

거래 해시 하나로 성공을 판단하지 않는다. 제출 자료와 연결되는 등록 실행인지 여러 증거를 대조한다.

### 현재 검증 순서

1. getTransaction(txHash)
   to = trusted.contract, from = trusted.issuer
   register 인수의 ID·해시·issuedAt·서명 일치
2. getTransactionReceipt(txHash)
   status = success, from/to 일치
3. getBlock(receipt.blockNumber)
   block.hash = receipt.blockHash
4. DocumentRegistered 이벤트 디코딩
   계약 주소·ID·해시·issuedAt 일치
5. 등록 높이 ≤ 조회한 finalized 높이
6. finalized 높이에서 issuer / records 조회

### 이벤트와 상태의 구분

DocumentRegistered
  topics[0] = 이벤트 시그니처 해시
  topics[1] = indexed documentId
  data = ABI(documentHash, issuedAt)

이벤트: 거래 실행 중 발생한 로그
상태: 계약에 저장된 현재 기준값

거래 실패·무관한 등록·다른 문서의
거래를 정상 등록으로 취급하지 않는다.

**범위·한계:** 이 구현은 RPC 응답 간 정합성을 검사한다. 거래·receipt의 Merkle-Patricia 포함 증명이나 합의 검증기를 직접 실행하는 구현은 아니다.

DocumentRegistered(bytes32,bytes32,uint64)의 topic0는 0x6ff0ae8cb7683b055d1eebe67d788ee55ddc6c87bd826eb7f74c23daa95965c8이다. 파일 수신 파서는 등록 transactionHash를 필수로 요구한다. verifyDocument 자체 타입에서는 optional이므로 이 조건은 수신 파일 경로의 추가 보장이다.

**공식 근거**

- [Ethereum, JSON-RPC API](https://ethereum.org/developers/docs/apis/json-rpc/)
- [Solidity 0.8.28, Contract ABI Specification](https://docs.soliditylang.org/en/v0.8.28/abi-spec.html)

**현재 구현**

- [apps/web/src/live/verification.ts#L252](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification.ts#L252)

## 9. PoS finality · 등록 포함과 확정 상태

거래 제출·블록 포함·최종 확정은 다르다. 현재 검증기는 노드가 보고한 finalized 기준을 사용한다.

### 판정 조건과 시간 모델

```text
F = eth_getBlockByNumber("finalized", false)
R = eth_getTransactionReceipt(txHash)
B = eth_getBlockByNumber(R.blockNumber, false)

require B.hash == R.blockHash
if R.blockNumber > F.number: status = pending

read authorizedIssuer() at blockNumber = F.number
read records(documentId) at blockNumber = F.number

issuedAt       = issuer-supplied uint64
receiptBlockTime = B.timestamp
finalizedBlock = F.number
```

### 합의와 관측의 차이

PoS finality는 검증인 투표와
체크포인트 합의에 기반한다.

앱은 합의를 직접 검증하지 않고
RPC가 제공하는 확정 블록을 읽는다.

발급 기재시각은 체인이 부여하지 않는다.
등록 블록 시각은 별도 값이다.

finalized 높이를 얻었다고
확정된 정확한 벽시계 시각을 아는 것은 아니다.

**범위·한계:** 몇 초 경과 또는 N개 확인만으로 확정을 대신하지 않는다. 단일 RPC에 의존하며 TSA·공인시점 인증을 구현하지 않았다. 정상 합의의 안전성 전제를 둔다.



**공식 근거**

- [Ethereum, Proof-of-stake / Finality](https://ethereum.org/developers/docs/consensus-mechanisms/pos/)
- [Ethereum, JSON-RPC API](https://ethereum.org/developers/docs/apis/json-rpc/)

**현재 구현**

- [apps/web/src/live/verification.ts#L245](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification.ts#L245)

## 10. JSON-RPC · 고정 블록에서 eth_call

viem이 ABI 호출을 JSON-RPC 요청으로 변환한다. 검증에는 발급자 지갑이나 새 거래 승인이 필요 없다.

### records 호출의 wire format

```text
B = hex(finalized.number)
CALLDATA = "0x01e64725" + documentId_without_0x

{
  "jsonrpc": "2.0", "id": 1,
  "method": "eth_call",
  "params": [
    { "to": CONTRACT, "data": CALLDATA },
    B
  ]
}

result: ABI(bytes32 documentHash, uint64 issuedAt)
```

### 현재 연결과 신뢰 전제

단일 공개 Sepolia RPC
ethereum-sepolia-rpc.publicnode.com

chainId도 먼저 대조한다.
issuer와 records는 동일 높이로 조회한다.

숫자 blockNumber로 고정하며
blockHash 기반 EIP-1898은 미사용.

실패·타임아웃은 unavailable.
미확인을 성공으로 바꾸지 않는다.

**범위·한계:** 체인 ID 응답과 여러 RPC 응답이 일관돼도 악성 제공자를 독립적으로 배제하지는 못한다. 자체 노드·다중 제공자·상태 증명 검증은 추가 설계 대상이다.

RPC 예시의 CONTRACT, CALLDATA, B는 런타임 값의 자리표시자다. 실제 JSON에 이 식을 문자 그대로 넣는 것이 아니다. eth_call은 일반적으로 쓰기 코드를 모의 실행할 수도 있으나 여기서는 view getter를 호출한다.

**공식 근거**

- [Ethereum, JSON-RPC API](https://ethereum.org/developers/docs/apis/json-rpc/)

**현재 구현**

- [apps/web/src/live/wallet.ts#L7](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/wallet.ts#L7)
- [apps/web/src/live/verification.ts#L237](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification.ts#L237)

## 11. 검증정보 JSON · 직렬화와 입력 검증

PDF와 분리된 detached verification envelope다. JSON 자체 전체를 서명하거나 온체인에 저장하지 않는다.

### koda-document-verification/v1

```text
{
 "format": "koda-document-verification/v1",
 "chain": {"chainId": 11155111, "contract": "0x..."},
 "proof": {
   "documentId": "0x...",     // 32 bytes, nonzero
   "documentHash": "0x...",   // 32 bytes, nonzero
   "issuedAt": "1793904567",  // decimal uint64 string
   "signature": "0x...",      // 65 bytes
   "transactionHash": "0x..." // 32 bytes, required
 }
}
// 위 주석은 설명용이며 실제 JSON에는 포함하지 않는다.
```

### 파서의 신뢰 경계

JSON 최대 64 KiB
미지원 format·필드·체인 거절
hex 길이·주소·uint64 범위 검사

계약은 고정된 trusted 목록과 대조.
파일이 issuer·RPC·코드를 정하지 못한다.

transactionHash는 서명 필드가 아니다.
해당 거래의 입력·이벤트·상태와
별도로 결속 여부를 검사한다.

**범위·한계:** EIP-712 typed-data를 서명하므로 JSON의 공백·필드 순서 정규화는 필요하지 않다. BTC 수량·법인명은 PDF 해시로 결속되며 JSON만으로 내용을 복구할 수 없다.



**공식 근거**

- [EIP-712, Specification / Security Considerations](https://eips.ethereum.org/EIPS/eip-712)

**현재 구현**

- [apps/web/src/live/verification-file.ts#L4](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification-file.ts#L4)

## 12. 배포 검증 · 코드 일치와 발급자 신뢰

제출 파일 외부에 trust anchor를 둔다. 코드 확인과 KODA 법인 신원 인증을 같은 것으로 취급하지 않는다.

### inspectDeployment()의 실제 검사

신뢰 설정 T = chainId, contract, issuer, deploymentTx

1. chainId와 계약 코드 존재·길이 검사
2. immutableReferences 구간을 0으로 마스킹
   실행 코드와 컴파일 deployedBytecode 대조
3. authorizedIssuer() = T.issuer
4. 배포 receipt 성공 및 contractAddress 대조
5. 배포 tx.input = 생성 바이트코드 + 생성자 인수
6. 배포 블록 hash 및 finalized 범위 대조

immutable 값 검증은 getter·생성자 인수로 보완.
컴파일 산출물과 설정 파일 자체를 신뢰한다.

### 현재 신뢰 주소의 성격

시험용 EOA와 시험 계약을 고정했다.
공식 KODA 키의 인증은 아니다.

배포 검사 일부는 latest 조회다.
문서 검증의 issuer·records 조회만
같은 finalized 높이를 사용한다.

공식 주소 배포·키 교체·폐기·
소프트웨어 배포 무결성 관리는
서비스 운영에서 정해야 한다.

**범위·한계:** 코드 바이트의 일치는 코드의 안전성 감사나 법인 신원의 증명이 아니다. immutable 마스킹만으로 값을 검증했다고 표현하지 않는다.



**공식 근거**

- [OpenZeppelin Contracts 5.x, ECDSA / EIP712](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography)
- [Ethereum, JSON-RPC API](https://ethereum.org/developers/docs/apis/json-rpc/)

**현재 구현**

- [apps/web/src/live/wallet.ts#L42](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/wallet.ts#L42)
- [apps/web/src/live/recorded-evidence.ts#L7](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/recorded-evidence.ts#L7)

## 13. 최종 판정 · 전자서명과 등록 기준의 역할

서명된 파일의 무결성과 같은 문서 ID에 공개 등록된 기준의 일치를 구분한다.

### 02·03 수신 경로의 성공 조건과 반례

```text
S = recover712(D, signature) == trusted.issuer
C = chainId + issuer + transaction/receipt checks
    + canonical block + event + finality checks
R = (record.hash == D.documentHash)
    && (record.issuedAt == D.issuedAt)
F = SHA256(submittedPDF) == D.documentHash

MATCH requires S && C && R && F

PDF alone changed: F=false (signature can detect)
Signed alternate file, same ID: S=true, F=true
Existing original record differs: R=false
=> valid signature alone cannot establish registration
```

### 블록체인 기록이 추가하는 것

여러 수신자가 같은 ID의
최초 등록 기준을 조회한다.
발급기관 DB 수정과 분리된 기록이다.

전자서명만으로도 파일 변경을
탐지할 수 있다.

서명된 대체 문서 비교는
가치를 설명하는 보조 시나리오이며
현재 화면에 구현한 사례는 아니다.

**범위·한계:** 위 반례는 신뢰 발급자가 같은 ID의 다른 내용을 다시 서명한 상황을 가정한다. 현재 데모는 원본·PDF 변경본을 실증했다. 다른 체인·투명성 로그와의 비교도 가능하다.

현재 02·03의 수신 파일 경로는 transactionHash를 필수로 요구한다. verifyDocument() 함수 타입 자체에서는 optional이므로, 이 성공 명제를 임의의 함수 호출 전체에 일반화하지 않는다. 한 번 변경한 PDF를 원래 바이트로 복원하면 다시 일치한다. 따라서 결과는 현재 제출본의 원본 일치이며 모든 유통 이력의 연속 무변경 증명은 아니다. 단순한 중앙 DB에도 최초 등록 거절 규칙을 만들 수 있다. 블록체인의 추가 가치는 규칙 자체의 독점성이 아니라 공통 상태·합의·외부 조회 및 운영 통제 경계에 있다. 이 코드의 invalid 상태는 어떤 검사에서 연결이 실패했는지 trace로 구분한다.

**공식 근거**

- [EIP-712, Specification / Security Considerations](https://eips.ethereum.org/EIPS/eip-712)
- [Solidity 0.8.28, Mappings and Dynamic Arrays](https://docs.soliditylang.org/en/v0.8.28/internals/layout_in_storage.html)

**현재 구현**

- [apps/web/src/live/verification.ts#L217](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/src/live/verification.ts#L217)
- [packages/chain/contracts/DocumentRegistry.sol#L43](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/packages/chain/contracts/DocumentRegistry.sol#L43)

## 14. 두 실행 환경 · 재현성과 검증 범위

같은 알고리즘·계약·신뢰 기준을 재사용한다. 별도 실행 가능성과 독립 보안 검증은 구분한다.

### 실행 경로와 검수 근거

02 브라우저
  PDF + JSON 입력 / 로컬 해시·서명 복구 / RPC 조회
03 Node.js 번들 (Node 22 이상)
  같은 parseVerificationFile / verifyDocument 사용
  node verify.mjs <PDF> <JSON>

CLI 종료 코드: 0 match, 2 file-mismatch, 1 기타
원본: match / 120 BTC 변경본: file-mismatch
입력 거절 6건 / live 회귀 47건 통과 기록

ZIP: 소스·규격·고정 신뢰 설정·의존성 라이선스
03 화면: 보존된 실제 실행 결과, 새 RPC 실행 아님

### 재현의 조건

동일 파일·서명·계약을 사용한다.
조회한 finalized 높이는 실행마다
달라질 수 있으므로 함께 기록한다.

현재 양쪽 모두 같은 공개 RPC에 의존.
코드·배포 설정도 공통 신뢰 전제다.

검증 성공이 독립 코드 감사,
완전한 탈중앙화, 상용 운영 승인을
뜻하지 않는다.

**범위·한계:** 실행 보고서에는 판정·해시·조회 블록·검사 시각을 보존한다. 공식 접근 권한·신뢰 목록 배포·RPC 운영과 새 서명 비교 사례는 미확정 또는 미구현이다.



**공식 근거**

- [Ethereum, JSON-RPC API](https://ethereum.org/developers/docs/apis/json-rpc/)

**현재 구현**

- [tools/external-verifier/verify.ts](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/tools/external-verifier/verify.ts)
- [docs/external-verification/IMPLEMENTATION.md](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/docs/external-verification/IMPLEMENTATION.md)
- [apps/web/public/external-verifier/manifest.json](https://github.com/KODA-INHA-2026/koda-project/blob/74ff79940a79657c3f72bdd39aeb41058450bf23/apps/web/public/external-verifier/manifest.json)
