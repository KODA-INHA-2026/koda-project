import type { FinanceSummaryDTO } from './index.js';
import { strictObject } from './workflow.js';

export interface InternalGrantDTO {
  id: string; evidenceId: string; version: number; recipientDid: string; recipientName: string;
  createdAt: string; expiresAt: string; status: 'ACTIVE' | 'EXPIRED' | 'REVOKED'; firstOpenedAt: string | null;
}
export interface AccountingSummaryDTO extends FinanceSummaryDTO {
  internalGrant: InternalGrantDTO;
  journal: { occurredAt: string; asset: string; quantity: string }[];
}
const str = { type: 'string' };
export const internalGrantSchema = strictObject({ id: str, evidenceId: str, version: { type: 'integer' }, recipientDid: str, recipientName: str,
  createdAt: str, expiresAt: str, status: { enum: ['ACTIVE','EXPIRED','REVOKED'] }, firstOpenedAt: { anyOf: [str,{type:'null'}] } });
