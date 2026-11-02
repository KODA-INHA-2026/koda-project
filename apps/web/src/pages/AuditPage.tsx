import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_EVIDENCE_FILE_BYTES, parseEvidenceFile, inspectEvidenceFile, type FileInspection, type AuditEnvelopeDTO, canonicalJson, parseCanonical, toBase64Url, validatePayload, verifyEnvelope, type AuditAccessDTO, type EvidencePayload, type SessionDTO, type TrustedConfig, type VerificationResult } from '@koda/protocol';
import { anchorReader } from '@koda/chain/reader';
import { Certificate } from '../components/Certificate';
import { api, RequestError } from '../api/client';
import { Notice } from '../components/Notice';
import { VerificationPanel, displayDate } from '../components/VerificationPanel';

export function AuditPage({ path, token, session, navigate, consumed, onUnauthorized }: { path: string; token: string | null; session: SessionDTO; navigate: (p: string) => void; consumed: () => void; onUnauthorized: () => void }) {
  const [access, setAccess] = useState<AuditAccessDTO | null>(null); const [error, setError] = useState(''); const [checking, setChecking] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null); const [busy, setBusy] = useState(false); const [copy, setCopy] = useState(false); const [retryable, setRetryable] = useState(false);
  const [file, setFile] = useState<{ name: string; envelope: AuditEnvelopeDTO } | null>(null); const [fileError, setFileError] = useState(''); const [inspection, setInspection] = useState<FileInspection | null>(null); const [inquiry, setInquiry] = useState(false); const [copyNotice, setCopyNotice] = useState('');
  const fileGeneration = useRef(0); const fileInput = useRef<HTMLInputElement>(null); const viewId = useRef(crypto.randomUUID()); const openedGrant = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null); const permissionGeneration = useRef(0); const checkingNow = useRef(true);
  const verification = useRef<AbortController | null>(null); const generation = useRef(0);
  const currentBinding = useRef<string | null>(null);
  const lastResult = useRef<{ binding: string; result: VerificationResult; copy: boolean; inspection: FileInspection | null } | null>(null);
  const grantId = path.startsWith('/audit/grants/') ? path.split('/')[3] : null;
  const subject = [session.principal.id, session.principal.did, session.principal.role, session.principal.organizationId, session.csrf].join(':');
  const bindingFor = useCallback(async (value: AuditAccessDTO, trust: TrustedConfig) => toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson({ subject, grant: { id: value.grant.id, evidenceId: value.grant.evidenceId, version: value.grant.version, auditorDid: value.grant.auditorDid, scope: value.grant.scope, createdAt: value.grant.createdAt, expiresAt: value.grant.expiresAt, status: value.grant.status }, envelope: value.envelope, trust }))))), [subject]);
  const invalidate = useCallback((cancelPermission = false) => {
    if (cancelPermission) { permissionGeneration.current++; request.current?.abort(); checkingNow.current = document.hidden; setChecking(document.hidden); }
    generation.current++; verification.current?.abort(); verification.current = null;
    fileGeneration.current++; setFile(null); setFileError(''); setInspection(null); setInquiry(false); setCopyNotice(''); if (fileInput.current) fileInput.current.value = '';
    lastResult.current = null; currentBinding.current = null; setResult(null); setCopy(false); setBusy(false);
  }, []);
  const hide = useCallback(() => { checkingNow.current = true; setChecking(true); setAccess(null); setResult(null); setInspection(null); setCopy(false); }, []);
  const recheck = useCallback(async () => {
    const id = ++permissionGeneration.current; request.current?.abort(); const controller = new AbortController(); request.current = controller;
    hide(); setError(''); setRetryable(false);
    try {
      if (!grantId && !token) { invalidate(); setError('원래 공유 링크를 다시 열어 주세요. 새로고침으로 링크 정보가 사라졌습니다.'); return; }
      const response = grantId ? await api<AuditAccessDTO>('/grants/' + grantId + (openedGrant.current === grantId ? '/evidence' : '/open'), openedGrant.current === grantId ? { signal: controller.signal } : { method: 'POST', headers: { 'x-csrf-token': session.csrf }, body: JSON.stringify({ viewId: viewId.current }), signal: controller.signal }) : await api<AuditAccessDTO>('/grants/open', { method: 'POST', headers: { 'x-csrf-token': session.csrf }, body: JSON.stringify({ token, viewId: viewId.current }), signal: controller.signal });
      if (controller.signal.aborted || id !== permissionGeneration.current) return;
      openedGrant.current = response.grant.id;
      if (!grantId) { consumed(); navigate('/audit/grants/' + response.grant.id); return; }
      const trust = await api<TrustedConfig>('/verification/trust', { signal: controller.signal });
      const binding = await bindingFor(response, trust);
      if (controller.signal.aborted || id !== permissionGeneration.current) return;
      if (currentBinding.current !== null && currentBinding.current !== binding) invalidate();
      currentBinding.current = binding;
      // Only an exact, authorized binding can restore an in-memory historical result.
      if (!document.hidden) {
        setAccess(response);
        const saved = lastResult.current;
        if (saved?.binding === binding) { setResult(saved.result); setCopy(saved.copy); setInspection(saved.inspection); }
      }
    } catch (e) {
      if (controller.signal.aborted || id !== permissionGeneration.current) return;
      invalidate();
      if (e instanceof RequestError && e.status === 401) onUnauthorized();
      else { setError(e instanceof Error ? e.message : '열람 권한을 확인하지 못했습니다.'); setRetryable(e instanceof RequestError && (e.status === 0 || e.status >= 500)); }
    } finally { if (!controller.signal.aborted && id === permissionGeneration.current && !document.hidden) { checkingNow.current = false; setChecking(false); } }
  }, [grantId, token, session.csrf, navigate, consumed, onUnauthorized, bindingFor, hide, invalidate]);
  useEffect(() => {
    void recheck();
    const interval = setInterval(() => { if (!document.hidden) void recheck(); }, 15_000);
    const focus = () => { if (!document.hidden) void recheck(); };
    const visibility = () => { if (document.hidden) { permissionGeneration.current++; request.current?.abort(); hide(); } else void recheck(); };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', visibility);
    return () => { if (grantId) { openedGrant.current = null; viewId.current = crypto.randomUUID(); } permissionGeneration.current++; generation.current++; request.current?.abort(); verification.current?.abort(); lastResult.current = null; currentBinding.current = null; clearInterval(interval); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility); };
  }, [recheck, hide, grantId]);
  async function verify(selectedFile = false) {
    if (selectedFile && !file) return;
    const fileVersion = fileGeneration.current; const selected = file;
    if (!access || busy || checkingNow.current || !grantId) return;
    const id = ++generation.current; verification.current?.abort(); const controller = new AbortController(); verification.current = controller;
    lastResult.current = null; setBusy(true); setResult(null); setError(''); setCopy(selectedFile); setInspection(null);
    try {
      const current = await api<AuditAccessDTO>('/grants/' + grantId + '/evidence', { signal: controller.signal });
      const trust = await api<TrustedConfig>('/verification/trust', { signal: controller.signal });
      const binding = await bindingFor(current, trust);
      if (controller.signal.aborted || generation.current !== id || fileGeneration.current !== fileVersion) return;
      if (binding !== currentBinding.current) { invalidate(true); void recheck(); return; }
      const inspected = selectedFile && selected ? await inspectEvidenceFile(selected.envelope, current.envelope, trust, anchorReader(trust)) : null;
      const outcome = inspected?.result ?? await verifyEnvelope(current.envelope, trust, { mode: 'CLIENT_DIRECT', anchor: anchorReader(trust) });
      if (controller.signal.aborted || generation.current !== id || fileGeneration.current !== fileVersion) return;
      // Permission is rechecked after RPC/crypto as well; a late result cannot revive a revoked view.
      await api('/grants/' + grantId + '/verification-events', { method: 'POST', headers: { 'x-csrf-token': session.csrf }, body: JSON.stringify({ status: outcome.status }), signal: controller.signal });
      const finalAccess = await api<AuditAccessDTO>('/grants/' + grantId + '/evidence', { signal: controller.signal });
      const finalTrust = await api<TrustedConfig>('/verification/trust', { signal: controller.signal });
      const finalBinding = await bindingFor(finalAccess, finalTrust);
      if (controller.signal.aborted || generation.current !== id || fileGeneration.current !== fileVersion) return;
      if (finalBinding !== binding || currentBinding.current !== binding) { invalidate(true); void recheck(); return; }
      lastResult.current = { binding, result: outcome, copy: selectedFile, inspection: inspected };
      if (!checkingNow.current && !document.hidden) { setAccess(finalAccess); setResult(outcome); setCopy(selectedFile); setInspection(inspected); }
    } catch (e) {
      if (controller.signal.aborted || generation.current !== id || fileGeneration.current !== fileVersion) return;
      if (!(e instanceof RequestError)) { setFileError(e instanceof Error ? e.message : '파일을 검사할 수 없습니다.'); return; }
      setAccess(null); invalidate(true);
      if (e instanceof RequestError && e.status === 401) onUnauthorized(); else { setError(e instanceof Error ? e.message : '검증을 완료하지 못했습니다.'); setRetryable(e instanceof RequestError && (e.status === 0 || e.status >= 500)); }
    } finally { if (!controller.signal.aborted && generation.current === id) { verification.current = null; setBusy(false); } }
  }
  async function chooseFile(value: File | undefined) {
    const id = ++fileGeneration.current; generation.current++; verification.current?.abort(); setBusy(false); lastResult.current = null;
    setFile(null); setFileError(''); setResult(null); setInspection(null); setCopy(false); setInquiry(false); setCopyNotice('');
    if (!value) return;
    try {
      if (value.size > MAX_EVIDENCE_FILE_BYTES) throw new Error('파일은 1 MiB 이하여야 합니다.');
      if (!value.name.toLowerCase().endsWith('.json')) throw new Error('JSON 시연 파일만 지원합니다. PDF/OCR·메일 연동은 지원하지 않습니다.');
      const envelope = parseEvidenceFile(await value.text());
      if (id === fileGeneration.current) setFile({ name: value.name, envelope });
    } catch (e) { if (id === fileGeneration.current) setFileError(e instanceof Error ? e.message : '파일을 읽을 수 없습니다.'); }
  }
  async function returnToOriginal() { invalidate(); await recheck(); window.scrollTo(0, 0); }
  const inquiryText = access && file && result ? `KODA 확인 문의 초안\n문서: ${access.envelope.evidenceId} · 버전 ${access.envelope.version}\n파일: ${file.name}\n검사 결과: ${result.status} / ${result.reasonCode}\n검사 시각: ${result.checkedAt}\n원본과 사본의 확인을 요청합니다.` : '';
  let payload: EvidencePayload | null = null;
  try { if (access) { const parsed = parseCanonical(access.envelope.payloadCanonical); validatePayload(parsed); payload = parsed; } } catch { /* Unsupported original is never rendered as valid. */ }
  return <div className="page detail-page">
    {checking ? <p role="status" className="loading-state">열람 권한을 확인하고 있어요…</p> : error ? <Notice kind="error" title="공유 자료를 열 수 없습니다">{error}{retryable && <button className="text-button" onClick={() => void recheck()}>권한 다시 확인</button>}</Notice> : access && <>
      <header className="page-heading"><p className="eyebrow">S-05 · 지정 감사인 전체 열람</p><div className="section-action"><h1>{payload?.customerDisplayName ?? '공유받은'} 잔고 증명서</h1><button className="button primary" disabled={busy} onClick={() => void verify()}>원본 검증하기</button></div><p className="field-hint">전체 항목 열람 · 만료 {displayDate(access.grant.expiresAt)}<br />인증된 원본 접근이 기록됩니다. 주기적 권한 확인은 새 열람으로 세지 않습니다.</p></header>
      {!result && !busy && <p className="field-hint" role="status">아직 검증하지 않았습니다.</p>}
      {result && !copy && <VerificationPanel result={result} busy={busy} run={() => void verify(copy)} copy={copy} authorizationCheckedAt={access.authorizationCheckedAt} expiresAt={access.grant.expiresAt} chainMismatch={inspection?.chainMismatch} />}
      {result && !copy && <button className="button secondary" onClick={() => { fileInput.current?.scrollIntoView({ block: "center" }); fileInput.current?.focus(); }}>메일 사본 검사로 이동</button>}
      {busy && !result && <p role="status" className="processing-notice">실제 서명·지문·체인 기록을 확인하고 있습니다…</p>}
      {payload && <Certificate payload={payload} envelope={access.envelope} />}
      <section className="file-inspection" aria-labelledby="file-title"><p className="eyebrow">S-07 · 메일 수정본 검사</p><h2 id="file-title">전달받은 파일도 같은 원본일까요?</h2><p>메일 사본 · 시연. 실제 메일 출처를 인증하는 기능은 아닙니다.</p><label className="field-label" htmlFor="evidence-file">검사할 시연 JSON 파일</label><input ref={fileInput} id="evidence-file" type="file" accept=".json,application/json" onChange={e => void chooseFile(e.target.files?.[0])} aria-describedby="file-help" /><p className="field-hint" id="file-help">서명·검증 정보가 담긴 JSON · 최대 1 MiB. 브라우저 메모리에서만 검사하며 PDF/OCR·메일 연동은 지원하지 않습니다.</p>
        {file && <p className="selected-file">선택 파일 · {file.name}</p>}{fileError && <Notice kind="error" title="파일을 검사할 수 없습니다">{fileError}</Notice>}
        <button className="button primary" disabled={!file || busy} onClick={() => void verify(true)}>{busy && copy ? '파일 검사 중…' : '선택 파일 검사'}</button>
        {copy && result && <VerificationPanel result={result} busy={busy} run={() => void verify(true)} copy authorizationCheckedAt={access.authorizationCheckedAt} expiresAt={access.grant.expiresAt} chainMismatch={inspection?.chainMismatch} />}
        {copy && inspection && result && <div className="file-findings" data-status={result.status}>
          <h3>{inspection.chainMismatch ? '체인 기록과 다릅니다.' : result.status === 'VALID' ? '선택 파일이 원본과 같습니다.' : '선택 파일의 검사 근거를 확인해 주세요.'}</h3>
          <p>원본 기준 검사: {inspection.baseline.status === 'VALID' ? '서명·지문·체인 기록 확인' : '확인 불가 · ' + inspection.baseline.reasonCode}</p>
          {inspection.baseline.anchorEvidence && <p>원본 체인 기록 시각 {displayDate(inspection.baseline.anchorEvidence.recordedAt)}</p>}
          {inspection.differences.length > 0 && <table className="document-table difference-table"><thead><tr><th>변경 항목</th><th>발행 원본</th><th>선택 파일</th></tr></thead><tbody>{inspection.differences.map(d => <tr key={d.field}><th scope="row">{d.field.replace('.quantity', ' 수량')}</th><td data-label="발행 원본">{d.before}</td><td data-label="선택 파일">{d.after}</td></tr>)}</tbody></table>}
          <p className="field-hint">원본의 실제 체인 검사와 파일의 검사는 별개입니다. 파일에서 미실행된 검사를 확인으로 표시하지 않습니다.</p>
          <div className="button-row"><button className="button secondary" onClick={() => void returnToOriginal()}>원본 링크로 다시 받기</button><button className="button secondary" onClick={() => setInquiry(true)}>KODA에 확인 요청</button></div>
          {inquiry && <div className="inquiry"><h3>문의 내용 확인 · 실제 발송 없음</h3><pre>{inquiryText}</pre><button className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(inquiryText); setCopyNotice('문의 내용을 복사했습니다. 실제 발송·접수는 하지 않았습니다.'); } catch { setCopyNotice('복사하지 못했습니다. 클립보드 권한을 확인해 주세요.'); } }}>문의 내용 복사</button><p role="status">{copyNotice}</p></div>}
        </div>}
      </section>
      <p className="field-hint">만료·철회가 확인되면 원본·파일·차이·결과를 비웁니다. 이미 열람한 내용은 회수되지 않습니다.</p>
    </>}
  </div>;
}
