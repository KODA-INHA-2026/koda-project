import { fromBase64Url, loginBytes, toBase64Url, type ChallengeDTO, type PrincipalDTO, type SessionDTO } from '@koda/protocol';
import { api } from '../api/client';

export async function loginWithFile(principal: PrincipalDTO, file: File, signal: AbortSignal): Promise<SessionDTO> {
  if (!globalThis.isSecureContext || !crypto.subtle) throw new Error('이 브라우저에서 Web Crypto를 사용할 수 없습니다. localhost의 지원 브라우저로 열어 주세요.');
  if (file.size > 8192) throw new Error('올바른 데모 키 파일을 선택해 주세요.');
  let parsed: { format?: string; did?: string; principalId?: string; pkcs8?: string };
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error('JSON 형식의 데모 키 파일을 선택해 주세요.'); }
  if (parsed.format !== 'koda-demo-key/1' || parsed.did !== principal.did || parsed.principalId !== principal.id || typeof parsed.pkcs8 !== 'string') throw new Error('선택한 신원과 키 파일이 다릅니다. 해당 신원의 파일을 선택해 주세요.');
  const privateBytes = fromBase64Url(parsed.pkcs8); parsed.pkcs8 = undefined;
  let key: CryptoKey;
  try { key = await crypto.subtle.importKey('pkcs8', privateBytes, { name: 'Ed25519' }, false, ['sign']); }
  catch { throw new Error('Ed25519 키를 읽을 수 없습니다. 키 형식과 브라우저 지원을 확인해 주세요.'); }
  finally { privateBytes.fill(0); }
  const challenge = await api<ChallengeDTO>('/auth/challenge', { method: 'POST', body: JSON.stringify({ did: principal.did }), signal });
  if (challenge.audience !== window.location.origin || challenge.did !== principal.did) throw new Error('인증 대상 주소가 일치하지 않습니다. localhost에서 다시 열어 주세요.');
  const bytes = loginBytes({ challengeId: challenge.challengeId, did: challenge.did, audience: challenge.audience, nonce: challenge.nonce, expiresAt: challenge.expiresAt });
  if (toBase64Url(bytes) !== challenge.signingBytes) throw new Error('인증 요청 내용이 일치하지 않습니다.');
  const signature = toBase64Url(new Uint8Array(await crypto.subtle.sign('Ed25519', key, bytes)));
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return api<SessionDTO>('/auth/verify', { method: 'POST', body: JSON.stringify({ challengeId: challenge.challengeId, signature }), signal });
}
