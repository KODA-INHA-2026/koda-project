import type { PresentationProps } from './presentation-types';
import { transactionUrl } from './wallet';
import { DEMO_CUSTODY_SNAPSHOT } from './certificate';
import './issuer-scenes.css';

type IssueJourneyProps = PresentationProps & {
  phase: 0 | 1 | 2;
  onNext: () => void;
  onPrevious: () => void;
};

const SCENES = [
  { label: '01 · 원본 발급', title: 'KODA의 수탁정보로 잔고 증명서를 만듭니다', description: '법인 한 곳의 수탁 BTC 전체 잔고를, 기준시점과 함께 PDF에 담습니다.', next: '02 · 이 문서의 해시와 서명', takeaway: '이 PDF가 이후 대조할 발급 원본입니다.' },
  { label: '02 · 전자서명·해시 생성', title: '원본의 해시를 만들고, 발급자가 서명합니다', description: '같은 PDF의 바이트를 SHA-256으로 계산하고, 문서 ID·해시·발급시각에 서명합니다.', next: '03 · 검증정보를 Ethereum에 등록', takeaway: '해시는 파일 대조에, 서명은 발급자 확인에 사용합니다.' },
  { label: '03 · 블록체인 기록', title: 'Ethereum에 기록하고, 고객사에 전달합니다', description: '문서 ID로 다시 찾을 수 있도록 검증정보를 등록합니다. 고객사는 PDF와 검증정보를 받아 제출합니다.', next: '04 · 전달받은 파일 검증하기', takeaway: '이제 제3자가 제출 파일을 등록 기록과 대조할 수 있습니다.' },
] as const;

const short = (value?: string) => value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '준비 전';
const issuedTime = (value?: string) => value
  ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(Number(value) * 1000))
  : '발급 전';

function FileIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6M9 16h6" /></svg>;
}

function Certificate({ customer, asOf, proof, compact = false }: Pick<PresentationProps, 'customer' | 'asOf' | 'proof'> & { compact?: boolean }) {
  return <section className={`ij-document${compact ? ' is-compact' : ''}`} aria-label="같은 발급 원본 PDF">
    <header><strong>KODA</strong><span>가상 증명서</span></header>
    <FileIcon />
    <h2>BTC 잔고 증명서</h2><p>{customer}</p>
    <b>{Number(DEMO_CUSTODY_SNAPSHOT.quantity)} <small>BTC</small></b>
    <dl><div><dt>잔고 기준시점</dt><dd>{asOf}</dd></div><div><dt>발급 기재시각</dt><dd>{issuedTime(proof?.issuedAt)}</dd></div></dl>
    <small>Bitcoin 네트워크의 네이티브 BTC</small>
  </section>;
}

function FlowArrow({ label, detail }: { label: string; detail?: string }) {
  return <div className="ij-flow-arrow"><span>{label}</span><i aria-hidden="true" />{detail && <small>{detail}</small>}</div>;
}

export function IssueJourney(props: IssueJourneyProps) {
  const { phase, proof } = props;
  const scene = SCENES[phase];
  const included = Boolean(proof?.transactionHash && props.receiptBlock);
  const submitted = Boolean(proof?.transactionHash);
  const registrationLabel = included ? '블록 포함 확인' : submitted ? '등록 거래 제출' : '등록 준비';

  return <article className={`ij-root ij-phase-${phase}`} data-issuance-stage={phase + 1}>
    <header className="ij-heading"><span>{scene.label}</span><h1>{scene.title}</h1><p>{scene.description}</p></header>
    <div className="ij-continuity"><FileIcon /><span>{props.customer} <b>BTC 잔고 증명서</b></span><small>문서 ID <code>{short(proof?.documentId)}</code></small></div>

    <div className="ij-canvas" key={phase}>
      {phase === 0 && <div className="ij-issue-flow">
        <section className="ij-source" aria-label="PDF 생성에 사용하는 가상 KODA 수탁정보">
          <span className="ij-location">KODA · 수탁정보</span><h2>증명서에 담을 잔고</h2>
          <dl><div><dt>법인</dt><dd>{props.customer}</dd></div><div><dt>수탁 BTC 전체 잔고</dt><dd className="ij-source-balance">{Number(DEMO_CUSTODY_SNAPSHOT.quantity)} <small>BTC</small></dd></div><div><dt>잔고 기준시점</dt><dd>{props.asOf}</dd></div></dl>
          <p>시연용 가상 데이터<br />실제 수탁 원장과 연동한 값은 아닙니다.</p>
        </section>
        <FlowArrow label="같은 정보로" detail="PDF 생성" />
        <Certificate {...props} />
      </div>}

      {phase === 1 && <div className="ij-proof-flow">
        <Certificate {...props} compact />
        <FlowArrow label="PDF 전체 바이트" />
        <section className="ij-crypto" aria-label="KODA 발급 과정의 해시 계산과 전자서명">
          <div className="ij-hash-step"><span className="ij-location">KODA 발급 과정 · Web Crypto</span><h2>SHA-256 <span>원본 해시</span></h2><code className="ij-digest">{short(proof?.documentHash)}</code><p>같은 파일인지 대조할 값</p></div>
          <div className="ij-signing-link"><span aria-hidden="true">↓</span> 문서 ID + 원본 해시 + 발급시각</div>
          <div className="ij-sign-step"><span className="ij-location">발급자 지갑 · EIP-712 / ECDSA</span><h2>전자서명</h2><p>지정된 발급자의 서명인지 확인할 근거</p><div className="ij-signature"><span aria-hidden="true">⌁</span><span>{proof?.signature ? '시험 발급자의 서명' : '발급자 서명 준비 전'}</span><code>{short(proof?.signature)}</code></div></div>
        </section>
      </div>}

      {phase === 2 && <>
        <div className="ij-register-flow">
          <section className="ij-register-input" aria-label="발급자가 등록할 문서 검증정보">
            <span className="ij-location">KODA · 시험 발급자</span><h2>문서 검증정보</h2>
            <dl><div><dt>문서 ID</dt><dd><code>{short(proof?.documentId)}</code></dd></div><div><dt>원본 해시</dt><dd><code>{short(proof?.documentHash)}</code></dd></div><div><dt>발급시각</dt><dd>{issuedTime(proof?.issuedAt)}</dd></div></dl>
            <p>발급자 서명을 함께 제출</p>
          </section>
          <FlowArrow label="등록 거래" detail="register() · 발급자 가스 부담" />
          <section className="ij-ethereum" aria-label={`Ethereum 문서 검증정보 ${registrationLabel}`}>
            <span className="ij-location">문서 검증정보를 기록하는 곳</span><h2>Ethereum</h2>
            <svg className="ij-chain" viewBox="0 0 320 108" aria-hidden="true"><path className="ij-chain-link" d="M50 62H102M210 62h58" /><g className="ij-chain-side"><path d="M8 42h42v42H8ZM8 42l10-10h42L50 42M50 42l10-10v42L50 84M268 42h42v42h-42ZM268 42l10-10h42l-10 10M310 42l10-10v42l-10 10" /></g><path className="ij-chain-top" d="M102 27l21-20h108l-21 20Z"/><path className="ij-chain-depth" d="M210 27l21-20v76l-21 20Z"/><path className="ij-chain-front" d="M102 27h108v76H102Z"/><path className="ij-chain-lines" d="M119 48h72M119 63h72M119 78h47"/></svg>
            <div className="ij-stored-record"><b>DocumentRegistry</b><code>{short(proof?.documentHash)}</code><small>{registrationLabel}{included ? ` · #${props.receiptBlock}` : ''}</small></div>
            <p>지정 발급자만 등록 · 같은 ID 덮어쓰기 금지</p><small>PDF 원문과 BTC 수량은 저장하지 않습니다.</small>
          </section>
        </div>
        <div className="ij-handoff" aria-label="KODA에서 고객사를 거쳐 제3자에게 전달하는 두 파일">
          <div><span className="ij-location">KODA가 발급</span><strong><FileIcon />PDF <span>+</span> 검증정보 JSON</strong></div><i aria-hidden="true">→</i>
          <div><span className="ij-location">고객사</span><strong>두 파일을 받아 보관·제출</strong></div><i aria-hidden="true">→</i>
          <div><span className="ij-location">제3자</span><strong>전달받은 파일 검증</strong></div>
        </div>
      </>}
    </div>

    <footer className="ij-footer"><p>{scene.takeaway}</p>
      <div className="ij-controls">
        {phase > 0 && <button className="ij-back" disabled={props.busy} onClick={props.onPrevious}>이전 단계</button>}
        {phase === 2 && <div className="ij-downloads"><span>시연 자료 받기</span><button disabled={!props.canDownload || props.busy} onClick={() => props.onDownload('original')}>PDF 받기</button><button disabled={!props.canDownload || props.busy} onClick={props.onDownloadProof}>검증정보 받기</button></div>}
        <button className="ij-next" disabled={props.busy} onClick={props.onNext}>{scene.next}<span aria-hidden="true">→</span></button>
      </div>
    </footer>
    {phase === 2 && <p className="ij-evidence-note">{included ? <>{props.mode === 'recorded' ? '보존된 시험 거래의 등록 기록입니다.' : '등록 거래의 블록 포함을 확인했습니다.'} 최종 확정은 검증 시 다시 확인합니다. <a href={transactionUrl(proof!.transactionHash!)} target="_blank" rel="noreferrer">실제 등록 거래 보기 ↗</a></> : submitted ? <>등록 거래를 제출했습니다. 블록 포함은 아직 확인되지 않았습니다. <a href={transactionUrl(proof!.transactionHash!)} target="_blank" rel="noreferrer">제출 거래 보기 ↗</a></> : '등록 준비 전입니다. 장면을 넘기는 것만으로 거래가 실행되지는 않습니다.'}</p>}
  </article>;
}
