import { useEffect, useState } from 'react';
import { ArchitectureMap } from './ArchitectureMap';
import { IssueJourney } from './IssuerScenes';
import { VerificationExperience } from './VerificationExperience';
import { ACTS, chapterForTrace, observedReviewPhases, reviewMapStep } from './presentation-sequence';
import type { PresentationProps } from './presentation-types';
import type { VerificationResult } from './verification';
import './presentation.css';

export function Presentation(props: PresentationProps) {
  const [act, setAct] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [followResult, setFollowResult] = useState(false);
  const [reviewState, setReviewState] = useState<{ result: VerificationResult; index: number; playing: boolean }>();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const trace = props.verificationTrace ?? [];
  const phases = observedReviewPhases(trace);
  const review = !props.busy && reviewState?.result === props.result ? reviewState : undefined;
  const phase = review ? phases[review.index] : undefined;
  const scene = act === 0 ? (['custody', 'register', 'delivery'] as const)[frame]!
    : props.busy ? chapterForTrace(trace) : phase ?? (props.result ? 'compare' : 'receive');

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) { setPlaying(false); setReviewState(value => value && { ...value, playing: false }); }
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (props.mode !== 'live') return;
    if (['verify', 'finalized', 'result'].includes(props.stage)) setAct(1);
    else { setAct(0); setFrame(['register', 'included'].includes(props.stage) ? 1 : 0); }
  }, [props.mode, props.stage]);
  useEffect(() => {
    if (!followResult || props.busy || !props.result) { setReviewState(undefined); return; }
    if (phases.length) setReviewState({ result: props.result, index: 0, playing: !reducedMotion && phases.length > 1 });
  }, [followResult, props.result, props.busy]);
  useEffect(() => {
    if (!review?.playing || reducedMotion || act !== 1) return;
    const timer = window.setTimeout(() => setReviewState(value => value && value.result === props.result
      ? value.index < phases.length - 1 ? { ...value, index: value.index + 1 } : { ...value, playing: false }
      : value), 5_000);
    return () => window.clearTimeout(timer);
  }, [review, reducedMotion, act, phases.length, props.result]);
  useEffect(() => {
    if (!playing || reducedMotion || props.busy || act !== 0) return;
    const timer = window.setTimeout(() => { if (frame < 2) setFrame(frame + 1); else setPlaying(false); }, 4_500);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, props.busy, act, frame]);

  const go = (next: number) => { setAct(next); setPlaying(false); setFollowResult(false); setReviewState(undefined); };
  const clearReview = () => { setFollowResult(false); setReviewState(undefined); };
  const verifierProps: PresentationProps = {
    ...props,
    onVerify: () => { setAct(1); setPlaying(false); setFollowResult(true); setReviewState(undefined); props.onVerify(); },
    onSelectSample: variant => { clearReview(); props.onSelectSample(variant); },
    onSelectFile: file => { if (file) clearReview(); props.onSelectFile(file); },
  };
  const reviewEvent = phase ? reviewMapStep(phase, trace) : undefined;
  const mapReview = phase && reviewEvent ? {
    label: { inspect: '제출 문서 확인', lookup: 'Ethereum 기록 조회', compare: '원본과 대조' }[phase],
    detail: '관측한 처리 설명', stepId: reviewEvent.id, state: reviewEvent.state, playing: review?.playing,
  } : undefined;

  return <main className={`kp-root act-${act === 0 ? 'issue' : 'verify'}`}>
    <header className="kp-header"><div className="kp-brand"><strong>KODA</strong><span>증빙 검증 서비스</span></div>
      <nav className="kp-acts" aria-label="발표 장면">{ACTS.map((label, index) => <button key={label} aria-current={index === act ? 'step' : undefined} disabled={props.busy} onClick={() => go(index)}><small>0{index + 1}</small>{label}</button>)}</nav>
      <span className="kp-demo-label">산학협력 프로젝트 · 기술 데모</span>
    </header>
    <div className="kp-workspace">
      <aside className="kp-map-panel"><span className="kp-map-label">전체 흐름</span><ArchitectureMap scene={scene} busy={props.busy} trace={trace} result={props.result} receiptBlock={props.receiptBlock} review={act === 1 ? mapReview : undefined} /></aside>
      <section className="kp-stage" aria-label="현재 발표 장면">
        {act === 0 ? <IssueJourney {...props} frame={frame} playing={playing} reducedMotion={reducedMotion}
          onFrame={next => { setPlaying(false); setFrame(next); }} onToggle={() => { if (frame === 2 && !playing) setFrame(0); setPlaying(value => !value); }} onVerifyScene={() => go(1)} />
          : <VerificationExperience {...verifierProps} phase={scene as 'receive' | 'inspect' | 'lookup' | 'compare'} review={review ? {
            index: review.index, phases, playing: review.playing, reducedMotion,
            select: next => setReviewState(value => value && { ...value, index: Math.max(0, Math.min(phases.length - 1, next)), playing: false }),
            toggle: () => setReviewState(value => value && { ...value, index: value.index === phases.length - 1 && !value.playing ? 0 : value.index, playing: !value.playing }),
          } : undefined} />}
        {props.error && props.mode === 'live' && act === 0 && <p className="kp-error" role="alert">발급·등록을 완료하지 못했습니다. 실행 로그에서 원인을 확인해 주세요.</p>}
      </section>
    </div>
    <footer className="kp-footer"><span>가상 증명서 · 시험 발급자 · 실행 환경 Ethereum Sepolia</span><details><summary>데모 범위</summary><p>KODA 운영 시스템과 연동한 화면은 아닙니다. 기존 등록 문서로 문서의 출처·원본 일치를 검증합니다. 실제 BTC 잔고의 사실성, 공식 KODA 신원, 중간 변경 이력 전체를 증명하지 않습니다. 고객사 전달 장면은 업무 흐름 설명입니다.</p></details></footer>
    <div className="kp-secondary"><details><summary>발표자 실행 준비</summary>{props.setup}</details><details><summary>실행 알림·전체 로그</summary>{props.error && <p>{props.error}</p>}{props.notice && <p role="status">{props.notice}</p>}{props.evidence}</details></div>
  </main>;
}
