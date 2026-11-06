# 5단계 발표 데모 검수 결과

검수일: 2026-11-07

## 결론

- 01 원본 발급 → 02 전자서명·해시 생성 → 03 블록체인 기록 → 04 제3자 대조·검증의 순서와 직접 링크가 동작한다. 별도 검증 환경을 보여주는 05 외부 검증 초안으로도 이동할 수 있다.
- 03에서 내려받은 실제 PDF·검증정보 JSON을 04에서 불러오고, 공개 Sepolia RPC로 등록 기록을 조회해 원본 일치와 변경본 불일치를 판정했다.
- 사용자 승인으로 만든 재서명 비교 자료는 PDF·발급서명 검사를 통과하지만, 같은 문서 ID의 등록 원본 해시와 달라 실패한다.
- 다섯 장면을 모두 이동한 뒤에도 선택한 파일과 완료된 비교 결과가 유지된다.
- 05의 별도 실행 환경은 저장된 실제 검증 결과를 보여주며, 검증 도구 ZIP을 내려받을 수 있다.

## 자동 검증

- `npm run live:test`: 56개 통과, 실패 0개.
- `scripts/live/check-presentation.mjs`: 실제 파일 전달, 원본/변경본 판정, RPC 조회·응답 연출, RPC 오류, reduced-motion, 1440/1280/390px 다섯 장면을 통과했다.
- `scripts/live/check-signed-comparison.mjs`: 원본 일치, PDF만 변경 불일치, 실제 승인 재서명 비교, 별도 파일 업로드, 다섯 장면 이동 후 상태 보존을 통과했다.
- 검수 중 지갑 서명이나 트랜잭션을 새로 요청하지 않았다. 체인 조회는 읽기 전용이다.

## 증거

- 전체 브라우저 결과: `browser-check.json`
- 재서명 비교 결과: `signed-comparison/browser-check.json`
- 장면 캡처: `01-issue.png`, `02-hash-sign.png`, `03-register-handoff.png`, `04-match.png`, `05-external-draft.png`

## 환경 메모

- 로컬 미리보기: `http://127.0.0.1:5190/live.html`
- 실제 조회 네트워크: Ethereum Sepolia
- 테스트용 임시 Hardhat 서버를 사용하는 registry 테스트는 sandbox 밖에서 실행했으며, 테스트가 생성한 프로세스만 자체 종료했다.
