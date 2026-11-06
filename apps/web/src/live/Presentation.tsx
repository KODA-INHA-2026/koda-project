import { useEffect, useState } from 'react';
import { ArchitectureMap } from './ArchitectureMap';
import { CustodyScene, PrepareScene, RegisterScene } from './IssuerScenes';
import { VerificationExperience } from './VerificationExperience';
import { CHAPTERS, LIVE_CHAPTER, chapterForStep, chapterForTrace, isVerificationChapter } from './presentation-sequence';
import type { PresentationProps } from './presentation-types';
import { verificationProgress } from './verification-progress';
import type { VerificationResult } from './verification';
import './presentation.css';

const REVIEW_INTERVAL = 3_500;
function PlayerIcon({ kind }: { kind: 'back' | 'next' | 'play' | 'pause' }) {
  return <svg className="kp-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={kind === 'back' ? 'm14 6-6 6 6 6' : kind === 'next' ? 'm10 6 6 6-6 6' : kind === 'play' ? 'm9 5 10 7-10 7Z' : 'M8 5v14M16 5v14'} /></svg>;
}
export function Presentation(props: PresentationProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [followVerification, setFollowVerification] = useState(false);
  const [reviewState, setReviewState] = useState<{ result: VerificationResult; index: number; playing: boolean }>();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const trace = props.verificationTrace ?? [];
  const reviewSteps = verificationProgress(trace, false, props.result).filter(step => step.state !== 'idle');
  const activeReview = followVerification && !props.busy && reviewState?.result === props.result ? reviewState : undefined;
  const reviewedStep = activeReview ? reviewSteps[activeReview.index] : undefined;
  const id = followVerification && props.busy ? chapterForTrace(trace)
    : reviewedStep ? chapterForStep(reviewedStep.id) : CHAPTERS[index]!.id;
  const safeIndex = CHAPTERS.findIndex(item => item.id === id);
  const isVerifier = isVerificationChapter(id);

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
    if (props.mode === 'live') setIndex(CHAPTERS.findIndex(item => item.id === LIVE_CHAPTER[props.stage]));
  }, [props.mode, props.stage]);
  useEffect(() => {
    if (!followVerification || props.busy || !props.result) { setReviewState(undefined); return; }
    if (reviewSteps.length) setReviewState({ result: props.result, index: 0, playing: !reducedMotion && reviewSteps.length > 1 });
  }, [followVerification, props.result, props.busy]);
  useEffect(() => {
    if (!activeReview?.playing || reducedMotion) return;
    const timer = window.setTimeout(() => setReviewState(value => value && value.result === props.result
      ? value.index < reviewSteps.length - 1 ? { ...value, index: value.index + 1 } : { ...value, playing: false }
      : value), REVIEW_INTERVAL);
    return () => window.clearTimeout(timer);
  }, [activeReview, props.result, reducedMotion, reviewSteps.length]);
  useEffect(() => {
    if (!playing || reducedMotion || props.busy || index >= 3) { if (index >= 3) setPlaying(false); return; }
    const timer = window.setTimeout(() => setIndex(value => value + 1), 7_500);
    return () => window.clearTimeout(timer);
  }, [index, playing, reducedMotion, props.busy]);

  const go = (next: number) => {
    setPlaying(false); setFollowVerification(false); setReviewState(undefined);
    setIndex(Math.min(Math.max(next, 0), CHAPTERS.length - 1));
  };
  const review = activeReview ? {
    ...activeReview, reducedMotion, steps: reviewSteps,
    select: (next: number) => setReviewState(value => value ? { ...value, index: Math.max(0, Math.min(next, reviewSteps.length - 1)), playing: false } : value),
    toggle: () => setReviewState(value => value ? { ...value, index: !value.playing && value.index === reviewSteps.length - 1 ? 0 : value.index, playing: !value.playing } : value),
  } : undefined;
  const mapReview = reviewedStep ? { label: reviewedStep.title, detail: `${reviewedStep.tech} · 실행 결과: ${reviewedStep.statusLabel}`, stepId: reviewedStep.ids[0]!, state: reviewedStep.state } : undefined;
  const verifierProps: PresentationProps = {
    ...props,
    onVerify: () => { setPlaying(false); setIndex(3); setFollowVerification(true); setReviewState(undefined); props.onVerify(); },
    onSelectSample: variant => { go(3); props.onSelectSample(variant); },
    onSelectFile: file => { if (file) go(3); props.onSelectFile(file); },
  };
  return <main className={`kp-root scene-${id}${playing ? ' is-playing' : ''}`}>
    <header className="kp-header">
      <div className="kp-brand"><strong>KODA</strong><span>증빙 전달·검증 기술 데모</span></div>
      <div className="kp-mode"><i />{isVerifier ? props.busy ? '실시간 조회·검증 중' : props.result ? '실제 판정 결과 · 처리 기록 확인' : '제3자 검증 · 지갑 불필요' : props.mode === 'recorded' ? '실제 등록 기록 · 발급 과정 설명' : '새 문서 실제 처리'}</div>
    </header>
    <div className="kp-chapter-group"><span className={!isVerifier ? 'is-current' : ''}>01–03 발급 원본의 기준 만들기</span><span className={isVerifier ? 'is-current' : ''}>04–07 제3자가 제출 문서 검증하기</span></div>
    <div className="kp-workspace">
      <aside className="kp-map-panel"><header><span>전체 아키텍처</span><b>수탁부터 문서 검증까지</b></header>
        <ArchitectureMap scene={id} busy={props.busy} trace={trace} result={props.result} receiptBlock={props.receiptBlock} review={mapReview} />
        <p className="kp-map-foot">데모 실행: 발급자 처리는 브라우저·MetaMask에서 수행합니다. 실제 KODA 시스템과 연동한 화면은 아닙니다.</p>
      </aside>
      <section className="kp-stage" aria-label="현재 처리 장면">
        {isVerifier ? <VerificationExperience {...verifierProps} phase={id} review={review} />
          : id === 'custody' ? <CustodyScene {...props} /> : id === 'prepare' ? <PrepareScene {...props} /> : <RegisterScene {...props} />}
        {props.error && !isVerifier && <p className="kp-error" role="alert">{props.error}</p>}
      </section>
    </div>
    <nav className="kp-transport" aria-label="발표 장면 이동">
      <div className="kp-player">
        <button aria-label="이전 장면" disabled={props.busy || safeIndex === 0} onClick={() => go(safeIndex - 1)}><PlayerIcon kind="back" /></button>
        <button aria-label={playing ? '발급 과정 일시정지' : '발급 과정 재생'} disabled={props.busy || reducedMotion || !props.proof || isVerifier} onClick={() => setPlaying(value => !value)}><PlayerIcon kind={playing ? 'pause' : 'play'} /></button>
        <span>{String(safeIndex + 1).padStart(2, '0')} / 07</span>
      </div>
      <ol>{CHAPTERS.map((item, i) => <li key={item.id}><button disabled={props.busy} aria-current={i === safeIndex ? 'step' : undefined} onClick={() => go(i)}><i />{item.label}</button></li>)}</ol>
      <button className="kp-next" aria-label="다음 장면" disabled={safeIndex === CHAPTERS.length - 1 || props.busy} onClick={() => go(safeIndex + 1)}><PlayerIcon kind="next" /></button>
      {!isVerifier && props.canVerify && <button className="kp-jump" disabled={props.busy} onClick={() => go(3)}>직접 검증하기</button>}
    </nav>
    <p className="kp-environment">기획 체인 <b>Ethereum</b> · 실행 환경 <b>Sepolia 테스트넷</b></p>
    <div className="kp-secondary"><details><summary>발표자 실행 준비</summary>{props.setup}</details><details><summary>실행 알림·전체 로그</summary>{props.error && <p>{props.error}</p>}{props.notice && <p role="status">{props.notice}</p>}{props.evidence}</details></div>
  </main>;
}
