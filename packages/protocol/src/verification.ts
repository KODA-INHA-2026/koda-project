import { commitmentBytes, fromBase64Url, parseCanonical, publicKeyFromDid, type EvidencePayload } from './index.js';

export interface TrustedConfig {
  chainId: number; contractAddress: `0x${string}`; instanceId: `0x${string}`; writer: `0x${string}`;
  deploymentTx: `0x${string}`; deploymentBlockHash: `0x${string}`; deploymentBlockNumber: string; rpc: string; issuerSigningDid: string;
}
export interface AnchorLocator { txHash: `0x${string}`; blockHash: `0x${string}`; instanceId: `0x${string}` }
export interface AuditEnvelopeDTO {
  sourceProof?: import('./pdf.js').SourceFileProofV1;
  evidenceId: string; version: number; tenantId: string; payloadCanonical: string; salt: string;
  statementCanonical: string; signature: string; anchorLocator: AnchorLocator;
}
export type CheckStatus = 'PASS' | 'FAIL' | 'UNAVAILABLE' | 'NOT_RUN';
export interface VerificationCheck { id: 'FORMAT' | 'ISSUER' | 'BINDING' | 'SIGNATURE' | 'COMMITMENT' | 'ANCHOR'; status: CheckStatus; reasonCode: string }
export interface AnchorEvidence { blockNumber: string; blockHash: string; recordedAt: string }
export interface VerificationResult {
  anchorEvidence?: AnchorEvidence;
  evidenceId: string; version: number; mode: 'SERVER_MEDIATED' | 'CLIENT_DIRECT'; checkedAt: string;
  status: 'VALID' | 'INVALID' | 'UNVERIFIABLE'; reasonCode: string; checks: VerificationCheck[]; chainInstance: string;
}
export interface Statement {
  domain: 'KODA-CUSTODY-DEMO-STATEMENT-v1'; schemaVersion: string; evidenceId: string; version: number;
  tenantId: string; issuerSigningDid: string; commitmentAlgorithm: 'SHA-256'; commitment: `0x${string}`;
  anchorTarget: { chainId: number; contractAddress: string; instanceId: string };
}
export type AnchorReadPort = (commitment: `0x${string}`, locator: AnchorLocator) => Promise<{ status: 'PASS' | 'FAIL' | 'UNAVAILABLE'; reasonCode: string; evidence?: AnchorEvidence }>;
const hex32 = /^0x[0-9a-f]{64}$/;
function object(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== fields.sort().join(',')) throw new Error('FORMAT');
}
function text(value: unknown): asserts value is string { if (typeof value !== 'string' || !value.length || value.length > 4096) throw new Error('FORMAT'); }
function timestamp(value: unknown) { text(value); if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error('FORMAT'); }
function quantity(value: unknown) { text(value); if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) throw new Error('FORMAT'); }
export function validatePayload(value: unknown): asserts value is EvidencePayload {
  const v3 = (value as { schemaVersion?: unknown })?.schemaVersion === 'custody-demo/3';
  const v2 = v3 || (value as { schemaVersion?: unknown })?.schemaVersion === 'custody-demo/2';
  object(value, [...(v2 ? ['valuationBasis'] : []), ...(v3 ? ['valuationQuotedAt','valuationSourceLabel','scenarioIssuedAt'] : []), 'schemaVersion','evidenceId','version','tenantId','customerDisplayName','issuerSigningDid','asOfAt','asOfTimeZone','issuedAt','assets','movements','demo']);
  if ((!v2 && value.schemaVersion !== 'custody-demo/1') || (v2 && value.valuationBasis !== 'SYNTHETIC_FIXED') || value.demo !== true || value.asOfTimeZone !== 'Asia/Seoul' || !Number.isSafeInteger(value.version) || Number(value.version) < 1) throw new Error('FORMAT');
  for (const k of ['evidenceId','tenantId','customerDisplayName','issuerSigningDid']) text(value[k]);
  if (v3) { timestamp(value.valuationQuotedAt); timestamp(value.scenarioIssuedAt); text(value.valuationSourceLabel); }
  timestamp(value.asOfAt); timestamp(value.issuedAt);
  if (!Array.isArray(value.assets) || !value.assets.length || value.assets.length > 100 || !Array.isArray(value.movements) || value.movements.length > 1000) throw new Error('FORMAT');
  for (const a of value.assets) { object(a, ['code','name','quantity','custodyAddress', ...(v2 ? ['valuationAmount','valuationCurrency'] : [])]); for (const k of ['code','name','custodyAddress']) text(a[k]); quantity(a.quantity); if (v2) { quantity(a.valuationAmount); if (a.valuationCurrency !== 'KRW') throw new Error('FORMAT'); } }
  for (const m of value.movements) { object(m, ['id','asset','quantity','occurredAt','counterpartyAddress','transactionReference', ...(v2 ? ['counterpartyName'] : [])]); for (const k of ['id','asset','counterpartyAddress','transactionReference']) text(m[k]); quantity(m.quantity); timestamp(m.occurredAt); if (v2) text(m.counterpartyName); }
  if (new Set(value.assets.map(a => a.code)).size !== value.assets.length || new Set(value.movements.map(m => m.id)).size !== value.movements.length) throw new Error('FORMAT');
}
function statementOf(value: unknown): Statement {
  object(value, ['domain','schemaVersion','evidenceId','version','tenantId','issuerSigningDid','commitmentAlgorithm','commitment','anchorTarget']);
  object(value.anchorTarget, ['chainId','contractAddress','instanceId']);
  if (value.domain !== 'KODA-CUSTODY-DEMO-STATEMENT-v1' || value.commitmentAlgorithm !== 'SHA-256' || typeof value.commitment !== 'string' || !hex32.test(value.commitment)) throw new Error('FORMAT');
  return value as unknown as Statement;
}

// Both runtimes compute the exact bytes with Web Crypto. No server verdict is an input.
export async function verifyEnvelope(envelope: AuditEnvelopeDTO, trusted: TrustedConfig, options: { mode: VerificationResult['mode']; anchor: AnchorReadPort; now?: () => number }): Promise<VerificationResult> {
  let anchorEvidence: AnchorEvidence | undefined;
  const checks: VerificationCheck[] = (['FORMAT','ISSUER','BINDING','SIGNATURE','COMMITMENT','ANCHOR'] as const).map(id => ({ id, status: 'NOT_RUN', reasonCode: 'NOT_RUN' }));
  const set = (i: number, status: CheckStatus, reasonCode: string) => { checks[i] = { ...checks[i]!, status, reasonCode }; };
  const result = (): VerificationResult => {
    const fail = checks.find(c => c.status === 'FAIL'); const unavailable = checks.find(c => c.status === 'UNAVAILABLE');
    return { ...(anchorEvidence ? { anchorEvidence } : {}), evidenceId: envelope.evidenceId, version: envelope.version, mode: options.mode, checkedAt: new Date((options.now ?? Date.now)()).toISOString(), status: fail ? 'INVALID' : checks.every(c => c.status === 'PASS') ? 'VALID' : 'UNVERIFIABLE', reasonCode: fail?.reasonCode ?? unavailable?.reasonCode ?? 'ALL_CHECKS_PASSED', checks, chainInstance: trusted.instanceId };
  };
  let payload: EvidencePayload; let statement: Statement;
  try {
    const parsed = parseCanonical(envelope.payloadCanonical); validatePayload(parsed); payload = parsed;
    statement = statementOf(parseCanonical(envelope.statementCanonical));
    if (fromBase64Url(envelope.salt).length !== 32 || fromBase64Url(envelope.signature).length !== 64 || !hex32.test(envelope.anchorLocator.txHash) || !hex32.test(envelope.anchorLocator.blockHash)) throw new Error('FORMAT');
    set(0, 'PASS', 'CANONICAL_SCHEMA');
  } catch { set(0, 'UNAVAILABLE', 'UNSUPPORTED_FORMAT'); return result(); }
  if (payload.issuerSigningDid !== trusted.issuerSigningDid || statement.issuerSigningDid !== trusted.issuerSigningDid) { set(1, 'FAIL', 'UNTRUSTED_ISSUER'); return result(); }
  set(1, 'PASS', 'PINNED_ISSUER');
  if (payload.evidenceId !== envelope.evidenceId || payload.version !== envelope.version || payload.tenantId !== envelope.tenantId ||
    statement.evidenceId !== payload.evidenceId || statement.version !== payload.version || statement.tenantId !== payload.tenantId || statement.schemaVersion !== payload.schemaVersion ||
    statement.anchorTarget.chainId !== trusted.chainId || statement.anchorTarget.contractAddress !== trusted.contractAddress || statement.anchorTarget.instanceId !== trusted.instanceId || envelope.anchorLocator.instanceId !== trusted.instanceId) {
    set(2, 'FAIL', 'DOCUMENT_BINDING_MISMATCH'); return result();
  }
  set(2, 'PASS', 'DOCUMENT_AND_TARGET_BOUND');
  try {
    const key = await crypto.subtle.importKey('raw', publicKeyFromDid(trusted.issuerSigningDid), 'Ed25519', false, ['verify']);
    if (!await crypto.subtle.verify('Ed25519', key, fromBase64Url(envelope.signature), new TextEncoder().encode(envelope.statementCanonical))) { set(3, 'FAIL', 'SIGNATURE_MISMATCH'); return result(); }
    set(3, 'PASS', 'SIGNATURE_VALID');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', commitmentBytes(payload, envelope.salt)));
    if ('0x' + Array.from(digest, b => b.toString(16).padStart(2, '0')).join('') !== statement.commitment) { set(4, 'FAIL', 'COMMITMENT_MISMATCH'); return result(); }
    set(4, 'PASS', 'COMMITMENT_MATCH');
  } catch { set(checks[3]!.status === 'PASS' ? 4 : 3, 'UNAVAILABLE', 'CRYPTO_UNAVAILABLE'); return result(); }
  try { const anchor = await options.anchor(statement.commitment, envelope.anchorLocator); set(5, anchor.status, anchor.reasonCode); if (anchor.status === 'PASS') anchorEvidence = anchor.evidence; }
  catch { set(5, 'UNAVAILABLE', 'RPC_UNAVAILABLE'); }
  return result();
}
