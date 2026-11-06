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
  review?: { label: string; detail: string; stepId: string; state?: string; playing?: boolean };
}

function actorClass(active: boolean) { return `kam-actor${active ? ' is-active' : ''}`; }
function pathClass(active: boolean, complete = false, flowing = active) { return `kam-path${active ? ' is-active' : ''}${complete ? ' is-complete' : ''}${flowing ? ' is-flowing' : ''}`; }
function pathMarker(active: boolean) { return active ? 'url(#kam-arrow-active)' : 'url(#kam-arrow)'; }

const REVIEW_CHAIN_STEPS = new Set([
  'deployment-validation', 'chain-id', 'finalized-block', 'transaction-input', 'receipt',
  'canonical-block', 'authorized-issuer', 'record',
]);

export function ArchitectureMap(props: ArchitectureMapProps) {
  const currentState = architectureMapState(props);
  const reviewStopped = props.review && ['failure', 'pending', 'stopped'].includes(props.review.state ?? '');
  const state = props.review ? {
    focus: REVIEW_CHAIN_STEPS.has(props.review.stepId)
      ? reviewStopped ? 'query' as const : 'response' as const
      : 'third-party' as const,
    label: props.review.label,
    detail: props.review.detail,
    chainReadComplete: false,
  } : currentState;
  const resultComplete = props.scene === 'compare' && state.chainReadComplete;
  const reviewFlowing = !props.review || (props.review.playing === true && !reviewStopped);
  const kodaActive = ['koda', 'write'].includes(state.focus);
  const customerActive = state.focus === 'handoff';
  const thirdActive = ['third-party', 'query', 'response'].includes(state.focus);
  const ethereumActive = resultComplete || ['ethereum', 'write', 'query', 'response'].includes(state.focus);

  return <aside className={`kam${props.review ? ' is-review' : ''}${props.review && !props.review.playing ? ' is-review-paused' : ''}${thirdActive ? ' is-verifier' : ''}`} aria-label={`전체 아키텍처. 현재 위치: ${state.label}. ${state.detail}`}>
    <p className="kam-current"><span>{props.review ? '처리 기록' : '현재 위치'}</span><strong>{state.label}</strong></p>
    <svg className="kam-diagram" viewBox="0 0 336 610" role="img" aria-labelledby="kam-title kam-desc">
      <title id="kam-title">KODA 증빙 전달과 제3자 검증 아키텍처</title>
      <desc id="kam-desc">고객사 소유 BTC와 KODA의 수탁 관리는 Bitcoin 네트워크에 연결됩니다. KODA가 발급한 PDF는 고객사를 거쳐 제3자에게 전달됩니다. 문서 검증정보는 KODA가 Ethereum에 등록하며, 제3자는 Bitcoin이 아닌 Ethereum에서 그 기록을 조회합니다.</desc>
      <defs>
        <marker id="kam-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7" /></marker>
        <marker id="kam-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7" /></marker>
      </defs>

      <g className="kam-network kam-bitcoin" transform="translate(52 18)">
        <rect width="232" height="72" rx="4" />
        <text className="kam-network-name" x="116" y="28" textAnchor="middle">Bitcoin 네트워크</text>
        <text className="kam-network-sub" x="116" y="51" textAnchor="middle">고객사 귀속 BTC · KODA 수탁 관리</text>
      </g>

      <path data-testid="customer-bitcoin" className="kam-relationship" d="M226 90 V116 H253 V142" />
      <text className="kam-relationship-label" x="235" y="108">BTC 귀속</text>
      <path data-testid="koda-bitcoin" className="kam-relationship" d="M110 90 V116 H83 V142" />
      <text className="kam-relationship-label" x="101" y="108" textAnchor="end">수탁 관리</text>

      <text className="kam-kicker" x="18" y="137">업무 주체</text>
      <g className={actorClass(kodaActive)} transform="translate(18 148)">
        <rect width="130" height="78" rx="4" /><circle cx="18" cy="20" r="5" />
        <text className="kam-name" x="31" y="25">KODA</text><text x="14" y="51">증명서 발급</text><text x="14" y="68">검증정보 등록</text>
      </g>
      <g className={actorClass(customerActive)} transform="translate(188 148)">
        <rect width="130" height="78" rx="4" /><circle cx="18" cy="20" r="5" />
        <text className="kam-name" x="31" y="25">고객사</text><text x="14" y="51">원본 보관</text><text x="14" y="68">업무상 제출</text>
      </g>

      <path data-testid="koda-customer-pdf" className={pathClass(state.focus === 'handoff', false, state.focus === 'handoff' && reviewFlowing)} d="M148 187 H188" markerEnd={pathMarker(state.focus === 'handoff')} />
      <text className="kam-route-label" x="168" y="177" textAnchor="middle">PDF</text>

      <g className={actorClass(thirdActive)} transform="translate(188 298)">
        <rect width="130" height="82" rx="4" /><circle cx="18" cy="20" r="5" />
        <text className="kam-name" x="31" y="25">제3자</text><text x="14" y="52">KODA 대시보드</text><text x="14" y="70">제출 문서 검증</text>
      </g>
      <path data-testid="customer-third-party-pdf" className={pathClass(state.focus === 'handoff', false, state.focus === 'handoff' && reviewFlowing)} d="M253 226 V298" markerEnd={pathMarker(state.focus === 'handoff')} />
      <text className="kam-route-label" x="264" y="265">PDF 제출</text>

      <path data-testid="koda-ethereum-register" className={pathClass(state.focus === 'write', false, state.focus === 'write' && reviewFlowing)} d="M83 226 V458" markerEnd={pathMarker(state.focus === 'write')} />
      <text className={`kam-route-label${state.focus === 'write' ? ' is-active' : ''}`} x="94" y="346">등록</text>

      <path data-testid="third-party-ethereum-query" className={pathClass(state.focus === 'query', resultComplete, state.focus === 'query' && reviewFlowing)} d="M228 380 V430 H228 V458" markerEnd={pathMarker(state.focus === 'query' || resultComplete)} />
      <text className={`kam-route-label${state.focus === 'query' ? ' is-active' : ''}`} x="218" y="424" textAnchor="end">조회</text>
      <path data-testid="ethereum-third-party-response" className={pathClass(state.focus === 'response', resultComplete, state.focus === 'response' && reviewFlowing)} d="M292 458 V420 H292 V380" markerEnd={pathMarker(state.focus === 'response' || resultComplete)} />
      <text className={`kam-route-label${state.focus === 'response' ? ' is-active' : ''}`} x="260" y="411" textAnchor="middle">응답</text>

      <g className={`kam-chain${ethereumActive ? ' is-active' : ''}`} transform="translate(18 458)">
        <rect className="kam-chain-boundary" width="300" height="116" rx="4" />
        <text className="kam-chain-title" x="18" y="31">Ethereum</text>
        <text className="kam-chain-sub" x="18" y="55">문서 검증정보를 기록하는 곳</text>
        <g className="kam-blocks" transform="translate(187 22)">
          <rect x="0" y="5" width="27" height="27" /><path d="M27 18.5h10" />
          <rect x="37" y="5" width="27" height="27" /><path d="M64 18.5h10" />
          <rect x="74" y="5" width="27" height="27" />
        </g>
        <line x1="18" y1="70" x2="282" y2="70" />
        <text className="kam-contract" x="18" y="94">DocumentRegistry</text>
        <text className="kam-chain-note" x="282" y="94" textAnchor="end">원본 PDF는 저장하지 않음</text>
      </g>

      <text className="kam-scope-note" x="18" y="600">BTC 자산과 문서 검증정보는 서로 다른 네트워크에서 다룹니다.</text>
    </svg>
  </aside>;
}
