/**
 * 원클릭 스토리 시연의 사례 형식.
 * 사례 하나 = 고객군 하나. 모든 사례는 같은 3축(KODA 발행 · 고객사 내부 · 외부 검증자)으로 흐른다.
 * 값은 모두 가상 데이터다. 실제 법인, 지갑 주소, 거래 상대방은 쓰지 않는다.
 */
export type Level = 'full' | 'partial' | 'hidden';
/** 고객사 내부 역할 2명 + 외부 검증자(1~3곳). */
export type ViewerId = 'inside1' | 'inside2' | 'external';

export interface StoryRole {
  /** 화면에 보이는 직함. 예: "재무 담당자" */
  title: string;
  /** 소속. 예: "한빛정밀" 또는 "한울회계법인 (가상)" */
  org: string;
  /** 이 역할이 이 문서로 하는 일, 한 문장. 예: "청구서 금액과 실제 수취 수량을 맞춰 봐요." */
  job: string;
  /** 외부 검증자 중 "자기 몫" 칸이 따로 있을 때 그 칸의 key. 이 칸은 값으로, 다른 검증자의 몫은 가림으로 보인다. */
  own?: string;
  /** 외부 검증자마다 열람 범위가 다를 때, 이 기관에만 적용할 규칙(views.external보다 우선). */
  override?: Record<string, ViewRule>;
}

export interface StoryField {
  /** 영문 소문자 키. 예: "amount", "counterparty" */
  key: string;
  /** 화면 라벨. 예: "수취 금액" */
  label: string;
  /** 원본 값(가상). 예: "25,000.00 USDC" */
  value: string;
  /** 민감 항목이면 true. 민감 항목만 역할별로 가린다. */
  sensitive: boolean;
}

/** 역할별 열람 범위. 민감 항목만 적는다(적지 않은 항목은 모두 full). partial이면 보여 줄 형태를 적는다. */
export type ViewRule = { level: Level; shown?: string; why: string };

export interface StoryCase {
  id: 'export' | 'game' | 'audit';
  company: string;          // 예: "한빛정밀"
  industry: string;         // 예: "수출 제조"
  docTitle: string;         // 예: "해외 대금 수취 증빙"
  docNo: string;            // 예: "KP-2026-1028-0101"
  asOf: string;             // 예: "2026-10-28 15:00 KST"
  headline: string;         // 사례 한 문장. 예: "해외 거래처에서 받은 USDC 대금을 청구서와 맞추고, 거래은행이 같은 증빙을 확인해요."
  issuer: StoryRole;        // KODA 쪽 발행 담당
  inside: [StoryRole, StoryRole];
  /** 외부 검증자 1~3곳. 서로 다른 기관이어야 한다(블록체인이 필요한 이유가 여기서 나온다). */
  external: StoryRole[];
  fields: StoryField[];     // 7~10개
  /** 고객사 내부 카드에 올릴 칸(최대 6개, 순서대로). 없으면 앞의 칸부터. */
  cardKeys?: string[];
  views: Record<ViewerId, Record<string, ViewRule>>;
  /** 내부 2명 사이에 일어나는 일 한 문장. 예: "재무가 대조를 마치고 회계에 결산 연결을 넘겨요." */
  handoff: string;
  /** 외부 검증자에게 권한을 줄 때의 조건 한 문장. 예: "거래은행에 30일 동안 수취 증빙 열람 권한을 줘요." */
  grant: string;
  /** "왜 블록체인" 장면에서 바뀌는 값. 반드시 fields 중 하나의 key. */
  tamper: { key: string; to: string; story: string };
  /** 장면별 자막(한 문장, 40자 안팎, "~해요" 체). */
  captions: { issue: string; inside1: string; inside2: string; grant: string; external: string; tamper: string; close: string };
}
