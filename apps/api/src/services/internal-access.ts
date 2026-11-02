import type { DatabaseSync } from 'node:sqlite';
import type { InternalGrantDTO } from '@koda/protocol';
import type { PrincipalRow } from '../repositories/database.js';
import { ApiError } from '../errors.js';

// Explicit preparation only: never rebuild principals or migrate an existing demo DB on startup.
export function prepareInternalRoles(db: DatabaseSync) {
  db.exec(`CREATE TABLE internal_grants (
    id TEXT PRIMARY KEY, tenantId TEXT NOT NULL, evidenceId TEXT NOT NULL, version INTEGER NOT NULL,
    recipientDid TEXT NOT NULL REFERENCES principals(did), createdBy TEXT NOT NULL REFERENCES principals(id),
    createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, revokedAt INTEGER, firstOpenedAt INTEGER,
    idempotencyKey TEXT NOT NULL, requestHash TEXT NOT NULL, UNIQUE(createdBy,idempotencyKey),
    FOREIGN KEY(evidenceId,version) REFERENCES evidence_versions(evidenceId,version));
    CREATE TABLE grant_lineage (auditGrantId TEXT PRIMARY KEY REFERENCES share_grants(id), internalGrantId TEXT NOT NULL REFERENCES internal_grants(id));`);
}
export interface InternalGrantRow {
  id: string; tenantId: string; evidenceId: string; version: number; recipientDid: string; createdBy: string;
  createdAt: number; expiresAt: number; revokedAt: number | null; firstOpenedAt: number | null; idempotencyKey: string; requestHash: string;
}
export function internalGrantDTO(db: DatabaseSync, g: InternalGrantRow, now: number): InternalGrantDTO {
  return { id:g.id,evidenceId:g.evidenceId,version:g.version,recipientDid:g.recipientDid,
    recipientName:String(db.prepare('SELECT name FROM principals WHERE did=?').get(g.recipientDid)?.name ?? '지정 회계담당자'),
    createdAt:new Date(g.createdAt).toISOString(),expiresAt:new Date(g.expiresAt).toISOString(),
    status:g.revokedAt!==null?'REVOKED':now>=g.expiresAt?'EXPIRED':'ACTIVE',firstOpenedAt:g.firstOpenedAt===null?null:new Date(g.firstOpenedAt).toISOString() };
}
export function requireAccountingGrant(db: DatabaseSync, p: PrincipalRow, evidenceId: string, version: number, now: number): InternalGrantRow {
  if(p.role!=='ACCOUNTING')throw new ApiError(403,'ROLE_DENIED','지정 회계담당자만 결산용 열람본을 볼 수 있습니다.');
  const g=db.prepare('SELECT * FROM internal_grants WHERE tenantId=? AND evidenceId=? AND version=? AND recipientDid=? AND revokedAt IS NULL AND expiresAt>? ORDER BY createdAt DESC,rowid DESC LIMIT 1').get(p.organizationId,evidenceId,version,p.did,now) as unknown as InternalGrantRow|undefined;
  if(!g)throw new ApiError(403,'INTERNAL_ACCESS_DENIED','회계 열람 권한이 없거나 만료·철회되었습니다. 재무담당자에게 새 인계를 요청해 주세요.');
  return g;
}
export function requireParentGrant(db: DatabaseSync, auditGrantId: string, now: number) {
  const g=db.prepare('SELECT i.*,p.active,p.role,p.organizationId FROM grant_lineage l JOIN internal_grants i ON i.id=l.internalGrantId JOIN principals p ON p.did=i.recipientDid WHERE l.auditGrantId=?').get(auditGrantId);
  if(!g || g.revokedAt!==null || Number(g.expiresAt)<=now || g.active!==1 || g.role!=='ACCOUNTING' || g.organizationId!==g.tenantId)
    throw new ApiError(410,'PARENT_GRANT_ENDED','고객사 내부 인계 권한이 종료되어 원본 접근을 차단했습니다. 담당자에게 새 권한을 요청해 주세요.');
}
