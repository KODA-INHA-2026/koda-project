import { defineControls } from 'tempo-sdk/assets';
import { useDemo } from './useDemo';
import { screens } from './screens';
import { Workspace } from './Workspace';
import { Explorer } from './Explorer';
import { MaskingMatrix } from './Certificates';
import './fonts.css';
import './reference.css';
import './interactive.css';
export default function ProofDemo() {
  const d = useDemo(); const screen = screens[d.screen]!;
  const content = d.screen === 7 ? <Explorer demo={d} /> : d.screen === 8 ? <div className="app matrix-app"><span className="matrix-demo env">모의 데이터</span><MaskingMatrix /></div> : <Workspace demo={d} />;
  return <>
    {!d.shot && <><header className="v-head"><div><div className="kicker">KODA 증명 데모 · 화면별 목업 v0.3</div><h1 className="v-title">누가, 무엇을, 어디까지 보고 검증하는가</h1></div><div className="v-meta"><b>증명 중심 시연 · PRD v0.3</b><br />2026.11.02 · 11/1 회의 결정 기준<br />교육용 가상 법인·가상 데이터</div></header>
    <nav className="rail" aria-label="데모 단계">{screens.map((s, i) => <button key={s.id} className={'step'+(i === d.screen ? ' on' : '')+(i === 8 ? ' matrix' : i === 7 ? ' pub' : '')} aria-current={i === d.screen ? 'step' : undefined} onClick={() => d.go(i)}><span className="dot" /><span className="n">{s.id}</span><span className="t">{s.step}</span><span className="r">{s.roleLabel}</span></button>)}</nav>
    <div className="legend-row"><span><span className="anat"><i /><i /><i /><i /></span><b>모든 역할이 같은 작업대</b> · 위 상태줄 · 가운데 문서 · 오른쪽 실행 패널 · 아래 기록</span><span><b>S-08</b> 체인 기록은 로그인 없이 누구나 조회</span></div></>}
    <section className={d.shot ? 'shot-layout' : 'stage-wrap'}><div><div className="stage" ref={d.stageRef} style={{ height: 620 * d.scale }}><div className="stage-inner" style={{ transform: `scale(${d.scale})` }}>{content}</div></div>
      {!d.shot && <div className="demo-toolbar"><span>시나리오 날짜 2026-11-09 · 모의 시연</span><div><button onClick={d.reset}>처음부터 다시 시연</button>{d.screen >= 4 && d.screen <= 6 && <button disabled={Boolean(d.busy)} onClick={() => { d.setExpired(!d.expired); d.record(d.expired ? '시연 권한 복원' : '시연 권한 만료', '모의 시계 전환'); }}>{d.expired ? '시연 권한 복원' : '기간 만료 시연'}</button>}<button onClick={() => { const url = new URL(location.href); url.searchParams.set('shot', screen.id); url.hash = ''; window.open(url.toString(), '_blank', 'noopener'); }}>화면만 보기 ↗</button></div></div>}
      {!d.shot && d.screen === 6 && !d.expired && <div className="file-tools"><div><b>메일로 받은 파일 검사</b><span>파일은 브라우저에서만 처리합니다.</span></div><button className="btn ghost" disabled={Boolean(d.busy)} onClick={() => d.fileInput.current?.click()}>{d.busy || 'PDF 파일 선택'}</button><button disabled={Boolean(d.busy)} onClick={() => void d.sample('modified')}>수정본 시연</button><button disabled={Boolean(d.busy)} onClick={() => void d.sample('resaved')}>재저장 사본 시연</button><button disabled={Boolean(d.busy)} onClick={() => void d.sample('original')}>원본 시연</button><details><summary>시연 PDF 받기</summary><div className="sample-downloads"><button onClick={() => void d.sample('original', true)}>원본 PDF</button><button onClick={() => void d.sample('modified', true)}>수정본 PDF</button><button onClick={() => void d.sample('resaved', true)}>재저장 PDF</button></div></details></div>}
      {d.notice && !d.shot && <div className="notice-banner" role="status">{d.notice}<button aria-label="알림 닫기" onClick={() => d.setNotice('')}>×</button></div>}
    </div>{!d.shot && <aside className="notes"><div className="sid">{screen.id} · {screen.roleLabel}</div><h3>{screen.title}</h3><p className="purpose">{screen.purpose}</p><ol>{screen.notes.map(([title, detail], i) => <li key={title}><span className="pinnum">{i + 1}</span><span><b>{title}</b><br />{detail}</span></li>)}</ol><p className="next">{screen.next.replace(/<[^>]*>/g, '')}</p><div className="nav"><button onClick={() => d.go(d.screen - 1)}>이전</button><button className="primary" onClick={() => d.go(d.screen + 1)}>{d.screen === 8 ? '처음으로' : '다음'}</button></div></aside>}</section>
    {!d.shot && <div className="foot">화면 속 법인명·지갑 주소·해시·블록 번호는 모두 시연용 가상 값입니다. 실제 고객정보·지갑 주소·개인키는 쓰지 않습니다. 마스킹 항목과 권한 기준은 팀 확정 전 제안안(v0.2)입니다. DID 인증·권한·체인 기록은 시연용 모의 처리입니다.</div>}
    <input className="visually-hidden" type="file" accept=".pdf,application/pdf" aria-label="검사할 PDF 파일" disabled={Boolean(d.busy)} ref={d.fileInput} onChange={e => { const file = e.target.files?.[0]; if (file) void d.inspectFile(file); e.target.value = ''; }} />
    <input className="visually-hidden" type="file" aria-label="공개 조회에서 대조할 파일" disabled={Boolean(d.busy)} ref={d.publicInput} onChange={e => { const file = e.target.files?.[0]; if (file) void d.inspectFile(file, true); e.target.value = ''; }} />
  </>;
}
defineControls(ProofDemo, {});
