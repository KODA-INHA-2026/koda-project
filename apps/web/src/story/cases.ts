import type { StoryCase } from './types';

// 사례 데이터: 사례별 초안을 서브 에이전트가 쓰고 메인이 검토해 고쳤다. 모든 법인, 기관, 지갑, 거래는 가상 값이다.
// 확인 필요 사항(법적 지위, 회계 분류 등)은 팀 문서의 "확인 필요" 목록에 옮겨 두었다.
export const exportCase: StoryCase = {
  id: 'export',
  company: '한빛정밀',
  industry: '수출 제조',
  docTitle: '해외 대금 수취 증빙',
  docNo: 'KP-2026-1028-0102',
  asOf: '2026-10-28 15:00 KST',
  headline: '해외 거래처가 보낸 USDC 대금을 청구서와 맞추고, 외부 기관이 같은 기록으로 증빙을 확인해요.',
  issuer: {
    title: '수탁 운영 담당자',
    org: 'KODA',
    job: '수취 기록을 원본으로 증빙을 발행해 고객사에 전달해요.',
  },
  inside: [
    { title: '재무 담당자', org: '한빛정밀', job: '청구서와 수취 내역을 한 건씩 맞춰 보고 차이를 확인해요.' },
    { title: '회계 담당자', org: '한빛정밀', job: '재무가 확인한 수취 금액을 외화 매출채권 결산에 연결해요.' },
  ],
  external: [
    { title: '거래은행 정산 담당자', org: '새벽은행 (가상)', job: '원화 환산액과 환율 기준이 은행 정산 기록과 맞는지 확인해요.' },
    { title: '외부 감사 담당자', org: '한울회계법인 (가상)', job: '원본 지문을 다시 계산해 체인에 남은 기록과 같은지 확인해요.' },
  ],
  cardKeys: ['amount', 'gap', 'counterparty', 'wallet', 'txref'],
  fields: [
    { key: 'invoice', label: '청구서 번호', value: 'DEMO-INV-1028', sensitive: false },
    { key: 'billed', label: '청구 금액 (고객사 등록값)', value: '25,100.00 USDC', sensitive: false },
    { key: 'amount', label: '수취 금액', value: '25,000.00 USDC', sensitive: false },
    { key: 'gap', label: '청구 대비 차이', value: '100.00 USDC 적음 (확인 필요)', sensitive: false },
    { key: 'asset', label: '자산 · 네트워크', value: 'USDC · Ethereum', sensitive: false },
    { key: 'receivedAt', label: '수취 일시', value: '2026-10-26 13:42 KST', sensitive: false },
    { key: 'krw', label: '원화 환산액 · 환율 기준', value: '34,250,000원 (1 USDC = 1,370원, 2026-10-26 17:00 KST 기준)', sensitive: false },
    { key: 'counterparty', label: '거래처', value: 'Northstar Components (가상)', sensitive: true },
    { key: 'wallet', label: '수취 지갑', value: '0x7c2F9a41E08bD35c6a1F7e90B4d2C8a5E13f9b06', sensitive: true },
    { key: 'txref', label: '거래 식별자 (Tx)', value: '0xa3f1c90e4b27d856f0e19c3a7b2d84e6f51c9a0b3d7e2f48c61a9d05b3e7f2c1', sensitive: true },
  ],
  views: {
    inside1: {
      counterparty: { level: 'partial', shown: '거래처 코드 CP-07', why: '승인 자료의 거래처 코드로 맞추면 대조가 끝나요. 이름은 필요한 사람만 봐요.' },
      wallet: { level: 'partial', shown: '수출대금 수취 지갑 · …9b06', why: '주소 일부만 보여요. 전체 주소와 잔고가 합쳐지면 지갑을 특정할 수 있어서요.' },
      txref: { level: 'partial', shown: '…f2c1', why: 'Tx 전체가 보이면 탐색기에서 상대방 주소와 잔고가 드러나요.' },
    },
    inside2: {
      counterparty: { level: 'hidden', why: '결산에는 거래처 이름이 필요하지 않아요.' },
      wallet: { level: 'partial', shown: '수출대금 수취 지갑 (주소 가림)', why: '결산에는 어느 지갑으로 받았는지만 알면 돼요.' },
      txref: { level: 'hidden', why: 'Tx가 보이면 탐색기에서 상대방 주소와 잔고가 드러나요.' },
    },
    external: {
      counterparty: { level: 'full', why: '권한을 받은 검증자는 거래 상대방까지 원본과 대조해요.' },
      wallet: { level: 'full', why: '감사인은 보관 지갑의 체인 잔고와 대조해야 해서 전체 주소를 봐요.' },
      txref: { level: 'full', why: '권한을 받은 검증자는 체인에서 같은 거래 기록을 직접 찾아요.' },
    },
  },
  handoff: '재무가 청구와의 100 USDC 차이를 표시하고, 확인한 수취 금액을 회계에 넘겨요.',
  grant: '거래은행과 외부 감사인에게 30일 동안 수취 증빙 열람 권한을 줘요.',
  tamper: {
    key: 'amount',
    to: '24,900.00 USDC',
    story: '수취 금액이 바뀌면 재무가 대조한 금액과 회계 결산, 은행 정산이 서로 어긋나요.',
  },
  captions: {
    issue: 'KODA가 수취 기록으로 증빙을 발행하고, 지문을 공개 블록체인에 남겨요.',
    inside1: '재무는 청구서와 대조해 100 USDC 차이를 찾고, 거래처는 코드로만 봐요.',
    inside2: '회계는 확인된 수취 금액만 받아 결산에 연결하고, 거래처는 가려져요.',
    grant: '거래은행과 외부 감사인에게만 30일 동안 열람 권한을 줘요.',
    external: '은행과 감사인이 KODA 서버를 거치지 않고 각자 같은 체인 기록과 대조해요.',
    tamper: '몇 달 뒤 운영 DB에서 수취 금액 하나가 바뀌면 어떻게 될까요?',
    close: '한 장의 증빙을 재무, 회계, 은행, 감사인이 같은 기록으로 확인했어요.',
  },
};

export const gameCase: StoryCase = {
  id: 'game',
  company: '루멘게임즈',
  industry: '게임·콘텐츠',
  docTitle: '파트너 정산 지급 증빙',
  docNo: 'LG-2026-1028-0101',
  asOf: '2026-10-28 15:00 KST',
  headline: 'B2B 파트너 3곳에 지급한 USDC 정산을 승인 기록과 실행 참조번호로 잇고, 파트너마다 자기 몫만 확인해요.',
  issuer: {
    title: '수탁 운영 담당자',
    org: 'KODA',
    job: '지급 요청과 승인 기록이 맞는지 확인하고 증빙을 발행해요.',
  },
  inside: [
    {
      title: '정산 담당자',
      org: '루멘게임즈',
      job: '파트너 3곳의 지급 요청과 거래처 정보를 맞춰 봐요.',
    },
    {
      title: '회계 담당자',
      org: '루멘게임즈',
      job: '2인 승인 기록을 확인하고 파트너 정산 비용을 결산해요.',
    },
  ],
  external: [
    {
      title: '정산 수취 담당',
      org: 'Orion Studio (가상)',
      own: 'orion',
      job: '받은 금액이 계약상 정산액과 같은지 확인해요.',
    },
    {
      title: '정산 수취 담당',
      org: 'Pixel Sound (가상)',
      own: 'pixel',
      job: '받은 USDC가 납품 완료분과 맞는지 확인해요.',
    },
    {
      title: '정산 수취 담당',
      org: 'Nova Art (가상)',
      own: 'nova',
      job: '받은 USDC가 승인된 작업 정산액과 맞는지 확인해요.',
    },
  ],
  cardKeys: ['total', 'orion', 'approvals', 'exception', 'wallet', 'tx'],
  fields: [
    { key: 'period', label: '정산 기간', value: '2026-10-01 ~ 2026-10-15', sensitive: false },
    { key: 'total', label: '정산 총액', value: '18,000.00 USDC', sensitive: true },
    { key: 'orion', label: 'Orion Studio (가상) 지급액', value: '8,000.00 USDC', sensitive: true },
    { key: 'pixel', label: 'Pixel Sound (가상) 지급액', value: '6,000.00 USDC', sensitive: true },
    { key: 'nova', label: 'Nova Art (가상) 지급액', value: '4,000.00 USDC', sensitive: true },
    { key: 'exception', label: '예외 거래처', value: '등록 정보 없는 거래처 1건, 지급 보류 (총액 미포함)', sensitive: true },
    { key: 'approvals', label: '승인 기록', value: '2인 승인 완료 · 재무 이사 DID …3f8a · 정산 팀장 DID …b20e', sensitive: true },
    { key: 'paid_at', label: '지급 일시', value: '2026-10-28 14:32 KST', sensitive: false },
    { key: 'wallet', label: '지급 지갑', value: '0x3C81a7F0d52E9b64c1A8f0e27D5b9E3a06F4c2D1', sensitive: true },
    { key: 'tx', label: '거래 식별자 (Tx)', value: '0x9e4b07c1a35f28d60b71e9c4f2a8d13e6c05b9a7d48e21f35a9c6e0b71d3f4a2', sensitive: true },
  ],
  views: {
    inside1: {
      total: { level: 'full', why: '지급 요청 총액과 실제 지급 합계를 맞춰 봐요.' },
      orion: { level: 'full', why: '거래처별 요청액과 한 건씩 맞춰 봐요.' },
      pixel: { level: 'full', why: '거래처별 요청액과 한 건씩 맞춰 봐요.' },
      nova: { level: 'full', why: '거래처별 요청액과 한 건씩 맞춰 봐요.' },
      exception: { level: 'full', why: '등록 정보가 없는 거래처는 정산 담당자가 직접 처리해요.' },
      approvals: { level: 'partial', shown: '2인 승인 완료 여부와 직함만', why: '요청 단계에서는 승인이 끝났는지만 확인하면 돼요.' },
      wallet: { level: 'partial', shown: '지갑 이름 · 끝 4자리', why: '출금 지갑이 맞는지는 이름과 끝 4자리로 확인할 수 있어요.' },
      tx: { level: 'partial', shown: '끝 4자리', why: '요청 건과 실행 건을 끝 4자리로 짝지어 확인해요.' },
    },
    inside2: {
      total: { level: 'full', why: '결산 총액과 장부 금액을 맞춰요.' },
      orion: { level: 'full', why: '거래처별 비용 인식 금액이 필요해요.' },
      pixel: { level: 'full', why: '거래처별 비용 인식 금액이 필요해요.' },
      nova: { level: 'full', why: '거래처별 비용 인식 금액이 필요해요.' },
      exception: { level: 'partial', shown: '보류 1건과 처리 상태만, 거래처 정보 가림', why: '결산에는 보류 건수와 처리 상태만 필요해요.' },
      approvals: { level: 'full', why: '2인 승인이 실제로 있었는지 통제 점검에서 직접 확인해요.' },
      wallet: { level: 'partial', shown: '지갑 이름만', why: '어느 보관 지갑에서 나갔는지만 알면 결산 근거가 돼요.' },
      tx: { level: 'partial', shown: '끝 4자리', why: '결산 자료에는 식별자 끝 4자리면 대조 참조로 충분해요.' },
    },
    external: {
      total: { level: 'hidden', why: '전체 금액과 다른 파트너 몫은 알 필요가 없어요.' },
      orion: { level: 'partial', shown: '자기 정산액만, 다른 파트너 금액 가림', why: '파트너는 자기 몫이 맞는지만 확인하면 돼요.' },
      pixel: { level: 'partial', shown: '자기 정산액만, 다른 파트너 금액 가림', why: '파트너는 자기 몫이 맞는지만 확인하면 돼요.' },
      nova: { level: 'partial', shown: '자기 정산액만, 다른 파트너 금액 가림', why: '파트너는 자기 몫이 맞는지만 확인하면 돼요.' },
      exception: { level: 'hidden', why: '등록 정보가 없는 거래처 내용은 파트너에게 공개하지 않아요.' },
      approvals: { level: 'partial', shown: '2인 승인 완료 여부만, 승인자 가림', why: '승인이 끝났는지만 알면 지급 근거를 믿을 수 있어요.' },
      wallet: { level: 'partial', shown: '끝 4자리만', why: '지급 지갑이 맞는지 대조할 정도만 보여 줘요.' },
      tx: { level: 'partial', shown: '자기 몫이 든 Tx 전체', why: '파트너는 자기 입금을 체인에서 찾을 때 식별자가 필요해요.' },
    },
  },
  handoff: '정산 담당자가 지급 요청과 실행 건을 맞춘 뒤 회계 담당자에게 승인 기록과 함께 넘겨요.',
  grant: '파트너 3곳에 정산 기간 동안 자기 몫만 보이는 열람 권한을 줘요.',
  tamper: {
    key: 'orion',
    to: '7,000.00 USDC',
    story: '발행 후 값이 바뀌어도 기록이 남지 않으면, 파트너와 분쟁이 생겼을 때 어느 쪽이 원본인지 가릴 수 없어요.',
  },
  captions: {
    issue: 'KODA가 지급과 승인 기록을 증빙 한 장으로 발행하고 지문을 체인에 남겨요.',
    inside1: '정산 담당자가 파트너 3곳의 지급액을 거래처 정보와 맞춰 봐요.',
    inside2: '회계 담당자가 2인 승인 기록을 확인하고 비용을 결산해요.',
    grant: '파트너 3곳에 자기 몫만 보이는 열람 권한을 나눠 줘요.',
    external: '파트너 3곳이 KODA 서버를 거치지 않고 각자 같은 체인 기록과 대조해요.',
    tamper: '몇 달 뒤 운영 DB에서 한 파트너의 지급액이 바뀌면 어떻게 될까요?',
    close: '파트너마다 자기 몫만 보면서도, 모두 같은 기록 하나로 확인했어요.',
  },
};

export const auditCase: StoryCase = {
  id: 'audit',
  company: '새봄자산운용',
  industry: '자산운용',
  docTitle: '보관 자산 잔고·거래 내역 증명',
  docNo: 'KP-2026-0930-0711',
  asOf: '2026-09-30 23:59 KST',
  headline: '보관 중인 자산의 잔고와 거래 내역을 감사자료로 내고, 외부 검증자가 같은 기록으로 확인해요.',
  issuer: {
    title: '수탁 운영 담당자',
    org: 'KODA',
    job: '기준일 보관 잔고와 거래 내역으로 증명을 발행하고 고객사에 전달해요.',
  },
  inside: [
    {
      title: '운용 지원 담당자',
      org: '새봄자산운용',
      job: '수탁 잔고와 거래 내역을 장부와 한 건씩 맞춰 봐요.',
    },
    {
      title: '회계·준법 담당자',
      org: '새봄자산운용',
      job: '결산에 쓸 값을 정하고 감사자료 제공 범위를 승인해요.',
    },
  ],
  external: [
    {
      title: '외부 감사인',
      org: '한결회계법인 (가상)',
      job: '기준일 수량이 보관 기록과 같은지, 빠진 거래가 없는지 확인해요.',
    },
    {
      title: '가치평가 담당자',
      org: '나래가치평가 (가상)',
      override: {
        wallet: { level: 'partial', shown: 'SBAM-VAULT-01', why: '평가에는 어느 지갑인지만 알면 돼요.' },
        movement: { level: 'partial', shown: '자산별 증감 합계만', why: '평가액 재계산에는 기준일 수량과 증감 합계면 충분해요.' },
        counterparty: { level: 'hidden', why: '평가에는 거래 상대방이 필요하지 않아요.' },
        txref: { level: 'hidden', why: '평가에는 거래 식별자가 필요하지 않아요.' },
      },
      job: '평가 기준가의 출처와 시점을 보고, 수량에 맞게 평가액을 다시 계산해요.',
    },
  ],
  cardKeys: ['btc', 'wallet', 'movement', 'counterparty', 'txref'],
  fields: [
    { key: 'asof', label: '기준일', value: '2026-09-30 23:59 KST (3분기 말)', sensitive: false },
    { key: 'btc', label: '비트코인 수량 · 평가액', value: '3.2500 BTC · 507,000,000원', sensitive: false },
    { key: 'eth', label: '이더리움 수량 · 평가액', value: '48.2000 ETH · 242,928,000원', sensitive: false },
    { key: 'usdc', label: 'USD 코인 수량 · 평가액', value: '820,000.00 USDC · 1,138,980,000원', sensitive: false },
    {
      key: 'price',
      label: '평가 기준가 시점 · 출처',
      value: 'BTC 156,000,000원 · ETH 5,040,000원 · USDC 1,389원 (가상 거래소 3곳 종가 평균, 2026.09.30 23:59 KST)',
      sensitive: false,
    },
    { key: 'custody', label: '보관 형태', value: '고객별 분리 보관 (가상) · 해외 전문투자자 대상 운용 자산 (가상)', sensitive: false },
    { key: 'wallet', label: '보관 지갑', value: 'SBAM-VAULT-01 · ADDR-DEMO-7D4E', sensitive: true },
    {
      key: 'movement',
      label: '거래 일자 · 자산 · 수량',
      value: '08-11 USDC +5,000.00 · 09-08 ETH −1.0000 · 09-22 BTC +0.1000 (3건)',
      sensitive: true,
    },
    {
      key: 'counterparty',
      label: '거래 상대방',
      value: '데스크 A (가상) · 데스크 B (가상) · 데스크 A (가상)',
      sensitive: true,
    },
    {
      key: 'txref',
      label: '거래 식별자 (Tx)',
      value: 'demo-tx-0811-93e1 · demo-tx-0908-b27c · demo-tx-0922-5d40',
      sensitive: true,
    },
  ],
  views: {
    inside1: {
      wallet: { level: 'partial', shown: 'SBAM-VAULT-01 · …7D4E', why: '지갑 이름과 끝 4자리면 잔고 줄과 맞출 수 있어요.' },
      counterparty: { level: 'partial', shown: 'CP-01 · CP-02 · CP-01', why: '승인 자료의 거래처 코드로 맞추면 충분해요. 이름은 가려요.' },
      txref: { level: 'partial', shown: '…93e1 · …b27c · …5d40', why: '탐색기에서 건을 찾을 때는 끝 4자리면 충분해요.' },
    },
    inside2: {
      wallet: { level: 'partial', shown: 'SBAM-VAULT-01', why: '결산 자료에는 지갑 이름만 연결해요.' },
      movement: { level: 'partial', shown: '자산별 증감 합계만', why: '회계는 증감 합계로 결산해요. 건별 일자와 상대방은 가려요.' },
      counterparty: { level: 'hidden', why: '결산과 범위 승인에 상대방 이름은 필요하지 않아요. 준법 확인이 필요하면 재무 담당자를 통해 요청해요.' },
      txref: { level: 'hidden', why: 'Tx가 보이면 탐색기에서 상대방 주소와 잔고가 드러날 수 있어요.' },
    },
    // 외부 검증자는 적지 않은 칸이 모두 전체 열람이에요.
    external: {},
  },
  handoff: '운용 지원이 대조를 마치면 회계 담당자에게 결산 연결과 감사자료 범위 승인을 넘겨요.',
  grant: '한결회계법인과 나래가치평가에 30일 동안 원본 열람 권한을 줘요.',
  tamper: {
    key: 'btc',
    to: '3.2800 BTC · 511,680,000원',
    story: 'BTC 수량이 바뀌면 감사인이 확인한 수량과 평가사가 계산한 평가액이 서로 어긋나요.',
  },
  captions: {
    issue: 'KODA가 기준일 잔고와 거래 내역으로 증명을 발행하고, 지문을 체인에 남겨요.',
    inside1: '수탁 잔고와 거래 3건을 장부와 한 건씩 맞춰 보고, 차이를 기록해요.',
    inside2: '결산에 쓸 값을 정하고, 감사자료에 담을 범위와 가림 기준을 승인해요.',
    grant: '두 기관에 30일 동안 권한을 주고, 원본은 KODA에 그대로 둬요.',
    external: '감사인과 평가사가 KODA 서버를 거치지 않고 각자 같은 체인 기록과 대조해요.',
    tamper: '몇 달 뒤 운영 DB에서 BTC 수량이 바뀌면 어떻게 될까요?',
    close: '감사인과 평가사가 같은 기록 하나로 잔고를 각자 확인했어요.',
  },
};

export const cases: StoryCase[] = [exportCase, gameCase, auditCase];
