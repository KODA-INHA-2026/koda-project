import { useState, type ChangeEvent } from 'react';
import { isAddressEqual, recoverTypedDataAddress } from 'viem';
import { documentDomain, documentTypes } from '../../../../packages/chain/src/document-registry';
import type { Proof } from './verification';
import {
  inspectDeployment,
  publicClient,
  signDocument,
  type Connection,
} from './wallet';
import {
  loadRecordedIssuance,
  recordedDeployment,
  recordedProof,
} from './recorded-evidence';
import { sha256, verifyDocument } from './verification';
import {
  parseSignedComparisonFile,
  serializeSignedComparisonFile,
  verifySignedComparison,
} from './signed-comparison';
import './signed-comparison-setup.css';

const MAX_COMPARISON_FILE_BYTES = 64 * 1024;
const errorText = (error: unknown) => error instanceof Error ? error.message.split('\n')[0]! : String(error);
const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;

interface Props {
  connection?: Connection;
  busy: boolean;
  onBusy: (action: () => Promise<void>) => Promise<void>;
  candidate?: Proof;
  onPrepared: (candidate: Proof) => void;
  onConnect: () => void;
}

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function SignedComparisonSetup({ connection, busy, onBusy, candidate, onPrepared, onConnect }: Props) {
  const [status, setStatus] = useState(candidate ? '비교 자료 준비 완료' : '준비 전');
  const [error, setError] = useState('');

  async function assertLocalSignature(proof: Proof, bytes: Uint8Array) {
    if (await sha256(bytes) !== proof.documentHash) throw new Error('비교용 서명정보와 120 BTC PDF가 다릅니다.');
    const signer = await recoverTypedDataAddress({ domain: documentDomain(recordedDeployment.chainId, recordedDeployment.contract),
      types: documentTypes, primaryType: 'Document', message: { documentId: proof.documentId, documentHash: proof.documentHash, issuedAt: BigInt(proof.issuedAt) }, signature: proof.signature });
    if (!isAddressEqual(signer, recordedDeployment.issuer)) throw new Error('비교용 서명이 지정된 시험 발급자와 다릅니다.');
  }

  async function assertComparison(candidateProof: Proof) {
    const issuance = await loadRecordedIssuance();
    const checked = await verifySignedComparison(
      issuance.altered,
      candidateProof,
      recordedProof,
      recordedDeployment,
      publicClient,
    );
    if (checked.status !== 'file-mismatch'
      || checked.signatureValid !== true
      || checked.chainRecordValid !== true
      || checked.fileMatch !== true
      || !checked.signedComparison?.signatureValid
      || !checked.signedComparison.fileMatch
      || !checked.signedComparison.registrationConflict) {
      throw new Error('서명·120 BTC PDF·기존 등록 원본의 비교 조건이 일치하지 않습니다.');
    }
    return issuance;
  }

  async function prepare() {
    setError('');
    await onBusy(async () => {
      try {
        if (!connection) throw new Error('시험 발급자 지갑을 먼저 연결해 주세요.');
        setStatus('기존 등록 원본 확인 중');
        const issuance = await loadRecordedIssuance();
        await inspectDeployment(recordedDeployment);
        const original = await verifyDocument(
          issuance.original,
          recordedProof,
          recordedDeployment,
          publicClient,
        );
        if (original.status !== 'match') {
          throw new Error(`기존 등록 원본을 확인하지 못했습니다. ${original.message}`);
        }

        setStatus('120 BTC 비교 문서 서명 요청 중');
        const documentHash = await sha256(issuance.altered);
        const unsigned = {
          documentId: recordedProof.documentId,
          documentHash,
          issuedAt: recordedProof.issuedAt,
        };
        const signature = await signDocument(connection, recordedDeployment, unsigned);
        const prepared: Proof = { ...unsigned, signature };
        await assertLocalSignature(prepared, issuance.altered);
        // Preserve an approved signature before another network request can fail.
        onPrepared(prepared);
        setStatus('서명 저장 완료 · 등록 원본과 대조 중');
        await assertComparison(prepared);
        setStatus('서명·파일 일치 / 기존 등록 원본과 불일치 확인');
      } catch (cause) {
        setStatus('준비 실패');
        setError(errorText(cause));
        throw cause;
      }
    });
  }

  async function importComparison(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    setError('');
    await onBusy(async () => {
      try {
        if (file.size > MAX_COMPARISON_FILE_BYTES) throw new Error('비교용 검증정보는 64 KiB 이하여야 합니다.');
        setStatus('비교 자료 확인 중');
        const parsed = parseSignedComparisonFile(
          await file.text(),
          recordedProof,
          recordedDeployment,
        );
        await assertComparison(parsed);
        onPrepared(parsed);
        setStatus('가져온 비교 자료 확인 완료');
      } catch (cause) {
        setStatus('가져오기 실패');
        setError(errorText(cause));
        throw cause;
      }
    });
  }

  async function downloadFiles() {
    if (!candidate) return;
    setError('');
    try {
      const issuance = await loadRecordedIssuance();
      await assertLocalSignature(candidate, issuance.altered);
      const serialized = serializeSignedComparisonFile(candidate, recordedProof, recordedDeployment);
      download(new TextEncoder().encode(serialized), 'BTC잔고_재서명_비교정보.json', 'application/json');
      download(issuance.altered, 'BTC잔고_120BTC_재서명_비교문서.pdf', 'application/pdf');
      setStatus('비교용 PDF와 검증정보 저장 완료');
    } catch (cause) {
      setStatus('저장 실패');
      setError(errorText(cause));
    }
  }

  return <section className="signed-comparison-setup" aria-labelledby="signed-comparison-title">
    <div>
      <small>발표자용 보조 사례</small>
      <h3 id="signed-comparison-title">유효한 새 서명과 최초 등록 기준 비교</h3>
      <p>시험 발급자가 같은 문서 ID의 120 BTC 문서에 다시 서명합니다. 원래 Ethereum 등록은 바꾸지 않으며, 새 거래와 가스비는 없습니다.</p>
      <p>실제 시험 지갑의 오프체인 서명 사례이며, 공식 KODA 발급이나 외부인의 서명 위조를 뜻하지 않습니다.</p>
    </div>
    <div className="setup-actions">
      {!connection && <button disabled={busy} onClick={onConnect}>MetaMask 연결</button>}
      <button className="primary" disabled={busy || !connection} onClick={() => void prepare()}>비교용 120 BTC 문서에 서명</button>
      {candidate && <button disabled={busy} onClick={() => void downloadFiles()}>비교용 검증정보 받기</button>}
      <label className="signed-comparison-import">
        저장한 비교정보 불러오기
        <input type="file" accept="application/json,.json" disabled={busy} onChange={event => void importComparison(event)} />
      </label>
    </div>
    <p className="signed-comparison-status" role="status"><b>{candidate && status === '준비 전' ? '저장된 비교자료 있음 · 실행 시 다시 검증' : status}</b>{candidate && <> · 시험 발급자 {short(recordedDeployment.issuer)}</>}</p>
    {error && <p className="signed-comparison-error" role="alert">{error}</p>}
  </section>;
}
