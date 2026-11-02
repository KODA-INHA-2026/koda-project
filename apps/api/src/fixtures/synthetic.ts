import { randomBytes } from 'node:crypto';
import type { EvidencePayload, PrincipalDTO } from '@koda/protocol';
export const demoPeople: Omit<PrincipalDTO, 'did' | 'keyFile'>[] = [
  { id: 'finance-a', name: '재무담당자 A', role: 'FINANCE', organizationId: 'tenant-a', organizationName: '가상 고객사 A' },
  { id: 'issuer', name: 'KODA 데모 발행자', role: 'ISSUER', organizationId: 'koda-demo', organizationName: 'KODA 시연 조직' },
  { id: 'auditor-b', name: '감사인 B', role: 'AUDITOR', organizationId: 'audit-b', organizationName: '가상 감사법인 B' },
  { id: 'auditor-c', name: '감사인 C', role: 'AUDITOR', organizationId: 'audit-c', organizationName: '가상 감사법인 C · 미지정' },
  { id: 'finance-b', name: '재무담당자 B', role: 'FINANCE', organizationId: 'tenant-b', organizationName: '가상 고객사 B' },
];
export function syntheticPayload(tenant: 'a' | 'b', issuerSigningDid: string): EvidencePayload {
  const secret = () => 'SYNTHETIC_PRIVATE_' + randomBytes(16).toString('hex');
  return { schemaVersion: 'custody-demo/1', evidenceId: tenant === 'a' ? 'KODA-20261031-001' : 'KODA-20261031-002', version: 1,
    tenantId: 'tenant-' + tenant, customerDisplayName: '가상 고객사 ' + tenant.toUpperCase(), issuerSigningDid,
    asOfAt: '2026-10-31T14:59:59.000Z', asOfTimeZone: 'Asia/Seoul', issuedAt: new Date().toISOString(), demo: true,
    assets: [
      { code: 'BTC', name: '비트코인', quantity: '12.50000000', custodyAddress: secret() },
      { code: 'ETH', name: '이더리움', quantity: '240.00000000', custodyAddress: secret() },
      { code: 'USDC', name: 'USD 코인', quantity: '125000.000000', custodyAddress: secret() },
    ],
    movements: [{ id: 'DEMO-IN-001', asset: 'BTC', quantity: '2.50000000', occurredAt: '2026-10-30T04:10:00.000Z', counterpartyAddress: secret(), transactionReference: secret() }],
  };
}

// A new document identity: never overwrite an already signed v1 document.
export function syntheticV3Payload(issuerSigningDid: string): EvidencePayload {
  const address = () => '0x' + randomBytes(20).toString('hex');
  return { schemaVersion: 'custody-demo/2', valuationBasis: 'SYNTHETIC_FIXED', evidenceId: 'KODA-20260930-GAON', version: 1,
    tenantId: 'tenant-a', customerDisplayName: '㈜가온테크', issuerSigningDid,
    asOfAt: '2026-09-30T14:59:59.000Z', asOfTimeZone: 'Asia/Seoul', issuedAt: new Date().toISOString(), demo: true,
    assets: [
      { code: 'BTC', name: '비트코인', quantity: '12.4500', valuationAmount: '1245000000', valuationCurrency: 'KRW', custodyAddress: address() },
      { code: 'ETH', name: '이더리움', quantity: '310.2000', valuationAmount: '930600000', valuationCurrency: 'KRW', custodyAddress: address() },
      { code: 'USDC', name: 'USD 코인', quantity: '1250000.00', valuationAmount: '1750000000', valuationCurrency: 'KRW', custodyAddress: address() },
    ],
    movements: Array.from({ length: 12 }, (_, i) => ({ id: 'DEMO-Q3-' + String(i + 1).padStart(2, '0'), asset: ['BTC','ETH','USDC'][i % 3]!, quantity: ['0.2500','10.0000','25000.00'][i % 3]!, occurredAt: new Date(Date.UTC(2026, 6 + Math.floor(i / 4), 3 + (i % 4) * 7, 3)).toISOString(), counterpartyName: i % 2 ? 'B사' : 'A사', counterpartyAddress: address(), transactionReference: '0x' + randomBytes(32).toString('hex') })),
  };
}

export function syntheticPrdPayload(did: string): EvidencePayload {
  return { ...syntheticV3Payload(did), schemaVersion: 'custody-demo/3', evidenceId: 'KODA-PRD-20260930-GAON', valuationQuotedAt: '2026-09-30T14:59:00.000Z', valuationSourceLabel: 'KODA 시연 고정 기준가 · 가상 출처 (구현 시작값)', scenarioIssuedAt: '2026-10-01T00:00:00.000Z' };
}

// Separate identities for the four-role demo; legacy fixtures remain unchanged.
export const accountingPeople: Omit<PrincipalDTO, 'did' | 'keyFile'>[] = [
  {id:'accounting-a',name:'회계담당자 A',role:'ACCOUNTING',organizationId:'tenant-a',organizationName:'㈜가온테크'},
  {id:'accounting-b',name:'회계담당자 B',role:'ACCOUNTING',organizationId:'tenant-b',organizationName:'가상 고객사 B'},
];
