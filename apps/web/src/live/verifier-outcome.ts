import type { SignedComparisonResult as VerificationResult } from './signed-comparison';

export type VerifierOutcomeKind = 'idle' | 'busy' | 'match' | 'mismatch' | 'pending' | 'failure';

export interface VerifierQuestion {
  label: string;
  value: string;
  state: 'confirmed' | 'warning' | 'unavailable' | 'waiting';
}

export interface VerifierOutcome {
  kind: VerifierOutcomeKind;
  title: string;
  description: string;
  questions: VerifierQuestion[];
}

const WAITING: VerifierQuestion[] = [
  { label: 'KODA가 발급한 문서인지', value: '검증 전', state: 'waiting' },
  { label: '발급 당시 원본과 일치하는지', value: '검증 전', state: 'waiting' },
  { label: '이후 변경되지 않았는지', value: '검증 전', state: 'waiting' },
];

function questionsFor(result: VerificationResult): VerifierQuestion[] {
  if (result.signedComparison?.registrationConflict) {
    return [
      { label: 'KODA가 발급한 문서인지', value: '발급서명 확인', state: 'confirmed' },
      { label: '발급 당시 원본과 일치하는지', value: '등록본과 불일치', state: 'warning' },
      { label: '이후 변경되지 않았는지', value: '등록 원본과 다름', state: 'warning' },
    ];
  }
  if (result.status === 'match') {
    return [
      { label: 'KODA가 발급한 문서인지', value: '발급서명 확인', state: 'confirmed' },
      { label: '발급 당시 원본과 일치하는지', value: '일치', state: 'confirmed' },
      { label: '이후 변경되지 않았는지', value: '변경 없음', state: 'confirmed' },
    ];
  }
  if (result.status === 'file-mismatch') {
    return [
      // A valid signature authenticates the stored issuance data, not this submitted PDF.
      { label: 'KODA가 발급한 문서인지', value: '원본 확인 불가', state: 'warning' },
      { label: '발급 당시 원본과 일치하는지', value: '불일치', state: 'warning' },
      { label: '이후 변경되지 않았는지', value: '원본과 다름', state: 'warning' },
    ];
  }
  if (result.status === 'pending') {
    return WAITING.map(question => ({ ...question, value: result.receiptBlockNumber ? '최종 확정 대기' : '블록 포함 대기', state: 'waiting' }));
  }
  return [
    {
      label: 'KODA가 발급한 문서인지',
      value: '확인 불가',
      state: 'unavailable',
    },
    { label: '발급 당시 원본과 일치하는지', value: '확인 불가', state: 'unavailable' },
    { label: '이후 변경되지 않았는지', value: '확인 불가', state: 'unavailable' },
  ];
}

export function verifierOutcome(result?: VerificationResult, busy = false): VerifierOutcome {
  if (busy) {
    return {
      kind: 'busy',
      title: '제출 PDF와 발급 기록을 확인하고 있어요',
      description: '브라우저 계산과 Ethereum 공개 기록 조회가 끝날 때까지 기다려 주세요.',
      questions: WAITING.map(question => ({ ...question, value: '확인 중', state: 'waiting' })),
    };
  }
  if (!result) {
    return { kind: 'idle', title: '증명서를 대조해 보세요', description: 'PDF를 선택하면 제출본·발급서명·Ethereum 기록을 순서대로 대조합니다.', questions: WAITING };
  }
  if (result.signedComparison?.registrationConflict) {
    return { kind: 'mismatch', title: '서명은 유효하지만 등록 원본과 다릅니다',
      description: '서명과 제출 PDF는 일치합니다. 같은 문서 ID로 등록된 발급 원본과는 일치하지 않습니다.', questions: questionsFor(result) };
  }
  const kinds: Record<VerificationResult['status'], Pick<VerifierOutcome, 'kind' | 'title' | 'description'>> = {
    match: { kind: 'match', title: '발급 원본과 일치합니다', description: '제출 PDF·발급서명·확정된 Ethereum 기록의 해시가 같습니다.' },
    'file-mismatch': { kind: 'mismatch', title: '제출 PDF가 발급 원본과 다릅니다', description: '발급 기록은 읽혔지만, 제출한 파일의 전체 바이트가 기준 원본과 다릅니다.' },
    pending: { kind: 'pending', title: result.receiptBlockNumber ? '최종 확정을 기다리고 있습니다' : '거래의 블록 포함을 기다리고 있습니다', description: result.message },
    'signature-mismatch': { kind: 'failure', title: '발급서명을 확인할 수 없습니다', description: '서명자가 신뢰할 시험 발급자와 다르거나, 서명을 해석하지 못했습니다.' },
    'not-registered': { kind: 'failure', title: '확정된 등록 기록을 찾지 못했습니다', description: '문서 ID와 등록 거래 정보를 다시 확인해 주세요.' },
    unavailable: { kind: 'failure', title: '검증에 필요한 정보를 확인하지 못했습니다', description: '문서 처리나 발급 기록 조회를 완료하지 못했습니다. 다시 시도해 주세요.' },
    invalid: { kind: 'failure', title: '문서와 발급 기록의 연결을 확인하지 못했습니다', description: '제출 PDF, 문서 ID, 등록 거래가 같은 발급 건인지 확인해 주세요.' },
  };
  return { ...kinds[result.status], questions: questionsFor(result) };
}
