import type { StoryCase } from './types';

// 스토리 시연의 지문은 브라우저에서 실제로 계산한다(SHA-256).
// 시연에서는 솔트를 항목 이름으로 정해 두었다. 실제 서비스는 칸마다 무작위 솔트를 KODA가 보관한다.
const DOMAIN = 'KODA-STORY-v1';
const encoder = new TextEncoder();
export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export type Override = { key: string; value: string } | null;
const valueOf = (c: StoryCase, key: string, value: string, override: Override) => override && override.key === key ? override.value : value;

/** 문서 지문: 문서번호와 모든 칸을 정해진 순서로 이어 붙여 계산한다. */
export function documentPrint(c: StoryCase, override: Override = null) {
  return sha256Hex(`${DOMAIN}|doc|${c.docNo}|` + c.fields.map(f => `${f.key}=${valueOf(c, f.key, f.value, override)}`).join('|'));
}
/** 항목 지문 묶음: 칸마다 솔트를 붙인 지문을 묶는다. 가린 칸은 지문만 건네도 같은 묶음을 다시 만들 수 있다. */
export async function fieldBundle(c: StoryCase, override: Override = null) {
  const leaves = await Promise.all(c.fields.map(async f => {
    const salt = await sha256Hex(`${DOMAIN}|salt|${c.docNo}|${f.key}`);
    return sha256Hex(`${DOMAIN}|leaf|${salt}|${f.key}|${valueOf(c, f.key, f.value, override)}`);
  }));
  return sha256Hex(`${DOMAIN}|bundle|${leaves.join('|')}`);
}
export const short = (hash: string) => hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : '계산 중';
