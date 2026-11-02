import { canonicalJson, parseCanonical, validatePayload, verifyEnvelope, type AuditEnvelopeDTO, type EvidencePayload, type TrustedConfig, type AnchorReadPort, type VerificationResult } from './index.js';

export const MAX_EVIDENCE_FILE_BYTES = 1024 * 1024;
export interface EvidenceDifference { field: string; before: string; after: string }
export interface FileInspection { baseline: VerificationResult; result: VerificationResult; differences: EvidenceDifference[]; chainMismatch: boolean }
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== keys.sort().join(',')) throw new Error('지원하지 않는 파일 구조입니다.');
}
export function parseEvidenceFile(text: string): AuditEnvelopeDTO {
  if (new TextEncoder().encode(text).length > MAX_EVIDENCE_FILE_BYTES) throw new Error('파일은 1 MiB 이하여야 합니다.');
  let container: unknown;
  try { container = parseCanonical(text); } catch { throw new Error('정규 JSON 시연 파일이 아닙니다. 손상·중복 키·지원 형식을 확인해 주세요.'); }
  exact(container, ['format', 'envelope']);
  if (container.format !== 'koda-evidence-file/1') throw new Error('지원하는 형식은 koda-evidence-file/1 JSON입니다. PDF/OCR은 지원하지 않습니다.');
  const e = container.envelope;
  exact(e, ['evidenceId','version','tenantId','payloadCanonical','salt','statementCanonical','signature','anchorLocator']);
  for (const k of ['evidenceId','tenantId','payloadCanonical','salt','statementCanonical','signature']) if (typeof e[k] !== 'string') throw new Error('파일 필드 형식을 확인해 주세요.');
  if (!Number.isSafeInteger(e.version) || Number(e.version) < 1) throw new Error('문서 버전을 확인해 주세요.');
  exact(e.anchorLocator, ['txHash','blockHash','instanceId']);
  for (const v of Object.values(e.anchorLocator)) if (typeof v !== 'string' || !/^0x[0-9a-f]{64}$/.test(v)) throw new Error('체인 위치 형식을 확인해 주세요.');
  const payload = parseCanonical(e.payloadCanonical as string); validatePayload(payload);
  parseCanonical(e.statementCanonical as string);
  return e as unknown as AuditEnvelopeDTO;
}
export function evidenceFile(envelope: AuditEnvelopeDTO): string { return canonicalJson({ format: 'koda-evidence-file/1', envelope }); }
export function comparePayloads(before: EvidencePayload, after: EvidencePayload): EvidenceDifference[] {
  const differences: EvidenceDifference[] = [];
  function walk(a: unknown, b: unknown, field: string) {
    if (canonicalJson(a) === canonicalJson(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      const aa = a as Record<string, unknown>, bb = b as Record<string, unknown>;
      for (const key of new Set([...Object.keys(aa), ...Object.keys(bb)])) walk(aa[key] ?? null, bb[key] ?? null, field ? field + '.' + key : key);
    } else differences.push({ field, before: typeof a === 'string' ? a : canonicalJson(a), after: typeof b === 'string' ? b : canonicalJson(b) });
  }
  const { assets: a, ...restA } = before, { assets: b, ...restB } = after;
  walk(restA, restB, '');
  if (a.map(v => v.code).join(',') !== b.map(v => v.code).join(',')) walk(a.map(v => v.code), b.map(v => v.code), '자산 순서');
  for (const code of new Set([...a, ...b].map(v => v.code))) walk(a.find(v => v.code === code) ?? null, b.find(v => v.code === code) ?? null, code);
  return differences;
}
// Caller must authorize before and after, and discard results if subject/file/trust changes.
export async function inspectEvidenceFile(file: AuditEnvelopeDTO, original: AuditEnvelopeDTO, trusted: TrustedConfig, anchor: AnchorReadPort): Promise<FileInspection> {
  const originalPayload = parseCanonical(original.payloadCanonical); validatePayload(originalPayload);
  const filePayload = parseCanonical(file.payloadCanonical); validatePayload(filePayload);
  if (['evidenceId','version','tenantId'].some(k => file[k as keyof AuditEnvelopeDTO] !== original[k as keyof AuditEnvelopeDTO]) ||
      filePayload.evidenceId !== originalPayload.evidenceId || filePayload.version !== originalPayload.version || filePayload.tenantId !== originalPayload.tenantId || filePayload.issuerSigningDid !== originalPayload.issuerSigningDid) throw new Error('현재 권한의 문서·버전·발행자와 다른 파일입니다. 변경 전후 값은 제공하지 않습니다.');
  const baseline = await verifyEnvelope(original, trusted, { mode: 'CLIENT_DIRECT', anchor });
  const result = await verifyEnvelope(file, trusted, { mode: 'CLIENT_DIRECT', anchor });
  const sameProof = file.statementCanonical === original.statementCanonical && file.signature === original.signature && file.salt === original.salt && canonicalJson(file.anchorLocator) === canonicalJson(original.anchorLocator);
  const comparable = baseline.status === 'VALID' && sameProof && (result.status === 'VALID' || result.reasonCode === 'COMMITMENT_MISMATCH');
  return { baseline, result, differences: comparable ? comparePayloads(originalPayload, filePayload) : [], chainMismatch: comparable && result.reasonCode === 'COMMITMENT_MISMATCH' };
}
