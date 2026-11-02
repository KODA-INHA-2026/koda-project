import type { FinanceSummaryDTO, PrincipalDTO, Statement, AnchorLocator } from '@koda/protocol';
import { payloadOf, type EvidenceRow, type PrincipalRow } from '../repositories/database.js';

export function principalDTO(row: PrincipalRow): PrincipalDTO {
  return { id: row.id, did: row.did, name: row.name, role: row.role, organizationId: row.organizationId, organizationName: row.organizationName, keyFile: row.keyFile };
}
export function toFinanceSummary(row: EvidenceRow, canShare = false, anchor?: AnchorLocator): FinanceSummaryDTO {
  const p = payloadOf(row); const statement = JSON.parse(row.statementCanonical) as Statement;
  // Construct an allowlisted object. Never spread a server payload into a browser response.
  return { evidenceId: p.evidenceId, version: p.version, customerDisplayName: p.customerDisplayName,
    ...(p.schemaVersion === 'custody-demo/3' ? { valuationQuotedAt: p.valuationQuotedAt, valuationSourceLabel: p.valuationSourceLabel, scenarioIssuedAt: p.scenarioIssuedAt } : {}),
    asOfAt: p.asOfAt, asOfTimeZone: p.asOfTimeZone, issuedAt: p.issuedAt, issuerDisplayName: 'KODA 데모 발행자',
    assets: p.assets.map(a => ({ code: a.code, name: a.name, quantity: a.quantity, custodyAddressMasked: a.custodyAddress.slice(0, 4) + '…' + a.custodyAddress.slice(-4), ...(p.schemaVersion !== 'custody-demo/1' ? { valuationAmount: a.valuationAmount, valuationCurrency: a.valuationCurrency } : {}) })),
    movementCount: p.movements.length, issuerSigningDid: p.issuerSigningDid, commitment: statement.commitment ?? '', anchor: { txHash: anchor?.txHash ?? '', blockHash: anchor?.blockHash ?? '', instanceId: statement.anchorTarget?.instanceId ?? '', chainId: statement.anchorTarget?.chainId ?? 0, contractAddress: statement.anchorTarget?.contractAddress ?? '' },
    issuanceStatus: 'CONFIRMED', verificationStatus: 'NOT_VERIFIED', canShare, demo: true };
}
