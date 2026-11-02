export const scenes = [
  { id: 'issue', label: '증빙 발행', role: '수탁 운영 담당자', org: 'KODA', title: '3분기 증빙을 발행해요', description: '기준일의 보관 내역을 확인하고 고객사에 증빙을 전달하세요.', action: '증빙 발행하기', next: '재무 담당자 화면으로', result: '고객사에 증빙을 전달했어요', steps: [['KODA 내부', '원본 문서 생성', '기준일 잔고로 증명서를 만들어요.'], ['DID 인증', '발행자 서명', 'KODA가 발행한 문서임을 표시해요.'], ['블록체인', '문서 지문 기록', '원본 지문과 항목 지문 묶음을 체인에 남겨요.']] },
  { id: 'finance', label: '재무 대조', role: '재무 담당자', org: '㈜가온테크', title: '받은 증빙을 대조해요', description: '매입 내역, 내부 승인 자료와 수탁 잔고를 함께 확인하세요.', action: '대조 완료하고 회계팀에 전달', next: '회계 담당자 화면으로', result: '회계팀에 확인한 증빙을 전달했어요', steps: [['DID 인증', '재무 담당자 확인', '고객사와 담당자의 열람 권한을 확인해요.'], ['KODA 내부', '민감정보 마스킹', '지갑 주소는 끝 4자리만, 거래 상대방은 거래처 코드로 바꿔요.'], ['고객사 내부', '대조 결과 전달', '확인 상태와 열람 권한을 회계팀에 전달해요.']] },
  { id: 'accounting', label: '회계 결산', role: '회계 담당자', org: '㈜가온테크', title: '결산에 필요한 증빙을 정리해요', description: '재무팀이 확인한 수량과 평가액을 결산 자료에 연결하세요.', action: '결산 자료에 연결하기', next: '감사인에게 권한 전달하기', result: '3분기 결산 자료에 연결했어요', steps: [['DID 인증', '회계 담당자 확인', '회계 담당자의 권한으로 열람해요.'], ['KODA 내부', '같은 원본에서 열람본 생성', '회계에 필요한 값만 보여줘요.'], ['고객사 내부', '결산 자료에 연결', '원본 파일 대신 증빙 참조를 연결해요.']] },
  { id: 'share', label: '권한 전달', role: '회계 담당자', org: '㈜가온테크', title: '감사인에게 열람 권한을 보내요', description: '받는 사람과 기간을 정하면 감사인이 KODA 원본을 직접 볼 수 있어요.', action: '열람 권한 보내기', next: '외부 감사인 화면으로', result: '감사인에게 열람 권한을 보냈어요', steps: [['DID 인증', '받는 감사인 확인', '지정한 DID와 감사인의 신원을 연결해요.'], ['KODA 내부', '열람 범위·기간 설정', '외부감사 제출용 권한을 적용해요.'], ['KODA 내부', '원본 접근 권한 전달', '문서는 보관하고 열람 권한만 전달해요.']] },
  { id: 'audit', label: '원본 검증', role: '외부 감사인', org: '한울회계법인', title: 'KODA가 발행한 원본을 확인해요', description: '전달받은 권한으로 원본을 열고, 발행 이후 바뀌지 않았는지 검증하세요.', action: '원본 검증하기', next: '메일로 받은 사본 검사하기', result: 'KODA가 발행한 원본과 같아요', steps: [['DID 인증', '서명과 열람 권한 확인', '발행자와 감사인의 권한을 확인해요.'], ['브라우저', '원본 지문 다시 계산', '원본 PDF의 SHA-256을 계산해요.'], ['블록체인', '기록된 지문과 대조', '발행 시점의 지문과 같은지 확인해요.']] },
  { id: 'inspect', label: '사본 검사', role: '외부 감사인', org: '한울회계법인', title: '메일로 받은 파일도 확인해요', description: '사본의 지문과 내용을 나눠 확인해 변경된 파일을 구분해요.', action: '파일 검사하기', next: '처음부터 다시 보기', result: '파일 검사를 마쳤어요', steps: [['브라우저', '파일 지문 계산', '파일을 업로드하지 않고 기기에서 계산해요.'], ['블록체인', '발행 기록과 대조', '원본 지문과 일치하는지 확인해요.'], ['브라우저', '내용 차이 확인', '지문이 다르면 읽을 수 있는 항목을 비교해요.']] },
] as const;
export const assets = [
  { symbol: '₿', name: '비트코인', code: 'BTC', amount: '12.4500', value: '1,942,110,000', color: '#f7931a' },
  { symbol: 'Ξ', name: '이더리움', code: 'ETH', amount: '310.2000', value: '1,563,408,000', color: '#6679bb' },
  { symbol: '$', name: 'USD 코인', code: 'USDC', amount: '1,250,000.00', value: '1,736,250,000', color: '#2775ca' },
];
// [거래일, 상대방, 수량, 거래 식별자] · 원본 PDF(proof-files)와 같은 순서의 가상 값
export const transactions = [['07-14','A사','+2.0000 BTC','4f1a…a21c'],['08-02','B사','−80.00 ETH','0x9b…07de'],['08-29','A사','+500,000 USDC','0x12…e9f0'],['09-17','B사','+0.4500 BTC','77c0…3b51'],['07-03','A사','+1.0000 BTC','2ab1…a001'],['07-21','B사','+50.00 ETH','0x41…0012'],['08-05','A사','−0.5000 BTC','bc21…a003'],['08-14','B사','+200,000 USDC','0x51…0014'],['08-20','A사','+0.2500 BTC','cd31…a005'],['09-02','B사','+40.20 ETH','0x61…0016'],['09-11','A사','−100,000 USDC','0x71…0017'],['09-28','B사','+0.2500 BTC','ef41…a008']] as const;
export const WALLET = 'bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz';
export const PRICE_BASIS = '2026.09.30 23:59 KST · 시연용 가상 기준가';
export const CUSTODY_TYPE = '고객별 분리 보관 (가상)';
// 상대방 이름 대신 고객사 승인 자료에 쓰는 거래처 코드로 바꿔 보여요.
export const counterpartyCode = (name: string) => ({ 'A사': 'CP-01', 'B사': 'CP-02' } as Record<string, string>)[name] ?? 'CP-??';
export const txTail = (ref: string) => '…' + ref.slice(-4);

/** 역할별 열람 기준 v0.3 · 범위표, 화면 위 열람 범위 띠, 열람본 검증은 이 표를 직접 읽어요.
 *  증빙 본문(Experience.tsx Document)은 역할별로 직접 그리므로, 표를 바꾸면 Document도 함께 고치고 tests/proof/demo.spec.ts의 누출 검사를 돌려야 해요. */
export type Viewer = 'issuer' | 'finance' | 'accounting' | 'auditor' | 'public';
export type Level = 'full' | 'partial' | 'hidden';
export const viewers: { id: Viewer; label: string }[] = [
  { id: 'issuer', label: 'KODA 발행' }, { id: 'finance', label: '재무 담당자' }, { id: 'accounting', label: '회계 담당자' }, { id: 'auditor', label: '외부 감사인' }, { id: 'public', label: '공개 기록' },
];
type Rule = [Level, string];
export type PolicyKey = 'basic' | 'assets' | 'price' | 'custody' | 'movement' | 'counterparty' | 'txref' | 'wallet' | 'proof';
export const policy: { key: PolicyKey; label: string; why: string; rules: Record<Viewer, Rule> }[] = [
  { key: 'basic', label: '법인명 · 문서번호 · 기준일', why: '증빙의 주체와 시점', rules: { issuer: ['full', '전체'], finance: ['full', '전체'], accounting: ['full', '전체'], auditor: ['full', '전체'], public: ['hidden', '담지 않음'] } },
  { key: 'assets', label: '자산 · 수량 · 평가액', why: '대조, 결산, 감사 모두의 기본값', rules: { issuer: ['full', '전체'], finance: ['full', '전체'], accounting: ['full', '전체'], auditor: ['full', '전체'], public: ['hidden', '담지 않음'] } },
  { key: 'price', label: '평가 기준가 시점 · 출처', why: '회계는 공정가치 근거를 주석에 적고, 감사인은 다시 계산해요', rules: { issuer: ['full', '전체'], finance: ['full', '전체'], accounting: ['full', '전체'], auditor: ['full', '전체'], public: ['hidden', '담지 않음'] } },
  { key: 'custody', label: '보관 형태', why: '분리 보관인지에 따라 자산의 귀속 판단이 달라져요', rules: { issuer: ['full', '전체'], finance: ['full', '전체'], accounting: ['full', '전체'], auditor: ['full', '전체'], public: ['hidden', '담지 않음'] } },
  { key: 'movement', label: '거래 일자 · 자산 · 수량', why: '재무는 매입 내역과 한 건씩 대조하고, 회계는 증감 합계로 결산해요', rules: { issuer: ['full', '전체'], finance: ['full', '12건 전체'], accounting: ['partial', '자산별 증감 합계'], auditor: ['full', '전체'], public: ['hidden', '담지 않음'] } },
  { key: 'counterparty', label: '거래 상대방', why: '재무는 승인 자료의 거래처 코드로 맞추면 충분해요. 이름은 필요한 사람만 봐요', rules: { issuer: ['full', '전체'], finance: ['partial', '거래처 코드'], accounting: ['hidden', '가림'], auditor: ['full', '전체'], public: ['hidden', '담지 않음'] } },
  { key: 'txref', label: '거래 식별자 (Tx)', why: 'Tx 전체가 보이면 탐색기에서 상대방 주소와 잔고가 드러나요', rules: { issuer: ['full', '전체'], finance: ['partial', '끝 4자리'], accounting: ['hidden', '가림'], auditor: ['full', '전체'], public: ['hidden', '담지 않음'] } },
  { key: 'wallet', label: '보관 지갑 주소', why: '주소 일부만 보여도 정확한 잔고와 합쳐지면 지갑을 특정할 수 있어요. 감사인은 체인 잔고와 대조해요', rules: { issuer: ['full', '전체'], finance: ['partial', '지갑 이름 · 끝 4자리'], accounting: ['hidden', '지갑 이름만'], auditor: ['full', '전체'], public: ['hidden', '담지 않음'] } },
  { key: 'proof', label: '문서 지문 · 발행자 DID · 기록 시각', why: '누구나 원본 여부를 확인할 수 있어야 해요', rules: { issuer: ['full', '전체'], finance: ['full', '전체'], accounting: ['full', '전체'], auditor: ['full', '전체'], public: ['full', '이것만 공개'] } },
];
export const levelOf = (viewer: Viewer, key: PolicyKey): Level => policy.find(p => p.key === key)!.rules[viewer][0];
export const LEVEL_NAME: Record<Level, string> = { full: '전체', partial: '일부', hidden: '가림' };
