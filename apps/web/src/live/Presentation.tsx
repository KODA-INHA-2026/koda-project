import { useEffect, useState } from 'react';
import { ArchitectureMap } from './ArchitectureMap';
import { IssueJourney } from './IssuerScenes';
import { VerificationExperience } from './VerificationExperience';
import { ACTS, MOTION_LABEL, MOTION_MS, motionFocus, nextMotionStep, type MotionStep } from './presentation-sequence';
import type { PresentationProps } from './presentation-types';
import type { VerificationResult, VerificationTraceEvent } from './verification';
import './presentation.css';

export function Presentation(props: PresentationProps) {
  const [act, setAct] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [motion, setMotion] = useState<{ step: MotionStep; paused: boolean; replay: boolean; enteredAt: number; elapsed: number; previousResult?: VerificationResult; previousTrace?: VerificationTraceEvent[] }>();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const trace = props.verificationTrace ?? [];
  const observedResult = motion && !motion.replay && props.result === motion.previousResult ? undefined : props.result;
  const observedTrace = motion && !motion.replay && props.verificationTrace === motion.previousTrace ? [] : trace;
  const step = reducedMotion ? observedResult ? 'result' : props.busy ? 'prepare' : 'ready'
    : motion?.step ?? (props.busy ? 'prepare' : props.result ? 'result' : 'ready');
  const next = nextMotionStep(step, { trace: observedTrace, result: observedResult });
  const scene = act === 0 ? (['custody', 'register', 'delivery'] as const)[frame]!
    : step === 'ready' ? 'receive' : step === 'prepare' ? 'inspect' : ['compare', 'result'].includes(step) ? 'compare' : 'lookup';

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(media.matches);
      setMotion(undefined);
      if (media.matches) setPlaying(false);
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
    if (!motion || motion.paused || reducedMotion || act !== 1 || step === next) return;
    const remaining = Math.max(0, MOTION_MS[step] - motion.elapsed - (performance.now() - motion.enteredAt));
    const timer = window.setTimeout(() => setMotion(value => value === motion
      ? { ...value, step: next, enteredAt: performance.now(), elapsed: 0 } : value), remaining);
    return () => window.clearTimeout(timer);
  }, [motion, reducedMotion, act, step, next]);
  useEffect(() => {
    if (!playing || reducedMotion || props.busy || act !== 0) return;
    const timer = window.setTimeout(() => { if (frame < 2) setFrame(frame + 1); else setPlaying(false); }, 4_500);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, props.busy, act, frame]);

  const go = (next: number) => { setAct(next); setPlaying(false); setMotion(undefined); };
  const begin = (replay: boolean) => setMotion(reducedMotion ? undefined : { step: 'prepare', paused: false, replay, enteredAt: performance.now(), elapsed: 0,
    previousResult: replay ? undefined : props.result, previousTrace: replay ? undefined : props.verificationTrace });
  const verifierProps: PresentationProps = {
    ...props,
    result: observedResult, verificationTrace: observedTrace,
    onVerify: () => { setAct(1); setPlaying(false); begin(false); props.onVerify(); },
    onSelectSample: variant => { setMotion(undefined); props.onSelectSample(variant); },
    onSelectFile: file => { if (file) setMotion(undefined); props.onSelectFile(file); },
  };
  const mapMotion = act === 1 ? { focus: motionFocus(step), label: MOTION_LABEL[step],
    detail: observedResult ? '관측한 처리 결과' : '조회·검증 진행', playing: Boolean(motion && !motion.paused && step !== 'result'),
    chainReadComplete: step === 'result' && observedResult?.chainRecordValid === true } : undefined;

  return <main className={`kp-root act-${act === 0 ? 'issue' : 'verify'}`}>
    <header className="kp-header"><div className="kp-brand"><strong>KODA</strong><span>증빙 검증 서비스</span></div>
      <nav className="kp-acts" aria-label="발표 장면">{ACTS.map((label, index) => <button key={label} aria-current={index === act ? 'step' : undefined} disabled={props.busy} onClick={() => go(index)}><small>0{index + 1}</small>{label}</button>)}</nav>
      <span className="kp-demo-label">산학협력 프로젝트 · 기술 데모</span>
    </header>
    <div className="kp-workspace">
      <aside className="kp-map-panel"><span className="kp-map-label">전체 흐름</span><ArchitectureMap scene={scene} busy={props.busy} trace={trace} result={props.result} receiptBlock={props.receiptBlock} motion={mapMotion} /></aside>
      <section className="kp-stage" aria-label="현재 발표 장면">
        {act === 0 ? <IssueJourney {...props} frame={frame} playing={playing} reducedMotion={reducedMotion}
          onFrame={next => { setPlaying(false); setFrame(next); }} onToggle={() => { if (frame === 2 && !playing) setFrame(0); setPlaying(value => !value); }} onVerifyScene={() => go(1)} />
          : <VerificationExperience {...verifierProps} motion={{ step, paused: motion?.paused ?? false, replay: motion?.replay ?? false, reducedMotion,
            replayRun: () => begin(true), finish: () => setMotion(undefined),
            toggle: () => setMotion(value => value && { ...value, paused: !value.paused, enteredAt: performance.now(),
              elapsed: value.elapsed + (value.paused ? 0 : performance.now() - value.enteredAt) }),
          }} />}
        {props.error && props.mode === 'live' && act === 0 && <p className="kp-error" role="alert">발급·등록을 완료하지 못했습니다. 실행 로그에서 원인을 확인해 주세요.</p>}
      </section>
    </div>
    <footer className="kp-footer"><span>가상 증명서 · 시험 발급자 · 실행 환경 Ethereum Sepolia</span><details><summary>데모 범위</summary><p>KODA 운영 시스템과 연동한 화면은 아닙니다. 기존 등록 문서로 문서의 출처·원본 일치를 검증합니다. 실제 BTC 잔고의 사실성, 공식 KODA 신원, 중간 변경 이력 전체를 증명하지 않습니다. 고객사 전달 장면은 업무 흐름 설명입니다.</p></details></footer>
    <div className="kp-secondary"><details><summary>발표자 실행 준비</summary>{props.setup}</details><details><summary>실행 알림·전체 로그</summary>{props.error && <p>{props.error}</p>}{props.notice && <p role="status">{props.notice}</p>}{props.evidence}</details></div>
  </main>;
}
