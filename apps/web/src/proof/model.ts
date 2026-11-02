export const ISSUER = 'did:koda:issuer:koda-ops';
export const AUDITOR = 'did:koda:auditor:hanul-cpa';
export const DOC_ID = 'KP-2026-0930-0417';
export const RECORDED_AT = '2026-10-01 10:02:19 KST';
export const BLOCK = '21,904,118';
export const roles = [
  { name: 'KODA 수탁 운영', did: ISSUER, avatar: 'K', job: '증빙 발행·체인 기록', nav: ['발행', '발행 이력', '열람 정책', '체인 기록 조회'] },
  { name: '고객사 재무·회계 담당', did: 'did:koda:corp:gaon-fin-01', avatar: '가', job: '열람본 확인·권한 전달', nav: ['받은 증빙', '보낸 권한', '공개 범위 프리셋'] },
  { name: '외부 감사인', did: AUDITOR, avatar: '한', job: '원본 열람·원본 검증', nav: ['감사 대상', '검증 이력', '파일로 검증'] },
] as const;
export type FileResult = 'changed' | 'copy' | 'match' | 'unknown';
export type DemoRecord = { time: string; actor: string; action: string; detail: string };
export type FileManifest = { hash: string; changedHash: string; copyHash: string; entries: { field: string; label: string; value: string }[] };
export const shortHash = (hash: string) => hash ? `${hash.slice(0, 12)} …… ${hash.slice(-8)}` : '지문 계산 중';
export async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function saveFile(name: string, bytes: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
