import type { AuditEnvelopeDTO, VerificationResult } from './verification.js';
import type { EvidencePayload } from './index.js';
export type IssuanceStatus = 'PREPARED' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNAVAILABLE';
export interface IssuanceJobDTO { evidenceId: string; version: number; snapshotId: string; status: IssuanceStatus; reasonCode: string; createdAt: string; updatedAt: string; txHash: string | null }
export interface IssuedSourceDTO { envelope: AuditEnvelopeDTO; verification: VerificationResult }
export interface SnapshotDTO { snapshotId: string; payload: EvidencePayload; job: IssuanceJobDTO | null }
export interface GrantDTO { id: string; evidenceId: string; version: number; auditorDid: string; auditorName: string; auditorOrganizationName: string; firstOpenedAt: string | null; lastOpenedAt: string | null; scope: 'AUDIT_FULL'; createdAt: string; expiresAt: string; status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' }
export interface GrantCreatedDTO { grant: GrantDTO; token?: string; replayed: boolean }
export interface AuditAccessDTO { authorizationCheckedAt: string; grant: GrantDTO; envelope: AuditEnvelopeDTO }
export interface AuditEventDTO { id: string; actor: string; evidenceId: string; version: number; grantId: string | null; type: string; result: string; source: 'SERVER' | 'CLIENT_REPORTED'; at: string }
export const MAX_GRANT_MS = 7 * 24 * 60 * 60_000;
export const DEFAULT_GRANT_MS = 24 * 60 * 60_000;
const str = { type: 'string' } as const;
const integer = { type: 'integer' } as const;
export const strictObject = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
export const grantSchema = strictObject({ id: str, evidenceId: str, version: integer, auditorDid: str, auditorName: str, auditorOrganizationName: str, firstOpenedAt: { anyOf: [str, { type: 'null' }] }, lastOpenedAt: { anyOf: [str, { type: 'null' }] }, scope: { const: 'AUDIT_FULL' }, createdAt: str, expiresAt: str, status: { enum: ['ACTIVE','EXPIRED','REVOKED'] } });
export const grantCreatedSchema = strictObject({ grant: grantSchema, token: str, replayed: { type: 'boolean' } }, ['grant','replayed']);
export const sourceProofSchema = strictObject({ domain: { const: 'KODA-SOURCE-FILE-v1' }, proofVersion: { const: 1 }, evidenceId: str, version: integer, issuerSigningDid: str, fileHash: str, byteLength: integer, mediaType: { const: 'application/pdf' }, signature: str });
export const envelopeSchema = strictObject({ sourceProof: sourceProofSchema, evidenceId: str, version: integer, tenantId: str, payloadCanonical: str, salt: str, statementCanonical: str, signature: str, anchorLocator: strictObject({ txHash: str, blockHash: str, instanceId: str }) }, ['evidenceId','version','tenantId','payloadCanonical','salt','statementCanonical','signature','anchorLocator']);
export const auditAccessSchema = strictObject({ grant: grantSchema, envelope: envelopeSchema, authorizationCheckedAt: str });
export const eventSchema = strictObject({ id: str, actor: str, evidenceId: str, version: integer, grantId: { anyOf: [str, { type: 'null' }] }, type: str, result: str, source: { enum: ['SERVER','CLIENT_REPORTED'] }, at: str });
export const verificationSchema = strictObject({ evidenceId: str, version: integer, mode: { enum: ['SERVER_MEDIATED','CLIENT_DIRECT'] }, checkedAt: str, status: { enum: ['VALID','INVALID','UNVERIFIABLE'] }, reasonCode: str, chainInstance: str, anchorEvidence: strictObject({ blockNumber: str, blockHash: str, recordedAt: str }), checks: { type: 'array', items: strictObject({ id: str, status: { enum: ['PASS','FAIL','UNAVAILABLE','NOT_RUN'] }, reasonCode: str }) } }, ['evidenceId','version','mode','checkedAt','status','reasonCode','chainInstance','checks']);
export const trustedSchema = strictObject({ chainId: integer, contractAddress: str, instanceId: str, writer: str, deploymentTx: str, deploymentBlockHash: str, deploymentBlockNumber: str, rpc: str, issuerSigningDid: str });
export const jobSchema = strictObject({ evidenceId: str, version: integer, snapshotId: str, status: { enum: ['PREPARED','PENDING','CONFIRMED','FAILED','UNAVAILABLE'] }, reasonCode: str, createdAt: str, updatedAt: str, txHash: { anyOf: [str, { type: 'null' }] } });
const payloadV1Schema = strictObject({ schemaVersion: { const: 'custody-demo/1' }, evidenceId: str, version: integer, tenantId: str, customerDisplayName: str, issuerSigningDid: str, asOfAt: str, asOfTimeZone: { const: 'Asia/Seoul' }, issuedAt: str, demo: { const: true }, assets: { type: 'array', items: strictObject({ code: str, name: str, quantity: str, custodyAddress: str }) }, movements: { type: 'array', items: strictObject({ id: str, asset: str, quantity: str, occurredAt: str, counterpartyAddress: str, transactionReference: str }) } });
const payloadV2Schema = strictObject({ ...payloadV1Schema.properties, schemaVersion: { const: 'custody-demo/2' }, valuationBasis: { const: 'SYNTHETIC_FIXED' }, assets: { type: 'array', items: strictObject({ code: str, name: str, quantity: str, custodyAddress: str, valuationAmount: str, valuationCurrency: { const: 'KRW' } }) }, movements: { type: 'array', items: strictObject({ id: str, asset: str, quantity: str, occurredAt: str, counterpartyAddress: str, transactionReference: str, counterpartyName: str }) } });
const payloadV3Schema = strictObject({ ...payloadV2Schema.properties, schemaVersion: { const: 'custody-demo/3' }, valuationQuotedAt: str, valuationSourceLabel: str, scenarioIssuedAt: str });
export const payloadSchema = { anyOf: [payloadV1Schema, payloadV2Schema, payloadV3Schema] };
export const snapshotSchema = strictObject({ snapshotId: str, payload: payloadSchema, job: { anyOf: [jobSchema, { type: 'null' }] } });
