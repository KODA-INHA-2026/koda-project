import type { VerificationResult, VerificationTraceEvent } from './verification';
import { architectureMapState, type SceneId } from './architecture-state';
import './architecture-map.css';

export type { SceneId } from './architecture-state';

export interface ArchitectureMapProps {
  scene: SceneId;
  busy: boolean;
  trace?: VerificationTraceEvent[];
  result?: VerificationResult;
  receiptBlock?: string;
  review?: { label: string; detail: string; stepId: string; state?: string };
}

function actorClass(active: boolean) { return `kam-actor${active ? ' is-active' : ''}`; }
function pathClass(active: boolean, complete = false) { return `kam-path${active ? ' is-active' : ''}${complete ? ' is-complete' : ''}`; }

const REVIEW_CHAIN_STEPS = new Set([
  'deployment-validation', 'chain-id', 'finalized-block', 'transaction-input', 'receipt',
  'canonical-block', 'registration-event', 'finality', 'authorized-issuer', 'record',
]);

export function ArchitectureMap(props: ArchitectureMapProps) {
  const currentState = architectureMapState(props);
  const reviewStopped = props.review && ['failure', 'pending', 'stopped'].includes(props.review.state ?? '');
  const state = props.review ? {
    focus: REVIEW_CHAIN_STEPS.has(props.review.stepId)
      ? reviewStopped ? 'query' as const : 'response' as const
      : 'third-party' as const,
    label: `처리 기록 다시 보기 · ${props.review.label}`,
    detail: props.review.detail,
    chainReadComplete: false,
  } : currentState;
  const resultComplete = props.scene === 'compare' && state.chainReadComplete;
  const kodaActive = ['koda', 'write'].includes(state.focus);
  const customerActive = state.focus === 'handoff';
  const thirdActive = ['third-party', 'query', 'response'].includes(state.focus);
  const ethereumActive = ['ethereum', 'write', 'query', 'response'].includes(state.focus);

  return <aside className={`kam${props.review ? ' is-review' : ''}`} aria-label={`전체 아키텍처. 현재 위치: ${state.label}. ${state.detail}`}>
    <header className="kam-current">
      <span>{props.review ? '실행한 처리 기록' : '전체 구조에서 현재 위치'}</span>
      <strong>{state.label}</strong>
      <p>{state.detail}</p>
    </header>
    <section className="kam-custody-context" aria-label="수탁 관계와 업무 배경">
      <span>수탁 관계 · 업무 배경</span>
      <div className="kam-custody-flow">
        <div><b>고객사</b><small>BTC 귀속</small></div>
        <i aria-hidden="true"><small>BTC 수탁</small></i>
        <div><b>KODA</b><small>수탁자</small></div>
        <i aria-hidden="true"><small>보관·관리</small></i>
        <div><b>Bitcoin 네트워크</b><small>고객사별 전용 지갑</small></div>
      </div>
      <p>BTC는 고객사에 귀속되고, KODA가 수탁·관리합니다.</p>
    </section>
    <svg className="kam-diagram" viewBox="0 0 420 390" role="img" aria-labelledby="kam-title kam-desc">
      <title id="kam-title">KODA 문서 검증 전체 아키텍처</title>
      <desc id="kam-desc">위 수탁 관계와 분리된 문서 검증 흐름입니다. KODA가 만든 PDF는 고객사를 거쳐 제3자에게 전달되고, KODA는 문서 검증정보를 Ethereum에 기록하며 제3자는 같은 기록을 다시 조회합니다.</desc>
      <defs>
        <marker id="kam-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7" /></marker>
        <marker id="kam-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7" /></marker>
      </defs>

      <text className="kam-kicker" x="18" y="25">업무 주체</text>
      <g className={actorClass(kodaActive)} transform="translate(18 40)">
        <rect width="112" height="78" rx="3" /><circle cx="18" cy="20" r="5" /><text className="kam-name" x="31" y="25">KODA</text><text x="14" y="50">발급 · 서명</text><text x="14" y="68">검증정보 등록</text>
      </g>
      <g className={actorClass(customerActive)} transform="translate(154 40)">
        <rect width="112" height="78" rx="3" /><circle cx="18" cy="20" r="5" /><text className="kam-name" x="31" y="25">고객사</text><text x="14" y="50">원본 보관</text><text x="14" y="68">업무상 제출</text>
      </g>
      <g className={actorClass(thirdActive)} transform="translate(290 40)">
        <rect width="112" height="78" rx="3" /><circle cx="18" cy="20" r="5" /><text className="kam-name" x="31" y="25">제3자</text><text x="14" y="50">KODA 대시보드</text><text x="14" y="68">제출 문서 검증</text>
      </g>

      <path className={pathClass(state.focus === 'handoff')} d="M130 79 H154" markerEnd="url(#kam-arrow)" />
      <path className={pathClass(state.focus === 'handoff')} d="M266 79 H290" markerEnd="url(#kam-arrow)" />
      <text className="kam-route-label" x="210" y="144" textAnchor="middle">PDF 전달</text>

      <path className={pathClass(state.focus === 'write')} d="M74 118 V225" markerEnd="url(#kam-arrow-active)" />
      <text className={`kam-route-label${state.focus === 'write' ? ' is-active' : ''}`} x="90" y="173">register(...)</text>
      <text className="kam-route-note" x="90" y="191">ID · 해시<tspan x="90" dy="16">발급시각</tspan></text>

      <path className={pathClass(state.focus === 'query', resultComplete)} d="M346 118 V225" markerEnd="url(#kam-arrow-active)" />
      <text className={`kam-route-label${state.focus === 'query' ? ' is-active' : ''}`} x="321" y="173" textAnchor="end">공개 조회</text>
      <text className="kam-route-note" x="321" y="191" textAnchor="end">JSON-RPC · eth_call</text>
      <path className={pathClass(state.focus === 'response', resultComplete)} d="M378 270 H402 V132 H378 V118" markerEnd="url(#kam-arrow-active)" />
      <text className={`kam-route-label${state.focus === 'response' ? ' is-active' : ''}`} x="397" y="211" textAnchor="end">조회 응답</text>

      <g className={`kam-chain${ethereumActive ? ' is-active' : ''}`} transform="translate(42 225)">
        <rect className="kam-chain-boundary" width="336" height="128" rx="4" />
        <text className="kam-chain-title" x="16" y="28">Ethereum</text>
        <text className="kam-chain-sub" x="16" y="51">KODA가 발급한 문서의</text>
        <text className="kam-chain-sub" x="16" y="68">검증정보를 기록합니다</text>
        <text className="kam-block-label" x="260" y="18" textAnchor="middle">블록 구조 · 개념도</text>
        <g className="kam-blocks" transform="translate(194 24)"><rect x="0" y="8" width="36" height="36" /><path d="M36 26h12" /><rect x="48" y="8" width="36" height="36" /><path d="M84 26h12" /><rect x="96" y="8" width="36" height="36" /></g>
        <line x1="16" y1="78" x2="320" y2="78" />
        <text className="kam-contract" x="16" y="99">DocumentRegistry</text>
        <text className="kam-record" x="16" y="118">records[documentId] → hash · issuedAt</text>
      </g>

      <g className="kam-scope" transform="translate(18 369)">
        <text className="kam-scope-note" x="0" y="14">PDF 원문 · 고객명 · 문서에 기재된 잔고는 Ethereum에 미등록</text>
      </g>
    </svg>
  </aside>;
}
