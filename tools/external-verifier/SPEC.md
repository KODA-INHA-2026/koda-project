# 외부 검증 규격 v1 — 검토용

입력은 BTC 잔고 증명서 PDF와 `koda-document-verification/v1` JSON입니다. JSON은 `chain(chainId, contract)`과 `proof(documentId, documentHash, issuedAt, signature, transactionHash)`만 허용합니다.

검증 순서는 다음과 같습니다.

1. 파일을 읽기 전에 PDF·JSON 크기를 확인하고 PDF의 `%PDF-` 헤더와 JSON 스키마를 검사합니다. JSON의 체인·계약은 패키지의 고정 신뢰 목록과 대조합니다.
2. 배포 바이트코드, 생성 거래, 고정 발급자를 확인합니다.
3. PDF 전체 바이트의 SHA-256을 계산합니다.
4. EIP-712 `Document(documentId, documentHash, issuedAt)` 서명에서 발급자 주소를 복구합니다.
5. 등록 거래의 `to`, `from`, `register(...)` 입력을 검증정보와 대조합니다.
6. 성공 영수증과 `DocumentRegistered` 이벤트, 정식 포함 블록을 확인합니다.
7. finalized 블록에서 `authorizedIssuer()`와 `records(documentId)`를 읽습니다.
8. 제출 PDF 해시, 서명된 해시, 확정 기록 해시를 대조합니다.

`match`는 세 값이 일치한 경우입니다. `file-mismatch`는 서명과 체인 기록은 유효하지만 제출 PDF의 바이트가 다른 경우입니다. 조회 실패·미등록·확정 대기·신뢰 기준 불일치는 성공으로 처리하지 않습니다.
