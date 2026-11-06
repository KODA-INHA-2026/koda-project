# 03 외부 검증 경로 — 구현 기록

## 목적

KODA 대시보드에서 실행하는 검증과 같은 입력·규칙을 별도 Node.js 환경에서도 재현할 수 있는지 확인한다. 이 경로는 KODA 피드백을 받기 위한 기술 초안이며 공식 제품이나 운영 배포가 아니다.

## 구성

- 입력: 고객사가 전달한 BTC 잔고 증명서 PDF와 `koda-document-verification/v1` JSON
- 실행: `node verify.mjs <증명서.pdf> <검증정보.json>`
- 신뢰 기준: 패키지에 고정된 Sepolia 체인·DocumentRegistry·시험 발급자·배포 거래
- 조회: 공개 Sepolia JSON-RPC
- 출력: 판정, 세 해시, 블록 번호, 처리 trace가 포함된 JSON 보고서

검증기는 대시보드와 같은 `verifyDocument`, `parseVerificationFile`, `inspectDeployment` 구현에서 빌드한다. 제출 JSON은 신뢰할 발급자·컨트랙트·RPC를 지정하지 못한다.

파일 크기는 전체 내용을 메모리에 읽기 전에 확인하며, PDF `%PDF-` 헤더와 JSON의 필수 등록 거래 해시도 체인 조회 전에 검사한다. 잘못된 실행 인자, 임의 계약·발급자 필드, 용량 초과 JSON, PDF가 아닌 파일에 대한 자동 회귀 검사를 패키지에 함께 둔다. 실행 번들의 실제 의존성 목록은 esbuild metafile에서 산출하고 각 패키지의 원문 라이선스를 ZIP에 포함한다.

## 실제 관측

기본 자료를 인하테크홀딩스㈜로 교체한 2026-11-06 20:12 KST 실행에서 등록 거래 포함 블록은 `12076051`, 조회 finalized 높이는 `12076101`이었다. 기존 한울 자료(등록 블록 `12071362`)는 포트폴리오 증거에 보존한다.

- 발급 원본: PDF 해시 = 서명된 해시 = 체인 해시, `match`
- 120 BTC 변경본: 서명된 해시 = 체인 해시이나 제출 PDF 해시만 다름, `file-mismatch`

정확한 실행시각·finalized 블록·전체 trace는 `apps/web/public/external-verifier/original-report.json`, `altered-report.json`, `manifest.json`에 보존한다.

## 남은 운영 과제

실제 독립 검증 서비스에는 KODA가 신뢰 목록과 검증기 버전을 어떤 서명·배포 경로로 공표할지, 발급자 키 교체·폐기 시점을 어떻게 반영할지, RPC를 복수화하거나 자체 노드로 검증할지 정해야 한다. 이 초안은 그 결정을 완료했다고 주장하지 않는다.
