import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { addressUrl, transactionUrl } from './wallet';
import type { PresentationProps } from './presentation-types';
import { MOTION_LABEL, MOTION_MS, type MotionStep } from './presentation-sequence';
import { verifierOutcome } from './verifier-outcome';
import './verification-experience.css';

type Motion = { step: MotionStep; paused: boolean; replay: boolean; reducedMotion: boolean; replayRun: () => void; finish: () => void; toggle: () => void };
type Props = PresentationProps & { motion: Motion; verificationBusy: boolean };
const short = (value?: string) => value ? `${value.slice(0, 10)}…${value.slice(-6)}` : '—';
function Icon({ name }: { name: 'file' | 'check' | 'close' | 'alert' | 'arrow' | 'play' | 'pause' }) {
  const paths = {
    file: 'M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6M9 16h6',
    check: 'm5 12 4 4L19 6', close: 'm7 7 10 10M17 7 7 17',
    alert: 'M12 3 22 20H2ZM12 9v4m0 4h.01', arrow: 'M4 12h16m-6-6 6 6-6 6',
    play: 'm9 5 10 7-10 7Z', pause: 'M8 5v14M16 5v14',
  };
  return <svg className="ve-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function ProductIcon({ name }: { name: 'building' | 'audit' | 'verify' }) {
  const paths = {
    building: 'M4 21V4h11v17M15 9h5v12M8 8h3m-3 4h3m-3 4h3m9 5H2',
    audit: 'M6 3h12v18H6ZM9 7h6m-6 4h6m-6 4h3',
    verify: 'M4 4h10v5h6v11H4Zm10 0v5h6m-12 6 2 2 4-5',
  };
  return <svg className="ve-product-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function VerificationExperience(props: Props) {
  const { step, paused, replay, reducedMotion } = props.motion;
  const trace = props.verificationTrace ?? [];
  const outcome = verifierOutcome(props.result, props.verificationBusy);
  const signedComparison = props.result?.signedComparison;
  const comparingSigned = Boolean(props.comparisonReference);
  const conflict = signedComparison?.registrationConflict === true;
  const candidateSignature = trace.findLast(event => event.operation === '재서명 정보의 발급자 주소 복구');
  const candidateFile = trace.findLast(event => event.operation === '재서명 PDF 전체 바이트 SHA-256');
  const signatureChecked = signedComparison?.signatureValid ?? (candidateSignature?.state === 'success' ? true : candidateSignature?.state === 'failure' ? false : undefined);
  const signedFileChecked = signedComparison?.fileMatch ?? (candidateFile?.state === 'success' ? true : candidateFile?.state === 'failure' ? false : undefined);
  const running = step !== 'ready' && step !== 'result';
  const finished = step === 'result' && Boolean(props.result) && !props.verificationBusy;
  const fileHash = trace.findLast(event => event.id === 'sha256' && event.state === 'success')?.detail ?? props.result?.fileHash;
  const hasRecord = props.result?.chainRecordValid === true && Boolean(props.result.chainHash);
  const recordVisible = hasRecord && ['record', 'return', 'compare', 'result'].includes(step);
  const returned = hasRecord && ['compare', 'result'].includes(step);
  const compared = returned && trace.some(event => event.id === 'hash-comparison');
  const isMatch = compared && props.result?.status === 'match';
  const isMismatch = compared && props.result?.status === 'file-mismatch';
  const readyTitle = props.inputLoading ? '파일을 불러오는 중입니다' : !props.selectedName && !props.selectedProofName ? '고객사에서 받은 자료를 불러오세요'
    : !props.selectedName ? '증명서 PDF도 선택해 주세요' : !props.selectedProofName ? '검증정보 JSON도 선택해 주세요' : '받은 자료를 검증할 준비가 됐습니다';
  const caption = step === 'ready' ? '검증 버튼을 눌러 발급 기록을 확인해 보세요'
    : step === 'prepare' ? 'PDF와 발급정보를 확인합니다'
      : step === 'request' ? '문서 ID로 Ethereum의 발급 기록을 조회합니다'
        : step === 'record' ? '이 문서 ID에 등록된 원본 해시를 찾았습니다'
          : step === 'return' ? '등록된 원본 해시가 대시보드로 돌아옵니다'
            : step === 'compare' ? '제출 PDF의 해시와 등록된 원본 해시를 대조합니다'
              : isMatch ? '제출 PDF가 등록된 원본과 일치합니다'
                : conflict ? '유효한 발급서명에 더해, 이미 등록된 원본과도 대조합니다'
                  : isMismatch ? '제출 PDF가 등록된 원본과 다릅니다'
                  : props.result?.status === 'not-registered' ? '이 문서 ID의 등록 기록을 찾지 못했습니다'
                    : '검증을 완료하지 못했습니다. 확인된 범위는 아래에 남겼습니다';
  // Connect the real button, registry record and comparison slot, including after resize.
  const canvasRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const registryRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [routes, setRoutes] = useState({ width: 1, height: 1, request: '', response: '', labelX: 0, requestY: 0, responseY: 0 });
  useLayoutEffect(() => {
    const canvas = canvasRef.current, button = buttonRef.current, registry = registryRef.current, slot = slotRef.current;
    if (!canvas || !button || !registry || !slot) return;
    const measure = () => {
      const c = canvas.getBoundingClientRect(), b = button.getBoundingClientRect(), r = registry.getBoundingClientRect(), s = slot.getBoundingClientRect();
      const bx = b.right - c.left + 4, by = b.top - c.top + b.height / 2;
      const rx = r.left - c.left - 5, ry = r.top - c.top + r.height / 2;
      const sx = s.right - c.left + 4, sy = s.top - c.top + s.height / 2;
      const stacked = r.top > b.bottom + 150;
      setRoutes({ width: c.width, height: c.height, labelX: (bx + rx) / 2, requestY: (by + ry - 24) / 2 - 25, responseY: (ry + 24 + sy) / 2 + 25,
        request: stacked ? `M${bx} ${by} C${c.width - 6} ${by},${c.width - 6} ${ry},${r.right - c.left} ${ry}`
          : `M${bx} ${by} C${bx + 55} ${by},${rx - 55} ${ry - 24},${rx} ${ry - 24}`,
        response: stacked ? `M${r.right - c.left} ${ry + 20} C${c.width - 4} ${ry + 20},${c.width - 4} ${sy},${sx} ${sy}`
          : `M${rx} ${ry + 24} C${rx - 55} ${ry + 24},${sx + 55} ${sy},${sx} ${sy}`,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    [canvas, button, registry, slot].forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const packetPath = step === 'request' ? routes.request : routes.response;
  const packetStyle = { offsetPath: `path('${packetPath}')`, animationDuration: `${MOTION_MS[step]}ms`, animationPlayState: paused ? 'paused' : 'running' } as CSSProperties;
  return <article className="ve-root">
    <header className="ve-stage-heading"><span>02 · KODA 대시보드에서 검증</span><h1>전달받은 증명서를 KODA 발급 기록과 대조합니다</h1><p>외부 수신자가 PDF와 검증정보를 불러오면, Ethereum의 등록 기록을 조회해 결과를 확인합니다.</p></header>
    <div className="ve-demo-tools"><span><b>KODA 대시보드 적용안</b> · 서비스 화면 제안</span><details className="ve-demo-input"><summary>발표용 예시</summary><div><p>받은 파일을 직접 불러오거나 아래 비교 자료를 선택할 수 있습니다.</p><button disabled={props.busy || !props.canDownload} onClick={() => props.onDownload('altered')}>변경본 PDF 받기</button><p>다시 서명한 문서는 같은 시험 발급자가 같은 문서 ID의 다른 내용에 서명한 비교 사례입니다. 실제 KODA의 발급 사고를 의미하지 않습니다.</p>{!props.signedComparisonReady && <p>비교용 서명은 아래 ‘발표자 실행 준비’에서 준비할 수 있습니다. 서명 전에는 검증 결과를 표시하지 않습니다.</p>}</div></details></div>
    <div className="ve-scenarios" role="group" aria-label="시연 파일 선택">
      <span>발표용 비교</span>
      {([
        ['original', '발급 원본', '100 BTC'],
        ['altered', 'PDF만 변경', '120 BTC'],
        ['resigned', '다시 서명한 문서', props.signedComparisonReady ? '120 BTC' : '서명 준비 전'],
      ] as const).map(([variant, title, detail]) => <button key={variant} aria-pressed={props.inputSource === 'sample' && props.selectedVariant === variant}
        disabled={props.busy || props.inputLoading || !props.canDownload || (variant === 'resigned' && !props.signedComparisonReady)}
        onClick={() => props.onSelectSample(variant)}>{title}<small>{detail}</small></button>)}
    </div>
    {comparingSigned && <p className="ve-comparison-context">같은 발급자가 같은 문서 ID의 다른 내용에 다시 서명한 경우를 대조합니다.</p>}
    <div ref={canvasRef} className={`ve-experience step-${step}${paused ? ' is-paused' : ''}${isMatch ? ' is-match' : ''}${isMismatch ? ' is-mismatch' : ''}`} data-motion-step={step}>
      <section className="ve-dashboard" aria-label="제3자가 이용하는 KODA 대시보드">
        <aside className="ve-product-nav" aria-label="KODA 대시보드 메뉴 예시">
          <div className="ve-product-org"><ProductIcon name="building" /><strong>외부 수신자</strong></div>
          <div className="ve-product-nav-section"><span><ProductIcon name="verify" />문서 검증</span><strong aria-current="page">증빙 문서 검증</strong></div>
          <div className="ve-product-nav-section is-muted"><span><ProductIcon name="audit" />감사</span><small>메시지 서명 검증</small></div>
          <p>KODA</p>
        </aside>
        <div className="ve-app-main">
          <header className="ve-app-header"><div><small>감사</small><strong>증빙 문서 검증</strong></div><span>제3자 검증</span></header>
          <div className="ve-app-body">
          <label className="ve-upload"><span className="ve-upload-heading"><b>전달받은 두 파일</b><em>파일 불러오기</em></span><span className={`ve-file-row${props.selectedName ? ' is-loaded' : ''}`}><Icon name="file" /><span><b>증명서 PDF</b><small>{props.selectedName ?? '선택 전'}</small></span><small>{props.selectedName ? '불러옴' : '필요'}</small></span><span className={`ve-file-row${props.selectedProofName ? ' is-loaded' : ''}`}><span className="ve-json-icon" aria-hidden="true">{'{ }'}</span><span><b>검증정보 JSON</b><small>{props.selectedProofName ?? '문서 ID·원본 해시·발급서명'}</small></span><small>{props.selectedProofName ? '불러옴' : '필요'}</small></span><input aria-label="전달받은 PDF와 검증정보 선택" disabled={props.busy} type="file" multiple accept="application/pdf,application/json,.pdf,.json" onChange={event => { props.onSelectFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
          {props.inputError && <p className="ve-input-error" role="alert">{props.inputError}</p>}
          {(props.selectedName || props.selectedProofName || props.inputLoading) && <div className="ve-input-status"><span>{props.inputLoading ? '파일 읽는 중' : props.inputSource === 'sample' ? '발표용 예시 자료' : '수신자가 선택한 파일'}</span><button disabled={props.busy} onClick={props.onClearFiles}>다시 선택</button></div>}
          <button ref={buttonRef} className="ve-primary" disabled={!props.canVerify || props.busy || running} onClick={props.onVerify}>{props.verificationBusy ? '검증 중' : running ? '처리 흐름 표시 중' : props.result ? '다시 검증하기' : '문서 검증하기'}<Icon name="arrow" /></button>
          {comparingSigned ? <div className="ve-local-checks" aria-label="제출 문서의 서명과 파일 검사" aria-live="polite">
            <span>브라우저 검사</span>
            <strong className={signatureChecked ? 'is-confirmed' : ''}>{signatureChecked && <Icon name="check" />}발급서명 {signatureChecked === undefined ? '검사 전' : signatureChecked ? '확인' : '확인 불가'}</strong>
            <strong className={signedFileChecked ? 'is-confirmed' : ''}>{signedFileChecked && <Icon name="check" />}서명된 PDF {signedFileChecked === undefined ? '검사 전' : signedFileChecked ? '일치' : '불일치'}</strong>
          </div> : <p className={`ve-local-operation${step === 'prepare' ? ' is-active' : ''}`}>브라우저에서 PDF 해시·발급서명 확인</p>}
          <div className={`ve-compare-tray${returned ? ' has-record' : ''}`} aria-label="제출 PDF와 등록 기록 대조">
            <div className={`ve-file-digest${fileHash ? ' has-hash' : ''}`}><span>제출 PDF <small>SHA-256</small></span><code>{short(fileHash)}</code></div>
            <div className="ve-comparison-sign" aria-label={compared ? isMatch ? '해시 일치' : '해시 불일치' : '대조 전'}>{compared ? isMatch ? '=' : '≠' : '·'}</div>
            <div ref={slotRef} className="ve-return-slot"><span>등록된 원본 <small>Ethereum</small></span><code>{returned ? short(props.result?.chainHash) : '조회한 기록이 도착할 곳'}</code></div>
          </div>
          <div className="ve-result-space">
            {finished ? <section className={`ve-outcome is-${outcome.kind}`} aria-live="polite">
              <div className="ve-verdict"><div className="ve-outcome-icon"><Icon name={outcome.kind === 'match' ? 'check' : outcome.kind === 'mismatch' ? 'close' : 'alert'} /></div><h2>{outcome.title}</h2></div>
              {(outcome.kind === 'failure' || outcome.kind === 'pending' || conflict) && <p className="ve-error-reason">{outcome.description}</p>}
              <ol className="ve-questions">{outcome.questions.map(question => <li key={question.label} className={`is-${question.state}`}><span>{question.label}</span><strong>{question.state === 'confirmed' ? <Icon name="check" /> : null}{question.value}</strong></li>)}</ol>
            </section> : <div className="ve-live-state" aria-live="polite"><span className={running ? 'is-working' : ''} /><div><h2>{step === 'ready' ? readyTitle : MOTION_LABEL[step]}</h2><p>{step === 'ready' ? '검증정보의 발급서명과 등록된 원본을 확인합니다.' : step === 'prepare' ? '발급서명과 조회 기준을 확인하는 중입니다.' : step === 'request' ? 'PDF는 보내지 않고 문서 ID로 조회합니다.' : step === 'record' ? '이미 등록된 기록을 읽습니다.' : step === 'return' ? '이 기록이 PDF를 대조할 기준입니다.' : '두 해시가 같은지 확인합니다.'}</p></div></div>}
          </div>
          <p className="ve-app-note">파일은 이 브라우저에서 처리하고, Ethereum에서는 등록 기록을 조회합니다.</p>
          </div>
        </div>
      </section>

      <section className={`ve-ethereum${recordVisible ? ' has-record' : ''}`} aria-label="Ethereum의 기존 발급 기록">
        <div className="ve-chain-heading"><span>문서 검증정보가 기록된 곳</span><h2>Ethereum</h2></div>
        <svg className="ve-blockchain" viewBox="0 0 280 135" role="img" aria-label="이미 연결된 블록의 기록을 읽습니다. 조회로 새 블록을 만들지 않습니다.">
          <path className="ve-block-link" d="M39 76H242" />
          <g className="ve-block-neighbor"><path d="M5 55 18 43h38L43 55ZM43 55 56 43v46L43 101ZM5 55h38v46H5Z" /><path d="M224 55 237 43h38L262 55ZM262 55 275 43v46L262 101ZM224 55h38v46h-38Z" /></g>
          <g className="ve-current-block"><path className="ve-block-top" d="M89 33 111 13h83L172 33Z" /><path className="ve-block-side" d="M172 33 194 13v88l-22 20Z" /><path className="ve-block-face" d="M89 33h83v88H89Z" /><path className="ve-block-lines" d="M106 55h49M106 70h49M106 85h32" /></g>
        </svg>
        <div ref={registryRef} className="ve-registry-record"><span>등록된 원본 해시</span><code>{recordVisible ? short(props.result?.chainHash) : props.result?.status === 'not-registered' && finished ? '등록 기록 없음' : '조회 전'}</code><small>스마트컨트랙트에서 기록 읽기</small></div>
        <p className="ve-chain-note">확정된 블록 기준 · 조회 가스비 없음</p>
        {conflict && returned && <p className="ve-registration-value">새 서명과 별개로,<br />이미 등록된 기준을 확인합니다.</p>}
      </section>

      <div className="ve-route-labels" aria-label="브라우저와 Ethereum 사이의 조회 경로">
        <span className={`ve-route-label is-query${['request', 'record'].includes(step) ? ' is-active' : ''}${recordVisible ? ' is-observed' : ''}`} style={{ left: routes.labelX, top: routes.requestY }}><b>RPC 조회</b><small>문서 ID 전달</small></span>
        <span className={`ve-route-label is-response${step === 'return' ? ' is-active' : ''}${returned ? ' is-observed' : ''}`} style={{ left: routes.labelX, top: routes.responseY }}><b>등록 기록 응답</b><small>원본 해시 수신</small></span>
      </div>
      <div className="ve-transfer-layer" aria-hidden="true">
        <svg viewBox={`0 0 ${routes.width} ${routes.height}`} preserveAspectRatio="none"><defs><marker id="ve-route-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="m1 1 5 2.5-5 2.5" /></marker></defs>
          <path className={`ve-transfer-path ve-request-path${['request', 'record'].includes(step) ? ' is-active' : ''}${recordVisible ? ' is-observed' : ''}`} d={routes.request} markerEnd="url(#ve-route-arrow)" />
          <path className={`ve-transfer-path ve-response-path${['return', 'compare'].includes(step) ? ' is-active' : ''}${returned ? ' is-observed' : ''}`} d={routes.response} markerEnd="url(#ve-route-arrow)" />
        </svg>
        {!reducedMotion && (step === 'request' || step === 'return') && packetPath && <div key={step} className={`ve-travel-packet is-${step}`} style={packetStyle}>{step === 'request' ? <b>문서 ID</b> : <code>{short(props.result?.chainHash)}</code>}</div>}
      </div>
    </div>
    <div className="ve-flow-footer">
      <p className="ve-process-caption" aria-live="polite">{caption}</p>
      <div className="ve-playback">
        <span className="ve-execution-status" role="status">{props.result && !props.verificationBusy ? <><b>실제 판정: {outcome.title}</b><small>{running ? `${replay ? '과정 다시 보기' : '처리 흐름 표시 중'} · 추가 조회 없음` : hasRecord ? '조회·대조 완료' : '확인된 범위까지 표시'}</small></> : <>{props.verificationBusy ? '실제 조회·검증 중' : '검증 결과에 맞춰 처리 흐름이 이어집니다'}</>}</span>
        {running && !reducedMotion && <button aria-label={paused ? '처리 흐름 재생' : '처리 흐름 일시정지'} onClick={props.motion.toggle}><Icon name={paused ? 'play' : 'pause'} /></button>}
        {running && props.result && !props.verificationBusy && <button onClick={props.motion.finish}>결과 바로 보기<Icon name="arrow" /></button>}
        {finished && !reducedMotion && <button onClick={props.motion.replayRun}>과정 다시 보기<Icon name="play" /></button>}
      </div>
    </div>
    <details className="ve-evidence"><summary>기술 상세·실제 조회 기록</summary><p>제출 파일·서명된 발급정보·체인 기록의 세 해시를 모두 대조합니다. 화면은 관측된 처리를 순서대로 보여주며, 이동 시간은 실제 네트워크 소요 시간이 아닙니다. 배포·서명·확정 상태 확인을 포함한 전체 실행 순서는 아래 기록을 따릅니다.</p><dl>
      <dt>문서 ID</dt><dd>{props.proof?.documentId ?? '준비 전'}</dd><dt>제출 PDF 해시</dt><dd>{props.result?.fileHash ?? '조회 전'}</dd><dt>제출 서명정보의 해시</dt><dd>{props.proof?.documentHash ?? '준비 전'}</dd><dt>체인에서 읽은 해시</dt><dd>{props.result?.chainHash ?? '조회 전'}</dd><dt>발급서명</dt><dd>{props.proof?.signature ?? '준비 전'}</dd><dt>복구한 발급자</dt><dd>{signedComparison?.recoveredAddress ?? props.result?.recoveredAddress ?? '조회 전'}</dd><dt>확정 블록</dt><dd>{props.result?.finalizedBlock ?? '조회 전'}</dd>
      {props.comparisonReference && <><dt>등록 원본의 서명정보</dt><dd>{props.comparisonReference.documentHash}</dd><dt>등록 원본의 거래</dt><dd>{props.comparisonReference.transactionHash}</dd></>}
    </dl><ol>{props.verificationTrace?.map((event, index) => <li key={index}><b>{event.state} · {event.operation}</b><code>{event.detail}</code></li>)}</ol><div className="ve-evidence-links">{(props.comparisonReference?.transactionHash ?? props.proof?.transactionHash) && <a href={transactionUrl((props.comparisonReference?.transactionHash ?? props.proof?.transactionHash)!)} target="_blank" rel="noreferrer">실제 테스트 등록 거래 ↗</a>}{props.trusted && <a href={addressUrl(props.trusted.contract)} target="_blank" rel="noreferrer">테스트 컨트랙트 ↗</a>}</div></details>
  </article>;
}
