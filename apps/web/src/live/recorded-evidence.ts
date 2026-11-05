import { renderCertificate } from './certificate.js';
import { sha256, type Proof, type TrustedDeployment } from './verification.js';
import type { SavedIssuance } from './storage.js';

// Public testnet transaction, explicitly approved and executed on 2026-11-06 KST.
// Never change the historical customer or PDF layout to match a new scenario.
export const recordedDeployment: TrustedDeployment = {
  chainId: 11155111,
  contract: '0xc13083047c0657ff576a972469d982b51e43dcb3',
  issuer: '0x5994aBF9b20319213c384a814f5C804FCF6bf9a7',
  deploymentTransaction: '0x2bf8e548990c8e391430c7f2f3344a955e912bf1efc915740617a8d51bb80de7',
};
export const recordedProof: Proof = {
  documentId: '0x603157e939369a0a8b69499c6849e26ea0938b394a099130c9fb71e7303af32a',
  documentHash: '0x4ffadf441fe587839f805dd70cc5836b465b449d1b7836f890716628dd2c2842',
  issuedAt: '1793904567',
  signature: '0x02e3dfd1671896ecbd43e7fbd5b8066d6fde80a2512d47c9a648123ba9c3e5b350eddb0e928acc4824a405a8a37db2ae149df95aa721656a07c3800a642ab9351b',
  transactionHash: '0x6c0d68e1f292a3ba9322e733291c0b2fb8da4fbbfe505d0466613438b0c2d1e8',
};
export const recordedBlock = '12071362';
export const recordedCustomer = '한울테크홀딩스㈜';

export function reproduceRecordedIssuance(font: Uint8Array): SavedIssuance {
  return {
    customer: recordedCustomer,
    deployment: recordedDeployment,
    proof: recordedProof,
    original: renderCertificate(font, recordedProof.documentId, recordedProof.issuedAt, false, recordedCustomer),
    altered: renderCertificate(font, recordedProof.documentId, recordedProof.issuedAt, true, recordedCustomer),
  };
}

export async function loadRecordedIssuance(): Promise<SavedIssuance> {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/PretendardVariable.ttf`);
  if (!response.ok) throw new Error('실증 PDF를 복원할 글꼴을 불러오지 못했어요. 페이지를 다시 열어 주세요.');
  const value = reproduceRecordedIssuance(new Uint8Array(await response.arrayBuffer()));
  if (await sha256(value.original) !== recordedProof.documentHash) {
    throw new Error('복원한 PDF가 등록 당시 지문과 달라요. 기존 실증 파일을 확인해 주세요.');
  }
  // This establishes exact PDF bytes only. Current chain status is read on Verify.
  return value;
}
