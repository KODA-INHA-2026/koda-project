import { sourceFile, verifyPdfRow, type PdfRuntime } from './source-file.js';
import type { DatabaseSync } from 'node:sqlite';
import { verifyEnvelope, type AuditEnvelopeDTO, type TrustedConfig, type AnchorReadPort, type VerificationResult } from '@koda/protocol';
import { anchorReader } from '@koda/chain/reader';
import type { EvidenceRow } from '../repositories/database.js';
import { ApiError } from '../errors.js';

export function evidenceEnvelope(db: DatabaseSync, row: EvidenceRow): AuditEnvelopeDTO {
  if (JSON.parse(row.payloadCanonical).schemaVersion === 'custody-demo/3') {
    const source = sourceFile(db, row.evidenceId, row.version);
    return { evidenceId: row.evidenceId, version: row.version, tenantId: row.tenantId, payloadCanonical: row.payloadCanonical, salt: row.salt, statementCanonical: row.statementCanonical, signature: row.signature, anchorLocator: { txHash: '0x', blockHash: '0x', instanceId: '0x' }, sourceProof: source.proof };
  }
  const anchor = db.prepare('SELECT txHash,blockHash,instanceId FROM anchor_records WHERE evidenceId=? AND version=?').get(row.evidenceId, row.version) as unknown as AuditEnvelopeDTO['anchorLocator'] | undefined;
  if (!anchor) throw new ApiError(409, 'ANCHOR_PENDING', '발행 기록 확인이 끝나지 않았습니다. 발행 담당자에게 확인해 주세요.');
  return { evidenceId: row.evidenceId, version: row.version, tenantId: row.tenantId, payloadCanonical: row.payloadCanonical, salt: row.salt, statementCanonical: row.statementCanonical, signature: row.signature, anchorLocator: { txHash: anchor.txHash, blockHash: anchor.blockHash, instanceId: anchor.instanceId } };
}
export async function verifyRow(db: DatabaseSync, row: EvidenceRow, trusted: TrustedConfig | undefined, now: () => number, anchor?: AnchorReadPort, pdf?: PdfRuntime): Promise<VerificationResult> {
  if (pdf) {
    const r = await verifyPdfRow(db,row,pdf);
    return { evidenceId: row.evidenceId, version: row.version, mode: 'SERVER_MEDIATED', checkedAt: new Date(now()).toISOString(), status: r.status === 'ORIGINAL_MATCH' ? 'VALID' : 'UNVERIFIABLE', reasonCode: r.status, checks: [], chainInstance: 'MOCK' };
  }
  if (!trusted || !db.prepare('SELECT did FROM issuer_trust WHERE did=?').get(trusted.issuerSigningDid)) throw new ApiError(503, 'TRUST_UNAVAILABLE', '검증 기준을 불러올 수 없습니다. 실행 환경을 확인해 주세요.');
  return verifyEnvelope(evidenceEnvelope(db, row), trusted, { mode: 'SERVER_MEDIATED', now, anchor: anchor ?? anchorReader(trusted) });
}
