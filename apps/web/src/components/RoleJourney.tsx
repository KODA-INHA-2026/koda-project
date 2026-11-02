import { defineControls } from 'tempo-sdk/assets';
import type { Role } from '@koda/protocol';

export function RoleJourney({ current, task, scene }: { current?: Role; task: string; scene?:string }) {
  return <header className="role-journey">

    <ol aria-label="역할별 업무와 인계 순서">
      <li aria-current={current==='ISSUER'?'step':undefined}><strong>KODA</strong><span>S-02 · 원본 발행</span></li>
      <li aria-current={current==='FINANCE'?'step':undefined}><strong>재무</strong><span>S-03 · 잔고 확인 → 인계</span></li>
      <li aria-current={current==='ACCOUNTING'?'step':undefined}><strong>회계</strong><span>S-03b → 04 · 결산·권한 전달</span></li>
      <li aria-current={current==='AUDITOR'?'step':undefined}><strong>외부 감사인</strong><span>S-05 → 07 · 원본·사본 검사</span></li>
    </ol>
    <div className="scene-title"><span className="current-scene">{scene??'S-01 · 신원 확인'}</span><h1>{task}</h1></div>
  </header>;
}
defineControls(RoleJourney,{scene:{type:'text'},current:{type:'select',options:['ISSUER','FINANCE','ACCOUNTING','AUDITOR']},task:{type:'text'}});
