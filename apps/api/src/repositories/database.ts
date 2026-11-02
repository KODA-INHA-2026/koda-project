import { DatabaseSync } from 'node:sqlite';
import type { EvidencePayload, PrincipalDTO } from '@koda/protocol';

export const migration1 = `
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS principals (
  id TEXT PRIMARY KEY, did TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ISSUER','FINANCE','ACCOUNTING','AUDITOR')),
  organizationId TEXT NOT NULL, organizationName TEXT NOT NULL, keyFile TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS issuer_trust (did TEXT PRIMARY KEY, publicKey TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auditor_assignments (tenantId TEXT NOT NULL, auditorDid TEXT NOT NULL REFERENCES principals(did), PRIMARY KEY(tenantId,auditorDid));
CREATE TABLE IF NOT EXISTS auth_challenges (
  challengeId TEXT PRIMARY KEY, did TEXT NOT NULL REFERENCES principals(did), audience TEXT NOT NULL,
  signingBytes TEXT NOT NULL, expiresAt INTEGER NOT NULL, consumedAt INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  tokenHash TEXT PRIMARY KEY, principalId TEXT NOT NULL REFERENCES principals(id),
  expiresAt INTEGER NOT NULL, revokedAt INTEGER, csrf TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence_versions (
  evidenceId TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0), tenantId TEXT NOT NULL,
  payloadCanonical TEXT NOT NULL, salt TEXT NOT NULL, statementCanonical TEXT NOT NULL, signature TEXT NOT NULL,
  PRIMARY KEY(evidenceId,version)
);
CREATE TRIGGER IF NOT EXISTS evidence_immutable_update BEFORE UPDATE ON evidence_versions BEGIN SELECT RAISE(ABORT,'Immutable evidence version'); END;
CREATE TRIGGER IF NOT EXISTS evidence_immutable_delete BEFORE DELETE ON evidence_versions BEGIN SELECT RAISE(ABORT,'Immutable evidence version'); END;
CREATE TABLE IF NOT EXISTS anchor_records (
  evidenceId TEXT NOT NULL, version INTEGER NOT NULL, commitment TEXT NOT NULL UNIQUE,
  txHash TEXT NOT NULL, blockHash TEXT NOT NULL, instanceId TEXT NOT NULL,
  PRIMARY KEY(evidenceId,version), FOREIGN KEY(evidenceId,version) REFERENCES evidence_versions(evidenceId,version)
);
INSERT OR IGNORE INTO schema_migrations VALUES (1);
`;
const migration2 = `
CREATE TABLE IF NOT EXISTS share_grants (
  id TEXT PRIMARY KEY, tokenHash TEXT NOT NULL UNIQUE, tenantId TEXT NOT NULL,
  evidenceId TEXT NOT NULL, version INTEGER NOT NULL, auditorDid TEXT NOT NULL REFERENCES principals(did), auditorOrganizationId TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope='AUDIT_FULL'), createdBy TEXT NOT NULL REFERENCES principals(id),
  createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, revokedAt INTEGER,
  idempotencyKey TEXT NOT NULL, requestHash TEXT NOT NULL,
  UNIQUE(createdBy,idempotencyKey), FOREIGN KEY(evidenceId,version) REFERENCES evidence_versions(evidenceId,version)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, tenantId TEXT NOT NULL, actor TEXT NOT NULL, evidenceId TEXT NOT NULL,
  version INTEGER NOT NULL, grantId TEXT, type TEXT NOT NULL, result TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('SERVER','CLIENT_REPORTED')), at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_tenant_document ON audit_events(tenantId,evidenceId,version,at);
INSERT OR IGNORE INTO schema_migrations VALUES (2);
`;
const migration3 = `
CREATE TABLE IF NOT EXISTS issuance_snapshots (snapshotId TEXT PRIMARY KEY, evidenceId TEXT NOT NULL, version INTEGER NOT NULL, payloadCanonical TEXT NOT NULL, UNIQUE(evidenceId,version));
CREATE TABLE IF NOT EXISTS anchor_jobs (
  evidenceId TEXT NOT NULL, version INTEGER NOT NULL, snapshotId TEXT NOT NULL UNIQUE REFERENCES issuance_snapshots(snapshotId),
  actor TEXT NOT NULL REFERENCES principals(id), idempotencyKey TEXT NOT NULL, requestHash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PREPARED','PENDING','CONFIRMED','FAILED','UNAVAILABLE')),
  reasonCode TEXT NOT NULL, txHash TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL,
  PRIMARY KEY(evidenceId,version), UNIQUE(actor,idempotencyKey), FOREIGN KEY(evidenceId,version) REFERENCES evidence_versions(evidenceId,version)
);
INSERT OR IGNORE INTO schema_migrations VALUES (3);
`;
export function openDatabase(path = ':memory:'): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec('BEGIN IMMEDIATE');
  try { db.exec(migration1); db.exec(migration2); db.exec(migration3); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  return db;
}
export interface PrincipalRow extends PrincipalDTO { active: number }
export interface EvidenceRow { evidenceId: string; version: number; tenantId: string; payloadCanonical: string; salt: string; statementCanonical: string; signature: string }
export function insertPrincipal(db: DatabaseSync, p: PrincipalDTO): void {
  db.prepare('INSERT INTO principals (id,did,name,role,organizationId,organizationName,keyFile) VALUES (?,?,?,?,?,?,?)')
    .run(p.id, p.did, p.name, p.role, p.organizationId, p.organizationName, p.keyFile);
}
export function payloadOf(row: EvidenceRow): EvidencePayload { return JSON.parse(row.payloadCanonical) as EvidencePayload; }
