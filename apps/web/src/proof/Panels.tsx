import { defineControls } from 'tempo-sdk/assets';
import type { ReactNode } from 'react';
import type { Demo } from './useDemo';
import { AUDITOR, ISSUER, RECORDED_AT, roles, saveFile, shortHash } from './model';
function Check({ title, detail, status, kind = 'empty' }: { title: string; detail?: ReactNode; status?: string; kind?: 'ok' | 'bad' | 'empty' }) {
  return <div className="row"><span className={kind === 'ok' ? 'ic' : kind === 'bad' ? 'ic x' : 'ic o'} /><span><b>{title}</b>{detail && <span className="sub">{detail}</span>}</span><span className="st" data-kind={kind}>{status}</span></div>;
}
defineControls(Check, { title: { type: 'text' }, detail: false, status: { type: 'text' }, kind: { type: 'select' } });
export function DemoPanel({ demo: d }: { demo: Demo }) {
  const hash = shortHash(d.manifest?.hash ?? '');
  if (d.screen === 0) return <>
    <div className="ptitle">DID 서명 요청<span className="ipin">2</span></div>
    <div className="selected-role">{roles[d.role]!.name}</div><div className="mono panel-did">{roles[d.role]!.did}</div>
    <div className="vsteps"><div>서명 요청<small>시연용 모의 인증</small></div><div className={d.authenticated ? '' : 'wait'}>{d.authenticated ? '인증 완료' : '인증 대기'}<small>{d.authenticated ? '완료 · 모의' : '버튼을 눌러 승인'}</small></div></div>
    <div className="pfoot"><button className="btn" disabled={Boolean(d.busy)} onClick={() => void d.authenticate()}>{d.busy || (d.authenticated ? `${d.role === 0 ? 'KODA' : d.role === 1 ? '재무·회계 담당자' : '감사인'}로 들어가기` : '서명 요청 승인 · 모의')}</button><button className="btn ghost" onClick={() => { d.setRole((d.role + 1) % 3); d.setAuthenticated(false); }}>다른 역할 고르기</button></div>
  </>;
  if (d.screen === 1) return <>
    <div className="seg"><button className="on" onClick={() => d.setTab('발행 이력')}>발행</button><button onClick={() => d.go(8)}>열람 정책</button></div>
    <dl className="fl"><dt>고객사</dt><dd><select aria-label="발행 고객사"><option>㈜가온테크 · 상장법인·가상</option></select></dd><dt>기준일</dt><dd><select aria-label="발행 기준일"><option>2026-09-30</option></select></dd><dt>포함 자산</dt><dd><select aria-label="포함 자산"><option>BTC · ETH · USDC</option></select></dd><dt>열람 정책</dt><dd>재무·회계 <span className="tag hide">일부 가림</span><br />외부 감사인 <span className="tag ok">전체</span></dd></dl>
    <div className="vsteps">{['문서 생성', 'DID 서명', '체인 기록'].map((label, index) => <div key={label} className={d.issueStage > index ? '' : 'wait'}>{label}<small>{d.issueStage > index ? ['10-01 10:02:11', '10-01 10:02:14 · 모의', '10-01 10:02:19 · 모의'][index] : '대기'}</small></div>)}</div>
    <div className="pfoot"><button className="btn navy" disabled={Boolean(d.busy) || !d.manifest} onClick={() => void d.issue()}>{d.busy || (d.issueStage === 3 ? '고객사 증빙함으로' : '발행하고 체인에 기록')}</button></div>
  </>;
  if (d.screen === 2) return <>
    <div className="seg"><button className="on">열람</button><button onClick={() => d.go(3)}>권한 보내기</button></div>
    <div className="ptitle">가린 항목 3개</div><div className="chk" style={{ marginTop: 6 }}><Check title="보관 지갑 주소" detail="앞뒤 4자리만 · 주소 추적 방지" /><Check title="거래 상대방" detail="가림 · 비밀유지약정" /><Check title="개별 거래 내역" detail="건수만 · Tx로 역추적 방지" /></div>
    <div className="pfoot"><div className="note" style={{ marginBottom: 4 }}>외부감사 제출은 파일이 아니라 <b>권한</b>으로 보냅니다.</div><button className="btn" onClick={() => d.go(3)}>감사인에게 권한 보내기</button><button className="btn off" disabled>원본 내려받기 없음<span className="ipin">2</span></button></div>
  </>;
  if (d.screen === 3) return <>
    <div className="seg"><button onClick={() => d.go(2)}>열람</button><button className="on">권한 보내기</button></div>
    <dl className="fl" style={{ rowGap: 10 }}><dt>받는 사람</dt><dd><b>한울회계법인</b> <span className="lbl">가상</span><span className="ipin">1</span><select className="mono did-select" aria-label="감사인 DID" value={d.auditor} onChange={e => { d.setAuditor(e.target.value); }} disabled={d.grantStage > 0}><option value={AUDITOR}>{AUDITOR}</option></select></dd>
      <dt>공개 범위</dt><dd><select aria-label="공개 범위"><option>외부감사 제출용 · 전체 항목</option></select><div className="lbl">전체 항목 · 시연 설정</div></dd>
      <dt>열람 기간</dt><dd className="date-range"><input aria-label="열람 시작일" type="date" value={d.starts} disabled={d.grantStage > 0 && !d.expired} onChange={e => d.setStarts(e.target.value)} /><span>~</span><input aria-label="열람 만료일" type="date" value={d.expires} disabled={d.grantStage > 0 && !d.expired} onChange={e => d.setExpires(e.target.value)} /></dd>
      <dt>목적</dt><dd>2026년 3분기 검토</dd></dl>
    <div className="pfoot"><div className="note" style={{ marginBottom: 4 }}>원본 파일은 <b>내 PC를 거치지 않습니다.</b></div><button className="btn" disabled={Boolean(d.busy)} onClick={() => void d.grant()}>{d.busy || (d.grantStage === 3 && !d.expired ? '감사인으로 원본 열기' : '권한 보내기')}</button></div>
  </>;
  if (d.expired) return <><div className="result"><div className="big neutral">열람 권한이 만료되었습니다.</div></div><p className="lead">시연일을 만료 이후로 전환한 상태입니다. 원본 열람과 항목 비교를 차단합니다.</p><div className="pfoot"><button className="btn" onClick={() => { d.setExpired(false); d.go(3); d.setNotice('권한 기간을 확인하고 다시 전달해 주세요.'); }}>권한 다시 요청하기</button></div></>;
  if (d.screen === 4) return <>
    <div className="seg"><button className="on">원본 검증</button><button onClick={() => d.go(6)}>파일로 검증</button></div>
    <div style={{ fontSize: 14, lineHeight: 1.55 }}>KODA 원본을 체인 기록과 대조합니다. 아래 네 가지를 확인합니다.</div>
    <div className="chk">{['발행자 서명', '문서 지문(해시)', '체인 기록 시각', '열람 권한'].map(title => <Check key={title} title={title} />)}</div>
    <div className="pfoot"><button className="btn navy" disabled={Boolean(d.busy) || !d.manifest} onClick={() => void d.verify()}>{d.busy || <>원본 검증하기<span className="ipin">3</span></>}</button></div>
  </>;
  if (d.screen === 5 || (d.screen === 6 && d.fileResult === 'match')) return <>
    <div className="seg"><button className={d.screen === 5 ? 'on' : ''} onClick={() => d.go(4)}>원본 검증</button><button className={d.screen === 6 ? 'on' : ''} onClick={() => d.go(6)}>파일로 검증</button></div>
    <div className="result"><span className="ring" /><div className="big">KODA가 발행한<br /><span className="mark">원본과 같습니다.</span><span className="ipin">1</span></div></div>
    <div className="chk"><Check title="발행자 서명" detail={ISSUER} kind="ok" status="일치" /><Check title="문서 지문" detail={<>지금 문서 {hash}<br />체인 기록 {hash}</>} kind="ok" status="일치" /><Check title="체인 기록 시각" detail="2026-10-01 10:02:19 · 시연용 모의 기록" kind="ok" status="확인" /><Check title="열람 권한" detail={`외부감사 제출용 · ~${d.expires}`} kind="ok" status="유효" /></div>
    <div className="pfoot" style={{ flexDirection: 'row' }}><button className="btn" style={{ flex: 1 }} onClick={() => { saveFile('KODA_검증증적_모의.json', JSON.stringify({ mode: 'DEMO_MOCK', result: 'ORIGINAL_MATCH', fileHash: d.manifest?.hash, issuer: ISSUER, recordedAt: RECORDED_AT, expires: d.expires, verifiedAt: new Date().toISOString(), notice: '지문은 실제 SHA-256 계산. DID 서명·체인·권한은 시연용 모의 상태.' }, null, 2), 'application/json'); d.record('검증 증적 저장', '시연용 모의 검증 결과'); d.setNotice('검증 증적을 저장했습니다. 시연용 모의 결과입니다.'); }}>검증 증적 저장</button><button className="btn ghost" style={{ flex: 1 }} onClick={() => d.go(7)}>공개 기록 보기<span className="ipin">3</span></button></div>
  </>;
  return <>
    <div className="seg"><button onClick={() => d.go(4)}>원본 검증</button><button className="on">파일로 검증</button></div>
    <div className="result">{d.fileResult === 'changed' && <span className="ring x"><i /><i /></span>}<div className={d.fileResult === 'changed' ? 'big failure' : 'big neutral'}>{d.fileResult === 'changed' ? '체인 기록과 다릅니다.' : d.fileResult === 'copy' ? '원본 아님 · 재저장 사본 또는 열람본' : '지문 불일치 · 내용 비교 불가'}</div></div>
    <div className="file-explanation">{d.fileResult === 'changed' ? '원본이 아니거나, 발행 이후 내용이 바뀌었습니다.' : d.fileResult === 'copy' ? '파일 지문은 다르지만 확인한 항목은 같습니다. 위변조로 단정하지 않습니다.' : d.fileMessage}</div>
    <div className="chk"><Check title="문서 지문" detail={<>올린 파일 {shortHash(d.fileHash)}<br />체인 기록 {hash}</>} kind={d.fileResult === 'changed' ? 'bad' : 'empty'} status="불일치" />
      {d.fileResult === 'changed' ? <Check title={`바뀐 항목 ${d.differences.length || 2}곳`} detail={d.differences.length ? d.differences.map(change => <span key={change.field} className="change-line">{change.label} {change.before} → {change.after}</span>) : <>BTC 수량 12.4500 → 15.4500<br />BTC 평가액 19.4억 → 24.1억 원</>} kind="bad" status="변경" /> : <Check title="항목 비교" detail={d.fileResult === 'copy' ? '수량·평가액 등 전체 항목 동일' : '지원하지 않는 PDF · 비교 결과 없음'} status={d.fileResult === 'copy' ? '동일' : '미확인'} />}
      <Check title="발행자 서명" detail="사본의 발행자 서명은 확인되지 않음" status="참고" /></div>
    <div className="pfoot" style={{ flexDirection: 'row' }}><button className="btn" style={{ flex: 1 }} onClick={() => d.go(4)}>원본 링크로 다시 받기</button><button className="btn ghost" style={{ flex: 1 }} onClick={() => { d.record('KODA 확인 요청 (모의)', d.fileName); d.setNotice('KODA 확인 요청을 모의 기록에 남겼습니다. 외부로 전송하지 않았습니다.'); }}>KODA에 확인 요청</button></div>
  </>;
}
defineControls(DemoPanel, { demo: false });
