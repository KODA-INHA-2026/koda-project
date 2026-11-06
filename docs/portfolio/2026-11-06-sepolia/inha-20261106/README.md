# 인하테크홀딩스 신규 발급·등록 증거

- 법인: 인하테크홀딩스㈜, 가상 DAT 법인.
- 문서: BTC 잔고 증명서, 가상 100 BTC. 변경본은 120 BTC.
- 사용자 수행: 기존 시험 발급자 MetaMask에서 EIP-712 서명과 등록 거래 승인.
- 거래: `0xb75fdf3acb19b955e451e86cb3c27c2d18f3ed3079f33624a3be71afd16310eb`.
- 등록 블록: `12076051`, 블록 timestamp `2026-11-06T10:44:00Z`.
- 확정 관측: `2026-11-06T11:01:32.346Z`, finalized 높이 `12076070`.
- 실제 결과: `FINALIZED_VERIFIED`, 원본 `match`, 변경본 `file-mismatch`.
- 가스: 245032 × 1500000018 wei = 367548004410576 wei, 0.000367548004410576 Sepolia ETH.

원본 PDF는 공개 거래에서 읽은 문서 ID·발급 기재시각과 현재 `renderCertificate`를 사용해 재생성했다. 전체 바이트 SHA-256이 실제 등록값 `0xba9bca0bd4723155b7084a54a3bb0f41bb235b94bc4ea44fa331bc94f6579f3c`와 일치한다. 사용자 브라우저에서 다운로드 파일을 직접 가져왔다고 주장하지 않는다. JSON은 동일 proof와 기존 고정 계약으로 생성하고 현재 입력 파서로 다시 검사했다.

## 파일

- `inha-original.pdf`: 등록 해시와 일치하는 재생성 원본.
- `inha-altered-120-btc.pdf`: 수량만 변경한 비교 PDF. 기존 원본 서명·JSON과 대조한다.
- `inha-verification.json`: 현행 `koda-document-verification/v1` 규격.
- `reproduction.json`: 재생성 방법·원본/변경본 해시.
- `registration-finalized.json`: 거래·receipt·이벤트·서명·확정 상태·실제 PDF 결과.

발급 기재시각, 등록 블록 시각, 확정을 관측한 시각은 서로 다르다. PDF의 가상 잔고 사실을 체인이 보증하는 것은 아니다. 이번 증거 수집은 공개 페이지의 기본 파일 교체나 03 패키지 재배포를 의미하지 않는다. 기존 한울 증명서와 서명 기록은 별도로 보존한다.

검증 재실행:

```text
node --import tsx scripts/live/capture-registration.ts 0xb75fdf3acb19b955e451e86cb3c27c2d18f3ed3079f33624a3be71afd16310eb docs/portfolio/2026-11-06-sepolia/inha-20261106/inha-original.pdf docs/portfolio/2026-11-06-sepolia/inha-20261106/inha-altered-120-btc.pdf
```

이 명령은 공개 체인을 조회하며 새 서명·거래를 제출하지 않는다. 새 실행의 조회 블록·관측 시각은 바뀔 수 있다.
