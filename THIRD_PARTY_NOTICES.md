# 외부 소스와 자산

웹 소스는 Vanilla JavaScript와 CSS를 사용하며, Motion 14.6.0과 esbuild 0.28.2로 모션 번들을 빌드합니다. 패키지 버전과 간접 의존성은 `landing/package-lock.json`에 고정되어 있습니다.

| 항목 | 조건·고지 |
| --- | --- |
| Motion / motion-dom / motion-utils | MIT. `landing/dist/assets/licenses/`에 전문 포함 |
| Embla Carousel 8.6.0 | MIT. 기존 의존성 및 고지 보존. 현재 홈은 탭 인터페이스 사용 |
| Tabler Icons | MIT. `landing/dist/assets/licenses/tabler-icons-LICENSE.txt` |
| Pretendard Variable | SIL Open Font License 1.1. `landing/dist/assets/licenses/Pretendard-OFL.txt` |
| IBM Plex Mono | SIL Open Font License 1.1. `landing/dist/assets/IBMPlex-OFL.txt` |
| KODA 로고 | 상표·로고 권리는 KODA에 귀속. 공식 운영 서비스와 제휴·보증을 주장하지 않음 |
| 프로젝트 이미지·영상·음악 | 공개 링크와 SHA-256 목록으로 연결. 재사용 범위와 상세 출처는 `landing/dist/assets/CREDITS.txt` 및 `AUDIO-CREDITS.txt` 참조 |

발표용 이미지·영상 바이너리는 Git에 포함하지 않습니다. `npm run media:fetch`로 공개 배포본에서 필요한 자산만 내려받고 해시를 확인합니다. 제3자 라이선스는 해당 자산에만 적용되며 프로젝트 전체의 재배포 허가를 의미하지 않습니다.
