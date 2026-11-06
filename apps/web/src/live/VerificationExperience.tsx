import { addressUrl, transactionUrl } from './wallet';
import type { PresentationProps } from './presentation-types';
import type { ReviewPhase } from './presentation-sequence';
import { verifierOutcome } from './verifier-outcome';
import './verification-experience.css';

type Review = { index: number; phases: ReviewPhase[]; playing: boolean; reducedMotion: boolean; select: (index: number) => void; toggle: () => void };
type Props = PresentationProps & { phase: 'receive' | ReviewPhase; review?: Review };
const short = (value?: string) => value ? `${value.slice(0, 10)}…${value.slice(-6)}` : '—';
function Icon({ name }: { name: 'file' | 'check' | 'close' | 'alert' | 'arrow' | 'back' | 'play' | 'pause' }) {
  const paths = {
    file: 'M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6M9 16h6',
    check: 'm5 12 4 4L19 6', close: 'm7 7 10 10M17 7 7 17',
    alert: 'M12 3 22 20H2ZM12 9v4m0 4h.01', arrow: 'M4 12h16m-6-6 6 6-6 6',
    back: 'm14 6-6 6 6 6', play: 'm9 5 10 7-10 7Z', pause: 'M8 5v14M16 5v14',
  };
  return <svg className="ve-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function VerificationMotion({ props }: { props: Props }) {
  const { phase, result, busy, review } = props;
  const trace = props.verificationTrace ?? [];
  const fileHash = trace.findLast(event => event.id === 'sha256' && event.state === 'success')?.detail ?? result?.fileHash;
  const isLookup = phase === 'lookup';
  const compared = phase === 'compare' && Boolean(result);
  const matched = compared && result?.status === 'match';
  const different = compared && result?.status === 'file-mismatch';
  const chainRead = result?.chainRecordValid === true;
  const showChainHash = chainRead && (isLookup || compared);
  const failed = result && !['match', 'file-mismatch'].includes(result.status) && !busy;
  const caption = phase === 'receive' ? 'PDF를 선택하고 검증을 시작해 보세요'
    : phase === 'inspect' ? '제출 PDF의 해시와 발급서명을 확인합니다'
      : isLookup ? failed ? '조회·확인한 범위에서 검증이 멈췄습니다' : 'Ethereum에서 등록된 원본의 기준을 읽습니다'
        : matched ? '제출 PDF와 등록된 원본의 해시가 같습니다'
          : different ? '제출 PDF의 해시가 등록된 원본과 다릅니다' : '원본과의 일치 여부를 확인하지 못했습니다';
  return <section className={`ve-processing phase-${phase}${matched ? ' is-match' : ''}${different ? ' is-mismatch' : ''}${isLookup && (busy || review?.playing) ? ' is-animating' : ''}`} aria-label="제3자의 문서 대조 과정">
    <div className="ve-process-label"><span>{review ? '방금 실행한 주요 처리 · 설명 재생' : busy ? '실제 조회·검증 중' : result ? '이번 검증의 처리 결과' : '검증은 이렇게 진행됩니다'}</span><i className={busy ? 'is-busy' : ''} /></div>
    <svg className="ve-flow" viewBox="0 0 480 310" role="img" aria-labelledby="ve-flow-title ve-flow-desc">
      <title id="ve-flow-title">제출 PDF와 Ethereum의 발급 기록 대조</title>
      <desc id="ve-flow-desc">제3자 브라우저에서 PDF 해시를 계산합니다. 문서 ID로 Ethereum의 기존 기록을 조회하고 응답을 받아 대조합니다. 연결된 블록은 개념도이며 조회로 새 블록을 만들지 않습니다.</desc>
      <defs><marker id="ve-flow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M1 1 6 3.5 1 6" /></marker></defs>
      <text className="ve-svg-label" x="84" y="32" textAnchor="middle">제3자 브라우저</text>
      <text className="ve-svg-label ve-svg-chain-title" x="363" y="32" textAnchor="middle">Ethereum</text>
      <g className="ve-flow-paper" transform="translate(43 60)"><path d="M0 0h58l24 24v103H0Z" /><path className="ve-paper-fold" d="M58 0v24h24" /><path className="ve-paper-lines" d="M17 58h48M17 72h48M17 86h30" /><text x="40" y="43" textAnchor="middle">PDF</text></g>
      <g className="ve-ledger" transform="translate(302 70)">
        <path className="ve-ledger-link" d="M-22 72H0M117 72h26" />
        <path className="ve-side-block" d="M-46 51h24v42h-24ZM143 51h24v42h-24Z" />
        <path className="ve-block-top" d="M0 18 20 0h97L97 18Z" /><path className="ve-block-side" d="M97 18 117 0v96L97 114Z" />
        <rect className="ve-record-block" y="18" width="97" height="96" />
        <path className="ve-record-lines" d="M17 43h63M17 57h63M17 71h42" />
        <text className="ve-record-label" x="48" y="96" textAnchor="middle">발급 기록</text>
      </g>
      <g className="ve-request"><path d="M136 102H300" markerEnd="url(#ve-flow-arrow)" /><text x="206" y="88" textAnchor="middle">문서 ID로 조회</text><circle className="ve-query-packet" cx="140" cy="102" r="4" /></g>
      <g className="ve-response"><path d="M300 184H136" markerEnd="url(#ve-flow-arrow)" /><text x="208" y="172" textAnchor="middle">등록된 기준</text><circle className="ve-response-packet" cx="296" cy="184" r="4" /></g>
      <text className="ve-svg-tech" x="84" y="214" textAnchor="middle">SHA-256 · 발급서명 확인</text>
      <text className="ve-svg-tech" x="363" y="214" textAnchor="middle">스마트컨트랙트 조회</text>
      <g className="ve-digest ve-digest-file" transform="translate(12 232)"><rect width="166" height="48" rx="6" /><text x="83" y="29" textAnchor="middle">{short(fileHash)}</text></g>
      <g className="ve-digest ve-digest-chain" transform="translate(290 232)"><rect width="178" height="48" rx="6" /><text x="89" y="29" textAnchor="middle">{showChainHash ? short(result?.chainHash) : '등록된 원본 해시'}</text></g>
      {compared && <text className="ve-comparison-sign" x="234" y="267" textAnchor="middle">{matched ? '=' : different ? '≠' : '?'}</text>}
      <text className="ve-digest-caption" x="95" y="301" textAnchor="middle">제출 파일</text><text className="ve-digest-caption" x="379" y="301" textAnchor="middle">Ethereum 기록</text>
    </svg>
    <p className="ve-process-caption" aria-live="polite">{caption}</p>
    {review && <nav className="ve-replay" aria-label="처리 설명 다시 보기">
      <span>{review.index + 1} / {review.phases.length}<small>{review.playing ? '설명 재생 중' : '설명 정지'} · 추가 조회 없음</small></span>
      <button aria-label="이전 처리 설명" disabled={review.index === 0} onClick={() => review.select(review.index - 1)}><Icon name="back" /></button>
      <button aria-label={review.playing ? '처리 설명 일시정지' : '처리 설명 재생'} disabled={review.reducedMotion || review.phases.length < 2} onClick={review.toggle}><Icon name={review.playing ? 'pause' : 'play'} /></button>
      <button aria-label="다음 처리 설명" disabled={review.index === review.phases.length - 1} onClick={() => review.select(review.index + 1)}><Icon name="arrow" /></button>
    </nav>}
  </section>;
}

export function VerificationExperience(props: Props) {
  const outcome = verifierOutcome(props.result, props.busy);
  const hasOutcome = props.busy || Boolean(props.result);
  return <article className="ve-root">
    <header className="ve-stage-heading"><span>02 · 제3자 검증</span><h1>제출받은 증명서를 발급 기록과 대조합니다</h1><p>발급기관에 다시 문의하지 않고, 등록된 기준을 직접 확인합니다.</p></header>
    <div className="ve-demo-input" role="group" aria-label="시연 파일 선택"><span>시연 파일</span><button aria-pressed={props.selectedVariant === 'original'} disabled={props.busy} onClick={() => props.onSelectSample('original')}>발급 원본 <small>100 BTC</small></button><button aria-pressed={props.selectedVariant === 'altered'} disabled={props.busy} onClick={() => props.onSelectSample('altered')}>변경본 <small>120 BTC</small></button></div>
    <div className={`ve-experience flow-${props.phase}${props.result?.status === 'file-mismatch' ? ' has-mismatch' : ''}`}>
      <section className="ve-dashboard" aria-label="제3자가 이용하는 KODA 대시보드">
        <header className="ve-app-header"><strong>KODA <span>대시보드</span></strong><span>제3자 · 증빙 검증</span></header>
        <div className="ve-app-body">
          <label className="ve-upload"><Icon name="file" /><span><b>BTC 잔고 증명서</b><small>{props.selectedVariant === 'upload' ? props.selectedName : props.selectedVariant === 'original' ? '발급 원본 · 100 BTC' : '변경본 · 120 BTC'}</small></span><em>PDF 선택</em><input aria-label="검증할 PDF 선택" disabled={props.busy} type="file" accept="application/pdf,.pdf" onChange={event => props.onSelectFile(event.target.files?.[0])} /></label>
          {hasOutcome ? <section className={`ve-outcome is-${outcome.kind}`} aria-live="polite" aria-busy={props.busy}>
            <div className="ve-outcome-icon"><Icon name={outcome.kind === 'match' ? 'check' : outcome.kind === 'mismatch' ? 'close' : 'alert'} /></div>
            <h2>{outcome.title}</h2>
            {(outcome.kind === 'failure' || outcome.kind === 'pending') && <p className="ve-error-reason">{outcome.description}</p>}
            {!props.busy && <ol className="ve-questions">{outcome.questions.map(question => <li key={question.label} className={`is-${question.state}`}><span>{question.label}</span><strong>{question.state === 'confirmed' ? <Icon name="check" /> : null}{question.value}</strong></li>)}</ol>}
          </section> : <div className="ve-ready"><h2>제출받은 PDF를 확인하세요</h2><p>발급서명과 Ethereum에 등록된<br />원본의 해시를 함께 대조합니다.</p></div>}
          <button className="ve-primary" disabled={!props.canVerify || props.busy} onClick={props.onVerify}>{props.busy ? '검증 중' : props.result ? '다시 검증하기' : '문서 검증하기'}<Icon name="arrow" /></button>
          <p className="ve-app-note">미리 불러온 발급정보 사용 · 현재 제출본과 원본 비교</p>
        </div>
      </section>
      <div className="ve-ui-link" aria-hidden="true"><svg className="ve-ui-outbound" viewBox="0 0 100 12"><path d="M0 6H98m-6-5 6 5-6 5" /><circle cx="5" cy="6" r="3" /></svg><svg className="ve-ui-inbound" viewBox="0 0 100 12"><path d="M100 6H2m6-5-6 5 6 5" /><circle cx="95" cy="6" r="3" /></svg></div>
      <VerificationMotion props={props} />
    </div>
    <details className="ve-evidence"><summary>기술 상세·실제 조회 기록</summary><p>제출 파일·서명된 발급정보·체인 기록의 세 해시를 모두 대조합니다. 위 연출은 주요 처리의 요약이며, 전체 실행 순서는 아래 기록을 따릅니다.</p><dl>
      <dt>문서 ID</dt><dd>{props.proof?.documentId ?? '준비 전'}</dd><dt>제출 PDF 해시</dt><dd>{props.result?.fileHash ?? '조회 전'}</dd><dt>서명된 원본 해시</dt><dd>{props.proof?.documentHash ?? '준비 전'}</dd><dt>체인에서 읽은 해시</dt><dd>{props.result?.chainHash ?? '조회 전'}</dd><dt>발급서명</dt><dd>{props.proof?.signature ?? '준비 전'}</dd><dt>복구한 발급자</dt><dd>{props.result?.recoveredAddress ?? '조회 전'}</dd><dt>확정 블록</dt><dd>{props.result?.finalizedBlock ?? '조회 전'}</dd>
    </dl><ol>{props.verificationTrace?.map((event, index) => <li key={index}><b>{event.state} · {event.operation}</b><code>{event.detail}</code></li>)}</ol><div className="ve-evidence-links">{props.proof?.transactionHash && <a href={transactionUrl(props.proof.transactionHash)} target="_blank" rel="noreferrer">실제 테스트 등록 거래 ↗</a>}{props.trusted && <a href={addressUrl(props.trusted.contract)} target="_blank" rel="noreferrer">테스트 컨트랙트 ↗</a>}</div></details>
  </article>;
}
