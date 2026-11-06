import type { ReactNode } from 'react';
import { addressUrl, transactionUrl } from './wallet';
import type { PresentationProps } from './presentation-types';
import { verificationProgress } from './verification-progress';
import type { VerificationTraceEvent } from './verification';
import { verifierOutcome } from './verifier-outcome';
import './verification-experience.css';

type Review = {
  index: number;
  playing: boolean;
  reducedMotion: boolean;
  steps: ReturnType<typeof verificationProgress>;
  select: (index: number) => void;
  toggle: () => void;
};

type IconName = 'file' | 'check' | 'close' | 'alert' | 'arrow' | 'back' | 'play' | 'pause' | 'upload' | 'chain' | 'shield' | 'code';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    file: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h4M9 12h6M9 16h6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m7 7 10 10M17 7 7 17" />,
    alert: <><path d="M12 3 22 20H2Z" /><path d="M12 9v4m0 4h.01" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="m14 6-6 6 6 6" />,
    play: <path d="m9 5 10 7-10 7Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    upload: <><path d="M12 17V4m-5 5 5-5 5 5M5 17v4h14v-4" /></>,
    chain: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /><path d="m9 15 6-6" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.3-2.9 7.6-7 10-4.1-2.4-7-5.7-7-10V6Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    code: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14" /></>,
  };
  return <svg className="ve-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

const short = (value?: string) => value ? `${value.slice(0, 13)}…${value.slice(-8)}` : '관측 전';
const raw = (value?: string) => value || '관측 전';

function Field({ label, children }: { label: string; children?: ReactNode }) {
  return <div className="ve-field"><dt>{label}</dt><dd>{children || '관측 전'}</dd></div>;
}

function traceValue(trace: VerificationTraceEvent[], id: VerificationTraceEvent['id']) {
  return trace.findLast(event => event.id === id && event.state === 'success')?.detail;
}

function observedFinalizedBlock(props: PresentationProps, trace: VerificationTraceEvent[]) {
  if (props.result?.finalizedBlock) return props.result.finalizedBlock;
  return traceValue(trace, 'finalized-block')?.match(/finalized #(\d+)/)?.[1];
}

function observedAddress(value?: string) {
  return value?.match(/0x[a-fA-F0-9]{40}/)?.[0];
}

function ReviewNavigator({ review }: { review: Review }) {
  return <nav className="ve-review" aria-label="처리 기록 보조 탐색">
    <div className="ve-review-actions">
      <button type="button" aria-label="이전 처리 기록" disabled={review.index === 0} onClick={() => review.select(review.index - 1)}><Icon name="back" /></button>
      <button type="button" aria-label={review.playing ? '처리 기록 일시정지' : '처리 기록 재생'} disabled={review.reducedMotion || review.steps.length < 2} onClick={review.toggle}><Icon name={review.playing ? 'pause' : 'play'} /></button>
      <button type="button" aria-label="다음 처리 기록" disabled={review.index === review.steps.length - 1} onClick={() => review.select(review.index + 1)}><Icon name="arrow" /></button>
      <small>{review.reducedMotion ? '자동 재생 없음' : review.playing ? '기록 재생 중' : '기록 정지'}</small>
    </div>
    <ol>
      {review.steps.map((step, index) => <li key={step.id} data-state={step.state}><button type="button" aria-current={review.index === index ? 'step' : undefined} onClick={() => review.select(index)}>{index + 1}<span>{step.title}</span><em>{step.statusLabel}</em></button></li>)}
    </ol>
  </nav>;
}

function ReceiveTechnical({ props }: { props: PresentationProps }) {
  return <div className="ve-tech-flow ve-receive">
    <div className="ve-object"><Icon name="file" /><span>고객사가 제출한 파일</span><b>BTC 잔고 증명서 PDF</b><code>{props.selectedName ?? 'PDF 선택 전'}</code></div>
    <span className="ve-flow-arrow"><Icon name="arrow" /></span>
    <div className="ve-object is-dashboard"><span>제3자 화면</span><b>KODA 대시보드</b><code>문서 ID {short(props.proof?.documentId)}</code></div>
    <span className="ve-flow-arrow"><Icon name="arrow" /></span>
    <div className="ve-object is-chain"><Icon name="chain" /><span>공개 조회 기준</span><b>DocumentRegistry</b><code>Ethereum 기록</code></div>
  </div>;
}

function InspectTechnical({ props, trace }: { props: PresentationProps; trace: VerificationTraceEvent[] }) {
  const hash = traceValue(trace, 'sha256') ?? props.result?.fileHash;
  const signature = traceValue(trace, 'signature');
  return <div className="ve-inspect-lanes">
    <div className="ve-tech-flow ve-inspect">
      <div className="ve-operation"><span>제3자 브라우저 입력</span><b>제출 PDF 전체 바이트</b><code>{props.selectedName ?? '파일 선택 전'}</code></div>
      <span className="ve-flow-arrow"><Icon name="arrow" /></span>
      <div className="ve-operation is-emphasis"><span>Web Crypto API · SHA-256</span><b>Hfile 계산</b><code>{short(hash)}</code></div>
    </div>
    <div className="ve-tech-flow ve-inspect">
      <div className="ve-operation"><span>사전 발급정보 입력</span><b>documentId · documentHash · issuedAt · signature</b><code>발급정보와 signature를 사용</code></div>
      <span className="ve-flow-arrow"><Icon name="arrow" /></span>
      <div className="ve-operation"><span>EIP-712 · ECDSA secp256k1</span><b>서명자 주소 복구</b><code>{short(props.result?.recoveredAddress ?? signature)}</code></div>
    </div>
  </div>;
}

function LookupTechnical({ props, trace }: { props: PresentationProps; trace: VerificationTraceEvent[] }) {
  const receipt = trace.find(event => event.id === 'receipt' && event.state !== 'running')?.detail;
  const finality = trace.find(event => event.id === 'finality' && event.state !== 'running')?.detail;
  const issuer = observedAddress(traceValue(trace, 'authorized-issuer'));
  const finalizedBlock = observedFinalizedBlock(props, trace);
  return <div className="ve-lookup-grid">
    <section><span>제3자 브라우저의 JSON-RPC 요청</span><b>eth_call records(documentId)</b><code>문서 ID {short(props.proof?.documentId)}</code><small>읽기 전용 조회입니다. 가스비를 내거나 새 블록을 만들지 않습니다.</small></section>
    <span className="ve-flow-arrow"><Icon name="arrow" /></span>
    <section className="is-chain"><Icon name="chain" /><span>Ethereum · DocumentRegistry 공개 상태</span><b>records / authorizedIssuer</b><code>{props.trusted?.contract ?? '컨트랙트 정보 준비 전'}</code></section>
    <div className="ve-chain-concept" aria-label="Ethereum 블록 연결 구조 개념도"><span>블록 연결 구조 · 개념도</span><div aria-hidden="true"><i /><b>등록 기준</b><i /></div><small>조회 기준 finalized #{finalizedBlock ?? '관측 전'} · 앞뒤 블록을 별도로 조회한 표현이 아닙니다.</small></div>
    <span className="ve-flow-arrow"><Icon name="arrow" /></span>
    <section><span>같은 확정 블록에서 받은 응답</span><b>해시 · issuedAt · 발급자</b><code>Hchain {short(props.result?.chainHash)}</code><code>issuedAt {props.result?.chainIssuedAt ?? '응답 전'}</code><code>issuer {short(issuer)}</code></section>
    <aside className="ve-finality"><b>등록 거래와 확정 상태는 별도로 대조합니다</b><span>Ethereum receipt: {receipt ?? '영수증 조회 전'}</span><span>Ethereum finalized: #{finalizedBlock ?? '조회 전'}</span><span>브라우저 비교: receipt.blockNumber ≤ finalized.number</span><small>{finality ?? '동일한 finalized 블록 번호로 authorizedIssuer()와 records(documentId)를 eth_call 조회합니다.'}</small></aside>
  </div>;
}

function CompareTechnical({ props }: { props: PresentationProps }) {
  const result = props.result;
  const mark = result?.fileMatch === true && result.chainRecordValid === true ? '=' : result?.fileMatch === false ? '≠' : '·';
  return <div className={`ve-compare${result?.fileMatch === false ? ' is-mismatch' : ''}`} aria-label="세 해시 대조">
    <div><span>제출 PDF</span><b>Hfile</b><code>{raw(result?.fileHash)}</code></div>
    <strong aria-hidden="true">{mark}</strong>
    <div><span>발급서명 데이터</span><b>Hsigned</b><code>{raw(result?.signedHash ?? props.proof?.documentHash)}</code></div>
    <strong aria-hidden="true">{result?.chainRecordValid ? '=' : '·'}</strong>
    <div><span>Ethereum 기록</span><b>Hchain</b><code>{raw(result?.chainHash)}</code></div>
  </div>;
}

function TechnicalPanel({ phase, props, review }: { phase: VerificationExperienceProps['phase']; props: PresentationProps; review?: Review }) {
  const trace = props.verificationTrace ?? [];
  const title = { receive: '고객사 → 제3자', inspect: '제3자 브라우저 · 두 계산 경로', lookup: '제3자 브라우저 ↔ Ethereum', compare: '제3자 브라우저 · 해시 대조' }[phase];
  return <section className="ve-technical" aria-label="검증 기술 처리">
    <header><span>{review ? '실행한 처리 기록 · 추가 조회 없음' : '실제 처리'}</span><h2>{title}</h2><p>{review ? '기록을 다시 보는 동안에는 새 JSON-RPC 요청을 보내지 않습니다.' : props.busy ? '실시간 검증 요청을 처리 중입니다.' : props.result ? '이번 검증에서 관측한 결과입니다.' : '실행 전에는 관측값을 채우지 않습니다.'}</p></header>
    {phase === 'receive' && <ReceiveTechnical props={props} />}
    {phase === 'inspect' && <InspectTechnical props={props} trace={trace} />}
    {phase === 'lookup' && <LookupTechnical props={props} trace={trace} />}
    {phase === 'compare' && <CompareTechnical props={props} />}
  </section>;
}

export type VerificationExperienceProps = PresentationProps & {
  phase: 'receive' | 'inspect' | 'lookup' | 'compare';
  review?: Review;
};

export function VerificationExperience(props: VerificationExperienceProps) {
  const trace = props.verificationTrace ?? [];
  const outcome = verifierOutcome(props.result, props.busy);
  const reviewLabel = props.review ? '기록 재생 · 추가 조회 없음' : props.busy ? '실시간 검증 중' : props.result ? '현재 조회 결과' : '검증 대기';
  const phaseHeading = {
    receive: '제출받은 증명서를 검증할 준비를 합니다',
    inspect: '제출 PDF와 발급정보에서 각각 검증값을 확인합니다',
    lookup: 'Ethereum의 확정된 발급 기록을 다시 읽습니다',
    compare: '제출본·발급정보·Ethereum 기록을 대조합니다',
  }[props.phase];
  return <article className="ve-root">
    <header className="ve-stage-heading"><span>제3자 검증 · {({ receive: '제출 준비', inspect: '로컬 확인', lookup: '공개 기록 조회', compare: '최종 대조' })[props.phase]}</span><h1>{phaseHeading}</h1></header>

    <div className="ve-experience-columns">
    <section className="ve-dashboard" aria-label="제3자 검증 대시보드">
    <header className="ve-app-header"><div><strong>KODA 대시보드</strong><span aria-hidden="true">/</span><span>증빙 검증</span></div><p><Icon name="shield" /> 외부 검증자 · {reviewLabel}</p></header>
    <p className="ve-proposal-caption">운영 연동 화면이 아닌, 제3자 검증 흐름을 설명하는 제안 화면입니다.</p>

      <section className="ve-submit" aria-label="제출 PDF 선택">
        <header><span>제출 문서</span><h2>BTC 잔고 증명서</h2><p>제출받은 PDF를 발급 당시의 기준과 대조합니다.</p></header>
        <div className="ve-samples" role="group" aria-label="시연 파일 선택">
          <button type="button" disabled={props.busy} aria-pressed={props.selectedVariant === 'original'} className={props.selectedVariant === 'original' ? 'is-selected' : ''} onClick={() => props.onSelectSample('original')}><Icon name="file" /><span><b>발급 원본</b><small>100 BTC</small></span></button>
          <button type="button" disabled={props.busy} aria-pressed={props.selectedVariant === 'altered'} className={props.selectedVariant === 'altered' ? 'is-selected' : ''} onClick={() => props.onSelectSample('altered')}><Icon name="file" /><span><b>변경본</b><small>120 BTC</small></span></button>
        </div>
        <label className="ve-upload"><Icon name="upload" /><span><b>제출받은 PDF 선택</b><small>{props.selectedName ?? '10 MiB 이하 PDF'}</small></span><input disabled={props.busy} type="file" accept="application/pdf,.pdf" onChange={event => props.onSelectFile(event.target.files?.[0])} /></label>
        <p className="ve-preloaded">미리 불러온 발급정보와 대조합니다.</p>

        <button type="button" className="ve-primary" disabled={!props.canVerify || props.busy} onClick={props.onVerify}>{props.busy ? '문서 검증 중' : props.result ? '다시 검증하기' : '문서 검증하기'}<Icon name="arrow" /></button>
        <p className="ve-limitation">시험 발급자 주소로 시연합니다. 공식 KODA 신원이나 실제 BTC 잔고를 인증하지 않습니다.</p>
      </section>

      <section className={`ve-outcome is-${outcome.kind}`} aria-live="polite" aria-busy={props.busy}>
        <div className="ve-outcome-heading"><span className="ve-outcome-icon"><Icon name={outcome.kind === 'match' ? 'check' : outcome.kind === 'mismatch' ? 'close' : outcome.kind === 'failure' ? 'alert' : 'chain'} /></span><div><span>검증 결과</span><h2>{outcome.title}</h2><p>{outcome.description}</p></div></div>
        <ol className="ve-questions">{outcome.questions.map((question, index) => <li key={question.label} className={`is-${question.state}`}><span>{String(index + 1).padStart(2, '0')}</span><b>{question.label}</b><strong>{question.value}</strong></li>)}</ol>
        <p className="ve-outcome-scope">변경 여부는 현재 제출본과 발급 원본의 비교 결과입니다.</p>
      </section>
    </section>

    <TechnicalPanel phase={props.phase} props={props} review={props.review} />
    </div>
    {props.review && <ReviewNavigator review={props.review} />}

    <section className="ve-reason"><header><Icon name="chain" /><div><span>설계 근거</span><h2>블록체인에 발급 기록을 남기는 이유</h2></div></header><p>제3자가 발급기관에 다시 문의하지 않고도, 발급 당시 등록된 기준을 공개 기록에서 읽어 제출 PDF와 대조할 수 있습니다.</p><details><summary>Ethereum을 선택한 근거 보기</summary><p>공개 L1의 EVM 스마트컨트랙트에 발급자 제한과 최초 등록 보존 규칙을 두고, 누구나 같은 확정 상태를 조회하는 구성을 사용합니다. 다른 EVM 체인에도 구현할 수 있으며, 이 데모는 비용 최적화를 입증하지 않습니다. 실제 실행 환경은 Ethereum Sepolia 테스트넷입니다.</p></details></section>

    <div className="ve-links">{props.proof?.transactionHash && <a href={transactionUrl(props.proof.transactionHash)} target="_blank" rel="noreferrer">테스트 등록 거래 ↗</a>}{props.trusted && <a href={addressUrl(props.trusted.contract)} target="_blank" rel="noreferrer">테스트 컨트랙트 ↗</a>}</div>
    <details className="ve-evidence"><summary>전체 해시·관측된 호출 기록 보기</summary><dl><Field label="문서 ID"><code>{props.proof?.documentId}</code></Field><Field label="신뢰할 발급자"><code>{props.trusted?.issuer}</code></Field><Field label="등록 거래"><code>{props.proof?.transactionHash}</code></Field><Field label="제출 PDF · Hfile"><code>{raw(props.result?.fileHash)}</code></Field><Field label="서명 데이터 · Hsigned"><code>{raw(props.result?.signedHash ?? props.proof?.documentHash)}</code></Field><Field label="Ethereum 기록 · Hchain"><code>{raw(props.result?.chainHash)}</code></Field><Field label="복구한 발급자"><code>{raw(props.result?.recoveredAddress)}</code></Field><Field label="finalized block">{raw(props.result?.finalizedBlock)}</Field><Field label="판정">{raw(props.result?.status)}</Field></dl><ol className="ve-trace">{trace.length ? trace.map((event, index) => <li key={`${event.id}-${index}`}><b>{event.state === 'success' ? '완료' : event.state === 'failure' ? '실패' : '진행 중'} · {event.operation}</b><code>{event.detail ?? '세부 관측값 없음'}</code></li>) : <li>아직 관측된 호출 기록이 없습니다.</li>}</ol></details>
  </article>;
}
