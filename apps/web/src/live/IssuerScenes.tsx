import { useState } from 'react';
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
  { label: '01 · 원본 발급', title: 'KODA가 잔고 증명서 원본을 만듭니다', description: '외부감사를 준비하는 고객사의 요청에 따라, 기준시점의 수탁정보를 PDF에 담습니다.', next: '02 · 원본에 해시와 서명 연결', output: 'PDF 원본', use: '이 파일을 그대로 읽어 해시를 계산합니다.' },
  { label: '02 · 전자서명·해시 생성', title: '이 PDF의 해시에 발급자가 서명합니다', description: '어떤 문서에 누가 서명했는지, 나중에 대조할 근거를 만듭니다.', next: '03 · 서명한 정보를 등록', output: '문서 정보 + 발급자 서명', use: '다음 단계의 등록 거래에 함께 제출합니다.' },
  { label: '03 · 블록체인 기록', title: '원본의 대조 기준을 Ethereum에 남깁니다', description: '등록 기록은 체인에, PDF와 검증정보는 고객사에게 전달됩니다.', next: '04 · 받은 파일로 대조·검증', output: 'PDF + 검증정보 JSON', use: '고객사가 보관하고, 은행·거래상대방·감사인에게 제출합니다.' },
] as const;

const short = (value?: string) => value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '준비 전';
const issuedTime = (value?: string) => value
  ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(Number(value) * 1000))
  : '발급 전';

function FileIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6M9 16h6" /></svg>;
}

function Certificate({ customer, asOf, proof, compact = false }: Pick<PresentationProps, 'customer' | 'asOf' | 'proof'> & { compact?: boolean }) {
  return <section className={`ij-document${compact ? ' is-compact' : ''}`} aria-label="발급 원본 PDF 내용 요약">
    <header><strong>KODA</strong><span>가상 증명서</span></header>
    <FileIcon /><h2>BTC 잔고 증명서</h2><p>{customer}</p>
    <b>{Number(DEMO_CUSTODY_SNAPSHOT.quantity)} <small>BTC</small></b>
    {!compact && <dl><div><dt>잔고 기준시점</dt><dd>{asOf}</dd></div><div><dt>발급시각</dt><dd>{issuedTime(proof?.issuedAt)}{proof?.issuedAt ? ' KST' : ''}</dd></div><div><dt>문서 ID</dt><dd><code>{short(proof?.documentId)}</code></dd></div></dl>}
    <small>{compact ? '파일 전체를 읽습니다' : 'PDF 원본 · 내용 요약'}</small>
    <i className="ij-document-scan" aria-hidden="true" />
  </section>;
}

function FlowArrow({ label, detail, packet }: { label: string; detail?: string; packet: string }) {
  return <div className="ij-flow-arrow"><span>{label}</span><i aria-hidden="true"><em>{packet}</em></i>{detail && <small>{detail}</small>}</div>;
}

function DocumentFields({ proof }: Pick<PresentationProps, 'proof'>) {
  return <dl className="ij-document-fields">
    <div><dt>문서 ID</dt><dd><code>{short(proof?.documentId)}</code></dd></div>
    <div className="ij-hash-field"><dt>원본 해시</dt><dd><code>{short(proof?.documentHash)}</code></dd></div>
    <div><dt>발급시각</dt><dd>{issuedTime(proof?.issuedAt)}</dd></div>
  </dl>;
}

export function IssueJourney(props: IssueJourneyProps) {
  const { phase, proof } = props;
  const [replay, setReplay] = useState(0);
  const scene = SCENES[phase];
  const included = Boolean(proof?.transactionHash && props.receiptBlock);
  const submitted = Boolean(proof?.transactionHash);
  // Use preserved issuer evidence, never recipient results or elapsed time, for this replay.
  const replayAvailable = props.mode === 'recorded' && Boolean(proof?.documentHash && proof?.signature) && (phase !== 2 || included);
  const registrationLabel = included ? '블록 포함 확인' : submitted ? '거래 제출 · 블록 포함 확인 전' : '등록 준비 전';
  const output = phase !== 2 || props.canDownload ? scene.output : included ? '블록에 포함된 등록 기록' : submitted ? '제출한 등록 거래' : '등록할 문서 정보와 서명';
  const outputUse = phase !== 2 || props.canDownload ? scene.use : included ? '공개 검증 기준과 연결된 뒤 전달용 파일을 받을 수 있습니다.' : '등록 거래의 블록 포함을 확인한 뒤 전달용 파일을 준비합니다.';

  return <article className={`ij-root ij-phase-${phase}`} data-issuance-stage={phase + 1}>
    <header className="ij-heading"><span>{scene.label}</span><h1>{scene.title}</h1><p>{scene.description}</p></header>
    <div className="ij-playback"><span>{props.mode === 'recorded' ? '보존된 실제 시험 결과 · 처리 흐름 재생' : '현재 발급 준비 상태'}</span>
      {replayAvailable && <button onClick={() => setReplay(value => value + 1)} disabled={props.busy} aria-label="현재 단계의 처리 흐름 다시 보기"><span aria-hidden="true">↻</span> 흐름 다시 보기</button>}
    </div>

    <div className={`ij-canvas${replayAvailable ? ' is-replaying' : ''}`} key={`${phase}-${replay}-${replayAvailable}`}>
      {phase === 0 && <>
        <div className="ij-place-heading"><b>KODA</b><span>발급 처리 · 데모에서는 브라우저</span></div>
        <div className="ij-issue-flow">
          <section className="ij-source" aria-label="PDF 생성에 사용하는 가상 수탁정보">
            <span className="ij-object-label">입력</span><h2>기준시점의 수탁정보</h2>
            <dl><div><dt>법인</dt><dd>{props.customer}</dd></div><div><dt>수탁 BTC 전체 잔고</dt><dd className="ij-source-balance">{Number(DEMO_CUSTODY_SNAPSHOT.quantity)} <small>BTC</small></dd></div><div><dt>잔고 기준시점</dt><dd>{props.asOf}</dd></div></dl>
            <small>실제 수탁 원장과 연동하지 않은 가상 데이터</small>
          </section>
          <FlowArrow label="PDF 생성" detail="문서 ID·발급시각 부여" packet="수탁정보" />
          <Certificate {...props} />
        </div>
      </>}

      {phase === 1 && <>
        <div className="ij-place-heading"><b>KODA</b><span>원본 해시 계산 → 발급자에게 서명 요청</span></div>
        <div className="ij-proof-flow">
          <section className="ij-browser-work" aria-label="브라우저에서 PDF 해시 계산과 서명할 정보 구성">
            <div className="ij-zone-label">브라우저 <span>PDF와 문서 정보 처리</span></div>
            <div className="ij-browser-flow">
              <Certificate {...props} compact />
              <FlowArrow label="SHA-256" detail="Web Crypto API로 계산" packet="해시" />
              <section className="ij-proof-packet" aria-label="EIP-712 서명 대상과 반환된 서명">
                <span className="ij-object-label">EIP-712 · 세 항목을 묶어 서명</span><h2>서명할 문서 정보</h2>
                <DocumentFields proof={proof} />
                <div className={`ij-attached-signature${proof?.signature ? ' has-signature' : ''}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 13 5 5L20 6" /></svg><span>{proof?.signature ? '발급자 서명 연결' : '발급자 서명 준비 전'}</span></div>
              </section>
            </div>
          </section>
          <div className="ij-sign-exchange" aria-label="브라우저가 지갑에 서명을 요청하고 서명값을 돌려받음">
            <FlowArrow label="서명 요청" packet="문서 정보" />
            <div className="ij-return-arrow"><FlowArrow label="서명값 반환" packet="서명" /></div>
          </div>
          <section className="ij-wallet" aria-label="MetaMask에서 시험 발급자 개인키로 전자서명">
            <div className="ij-zone-label">시험 발급자 <span>MetaMask</span></div>
            <svg className="ij-key-icon" viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="12" width="46" height="40" rx="5"/><circle cx="28" cy="31" r="7"/><path d="M35 31h12m-5 0v6"/></svg>
            <h2>내용 확인·승인</h2><p>개인키로 서명</p><small>개인키는 지갑에 남고<br />서명값만 돌아옵니다.</small>
          </section>
        </div>
        <p className="ij-boundary-note"><FileIcon />PDF 원본은 그대로 <span>체인 기록·거래 가스비 없음</span></p>
      </>}

      {phase === 2 && <>
        <div className="ij-register-flow">
          <section className="ij-register-input" aria-label="KODA가 등록 거래에 제출하는 문서 정보와 서명">
            <div className="ij-place-heading"><b>KODA</b><span>발급자</span></div>
            <h2>서명한 문서 정보</h2><DocumentFields proof={proof} />
            <div className="ij-submitted-signature">{proof?.signature ? '+ 발급자 서명' : '발급자 서명 준비 전'}</div>
            <div className="ij-stays-outside"><FileIcon /><span>PDF 원본은 체인 밖에 보관</span></div>
          </section>
          <FlowArrow label="등록 거래" detail="MetaMask 승인·제출 / 발급자가 가스 부담" packet="검증정보" />
          <section className="ij-ethereum" aria-label={`Ethereum 문서 검증정보 ${registrationLabel}`}>
            <div className="ij-place-heading"><b>Ethereum</b><span>문서 검증정보 기록</span></div>
            <div className="ij-contract-rule"><span>우리가 만든 스마트컨트랙트</span><p>발급자·서명 확인 <i aria-hidden="true">→</i> 같은 문서 ID는 한 번만 등록</p></div>
            <div className={`ij-chain-record${included ? ' is-included' : ''}`}>
              <svg className="ij-chain" viewBox="0 0 150 118" aria-hidden="true"><path className="ij-chain-link" d="M0 65h24m101 0h25"/><path className="ij-chain-top" d="m24 29 21-20h80l-21 20Z"/><path className="ij-chain-depth" d="m104 29 21-20v76l-21 20Z"/><path className="ij-chain-front" d="M24 29h80v76H24Z"/><path className="ij-chain-lines" d="M38 49h52M38 65h52M38 81h31"/></svg>
              <div className="ij-stored-record"><span className="ij-object-label">{included ? '등록된 대조 기준' : '등록할 대조 기준'}</span><h2>문서 ID → 원본 해시</h2><code>{short(proof?.documentHash)}</code><small>발급시각도 함께 보관</small><span className="ij-inclusion">{registrationLabel}{included ? ` · #${props.receiptBlock}` : ''}</span></div>
            </div>
            <p className="ij-chain-limit">PDF 원문·고객명·BTC 수량은 저장하지 않습니다.</p>
          </section>
        </div>
        <div className={`ij-receipt-return${included ? ' has-receipt' : ''}`}><span>{included ? '블록 포함 확인 → 등록 거래 정보 수신' : '등록 거래 정보는 블록 포함 확인 후 수신'}</span><i aria-hidden="true"><em>거래 정보</em></i></div>
        <div className={`ij-handoff${props.canDownload ? ' is-ready' : ' is-pending'}`} aria-label={props.canDownload ? '고객사와 제3자에게 전달할 수 있는 PDF와 검증정보 JSON' : '등록 확인 후 이어질 파일 전달 과정'}>
          <div className="ij-file-pair"><span className="ij-location">KODA</span><strong><FileIcon />PDF <span>+</span> <span className="ij-json-icon">{'{ }'}</span>JSON</strong><small>{props.canDownload ? '내려받을 때 검증정보 JSON 구성' : '자료 준비 후 전달'}</small></div>
          <FlowArrow label={props.canDownload ? '발급·전달' : '전달 준비 전'} packet="PDF + JSON" />
          <div className="ij-customer"><span className="ij-location">고객사</span><strong>보관하고 제출</strong><small>{props.customer}</small></div>
          <FlowArrow label="업무상 제출" packet="PDF + JSON" />
          <div className="ij-recipient"><span className="ij-location">제3자</span><strong>두 파일로 대조·검증</strong><small>다음 장면에서 직접 확인</small></div>
        </div>
      </>}
    </div>

    <footer className="ij-footer">
      <div className="ij-output"><span>다음으로 이어지는 결과</span><p>{output}</p><small>{outputUse}</small></div>
      <div className="ij-controls">
        {phase > 0 && <button className="ij-back" disabled={props.busy} onClick={props.onPrevious}>이전 단계</button>}
        <button className="ij-next" disabled={props.busy} onClick={props.onNext}>{scene.next}<span aria-hidden="true">→</span></button>
      </div>
    </footer>
    {phase === 2 && <div className="ij-delivery-tools"><div className="ij-downloads"><span>실제 시연 파일</span><button disabled={!props.canDownload || props.busy} onClick={() => props.onDownload('original')}>PDF 받기</button><button disabled={!props.canDownload || props.busy} onClick={props.onDownloadProof}>검증정보 JSON 받기</button></div>
      <p className="ij-evidence-note">{included ? <><a href={transactionUrl(proof!.transactionHash!)} target="_blank" rel="noreferrer">실제 등록 거래 ↗</a><span>최종 확정은 검증 시 다시 확인</span></> : submitted ? <a href={transactionUrl(proof!.transactionHash!)} target="_blank" rel="noreferrer">제출 거래 보기 ↗</a> : '등록 거래 제출 전'}</p></div>}
    <details className="ve-evidence"><summary>처리 위치와 구현 범위</summary>
      <p>{props.mode === 'recorded' ? '보존된 실제 시험 발급·등록 결과로 처리 흐름을 보여줍니다. 장면 이동이나 흐름 재생으로 새 서명이나 거래를 실행하지 않습니다.' : '현재 발급 준비 상태입니다. 서명·등록은 아래 발표자 실행 준비에서 시험 발급자가 승인하면 진행됩니다.'}</p>
      {phase === 0 && <p>고객사의 대시보드 요청 이후 KODA 내부 서버가 권한과 수탁정보를 확인하고 PDF를 생성하는 구성을 제안합니다. 실제 KODA 발급 시스템과 연동한 것은 아니며, 이번 데모는 가상 수탁정보로 브라우저에서 PDF를 생성합니다. 잔고 기준시점은 언제의 잔고인지, 발급시각은 그 증명서를 언제 만들었는지를 뜻합니다.</p>}
      {phase === 1 && <p>Web Crypto는 브라우저가 제공하는 암호 API이고, SHA-256은 해시 계산 규칙입니다. 서버에서도 같은 규칙으로 계산할 수 있습니다. EIP-712는 문서 ID·원본 해시·발급시각과 서비스·체인·컨트랙트 정보를 정해진 형식으로 서명하는 이더리움 표준입니다. 이 서명은 PDF에 삽입하지 않고 별도로 보관합니다. MetaMask는 KODA의 발급 역할을 대신하는 시험 지갑이며 고객 BTC 보관 지갑과는 별개입니다.</p>}
      {phase === 2 && <p>DocumentRegistry는 우리가 작성한 등록·조회 스마트컨트랙트의 이름입니다. Ethereum이 제공하는 기본 서비스 이름은 아닙니다. viem으로 등록 호출을 준비하고, MetaMask가 승인한 거래를 제출하면 Ethereum 노드가 컨트랙트를 실행합니다. 등록 거래가 블록에 포함된 것을 확인한 뒤 다운로드할 때 문서 정보·발급서명·조회할 체인과 컨트랙트·거래 해시를 검증정보 JSON에 담습니다. 수신자는 별도로 최종 확정과 등록 원본을 확인합니다.</p>}
    </details>
  </article>;
}
