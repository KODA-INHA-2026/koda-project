import { useEffect, useState } from 'react';
import { ArchitectureMap } from './ArchitectureMap';
import { IssueJourney } from './IssuerScenes';
import { VerificationExperience } from './VerificationExperience';
import { ExternalVerification } from './ExternalVerification';
import { ACTS, ACT_VIEWS, presentationAct, liveStageAct, MOTION_LABEL, MOTION_MS, motionFocus, nextMotionStep, type MotionStep } from './presentation-sequence';
import type { PresentationProps } from './presentation-types';
import type { VerificationResult, VerificationTraceEvent } from './verification';
import './presentation.css';

export function Presentation(props: PresentationProps) {
  const [act, setAct] = useState(() => presentationAct(new URLSearchParams(window.location.search).get('view')));
  const [handoff, setHandoff] = useState(false);
  const [motion, setMotion] = useState<{ step: MotionStep; paused: boolean; replay: boolean; enteredAt: number; elapsed: number; previousResult?: VerificationResult; previousTrace?: VerificationTraceEvent[] }>();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const trace = props.verificationTrace ?? [];
  const verificationBusy = props.busy && props.stage === 'verify';
  const observedResult = motion && !motion.replay && props.result === motion.previousResult ? undefined : props.result;
  const observedTrace = motion && !motion.replay && props.verificationTrace === motion.previousTrace ? [] : trace;
  const step = reducedMotion ? observedResult ? 'result' : verificationBusy ? 'prepare' : 'ready'
    : motion?.step ?? (verificationBusy ? 'prepare' : props.result ? 'result' : 'ready');
  const next = nextMotionStep(step, { trace: observedTrace, result: observedResult });
  const scene = act < 3 ? (act === 2 && handoff ? 'delivery' : (['custody', 'prepare', 'register'] as const)[act]!)
    : act === 4 || step === 'ready' ? 'receive' : step === 'prepare' ? 'inspect' : ['compare', 'result'].includes(step) ? 'compare' : 'lookup';

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(media.matches);
      setMotion(undefined);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (props.mode !== 'live') return;
    setAct(liveStageAct(props.stage));
    setHandoff(false);
  }, [props.mode, props.stage]);
  useEffect(() => {
    if (!motion || motion.paused || reducedMotion || act !== 3 || step === next) return;
    const remaining = Math.max(0, MOTION_MS[step] - motion.elapsed - (performance.now() - motion.enteredAt));
    const timer = window.setTimeout(() => setMotion(value => value === motion
      ? { ...value, step: next, enteredAt: performance.now(), elapsed: 0 } : value), remaining);
    return () => window.clearTimeout(timer);
  }, [motion, reducedMotion, act, step, next]);
  const go = (next: number) => {
    setAct(next); setHandoff(false); setMotion(undefined);
    const url = new URL(window.location.href);
    url.searchParams.set('view', ACT_VIEWS[next]!);
    window.history.replaceState(null, '', url);
  };
  const begin = (replay: boolean) => setMotion(reducedMotion ? undefined : { step: 'prepare', paused: false, replay, enteredAt: performance.now(), elapsed: 0,
    previousResult: replay ? undefined : props.result, previousTrace: replay ? undefined : props.verificationTrace });
  const verifierProps: PresentationProps = {
    ...props,
    proof: props.verificationProof, trusted: props.verificationTrust,
    result: observedResult, verificationTrace: observedTrace,
    onVerify: () => { setAct(3); begin(false); props.onVerify(); },
    onSelectSample: variant => { setMotion(undefined); props.onSelectSample(variant); },
    onSelectFiles: files => { if (files.length) setMotion(undefined); props.onSelectFiles(files); },
    onClearFiles: () => { setMotion(undefined); props.onClearFiles(); },
  };
  const mapMotion = act === 3 ? { focus: motionFocus(step), label: MOTION_LABEL[step],
    detail: observedResult ? '관측한 처리 결과' : '조회·검증 진행', playing: Boolean(motion && !motion.paused && step !== 'result'),
    chainReadComplete: step === 'result' && observedResult?.chainRecordValid === true } : undefined;

  return <main className={`kp-root act-${act < 3 ? 'issue' : act === 3 ? 'verify' : 'external'}`} data-presentation-act={act + 1}>
    <header className="kp-header"><div className="kp-brand"><strong>KODA</strong><span>증빙 검증 서비스</span></div>
      <nav className="kp-acts" aria-label="발표 장면">{ACTS.map((label, index) => <button key={label} className={index === 4 ? 'kp-alternative' : undefined} aria-current={index === act ? 'step' : undefined} disabled={props.busy} onClick={() => go(index)}><small>0{index + 1}</small>{label}</button>)}</nav>
      <span className="kp-demo-label">산학협력 프로젝트 · 기술 데모</span>
    </header>
    <div className="kp-workspace">
      <aside className="kp-map-panel"><span className="kp-map-label">전체 흐름</span><ArchitectureMap scene={scene} busy={props.busy} trace={act === 4 ? [] : trace} result={act === 4 ? undefined : props.result} receiptBlock={props.receiptBlock} motion={mapMotion} external={act === 4} /><p className="kp-recipient-note">제3자: 은행·거래상대방·외부 감사인 등</p></aside>
      <section className="kp-stage" aria-label="현재 발표 장면">
        {act < 3 ? <IssueJourney {...props} phase={act as 0 | 1 | 2} onNext={() => go(act + 1)} onPrevious={() => go(act - 1)}
          onDownload={variant => { setHandoff(true); props.onDownload(variant); }} onDownloadProof={() => { setHandoff(true); props.onDownloadProof(); }} />
          : act === 4 ? <ExternalVerification /> : <VerificationExperience {...verifierProps} verificationBusy={verificationBusy} motion={{ step, paused: motion?.paused ?? false, replay: motion?.replay ?? false, reducedMotion,
            replayRun: () => begin(true), finish: () => setMotion(undefined),
            toggle: () => setMotion(value => value && { ...value, paused: !value.paused, enteredAt: performance.now(),
              elapsed: value.elapsed + (value.paused ? 0 : performance.now() - value.enteredAt) }),
          }} />}
        {props.error && props.mode === 'live' && act < 3 && <p className="kp-error" role="alert">발급·등록을 완료하지 못했습니다. 실행 로그에서 원인을 확인해 주세요.</p>}
      </section>
    </div>
    <footer className="kp-footer"><span>가상 증명서 · 시험 발급자 · 실행 환경 Ethereum Sepolia</span><details><summary>데모 범위</summary><p>KODA 운영 시스템과 연동한 화면은 아닙니다. PDF와 검증정보의 다운로드·불러오기로 전달 과정을 재현하며, 받은 파일을 실제 체인 기록과 대조합니다. 실제 BTC 잔고의 사실성, 공식 KODA 신원, 중간 변경 이력 전체를 증명하지 않습니다.</p></details></footer>
    <div className="kp-secondary"><details><summary>발표자 실행 준비</summary>{props.setup}</details><details><summary>실행 알림·전체 로그</summary>{props.error && <p>{props.error}</p>}{props.notice && <p role="status">{props.notice}</p>}{props.evidence}</details></div>
  </main>;
}
