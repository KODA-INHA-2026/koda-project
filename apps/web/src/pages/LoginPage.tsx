import { useEffect, useRef, useState } from 'react';
import { defineControls } from 'tempo-sdk/assets';
import { loginBytes, toBase64Url, type ChallengeDTO, type PrincipalDTO, type SessionDTO } from '@koda/protocol';
import { api } from '../api/client';
import { DemoWorkspace, type TraceItem } from '../components/DemoWorkspace';
import { Notice } from '../components/Notice';
import { FileLoginPage } from './FileLoginPage';
const roles=[
  {id:'issuer',label:'KODA 운영자',action:'S-02 · 원본 발행 — 여기서 시작'},
  {id:'finance-a',label:'재무담당자',action:'S-03 · 잔고만 공개, 상세 거래는 가림'},
  {id:'accounting-a',label:'회계담당자',action:'S-03b → 04 · 결산용 거래와 감사 권한'},
  {id:'auditor-b',label:'외부 감사인',action:'S-05 → 07 · 지정 권한으로 원본 전체 확인'},
];
export function LoginPage({onLogin,notice,receiving=false,suggested}:{suggested?:string;onLogin:(s:SessionDTO)=>void;notice:string;receiving?:boolean}){
  const [mode,setMode]=useState<'CLICK'|'FILE'|null>(null),[people,setPeople]=useState<PrincipalDTO[]>([]),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const [selected,setSelected]=useState(''),[phase,setPhase]=useState(0),[busy,setBusy]=useState(false);
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>{const c=new AbortController();setError('');Promise.all([api<{mode:'CLICK'|'FILE'}>('/demo/auth-mode',{signal:c.signal}),api<PrincipalDTO[]>('/demo/principals',{signal:c.signal})]).then(([m,p])=>{if(!c.signal.aborted){setMode(m.mode);setPeople(p);}}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>{c.abort();pending.current?.abort();};},[attempt]);
  async function start(id:string){
    if(busy||pending.current)return;const person=people.find(p=>p.id===id);if(!person)return;
    const c=new AbortController();pending.current=c;setSelected(id);setBusy(true);setError('');setPhase(1);
    const post=<T,>(path:string,body:object)=>api<T>(path,{method:'POST',body:JSON.stringify(body),signal:c.signal});
    try{
      const resolved=await post<{did:string;mode:'MOCK'}>('/auth/demo-resolve',{principalId:id});
      if(resolved.did!==person.did||resolved.mode!=='MOCK')throw new Error('등록 신원이 변경되었습니다. 화면을 새로고침해 주세요.');
      setPhase(2);const challenge=await post<ChallengeDTO>('/auth/challenge',{did:resolved.did});
      if(challenge.did!==resolved.did||challenge.audience!==location.origin||toBase64Url(loginBytes({challengeId:challenge.challengeId,did:challenge.did,audience:challenge.audience,nonce:challenge.nonce,expiresAt:challenge.expiresAt}))!==challenge.signingBytes)throw new Error('인증 요청 내용이 다릅니다. 다시 시도해 주세요.');
      const signed=await post<{signature:string}>('/auth/demo-sign',{principalId:id,challengeId:challenge.challengeId});
      setPhase(3);const session=await post<SessionDTO>('/auth/verify',{challengeId:challenge.challengeId,signature:signed.signature});
      if(!c.signal.aborted)onLogin(session);
    }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'인증을 완료하지 못했습니다. 역할을 다시 눌러 주세요.');}
    finally{if(!c.signal.aborted){setBusy(false);pending.current=null;}}
  }
  if(mode==='FILE')return <FileLoginPage onLogin={onLogin} notice={notice} receiving={receiving}/>;
  const state=(n:number):TraceItem['state']=>phase===n?(error?'blocked':busy?'running':'idle'):phase>n?'confirmed':'idle';
  return <div className="page login-page click-login">{notice&&<Notice title="세션 안내">{notice}</Notice>}
    <DemoWorkspace step={1} role={(suggested||selected)==='issuer'?'ISSUER':(suggested||selected)==='finance-a'?'FINANCE':(suggested||selected)==='accounting-a'?'ACCOUNTING':(suggested||selected)==='auditor-b'?'AUDITOR':undefined} insight="역할을 누르면 신원 확인부터 서명 인증까지 이어집니다."
      trace={[
        {title:'모의 체인 · DID 등록 조회',detail:'서버의 시연 신원 원장에서 등록 DID를 읽습니다.',state:state(1)},
        {title:'시연 지갑 · 인증 요청 서명',detail:'격리된 시연 키로 일회용 요청에 실제 서명합니다.',state:state(2)},
        {title:'서버 · 서명과 역할 확인',detail:'서명·만료·재사용 여부를 검사한 뒤 세션을 만듭니다.',state:state(3)},
      ]}
      technical={<><p>DID 원장은 서버의 등록 신원 테이블로 모의 실행합니다. 실제 DID 체인 등록이나 RPC 요청은 없습니다.</p><p>시연 지갑은 로컬 서버에 보관된 데모 키로 서명합니다. 개인키는 브라우저로 보내지 않습니다. 실제 사용자 본인 확인을 대신하는 기능이 아닙니다.</p><p>현재 식별 방식은 did:key이며, 화면의 모의 체인 조회는 블록체인 기반 DID의 업무 흐름을 설명하는 데모 어댑터입니다.</p></>}
      document={<section className="role-picker" aria-label="시연 역할 선택"><h2>{suggested?'다음 담당자로 이어갑니다':receiving?'지정 감사인으로 원본을 열어보세요':'한 장의 증명서가 전달되는 과정'}</h2><p>{suggested?'이 담당자의 DID를 확인한 뒤, 방금 인계한 문서를 엽니다.':'KODA 발행부터 시작하세요. 역할을 바꿀 때마다 별도 DID로 인증합니다.'}</p>
        {!mode&&!error&&<p role="status">시연 신원을 준비하고 있습니다…</p>}
        <div className="role-picker-grid">{roles.filter(r=>suggested?r.id===suggested:!receiving||r.id==='auditor-b').map(r=><button className="role-choice" key={r.id} aria-label={r.label+(r.id==='auditor-b'?'으로 시작':'로 시작')} data-selected={selected===r.id} disabled={busy||!people.some(p=>p.id===r.id)||!mode} onClick={()=>void start(r.id)}><strong>{r.label}<span aria-hidden="true">→</span></strong><span>{r.action}</span><span className="role-did">DID · {people.find(p=>p.id===r.id)?.did.slice(-12)??'등록 신원 확인 중'}</span>{busy&&selected===r.id&&<span role="status">신원 확인 중…</span>}</button>)}</div>
        {error&&<Notice kind="error" title="시작하지 못했습니다">{error}<button className="text-button" onClick={()=>{if(!mode)setAttempt(n=>n+1);else if(selected)void start(selected);}}>다시 시도</button></Notice>}
      </section>} actions={null} records={null}/>
  </div>;
}
defineControls(LoginPage,{suggested:false,onLogin:false,notice:{type:'text'},receiving:{type:'boolean'}});
