import { DemoWorkspace } from '../components/DemoWorkspace';
import { useEffect, useRef, useState } from 'react';
import { defineControls } from 'tempo-sdk/assets';
import type { PrincipalDTO, SessionDTO } from '@koda/protocol';
import { api } from '../api/client';
import { loginWithFile } from '../auth/identity';
import { Notice } from '../components/Notice';

export function FileLoginPage({ onLogin, notice, receiving = false }: { onLogin: (session: SessionDTO) => void; notice: string; receiving?: boolean }) {
  const [people, setPeople] = useState<PrincipalDTO[]>([]);
  const [selected, setSelected] = useState(receiving ? 'auditor-b' : 'issuer');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError('');
    api<PrincipalDTO[]>('/demo/principals', { signal: controller.signal }).then(setPeople).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); request.current?.abort(); };
  }, [attempt]);
  const person = people.find(p => p.id === selected);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!person || !file || busy) return;
    setBusy(true); setError(''); const controller = new AbortController(); request.current = controller;
    try { const session = await loginWithFile(person, file, controller.signal); if (!controller.signal.aborted) onLogin(session); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '인증하지 못했습니다.'); }
    finally { if (!controller.signal.aborted) { setBusy(false); setFile(null); if (input.current) input.current.value = ''; } }
  }
  return <div className="page login-page">{notice && <Notice title="세션 안내">{notice}</Notice>}
    <DemoWorkspace step={1} insight="신원을 고르는 것만으로 로그인되지 않습니다. 서명 확인과 서버의 역할 확인을 모두 거칩니다."
      trace={[
        {title:'등록 신원 선택',detail:person ? `${person.name} · ${person.organizationName}`:'시연 신원을 불러옵니다.',state:person?'confirmed':'idle'},
        {title:'브라우저에서 서명',detail:'일회용 인증 요청을 개인키로 서명합니다. 개인키는 브라우저 안에서만 사용합니다.',state:busy?'running':error?'blocked':'idle'},
        {title:'서버에서 권한 확인',detail:'등록된 DID의 공개키로 서명을 검사하고, 회사·역할에 맞는 세션을 만듭니다.',state:busy?'running':'idle'},
      ]}
      technical={<><p>DID는 신원을 가리키는 식별자입니다. 키 파일은 그 신원을 제어한다는 것을 증명하는 수단입니다.</p><p className="technical-value">{person?.did}</p><p>회사 소속·감사 자격을 외부에서 인증한 것은 아닙니다. 서버에 등록된 시연 관계로 권한을 판단합니다.</p></>}
      document={<section className="login-panel" aria-labelledby="auth-title"><h2 id="auth-title">인증하고 시작하기</h2>{receiving && <p>링크에 지정된 감사인으로 인증해 주세요.</p>}
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="principal">시연 신원 <span>필수</span></label>
          <select id="principal" value={selected} disabled={busy || loading} onChange={e => { setSelected(e.target.value); setFile(null); setError(''); if (input.current) input.current.value = ''; }}>
            {people.map(p => <option key={p.id} value={p.id}>{p.name} · {p.organizationName}</option>)}
          </select>
          {loading && <p className="field-hint" role="status">등록된 신원을 불러오는 중…</p>}
          <label className="field-label key-label" htmlFor="key-file">해당 신원의 키 파일 <span>필수</span></label>
          <div className="file-field"><div className="file-description"><strong>{file ? file.name : '키 파일 선택'}</strong><span>{file ? '선택한 파일로 인증합니다' : person?.keyFile ?? '초기 준비에서 생성한 JSON 파일'}</span></div>
            <input ref={input} id="key-file" type="file" accept=".json,application/json" disabled={busy || !person} aria-describedby="key-help" onChange={e => { setFile(e.target.files?.[0] ?? null); setError(''); }} />
          </div>
          <p className="field-hint" id="key-help">키 파일은 DID 자체가 아니라, 그 신원으로 서명하는 비밀키입니다. 서버로 업로드하지 않습니다.</p>
          {error && <Notice kind="error" title="인증을 진행할 수 없습니다">{error}{!people.length && <button className="text-button" type="button" onClick={() => setAttempt(n => n + 1)}>신원 목록 다시 불러오기</button>}</Notice>}
          <button className="button primary login-button" type="submit" disabled={!file || !person || busy}>{busy ? '신원을 확인하고 있어요…' : '시연 신원 인증'}</button>
        </form></section>} actions={null}
      records={<div className="scope-grid"><div><h3>KODA 운영자</h3><p>원본 확인 · 발행</p></div><div><h3>재무담당자</h3><p>잔고·평가액 확인 · 회계 인계</p></div><div><h3>회계담당자</h3><p>결산용 거래 확인 · 감사 권한 전달</p></div><div><h3>지정 감사인</h3><p>전체 열람 · 원본과 사본 검사</p></div></div>}/>
  </div>;
}
defineControls(FileLoginPage, { onLogin: false, notice: { type: 'text' }, receiving: { type: 'boolean' } });
