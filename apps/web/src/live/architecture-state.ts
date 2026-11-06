import type { VerificationResult, VerificationTraceEvent, VerificationTraceId } from './verification';

export type SceneId = 'custody' | 'prepare' | 'register' | 'receive' | 'inspect' | 'lookup' | 'compare';
export type ArchitectureFocus = 'none' | 'koda' | 'third-party' | 'ethereum' | 'write' | 'handoff' | 'query' | 'response';

export interface ArchitectureStateInput {
  scene: SceneId;
  busy: boolean;
  trace?: VerificationTraceEvent[];
  result?: VerificationResult;
  receiptBlock?: string;
}

export interface ArchitectureState {
  focus: ArchitectureFocus;
  label: string;
  detail: string;
  chainReadComplete: boolean;
}

const TRACE_LABELS: Record<VerificationTraceId, string> = {
  'deployment-validation': '컨트랙트 코드·발급자 확인',
  input: '제출 PDF 형식 확인',
  sha256: '제출 PDF 해시 계산',
  signature: '발급서명 복구',
  'chain-id': '조회 체인 ID 확인',
  'finalized-block': '확정 블록 조회',
  'transaction-input': '등록 거래 조회',
  receipt: '거래 영수증 조회',
  'canonical-block': '정식 블록 확인',
  'registration-event': '등록 이벤트 대조',
  finality: '포함·확정 높이 비교',
  'authorized-issuer': '허용 발급자 조회',
  record: '문서 검증기록 조회',
  'hash-comparison': '세 해시 최종 대조',
};

const RPC_TRACE_IDS = new Set<VerificationTraceId>([
  'deployment-validation', 'chain-id', 'finalized-block', 'transaction-input', 'receipt',
  'canonical-block', 'authorized-issuer', 'record',
]);
const LOCAL_INSPECTION_TRACE_IDS = new Set<VerificationTraceId>(['input', 'sha256', 'signature']);
const LOOKUP_TRACE_IDS = new Set<VerificationTraceId>([...RPC_TRACE_IDS, 'registration-event', 'finality']);

function state(focus: ArchitectureFocus, label: string, detail: string, chainReadComplete = false): ArchitectureState {
  return { focus, label, detail, chainReadComplete };
}

function lastTrace(trace: VerificationTraceEvent[] = []) {
  return [...trace].reverse().find(event => event.state === 'running') ?? trace.at(-1);
}

function lastRelevantTrace(trace: VerificationTraceEvent[] = [], ids: Set<VerificationTraceId>) {
  const relevant = trace.filter(event => ids.has(event.id));
  return [...relevant].reverse().find(event => event.state === 'running') ?? relevant.at(-1);
}

function traceState(current: VerificationTraceEvent): ArchitectureState {
  if (RPC_TRACE_IDS.has(current.id)) {
    if (current.state === 'running') return state('query', '제3자 → Ethereum', TRACE_LABELS[current.id]);
    if (current.state === 'success') return state('response', 'Ethereum → 제3자', `${TRACE_LABELS[current.id]} 응답`);
    return state('third-party', '제3자 · 공개 조회 실패', `${TRACE_LABELS[current.id]} 요청 실패`);
  }
  if (current.state === 'failure') return state('third-party', '제3자 대시보드 · 로컬 검사 실패', `${TRACE_LABELS[current.id]} 실패`);
  return state('third-party', '제3자 대시보드 · 로컬 검사', TRACE_LABELS[current.id]);
}

function failedTrace(trace: VerificationTraceEvent[] = []) {
  return [...trace].reverse().find(event => event.state === 'failure');
}

function resultState(result: VerificationResult, trace?: VerificationTraceEvent[]): ArchitectureState {
  if (result.status === 'match') return state('third-party', '검증 완료 · 원본 일치', '확정된 공개 기록과 제출 PDF 대조 완료', result.chainRecordValid === true);
  if (result.status === 'file-mismatch') return state('third-party', '검증 완료 · 제출본 불일치', '확정 기록은 유효하고 제출 PDF만 원본과 다름', result.chainRecordValid === true);
  if (result.status === 'pending') return state('third-party', result.receiptBlockNumber ? '검증 중단 · 최종 확정 대기' : '검증 중단 · 블록 포함 대기', result.message);
  if (result.status === 'unavailable') {
    const failed = failedTrace(trace);
    if (failed?.id === 'input') return state('third-party', '검증 중단 · PDF 입력 확인 실패', result.message);
    if (failed?.id === 'sha256') return state('third-party', '검증 중단 · PDF 해시 계산 실패', result.message);
    if (failed?.id === 'signature') return state('third-party', '검증 중단 · 발급서명 확인 실패', result.message);
    if (failed?.id === 'deployment-validation') return state('third-party', '검증 중단 · 컨트랙트 확인 실패', result.message);
    if (failed && RPC_TRACE_IDS.has(failed.id)) return state('third-party', '검증 중단 · 공개 조회 실패', result.message);
    return state('third-party', '검증 중단 · 검증정보 확인 실패', result.message);
  }
  if (result.status === 'not-registered') return state('third-party', '검증 종료 · 확정 기록 없음', 'finalized 상태에서 문서 ID를 찾지 못함');
  if (result.status === 'signature-mismatch') return state('third-party', '검증 중단 · 발급서명 불일치', '문서 서명에서 지정 발급자 확인 실패');
  if (result.signatureValid !== true) return state('third-party', '검증 중단 · 입력 확인 실패', 'PDF 또는 검증정보 형식을 확인해 주세요');
  return state('third-party', '검증 중단 · 신뢰 기준 불일치', '입력·체인·발급정보의 신뢰 기준을 충족하지 못함');
}

export function architectureMapState({ scene, busy, trace, result, receiptBlock }: ArchitectureStateInput): ArchitectureState {
  const current = lastTrace(trace);
  if (busy && current && ['receive', 'inspect', 'lookup', 'compare'].includes(scene)) return traceState(current);

  if (scene === 'custody') return state('koda', '수탁 관계와 증명서 발급', '고객 BTC 수탁·보관 관리와 잔고 증명서 발급');
  if (scene === 'prepare') return state('koda', 'KODA · 검증정보 준비', 'PDF 해시 계산 · 발급자 서명');
  if (scene === 'register') return state('write', 'KODA → Ethereum', receiptBlock ? `검증정보 등록 · 블록 #${receiptBlock}` : '검증정보 등록 · 최종 확정 확인');
  if (scene === 'receive') return state('handoff', '제3자 · 증명서 접수', '고객사가 제출한 PDF와 검증정보 접수');
  if (scene === 'inspect') {
    const inspection = lastRelevantTrace(trace, LOCAL_INSPECTION_TRACE_IDS);
    return inspection ? traceState(inspection) : state('third-party', '제3자 대시보드 · 로컬 검사', 'PDF 형식 · 해시 · 발급서명 확인');
  }
  if (scene === 'lookup') {
    if (result?.status === 'pending') return resultState(result, trace);
    const lookup = lastRelevantTrace(trace, LOOKUP_TRACE_IDS);
    return lookup ? traceState(lookup) : state('query', '제3자 → Ethereum', '확정된 문서 검증정보 조회');
  }
  if (result) return resultState(result, trace);
  if (current) return traceState(current);
  return state('third-party', '제3자 대시보드 · 최종 대조', '제출 PDF · 발급서명 · Ethereum 기록 비교');
}
