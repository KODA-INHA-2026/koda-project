import type { ReactNode } from 'react';
import type { PresentationProps } from './presentation-types';
import { transactionUrl } from './wallet';
import './issuer-scenes.css';

type IssueJourneyProps = PresentationProps & {
  frame: number;
  onVerifyScene: () => void;
  onFrame: (frame: number) => void;
  playing: boolean;
  onToggle: () => void;
  reducedMotion: boolean;
};

const BEATS = [
  { label: '발급', detail: 'BTC 잔고 증명서 원본을 확정합니다' },
  { label: '등록', detail: '나중에 대조할 검증정보를 Ethereum에 남깁니다' },
  { label: '전달', detail: '원본 PDF는 고객사가 보관하고 제출합니다' },
] as const;

const short = (value?: string) => value ? `${value.slice(0, 10)}…${value.slice(-6)}` : '준비 전';
const issuedTime = (value?: string) => value
  ? new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Seoul',
    }).format(new Date(Number(value) * 1000))
  : '발급 전';

function Icon({ name }: { name: 'file' | 'person' | 'play' | 'pause' | 'arrow' }) {
  const paths: Record<typeof name, ReactNode> = {
    file: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h4M9 12h6M9 16h6" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7" /></>,
    play: <path d="m9 5 10 7-10 7Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function IssueJourney(props: IssueJourneyProps) {
  const frame = Math.min(Math.max(props.frame, 0), BEATS.length - 1);
  const activeBeat = BEATS[frame] ?? BEATS[0];
  const hasSubmittedRegistration = Boolean(props.proof?.transactionHash);
  const hasRecordedRegistration = Boolean(props.proof?.transactionHash && props.receiptBlock);
  const registrationLabel = hasRecordedRegistration ? '블록 포함 확인' : hasSubmittedRegistration ? '등록 거래 제출' : '등록 준비';

  return <article className="ij-root">
    <header className="ij-heading">
      <span>01 · KODA 발급과 검증정보 등록</span>
      <h1>증명서는 고객사에, 검증정보는 Ethereum에</h1>
      <p>고객사는 BTC 잔고 증명서 원본을 보관하고, 제3자는 별도로 등록된 기준을 나중에 조회합니다.</p>
    </header>

    <section className={`ij-canvas is-frame-${frame}`} aria-label="증명서 발급, 검증정보 등록, 고객사 전달 흐름">
      <svg className="ij-routes" viewBox="0 0 1000 430" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="ij-arrow-muted" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7" /></marker>
          <marker id="ij-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7" /></marker>
        </defs>
        <path className="ij-route ij-route-delivery" d="M275 170 C440 160 590 125 740 125" markerEnd="url(#ij-arrow-muted)" />
        <path className="ij-route ij-route-register" d="M255 230 C365 285 455 328 610 338" markerEnd="url(#ij-arrow-muted)" />
        {props.playing && !props.reducedMotion && frame > 0 && <circle key={`${frame}-${props.playing}`} className="ij-moving-packet" r="6">
          <animateMotion dur="2.2s" repeatCount="1" path={frame === 1
            ? 'M255 230 C365 285 455 328 610 338'
            : 'M275 170 C440 160 590 125 740 125'} />
        </circle>}
      </svg>

      <div className="ij-koda-label"><i />KODA · 증명서 발급</div>
      <section className="ij-document" aria-label="KODA가 발급한 가상 BTC 잔고 증명서">
        <header><strong>KODA</strong><span>가상 증명서</span></header>
        <Icon name="file" />
        <h2>BTC 잔고 증명서</h2>
        <p>{props.customer}</p>
        <b>100 <small>BTC</small></b>
        <dl>
          <div><dt>잔고 기준시점</dt><dd>{props.asOf}</dd></div>
          <div><dt>발급 기재시각</dt><dd>{issuedTime(props.proof?.issuedAt)}</dd></div>
        </dl>
        <small>Bitcoin 네트워크의 네이티브 BTC</small>
      </section>

      <div className="ij-delivery-label">원본 PDF</div>
      <section className="ij-customer" aria-label="고객사가 원본 PDF를 보관하고 제출하는 업무 흐름">
        <Icon name="person" />
        <span>고객사</span>
        <h2>원본 PDF 보관</h2>
        <p>필요한 업무에서 제3자에게 제출</p>
      </section>

      <section className="ij-proof" aria-label="PDF에서 만든 검증정보">
        <span>PDF 원본에서 생성</span>
        <strong>SHA-256 · 발급서명</strong>
        <code>{short(props.proof?.documentHash)}</code>
      </section>
      <div className="ij-register-label">검증정보만 등록</div>

      <section className="ij-ethereum" aria-label={`Ethereum 문서 검증정보 ${registrationLabel}`}>
        <div className="ij-chain-blocks" aria-hidden="true"><i /><i /><i /></div>
        <div>
          <span>Ethereum · {registrationLabel}</span>
          <h2>문서 검증정보</h2>
          <p>문서 ID · 원본 해시 · 발급시각</p>
        </div>
        <small>PDF 원문과 고객 정보는 등록하지 않습니다</small>
      </section>
    </section>

    <footer className="ij-footer">
      <div className="ij-beats" aria-label="발급 흐름 설명">
        <button type="button" className="ij-play" disabled={props.reducedMotion} onClick={props.onToggle} aria-label={props.playing ? '설명 일시정지' : '설명 재생'}>
          <Icon name={props.playing ? 'pause' : 'play'} />
        </button>
        <ol>{BEATS.map((beat, index) => <li key={beat.label}>
          <button type="button" aria-current={frame === index ? 'step' : undefined} onClick={() => props.onFrame(index)}>
            <i />
            <span>{beat.label}</span>
          </button>
        </li>)}</ol>
        <p><b>{activeBeat.label}</b>{activeBeat.detail}</p>
      </div>
      <button type="button" className="ij-verify" disabled={!props.canVerify || props.busy} onClick={props.onVerifyScene}>
        제3자가 검증하기 <Icon name="arrow" />
      </button>
    </footer>

    <p className="ij-evidence-note">
      {hasRecordedRegistration
        ? <>등록은 보존된 테스트넷 거래로 확인했습니다. 고객사 전달은 실제 업무 흐름을 설명한 것입니다. <a href={transactionUrl(props.proof!.transactionHash!)} target="_blank" rel="noreferrer">등록 거래 보기 ↗</a></>
        : hasSubmittedRegistration
          ? <>등록 거래는 제출됐으며 블록 포함은 아직 확인되지 않았습니다. 고객사 전달은 실제 업무 흐름을 설명한 것입니다. <a href={transactionUrl(props.proof!.transactionHash!)} target="_blank" rel="noreferrer">제출 거래 보기 ↗</a></>
          : '등록과 고객사 전달은 현재 처리 단계에 따라 표시합니다.'}
    </p>
  </article>;
}
