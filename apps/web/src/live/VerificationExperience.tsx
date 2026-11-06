import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { addressUrl, transactionUrl } from './wallet';
import type { PresentationProps } from './presentation-types';
import { MOTION_LABEL, MOTION_MS, type MotionStep } from './presentation-sequence';
import { verifierOutcome } from './verifier-outcome';
import './verification-experience.css';

type Motion = { step: MotionStep; paused: boolean; replay: boolean; reducedMotion: boolean; replayRun: () => void; finish: () => void; toggle: () => void };
type Props = PresentationProps & { motion: Motion };
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

export function VerificationExperience(props: Props) {
  const { step, paused, replay, reducedMotion } = props.motion;
  const trace = props.verificationTrace ?? [];
  const outcome = verifierOutcome(props.result, props.busy);
  const running = step !== 'ready' && step !== 'result';
  const finished = step === 'result' && Boolean(props.result) && !props.busy;
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
                : isMismatch ? '제출 PDF가 등록된 원본과 다릅니다'
                  : props.result?.status === 'not-registered' ? '이 문서 ID의 등록 기록을 찾지 못했습니다'
                    : '검증을 완료하지 못했습니다. 확인된 범위는 아래에 남겼습니다';

  // Connect the real button, registry record and comparison slot, including after resize.
  const canvasRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const registryRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [routes, setRoutes] = useState({ width: 1, height: 1, request: '', response: '' });
  useLayoutEffect(() => {
    const canvas = canvasRef.current, button = buttonRef.current, registry = registryRef.current, slot = slotRef.current;
    if (!canvas || !button || !registry || !slot) return;
    const measure = () => {
      const c = canvas.getBoundingClientRect(), b = button.getBoundingClientRect(), r = registry.getBoundingClientRect(), s = slot.getBoundingClientRect();
      const bx = b.right - c.left + 4, by = b.top - c.top + b.height / 2;
      const rx = r.left - c.left - 5, ry = r.top - c.top + r.height / 2;
      const sx = s.right - c.left + 4, sy = s.top - c.top + s.height / 2;
      const stacked = r.top > b.bottom + 150;
      setRoutes({ width: c.width, height: c.height,
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
    <header className="ve-stage-heading"><span>02 · 외부 수신자 — KODA 문서 검증</span><h1>전달받은 증명서를 발급 기록과 대조합니다</h1><p>고객사에서 받은 PDF와 검증정보를 불러와, Ethereum의 등록 기록과 확인합니다.</p></header>
    <div className="ve-demo-tools"><span>고객사에서 외부 수신자로</span><details className="ve-demo-input"><summary>발표용 예시</summary><div role="group" aria-label="시연 파일 선택"><p>직접 파일을 불러오는 대신 예시 자료를 사용합니다.</p>{(['original', 'altered'] as const).map(variant => <button key={variant} aria-pressed={props.inputSource === 'sample' && props.selectedVariant === variant} disabled={props.busy || props.inputLoading || !props.canDownload} onClick={event => { props.onSelectSample(variant); event.currentTarget.closest('details')!.open = false; }}>{variant === 'original' ? '발급 원본' : '변경본'} <small>{variant === 'original' ? '100 BTC' : '120 BTC'}</small></button>)}<button disabled={props.busy || !props.canDownload} onClick={() => props.onDownload('altered')}>변경본 PDF 받기</button></div></details></div>
    <div ref={canvasRef} className={`ve-experience step-${step}${paused ? ' is-paused' : ''}${isMatch ? ' is-match' : ''}${isMismatch ? ' is-mismatch' : ''}`} data-motion-step={step}>
      <section className="ve-dashboard" aria-label="제3자가 이용하는 KODA 대시보드">
        <header className="ve-app-header"><strong>KODA <span>대시보드</span></strong><span>제3자 · 증빙 검증</span></header>
        <div className="ve-app-body">
          <label className="ve-upload"><span className="ve-upload-heading"><b>전달받은 두 파일</b><em>파일 불러오기</em></span><span className={`ve-file-row${props.selectedName ? ' is-loaded' : ''}`}><Icon name="file" /><span><b>증명서 PDF</b><small>{props.selectedName ?? '선택 전'}</small></span><small>{props.selectedName ? '불러옴' : '필요'}</small></span><span className={`ve-file-row${props.selectedProofName ? ' is-loaded' : ''}`}><span className="ve-json-icon" aria-hidden="true">{'{ }'}</span><span><b>검증정보 JSON</b><small>{props.selectedProofName ?? '문서 ID·원본 해시·발급서명'}</small></span><small>{props.selectedProofName ? '불러옴' : '필요'}</small></span><input aria-label="전달받은 PDF와 검증정보 선택" disabled={props.busy} type="file" multiple accept="application/pdf,application/json,.pdf,.json" onChange={event => { props.onSelectFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
          {props.inputError && <p className="ve-input-error" role="alert">{props.inputError}</p>}
          {(props.selectedName || props.selectedProofName || props.inputLoading) && <div className="ve-input-status"><span>{props.inputLoading ? '파일 읽는 중' : props.inputSource === 'sample' ? '발표용 예시 자료' : '수신자가 선택한 파일'}</span><button disabled={props.busy} onClick={props.onClearFiles}>다시 선택</button></div>}
          <button ref={buttonRef} className="ve-primary" disabled={!props.canVerify || props.busy || running} onClick={props.onVerify}>{props.busy ? '검증 중' : running ? '처리 흐름 표시 중' : props.result ? '다시 검증하기' : '문서 검증하기'}<Icon name="arrow" /></button>
          <div className={`ve-compare-tray${returned ? ' has-record' : ''}`} aria-label="제출 PDF와 등록 기록 대조">
            <div className={`ve-file-digest${fileHash ? ' has-hash' : ''}`}><span>제출 PDF <small>SHA-256</small></span><code>{short(fileHash)}</code></div>
            <div className="ve-comparison-sign" aria-label={compared ? isMatch ? '해시 일치' : '해시 불일치' : '대조 전'}>{compared ? isMatch ? '=' : '≠' : '·'}</div>
            <div ref={slotRef} className="ve-return-slot"><span>등록된 원본 <small>Ethereum</small></span><code>{returned ? short(props.result?.chainHash) : '조회한 기록이 도착할 곳'}</code></div>
          </div>
          <div className="ve-result-space">
            {finished ? <section className={`ve-outcome is-${outcome.kind}`} aria-live="polite">
              <div className="ve-verdict"><div className="ve-outcome-icon"><Icon name={outcome.kind === 'match' ? 'check' : outcome.kind === 'mismatch' ? 'close' : 'alert'} /></div><h2>{outcome.title}</h2></div>
              {(outcome.kind === 'failure' || outcome.kind === 'pending') && <p className="ve-error-reason">{outcome.description}</p>}
              <ol className="ve-questions">{outcome.questions.map(question => <li key={question.label} className={`is-${question.state}`}><span>{question.label}</span><strong>{question.state === 'confirmed' ? <Icon name="check" /> : null}{question.value}</strong></li>)}</ol>
            </section> : <div className="ve-live-state" aria-live="polite"><span className={running ? 'is-working' : ''} /><div><h2>{step === 'ready' ? readyTitle : MOTION_LABEL[step]}</h2><p>{step === 'ready' ? '검증정보의 발급서명과 등록된 원본을 확인합니다.' : step === 'prepare' ? '발급서명과 조회 기준을 확인하는 중입니다.' : step === 'request' ? 'PDF는 보내지 않고 문서 ID로 조회합니다.' : step === 'record' ? '이미 등록된 기록을 읽습니다.' : step === 'return' ? '이 기록이 PDF를 대조할 기준입니다.' : '두 해시가 같은지 확인합니다.'}</p></div></div>}
          </div>
          <p className="ve-app-note">파일은 이 브라우저에서 처리하고, Ethereum에서는 등록 기록을 조회합니다.</p>
        </div>
      </section>

      <section className={`ve-ethereum${recordVisible ? ' has-record' : ''}`} aria-label="Ethereum의 기존 발급 기록">
        <div className="ve-chain-heading"><span>문서 검증정보가 기록된 곳</span><h2>Ethereum</h2></div>
        <svg className="ve-blockchain" viewBox="0 0 280 135" role="img" aria-label="이미 연결된 블록의 기록을 읽습니다. 조회로 새 블록을 만들지 않습니다.">
          <path className="ve-block-link" d="M39 76H242" />
          <g className="ve-block-neighbor"><path d="M5 55 18 43h38L43 55ZM43 55 56 43v46L43 101ZM5 55h38v46H5Z" /><path d="M224 55 237 43h38L262 55ZM262 55 275 43v46L262 101ZM224 55h38v46h-38Z" /></g>
          <g className="ve-current-block"><path className="ve-block-top" d="M89 33 111 13h83L172 33Z" /><path className="ve-block-side" d="M172 33 194 13v88l-22 20Z" /><path className="ve-block-face" d="M89 33h83v88H89Z" /><path className="ve-block-lines" d="M106 55h49M106 70h49M106 85h32" /></g>
        </svg>
        <div ref={registryRef} className="ve-registry-record"><span>{recordVisible ? '등록된 원본 해시' : props.result?.status === 'not-registered' && finished ? '등록 기록 없음' : '문서 ID로 찾을 발급 기록'}</span><code>{recordVisible ? short(props.result?.chainHash) : 'documentHash'}</code><small>DocumentRegistry · 스마트컨트랙트</small></div>
        <p className="ve-chain-note">기존 기록 조회 · 새 거래 없음</p>
      </section>

      <div className="ve-transfer-layer" aria-hidden="true">
        <svg viewBox={`0 0 ${routes.width} ${routes.height}`} preserveAspectRatio="none"><defs><marker id="ve-route-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="m1 1 5 2.5-5 2.5" /></marker></defs>
          <path className={`ve-transfer-path ve-request-path${['request', 'record'].includes(step) ? ' is-active' : ''}`} d={routes.request} markerEnd="url(#ve-route-arrow)" />
          <path className={`ve-transfer-path ve-response-path${['return', 'compare'].includes(step) ? ' is-active' : ''}`} d={routes.response} markerEnd="url(#ve-route-arrow)" />
        </svg>
        {!reducedMotion && (step === 'request' || step === 'return') && packetPath && <div key={step} className={`ve-travel-packet is-${step}`} style={packetStyle}>{step === 'request' ? <><b>조회 요청</b><small>문서 ID</small></> : <><b>등록된 원본 해시</b><code>{short(props.result?.chainHash)}</code></>}</div>}
      </div>
    </div>
    <div className="ve-flow-footer">
      <p className="ve-process-caption" aria-live="polite">{caption}</p>
      <div className="ve-playback">
        <span className="ve-execution-status" role="status">{props.result && !props.busy ? <><b>실제 판정: {outcome.title}</b><small>{running ? `${replay ? '과정 다시 보기' : '처리 흐름 표시 중'} · 추가 조회 없음` : hasRecord ? '조회·대조 완료' : '확인된 범위까지 표시'}</small></> : <>{props.busy ? '실제 조회·검증 중' : '검증 결과에 맞춰 처리 흐름이 이어집니다'}</>}</span>
        {running && !reducedMotion && <button aria-label={paused ? '처리 흐름 재생' : '처리 흐름 일시정지'} onClick={props.motion.toggle}><Icon name={paused ? 'play' : 'pause'} /></button>}
        {running && props.result && !props.busy && <button onClick={props.motion.finish}>결과 바로 보기<Icon name="arrow" /></button>}
        {finished && !reducedMotion && <button onClick={props.motion.replayRun}>과정 다시 보기<Icon name="play" /></button>}
      </div>
    </div>
    <details className="ve-evidence"><summary>기술 상세·실제 조회 기록</summary><p>제출 파일·서명된 발급정보·체인 기록의 세 해시를 모두 대조합니다. 화면은 관측된 처리를 순서대로 보여주며, 이동 시간은 실제 네트워크 소요 시간이 아닙니다. 배포·서명·확정 상태 확인을 포함한 전체 실행 순서는 아래 기록을 따릅니다.</p><dl>
      <dt>문서 ID</dt><dd>{props.proof?.documentId ?? '준비 전'}</dd><dt>제출 PDF 해시</dt><dd>{props.result?.fileHash ?? '조회 전'}</dd><dt>서명된 원본 해시</dt><dd>{props.proof?.documentHash ?? '준비 전'}</dd><dt>체인에서 읽은 해시</dt><dd>{props.result?.chainHash ?? '조회 전'}</dd><dt>발급서명</dt><dd>{props.proof?.signature ?? '준비 전'}</dd><dt>복구한 발급자</dt><dd>{props.result?.recoveredAddress ?? '조회 전'}</dd><dt>확정 블록</dt><dd>{props.result?.finalizedBlock ?? '조회 전'}</dd>
    </dl><ol>{props.verificationTrace?.map((event, index) => <li key={index}><b>{event.state} · {event.operation}</b><code>{event.detail}</code></li>)}</ol><div className="ve-evidence-links">{props.proof?.transactionHash && <a href={transactionUrl(props.proof.transactionHash)} target="_blank" rel="noreferrer">실제 테스트 등록 거래 ↗</a>}{props.trusted && <a href={addressUrl(props.trusted.contract)} target="_blank" rel="noreferrer">테스트 컨트랙트 ↗</a>}</div></details>
  </article>;
}
