import { defineControls } from 'tempo-sdk/assets';
import type { Demo } from './useDemo';
import { AuditorCertificate, ChangedCertificate, FullCertificate, MaskedCertificate } from './Certificates';
import { DemoPanel } from './Panels';
import { BLOCK, DOC_ID, roles, shortHash } from './model';
export function Workspace({ demo: d }: { demo: Demo }) {
  const index = d.screen; const role = roles[index < 2 ? 0 : index < 4 ? 1 : 2]!;
  const hash = shortHash(d.manifest?.hash ?? '');
  const strips: [string, string, string?][][] = [
    [['상태', d.authenticated ? '인증 완료 · 모의' : '로그인 전', 't dim'], ['인증 방식', 'DID 서명', 't'], ['열람 범위', '인증 결과로 결정', 't'], ['데이터', '교육용 가상 값', 't']],
    [['고객사', '㈜가온테크', 't'], ['기준일', '2026-09-30'], ['상태', d.issueStage === 3 ? '발행 완료 · 모의' : d.issueStage >= 2 ? '서명 완료 · 모의' : '발행 대기', 't'], ['문서 지문', hash], ['체인 기록', d.issueStage === 3 ? '모의 기록 완료' : '대기', 't']],
    [['발행', 'KODA', 't'], ['기준일', '2026-09-30'], ['내 권한', '일부 가림', 't'], ['원본 파일', '내려받기 없음', 't dim'], ['받은 날', '2026-10-01']],
    [['발행', 'KODA', 't'], ['기준일', '2026-09-30'], ['내 권한', '일부 가림', 't'], ['보낸 권한', d.grantStage === 3 ? '1건 · 수신 완료 (모의)' : d.grantStage ? '1건 · 진행 중' : '전달 전', 't'], ['원본 파일', '내 PC 거치지 않음', 't']],
    [['내 권한', d.expired ? '만료' : '전체 항목', 't'], ['만료', d.expires], ['열람', d.expired ? '차단됨' : 'KODA에 기록됨', 't'], ['체인 기록', '2026-10-01 10:02:19']],
    [['내 권한', d.expired ? '만료' : '전체 항목', 't'], ['만료', d.expires], ['열람', d.expired ? '차단됨' : 'KODA에 기록됨', 't'], ['체인 기록', '2026-10-01 10:02:19'], ['검증', d.expired ? '권한 만료' : '통과 · 모의 기록 대조', 't ok']],
    [['출처', '메일 첨부', 't'], ['발행자 서명', d.fileResult === 'match' ? '모의 서명' : '미확인', 't'], ['올린 파일 지문', shortHash(d.fileHash), d.fileResult === 'changed' ? 'bad' : ''], ['체인 기록', d.fileResult === 'match' ? '일치' : '일치하는 기록 없음', d.fileResult === 'changed' ? 't bad' : 't']],
  ];
  const tabs = index === 0 ? ['역할별 열람 범위'] : index === 1 ? ['발행 이력', '체인 기록', '열람 정책 변경'] : index < 4 ? ['열람 기록', '보낸 권한'] : ['열람 기록', '검증 이력'];
  const activeTab = d.tab || (index === 3 ? '보낸 권한' : index >= 5 ? '검증 이력' : tabs[0]);
  function nav(label: string) {
    if (label === '체인 기록 조회') d.go(7);
    else if (label === '열람 정책' || label === '공개 범위 프리셋') d.go(8);
    else if (label === '파일로 검증') d.go(6);
    else if (label === '감사 대상') d.go(4);
    else if (label === '보낸 권한') { d.go(3); d.setTab(label); }
    else if (label === '받은 증빙') d.go(2);
    else if (label === '발행') d.go(1);
    else d.setTab(label);
  }
  const defaultRecords = index === 1 ? [['10-01 10:02:11', 'KODA 수탁 운영', '발행 준비', '기준일 2026-09-30 · 문서 생성 대기']] : index < 4 ? [['10-01 10:02:19', 'KODA 수탁 운영', '발행·체인 기록 (모의)', DOC_ID]] : [['11-09 10:38:52', '한울회계법인', '원본 전체 열람', '시연용 열람 기록'], ['11-09 10:32:07', '한울회계법인', '열람 권한 수신 (모의)', '외부감사 제출용 · 전체 항목']];
  const filtered = d.records.filter(r => activeTab === '검증 이력' ? /검증|확인 요청/.test(r.action) : activeTab === '발행 이력' || activeTab === '체인 기록' ? /발행/.test(r.action) : /열람|인증/.test(r.action));
  return <div className="app">
    <div className="bar"><span className="logo">KODA <i>Proof</i></span><span className="env">모의 데이터</span>
      <span className="tnav">{(index === 0 ? ['시작', '도움말'] : role.nav).map((label, i) => <button key={label} className={(index === 6 ? label === '파일로 검증' : i === 0) ? 'on' : ''} onClick={() => index === 0 ? label === '도움말' && d.go(8) : nav(label)}>{label}</button>)}</span><span className="sp" />
      {index === 0 ? <span className="lbl">로그인 전</span> : <button className="who" title="역할 선택으로 돌아가기" onClick={() => d.go(0)}><span className="role">{index < 2 ? role.name : index < 4 ? '재무·회계 담당 · ㈜가온테크' : '외부 감사인 · 한울회계법인'}</span><span className="did">{role.did}</span><span className="av">{role.avatar}</span></button>}
    </div>
    <div className="strip"><div className="docsel"><b>{index === 0 ? '증빙 선택 전' : index === 6 ? d.fileName : index >= 4 ? '㈜가온테크 · 3분기 잔고 증명' : '3분기 기준일 잔고 증명'}</b><small>{index === 0 ? '인증 후 열림' : index === 6 ? '메일로 받은 사본' : DOC_ID}</small></div>{strips[index]!.map(([key, value, type]) => <div className="cell" key={key}><span className="k">{key}</span><span className={'v '+(type || '')}>{value}</span></div>)}</div>
    <div className="work"><div className="center">
      {index === 0 ? <><div className="h1" style={{ marginTop: 4 }}>어느 역할로 들어갈까요?</div><div className="lead">역할을 고르면 해당 DID로 서명 요청이 갑니다.</div><table className="tbl role-table" style={{ marginTop: 16, fontSize: 14 }}><thead><tr><th>역할</th><th>DID<span className="ipin">1</span></th><th>하는 일</th></tr></thead><tbody>{roles.map((r, i) => <tr key={r.did} data-selected={d.role === i}><td><button className="role-choice" aria-pressed={d.role === i} onClick={() => { d.setRole(i); d.setAuthenticated(false); }}><b>{r.name}</b></button></td><td className="mono" style={{ fontSize: 12 }}>{r.did}</td><td>{r.job}</td></tr>)}</tbody></table></>
      : index >= 4 && d.expired ? <div className="locked-document"><span className="lbl">원본 열람 차단</span><div className="h1">열람 기간이 끝났습니다</div><p className="lead">새로운 열람 권한을 받은 뒤 원본을 확인할 수 있습니다.</p></div>
      : index === 1 ? <FullCertificate /> : index < 4 ? <MaskedCertificate /> : index < 6 ? <AuditorCertificate />
      : d.fileResult === 'changed' && (!d.differences.length || d.fileHash === d.manifest?.changedHash) ? <ChangedCertificate />
      : d.fileResult === 'copy' ? <><div className="copy-label">원본 아님 · 재저장 사본 또는 열람본</div><FullCertificate /></>
      : d.fileResult === 'match' ? <AuditorCertificate /> : <div className="locked-document"><span className="lbl">{d.fileName}</span><div className="h1">파일 미리보기 없음</div><p className="lead">{d.fileResult === 'changed' ? '읽을 수 있는 항목의 변경 내용을 오른쪽에서 확인해 주세요.' : d.fileMessage}</p></div>}
    </div><div className="panel"><DemoPanel demo={d} /></div></div>
    <div className="btm"><div className="btabs">{tabs.map(label => <button key={label} className={activeTab === label ? 'on' : ''} onClick={() => d.setTab(label)}>{label}</button>)}<span className="sp" /><span className="live">시연용 모의 체인 · 실제 기록 아님</span></div>
      <div className="record-scroll">{index === 0 ? <table className="rows"><thead><tr>{['역할', '보관 지갑 주소', '거래 상대방', '개별 거래 내역', '문서 지문'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{roles.map((r, i) => <tr key={r.did}><td>{r.name}</td><td>{i === 1 ? '앞뒤 4자리' : '전체'}</td><td>{i === 1 ? '가림' : '전체'}</td><td>{i === 1 ? '건수만' : '전체'}</td><td>공개</td></tr>)}</tbody></table>
      : activeTab === '보낸 권한' ? <table className="rows"><thead><tr>{['보낸 시각', '받는 사람', 'DID', '공개 범위', '기간', '상태'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody><tr className="cur"><td className="mono">{d.grantStage ? '11-09 10:31:40' : '—'}</td><td>한울회계법인</td><td className="mono">{d.auditor}</td><td>외부감사 제출용</td><td className="mono">~{d.expires.slice(5)}</td><td>{d.expired ? '권한 만료' : `요청 ${d.grantStage >= 1 ? '●' : '○'} 정책 확인 ${d.grantStage >= 2 ? '●' : '○'} 수신 ${d.grantStage >= 3 ? '●' : '○'}`}</td></tr></tbody></table>
      : activeTab === '열람 정책 변경' ? <div className="record-empty">기준표 M-01 · 재무·회계 일부 가림 / 외부 감사인 전체 항목 · 시연용 권한 설정 <button className="text-action" onClick={() => d.go(8)}>기준표 보기 →</button></div>
      : activeTab === '체인 기록' ? <table className="rows"><thead><tr><th>블록</th><th>기록 시각</th><th>문서 지문</th><th>상태</th></tr></thead><tbody><tr className="cur"><td>#{BLOCK}</td><td>2026-10-01 10:02:19</td><td className="mono">{hash}</td><td>{d.issueStage === 3 ? '시연용 모의 기록' : '기록 대기'}</td></tr></tbody></table>
      : <table className="rows"><thead><tr>{['시각', '누가', '무엇을', '상세'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.length ? filtered.map((r, i) => <tr key={i} className={i === 0 ? 'cur' : ''}><td className="mono">{r.time}</td><td>{r.actor}</td><td>{r.action}</td><td>{r.detail}</td></tr>) : activeTab === '검증 이력' && index < 5 ? <tr><td colSpan={4}>아직 검증 이력이 없습니다.</td></tr> : (index >= 5 && activeTab === '검증 이력' ? [['11-09 10:40:27', '한울회계법인', '검증 장면 · 시연용 예시', index === 5 ? '통과 · 모의 기록 대조' : '파일 불일치 · 수정본 예시']] : defaultRecords).map((row, i) => <tr key={i} className={i === 0 ? 'cur' : ''}>{row.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody></table>}</div>
    </div>
  </div>;
}
defineControls(Workspace, { demo: false });
