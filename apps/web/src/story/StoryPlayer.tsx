import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Level, StoryCase, StoryField, StoryRole, ViewerId } from './types';
import { cases } from './cases';
import { documentPrint, fieldBundle, short } from './crypto';
import './story.css';

/**
 * 원클릭 스토리 시연. 고객군 하나의 증빙이 3축(KODA 발행 · 고객사 내부 · 외부 검증)으로 흐르고,
 * 모든 축이 같은 공개 블록체인 기록을 내려다본다. 마지막 장면에서 "왜 블록체인인가"를 비교로 보여 준다.
 */
const BEATS = ['intro', 'issue', 'inside1', 'inside2', 'grant', 'external', 'tamper', 'close'] as const;
type Beat = typeof BEATS[number];
const BEAT_LABEL: Record<Beat, string> = { intro: '사례', issue: '발행', inside1: '내부 확인', inside2: '내부 결산', grant: '권한 전달', external: '외부 검증', tamper: '왜 블록체인', close: '정리' };
const BLOCKS: Record<StoryCase['id'], number> = { export: 21950204, game: 21951877, audit: 21904118 };

function Lock() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>; }
function Check() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>; }
function Cross() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>; }

function Cell({ level, value, shown }: { level: Level; value: string; shown?: string }) {
  if (level === 'full') return <span className="st-val">{value}</span>;
  if (level === 'partial') return <span className="st-partial">{shown ?? '일부'}<span className="st-sr"> (일부만 표시)</span></span>;
  return <span className="st-redact" role="img" aria-label="가림"><Lock/><span aria-hidden="true">가림</span></span>;
}
function rule(c: StoryCase, viewer: ViewerId, f: StoryField, who?: StoryRole) {
  // 외부 검증자마다 "자기 몫" 칸이 있으면: 자기 칸은 값으로, 다른 검증자의 칸은 가림으로.
  const owned = c.external.map(e => e.own).filter(Boolean);
  if (viewer === 'external' && who?.own && owned.includes(f.key)) return f.key === who.own ? { level: 'full' as Level, why: '자기 몫' } : { level: 'hidden' as Level, why: '다른 검증자의 몫' };
  if (viewer === 'external' && who?.override?.[f.key]) return who.override[f.key]!;
  return c.views[viewer]?.[f.key] ?? { level: 'full' as Level, why: '' };
}
/** 고객사 내부 카드에 올릴 칸(사례가 고른 순서, 최대 6줄). */
function cardFields(c: StoryCase) {
  const picked = (c.cardKeys ?? []).map(k => c.fields.find(f => f.key === k)).filter((f): f is StoryField => Boolean(f));
  return (picked.length ? picked : c.fields).slice(0, 6);
}
/** 외부 카드: 보이는 민감 칸 2개 + 가려진 칸이 있으면 1개(무엇이 가려지는지 보이도록). */
function externalFields(c: StoryCase, who: StoryRole) {
  const sensitive = c.fields.filter(f => f.sensitive);
  const shown = sensitive.filter(f => rule(c, 'external', f, who).level !== 'hidden');
  const others = c.external.filter(e => e !== who).map(e => e.own).filter(Boolean);
  const isHidden = (f: StoryField) => rule(c, 'external', f, who).level === 'hidden';
  const hidden = sensitive.find(f => isHidden(f) && others.includes(f.key)) ?? sensitive.find(isHidden);
  return hidden ? [...shown.slice(0, 2), hidden] : shown.slice(0, 3);
}
/** 무대가 화면보다 크면 비율을 유지한 채 줄여 한 화면에 들어오게 한다(발표장 화면 크기와 무관하게). */
function Fit({ children, deps }: { children: ReactNode; deps: unknown[] }) {
  const outer = useRef<HTMLDivElement>(null); const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const measure = () => {
      const o = outer.current, i = inner.current; if (!o || !i) return;
      const natural = i.scrollHeight, room = o.clientHeight;
      setScale(natural > room && room > 0 ? Math.max(0.6, room / natural) : 1);
    };
    measure();
    const ro = new ResizeObserver(measure); if (outer.current) ro.observe(outer.current); if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <div className="st-fit" ref={outer}><div className="st-fit-inner" ref={inner} style={scale < 1 ? { transform: `scale(${scale})`, width: `${100 / scale}%` } : undefined}>{children}</div></div>;
}

export function StoryPlayer({ onExit, initialCase, autoStart }: { onExit: () => void; initialCase?: string | null; autoStart?: boolean }) {
  const [caseIndex, setCaseIndex] = useState(() => Math.max(0, cases.findIndex(c => c.id === initialCase)));
  const c = cases[caseIndex]!;
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(Boolean(autoStart));
  const [checked, setChecked] = useState(0);
  const [record, setRecord] = useState<{ doc: string; bundle: string } | null>(null);
  const [tampered, setTampered] = useState<string>('');
  const b: Beat = BEATS[beat]!;
  const reached = (name: Beat) => beat >= BEATS.indexOf(name);

  // 발행 기록: 사례가 바뀌면 원본 지문과 항목 지문 묶음을 다시 계산한다.
  useEffect(() => {
    let alive = true; setRecord(null); setTampered('');
    void Promise.all([documentPrint(c), fieldBundle(c)]).then(([doc, bundle]) => { if (alive) setRecord({ doc, bundle }); });
    return () => { alive = false; };
  }, [c]);
  // 왜 블록체인 장면: 운영 DB의 값이 바뀐 문서로 지문을 다시 계산한다.
  useEffect(() => {
    if (b !== 'tamper') return;
    let alive = true;
    void documentPrint(c, { key: c.tamper.key, value: c.tamper.to }).then(h => { if (alive) setTampered(h); });
    return () => { alive = false; };
  }, [b, c]);
  // 외부 검증: 기관마다 차례로 체인 기록과 대조한다.
  useEffect(() => {
    if (b !== 'external') { setChecked(BEATS.indexOf(b) > BEATS.indexOf('external') ? c.external.length : 0); return; }
    setChecked(0);
    const timers = c.external.map((_, i) => setTimeout(() => setChecked(i + 1), 900 + i * 1000));
    return () => timers.forEach(clearTimeout);
  }, [b, c]);
  // 자동 진행
  const duration = useMemo(() => ({ intro: 3200, issue: 4600, inside1: 4600, inside2: 4600, grant: 3800, external: 1800 + c.external.length * 1000 + 1400, tamper: 10500, close: 0 }), [c]);
  useEffect(() => {
    if (!playing || b === 'close') return;
    const t = setTimeout(() => setBeat(i => Math.min(i + 1, BEATS.length - 1)), duration[b]);
    return () => clearTimeout(t);
  }, [playing, b, duration]);

  const go = useCallback((i: number) => setBeat(Math.max(0, Math.min(BEATS.length - 1, i))), []);
  const restart = useCallback(() => { setBeat(0); setPlaying(true); }, []);
  const pick = useCallback((i: number) => { setCaseIndex(i); setBeat(0); setPlaying(true); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,select,textarea')) return;
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setPlaying(false); setBeat(i => Math.min(i + 1, BEATS.length - 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); setBeat(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Escape') { e.preventDefault(); onExit(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onExit]);

  const caption = b === 'intro' ? c.headline : b === 'close' ? c.captions.close : c.captions[b];
  const focus = (col: 'koda' | 'inside' | 'external') => ({ intro: '', issue: 'koda', inside1: 'inside', inside2: 'inside', grant: 'inside external', external: 'external', tamper: '', close: '' }[b].includes(col));
  const checkedBy = [...(reached('inside1') ? [c.inside[0].title] : []), ...(reached('inside2') ? [c.inside[1].title] : []), ...c.external.slice(0, checked).map(e => e.org)];
  const block = BLOCKS[c.id];

  return <div className={`st-root beat-${b}`} role="region" aria-label="원클릭 스토리 시연">
    <header className="st-top">
      <div className="st-brand">KODA<span>proof · 원클릭 시연</span></div>
      <nav className="st-cases" aria-label="고객군 선택">{cases.map((x, i) => <button key={x.id} aria-pressed={i === caseIndex} className={i === caseIndex ? 'on' : ''} onClick={() => pick(i)}><b>{x.industry}</b><span>{x.company}</span></button>)}</nav>
      <button className="st-exit" onClick={onExit}>단계별로 보기</button>
    </header>

    <section className="st-headline"><p>{c.industry} · {c.docTitle} · {c.docNo}</p><h1>{c.headline}</h1></section>

    <Fit deps={[caseIndex, b]}>{b === 'tamper' ? <TamperScene c={c} record={record} tampered={tampered} block={block}/> : <div className="st-stage">
      <Column n="1" axis="KODA" title="발행" active={focus('koda')}>
        <article className={'st-card issuer' + (reached('issue') ? ' done' : '')}>
          <RoleHead title={c.issuer.title} org={c.issuer.org} job={c.issuer.job}/>
          <div className="st-doc"><b>{c.docTitle}</b><span>{c.docNo} · {c.asOf}</span>
            <dl>{c.fields.slice(0, 3).map(f => <div key={f.key}><dt>{f.label}</dt><dd><Cell level="full" value={f.value}/></dd></div>)}</dl>
          </div>
          <Status on={reached('issue')} text={reached('issue') ? '서명하고 지문을 체인에 기록했어요' : '발행 준비'}/>
        </article>
      </Column>
      <Column n="2" axis={c.company} title="고객사 내부" active={focus('inside')}>
        {(['inside1', 'inside2'] as const).map((v, i) => { const r = c.inside[i]!; const on = reached(v); return <article key={v} className={'st-card' + (on ? ' done' : '') + (b === v ? ' now' : '')}>
          <RoleHead title={r.title} org={r.org} job={r.job}/>
          <dl className="st-fields">{cardFields(c).map(f => { const x = rule(c, v, f); return <div key={f.key} className={'lv-' + x.level}><dt>{f.label}</dt><dd><Cell level={x.level} value={f.value} shown={x.shown}/></dd></div>; })}</dl>
          <Status on={on} text={on ? '가린 열람본도 지문 묶음과 일치해요' : '열람 대기'}/>
        </article>; })}
      </Column>
      <Column n="3" axis="외부" title="외부 검증" active={focus('external')}>
        {c.external.map((r, i) => { const granted = reached('grant'); const ok = i < checked; return <article key={r.org} className={'st-card ext' + (granted ? '' : ' locked') + (ok ? ' done' : '')}>
          <RoleHead title={r.title} org={r.org} job={r.job}/>
          {granted ? <dl className="st-fields compact">{externalFields(c, r).map(f => { const x = rule(c, 'external', f, r); return <div key={f.key} className={'lv-' + x.level}><dt>{f.label}</dt><dd><Cell level={x.level} value={f.value} shown={x.shown}/></dd></div>; })}</dl> : <p className="st-locked"><Lock/> 아직 열람 권한이 없어요</p>}
          <Status on={ok} text={ok ? 'KODA 서버를 거치지 않고 체인 기록과 대조했어요' : granted ? '기간 한정 열람 권한을 받았어요' : '권한 대기'}/>
        </article>; })}
      </Column>
      <Lane c={c} record={record} on={reached('issue')} block={block} checkedBy={checkedBy} total={2 + c.external.length}/>
    </div>}</Fit>

    {b === 'close' && <CloseCard c={c} replay={restart} next={() => pick((caseIndex + 1) % cases.length)} exit={onExit}/>}

    <footer className="st-caption">
      <ol className="st-beats" aria-label="장면">{BEATS.map((x, i) => <li key={x}><button className={i === beat ? 'on' : i < beat ? 'done' : ''} onClick={() => { setPlaying(false); go(i); }} aria-current={i === beat ? 'step' : undefined}>{BEAT_LABEL[x]}</button></li>)}</ol>
      <p aria-live="polite">{caption}</p>
      <div className="st-controls">
        <button onClick={() => { setPlaying(false); go(beat - 1); }} aria-label="이전 장면">←</button>
        <button className="st-play" onClick={() => b === 'close' ? restart() : setPlaying(p => !p)}>{b === 'close' ? '다시 보기' : playing ? '일시정지' : beat === 0 ? '시작' : '계속'}</button>
        <button onClick={() => { setPlaying(false); go(beat + 1); }} aria-label="다음 장면">→</button>
      </div>
    </footer>
  </div>;
}

function Column({ n, axis, title, active, children }: { n: string; axis: string; title: string; active: boolean; children: ReactNode }) {
  return <section className={'st-col' + (active ? ' active' : '')} aria-label={`${n}축 ${title}`}><h2><b>{n}</b>{axis}<span>{title}</span></h2>{children}</section>;
}
function RoleHead({ title, org, job }: { title: string; org: string; job: string }) {
  return <header className="st-role"><strong>{title}</strong><span>{org}</span><p>{job}</p></header>;
}
function Status({ on, text }: { on: boolean; text: string }) {
  return <p className={'st-status' + (on ? ' on' : '')}>{on ? <Check/> : <span className="st-dot"/>}{text}</p>;
}
function Lane({ c, record, on, block, checkedBy, total }: { c: StoryCase; record: { doc: string; bundle: string } | null; on: boolean; block: number; checkedBy: string[]; total: number }) {
  return <section className={'st-lane' + (on ? ' on' : '')} aria-label="공개 블록체인 기록">
    <h2>공개 블록체인 기록 <span>세 축이 모두 같은 기록을 봐요 · 문서 내용은 올리지 않고 지문만 남겨요 · 모의 기록</span></h2>
    <div className="st-chain">
      {[-2, -1].map(d => <div key={d} className="st-block old"><b>#{(block + d).toLocaleString('ko-KR')}</b><span>다른 기록</span></div>)}
      <div className="st-block mine"><b>#{block.toLocaleString('ko-KR')}</b><span>{c.company} · {c.docNo}</span>
        <dl><div><dt>문서 지문</dt><dd>{on && record ? short(record.doc) : '대기'}</dd></div><div><dt>항목 지문 묶음</dt><dd>{on && record ? short(record.bundle) : '대기'}</dd></div><div><dt>발행자 서명</dt><dd>did:koda:issuer:koda-ops{on ? ' · 확인됨' : ''}</dd></div></dl>
      </div>
      <div className="st-block old"><b>#{(block + 1).toLocaleString('ko-KR')}</b><span>다른 기록</span></div>
      <div className="st-readers"><span className="st-readers-title">이 기록을 확인한 곳 {checkedBy.length} / {total}</span>{checkedBy.map(n => <span key={n} className="st-reader"><Check/>{n}</span>)}</div>
    </div>
  </section>;
}
function TamperScene({ c, record, tampered, block }: { c: StoryCase; record: { doc: string; bundle: string } | null; tampered: string; block: number }) {
  const f = c.fields.find(x => x.key === c.tamper.key)!;
  return <div className="st-tamper">
    <div className="st-tamper-head"><p>몇 달 뒤</p><h2>KODA 서버의 값 하나가 바뀐다면?</h2><span>{c.tamper.story}</span>
      <div className="st-change"><em>{f.label}</em><s>{f.value}</s><b>{c.tamper.to}</b><small>KODA 운영 DB에서 변경</small></div></div>
    <div className="st-compare">
      <article className="st-world db"><h3>중앙 DB만 있을 때</h3>
        <p className="st-flow">검증자 <i>→</i> KODA 서버에 물어봐요 <i>→</i> <b>{c.tamper.to}</b></p>
        <p className="st-verdict warn"><Cross/>바뀐 값을 그대로 믿게 돼요</p>
        <p className="st-note">검증자는 KODA 서버에만 물어볼 수 있어서, 언제 무엇이 바뀌었는지 밖에서는 알 수 없어요.</p></article>
      <article className="st-world chain"><h3>체인에 지문이 있을 때</h3>
        <dl><div><dt>지금 문서로 다시 계산</dt><dd className="bad">{tampered ? short(tampered) : '계산 중'}</dd></div><div><dt>#{block.toLocaleString('ko-KR')}에 남은 지문</dt><dd>{record ? short(record.doc) : '계산 중'}</dd></div></dl>
        <p className="st-verdict ok"><Check/>바뀐 값이 바로 드러나요</p>
        <p className="st-note">원본으로 다시 계산한 지문이 공개 블록체인 기록과 달라요. 이 기록은 KODA도 고칠 수 없어서 기관마다 각자 같은 기준으로 확인해요.</p></article>
    </div>
    <p className="st-honest">블록체인은 값이 맞는지 보증하지 않아요. 기록 뒤 바뀌었는지, 누가 언제 발행했는지를 누구나 확인하게 해요.</p>
  </div>;
}
function CloseCard({ c, replay, next, exit }: { c: StoryCase; replay: () => void; next: () => void; exit: () => void }) {
  return <div className="st-close" role="dialog" aria-label="시연 정리">
    <p className="st-kicker">{c.company} · 한 사례 끝</p>
    <h2>세 축이 같은 기록 하나로 이어졌어요</h2>
    <ol>
      <li><b>여러 기관이 같은 기록을 각자 대조해요</b><span>{c.external.map(e => e.org).join(', ')}가 KODA 서버를 거치지 않고 확인해요.</span></li>
      <li><b>한 번 기록된 지문은 발행자도 고칠 수 없어요</b><span>원본으로 다시 계산한 지문이 기록과 다르면 누구든 알아채요.</span></li>
      <li><b>원본은 공개하지 않고 지문만 올려요</b><span>역할마다 필요한 칸만 보이고, 가린 열람본도 원본에서 나왔는지 확인돼요.</span></li>
    </ol>
    <div className="st-close-actions"><button onClick={replay}>다시 보기</button><button className="primary" onClick={next}>다음 고객군 보기</button><button onClick={exit}>단계별로 보기</button></div>
  </div>;
}
