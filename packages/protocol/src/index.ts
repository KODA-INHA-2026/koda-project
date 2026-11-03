import { internalGrantSchema } from './internal.js';
import canonicalize from 'canonicalize';
import { base58btc } from 'multiformats/bases/base58';
export * from './verification.js';
export * from './workflow.js';
export * from './file.js';
export * from './pdf.js';

export type Role = 'ISSUER' | 'FINANCE' | 'ACCOUNTING' | 'AUDITOR';
export interface PrincipalDTO { id: string; did: string; name: string; role: Role; organizationId: string; organizationName: string; keyFile: string }
export interface SessionDTO { principal: PrincipalDTO; expiresAt: string; csrf: string }
export interface Challenge { challengeId: string; did: string; audience: string; nonce: string; expiresAt: string }
export interface ChallengeDTO extends Challenge { signingBytes: string }
export interface AssetSummary { code: string; name: string; quantity: string }
export interface FinanceSummaryDTO {
  canHandoff?: boolean;
  evidenceId: string; version: number; customerDisplayName: string; asOfAt: string; asOfTimeZone: string;
  issuedAt: string; issuerDisplayName: string; assets: (AssetSummary & { custodyAddressMasked: string; valuationAmount?: string; valuationCurrency?: 'KRW' })[];
  valuationQuotedAt?: string; valuationSourceLabel?: string; scenarioIssuedAt?: string; fileHash?: string; mockRecord?: import('./pdf.js').MockAnchorRecord;
  movementCount: number; issuerSigningDid: string; commitment: string; anchor: { txHash: string; blockHash: string; instanceId: string; chainId: number; contractAddress: string };
  issuanceStatus: 'CONFIRMED'; verificationStatus: 'NOT_VERIFIED'; canShare: boolean; demo: true;
}
export interface EvidencePayload {
  valuationQuotedAt?: string; valuationSourceLabel?: string; scenarioIssuedAt?: string;
  schemaVersion: 'custody-demo/1' | 'custody-demo/2' | 'custody-demo/3'; valuationBasis?: 'SYNTHETIC_FIXED'; evidenceId: string; version: number; tenantId: string;
  customerDisplayName: string; issuerSigningDid: string; asOfAt: string; asOfTimeZone: 'Asia/Seoul'; issuedAt: string;
  assets: (AssetSummary & { custodyAddress: string; valuationAmount?: string; valuationCurrency?: 'KRW' })[];
  movements: { id: string; asset: string; quantity: string; occurredAt: string; counterpartyName?: string; counterpartyAddress: string; transactionReference: string }[];
  demo: true;
}
export const AUTH_CHALLENGE_MS = 90_000;
export const SESSION_MS = 30 * 60_000;
export const LOGIN_DOMAIN = 'KODA-DEMO-LOGIN-v1';
export const COMMITMENT_DOMAIN = 'KODA-CUSTODY-DEMO-COMMITMENT-v1';

function checkJson(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite JSON number');
  if (typeof value === 'string') {
    if (!value.isWellFormed()) throw new Error('Invalid Unicode');
  } else if (Array.isArray(value)) value.forEach(checkJson);
  else if (value !== null && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Expected plain JSON object');
    for (const [key, child] of Object.entries(value)) { checkJson(key); checkJson(child); }
  } else if (!['number', 'boolean'].includes(typeof value) && value !== null) throw new Error('Not a JSON value');
}
export function canonicalJson(value: unknown): string {
  checkJson(value);
  const result = canonicalize(value);
  if (typeof result !== 'string') throw new Error('Invalid JSON');
  return result;
}
export function parseCanonical(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  if (canonicalJson(parsed) !== text) throw new Error('Non-canonical JSON');
  return parsed;
}
export function toBase64Url(bytes: Uint8Array): string {
  let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  if (toBase64Url(bytes) !== value) throw new Error('Non-canonical base64url');
  return bytes;
}
export function didFromPublicKey(key: Uint8Array): string {
  if (key.length !== 32) throw new Error('Ed25519 public key must be 32 bytes');
  return 'did:key:' + base58btc.encode(new Uint8Array([0xed, 0x01, ...key]));
}
export function publicKeyFromDid(did: string): Uint8Array<ArrayBuffer> {
  if (!did.startsWith('did:key:z') || did.length > 64) throw new Error('Unsupported DID profile');
  const bytes = base58btc.decode(did.slice(8));
  if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01) throw new Error('Unsupported DID key');
  const key = new Uint8Array(bytes.slice(2));
  if (didFromPublicKey(key) !== did) throw new Error('Non-canonical DID');
  return key;
}
export function loginBytes(challenge: Challenge): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(LOGIN_DOMAIN + '\n' + canonicalJson(challenge));
}
export function commitmentBytes(payload: EvidencePayload, salt: string): Uint8Array<ArrayBuffer> {
  if (fromBase64Url(salt).length !== 32) throw new Error('Salt must be 32 bytes');
  return new TextEncoder().encode(canonicalJson({ domain: COMMITMENT_DOMAIN, salt, payload }));
}

const text = { type: 'string' } as const;
export const principalSchema = { type: 'object', additionalProperties: false, required: ['id', 'did', 'name', 'role', 'organizationId', 'organizationName', 'keyFile'], properties: {
  id: text, did: text, name: text, role: { enum: ['ISSUER', 'FINANCE', 'ACCOUNTING', 'AUDITOR'] }, organizationId: text, organizationName: text, keyFile: text,
} } as const;
export const financeSummarySchema = { type: 'object', additionalProperties: false,
  required: ['evidenceId', 'version', 'customerDisplayName', 'asOfAt', 'asOfTimeZone', 'issuedAt', 'issuerDisplayName', 'assets', 'movementCount', 'issuerSigningDid', 'commitment', 'anchor', 'issuanceStatus', 'verificationStatus', 'canShare', 'demo'],
  properties: { canHandoff: { type: 'boolean' }, evidenceId: text, version: { type: 'integer', minimum: 1 }, customerDisplayName: text, asOfAt: text, asOfTimeZone: text, issuedAt: text, issuerDisplayName: text,
    assets: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['code', 'name', 'quantity', 'custodyAddressMasked'], properties: { code: text, name: text, quantity: text, custodyAddressMasked: text, valuationAmount: text, valuationCurrency: { const: 'KRW' } } } },
    valuationQuotedAt: text, valuationSourceLabel: text, scenarioIssuedAt: text, fileHash: text, mockRecord: { type: 'object', additionalProperties: false, properties: { mode: { const: 'MOCK' }, fileHash: text, recordedAt: text, blockLocator: text, issuerSigningDid: text }, required: ['mode','fileHash','recordedAt','blockLocator','issuerSigningDid'] },
    movementCount: { type: 'integer' }, issuerSigningDid: text, commitment: text, anchor: { type: 'object', additionalProperties: false, required: ['txHash','blockHash','instanceId','chainId','contractAddress'], properties: { txHash: text, blockHash: text, instanceId: text, chainId: { type: 'integer' }, contractAddress: text } },
    issuanceStatus: { const: 'CONFIRMED' }, verificationStatus: { const: 'NOT_VERIFIED' }, canShare: { type: 'boolean' }, demo: { const: true },
  },
} as const;

export * from './internal.js';

export const accountingSummarySchema = {type:'object',additionalProperties:false,properties:{...financeSummarySchema.properties,internalGrant:internalGrantSchema,
  journal:{type:'array',items:{type:'object',additionalProperties:false,properties:{occurredAt:text,asset:text,quantity:text},required:['occurredAt','asset','quantity']}}},required:[...financeSummarySchema.required,'internalGrant','journal']};
export { maskAddress } from './mask.js';
