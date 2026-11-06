import type { ReactNode } from 'react';
import { addressUrl, transactionUrl } from './wallet';
import type { PresentationProps } from './presentation-types';
import './issuer-scenes.css';
const short = (value?: string) => value ? `${value.slice(0, 12)}…${value.slice(-8)}` : '생성 전';
const time = (value?: string) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(Number(value) * 1000)) : '발급 전';
function Icon({ name }: { name: 'file' | 'check' | 'arrow' | 'back' | 'play' | 'pause' | 'key' | 'chain' | 'download' | 'upload' }) {
  const paths = {
    file: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v5h4M9 12h6M9 16h6" /></>,
    check: <path d="m5 12 4 4L19 6" />, arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="m14 6-6 6 6 6" />, play: <path d="m9 5 10 7-10 7Z" />,
    pause: <path d="M8 5v14M16 5v14" />, key: <><circle cx="8" cy="9" r="5" /><path d="m12 13 8 8m-4-4 3-3m-6 0 3-3" /></>,
    chain: <><path d="m10 14-3 3a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 2 3-3a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0M8 16l8-8" /></>,
    download: <><path d="M12 3v13m-5-5 5 5 5-5M5 17v4h14v-4" /></>,
    upload: <><path d="M12 17V4m-5 5 5-5 5 5M5 17v4h14v-4" /></>,
  };
  return <svg className="kp-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
function Arrow({ label }: { label?: string }) { return <div className="kp-arrow"><small>{label}</small><Icon name="arrow" /></div>; }
function Frame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <article className="kp-scene"><header className="kp-scene-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></header>{children}</article>;
}
function Meaning({ label = '이렇게 이어집니다', children }: { label?: string; children: ReactNode }) { return <aside className="kp-meaning"><span>{label}</span><p>{children}</p></aside>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="kp-field"><dt>{label}</dt><dd>{children ?? '생성 전'}</dd></div>; }
function Evidence({ children, label = '입력값과 처리 결과 보기' }: { children: ReactNode; label?: string }) { return <details className="kp-detail"><summary>{label}<span>펼치기</span></summary><div className="kp-detail-body">{children}</div></details>; }
function Paper({ customer, compact = false, asOf, issuedAt }: { customer: string; compact?: boolean; asOf?: string; issuedAt?: string }) {
  return <div className={`kp-paper${compact ? ' is-compact' : ''}`}><div className="kp-paper-top"><strong>KODA</strong><span>가상 증명서</span></div><Icon name="file" /><h3>BTC 잔고 증명서</h3><p>{customer}</p><strong className="kp-balance">100<small>BTC</small></strong>{asOf && <dl><Field label="잔고 기준시점">{asOf}</Field><Field label="발급 기재시각">{time(issuedAt)} KST</Field></dl>}<div className="kp-paper-lines"><i /><i /></div><small className="kp-paper-foot">자산: Bitcoin 네트워크의 BTC</small></div>;
}
function ChainLinks({ proof, trusted }: Pick<PresentationProps, 'proof' | 'trusted'>) { return <div className="kp-links">{proof?.transactionHash && <a href={transactionUrl(proof.transactionHash)} target="_blank" rel="noreferrer">테스트 등록 거래 ↗</a>}{trusted && <a href={addressUrl(trusted.contract)} target="_blank" rel="noreferrer">테스트 컨트랙트 ↗</a>}</div>; }


export function CustodyScene(props: PresentationProps) {
  return <Frame eyebrow="수탁과 증명서 · 기존 업무" title="KODA가 고객사의 BTC 잔고를 증명합니다" description="고객사에 발급한 증명서가 외부로 전달된 뒤에도 원본과 대조할 수 있도록 합니다.">
    <div className="kp-pdf-stage">
      <Paper customer={props.customer} asOf={props.asOf} issuedAt={props.proof?.issuedAt} />
      <div className="kp-pdf-explanation">
        <span className="kp-operation-label">제3자가 확인할 세 가지</span>
        <ol className="kp-questions"><li>KODA가 발급한 문서인지</li><li>발급 당시 원본과 일치하는지</li><li>이후 변경되지 않았는지</li></ol>
        <dl><Field label="증명 범위">법인 1곳의 KODA 수탁 BTC 전체 잔고</Field><Field label="잔고 기준시점">{props.asOf}</Field><Field label="발급 기재시각">{time(props.proof?.issuedAt)} KST</Field></dl>
      </div>
    </div>
    <div className="kp-delivery-context"><b>KODA</b><span>PDF 발급 →</span><b>고객사</b><span>보관·제출 →</span><b>외부감사인 등 제3자</b></div>
    <Meaning label="이번에 추가하는 기능">발급 원본의 <b>검증정보를 등록</b>하고, 제3자가 <b>제출받은 PDF를 그 기록과 대조</b>합니다.</Meaning>
    <Evidence label="증명서 범위와 실제 실행값"><button className="kp-outline" onClick={() => props.onDownload('original')}><Icon name="download" />원본 PDF 내려받기</button><dl><Field label="고객사">{props.customer}</Field><Field label="PDF 파일 크기">{props.originalSize?.toLocaleString()} bytes</Field><Field label="PDF 시작 24 bytes">{props.pdfHeaderHex}</Field></dl><p>잔고 기준시점은 잔고를 집계한 때, 발급시각은 문서를 만든 때입니다. 기존에 실제 서명·등록한 가상 증명서이며, KODA의 실제 양식·수탁 잔고와 연동한 자료는 아닙니다.</p></Evidence>
  </Frame>;
}
export function PrepareScene(props: PresentationProps) {
  return <Frame eyebrow="KODA 측 처리 · 원본을 식별할 기준" title="원본의 해시를 만들고, 발급자가 서명합니다" description="파일 전체의 해시와 문서 ID·발급시각을 연결해 검증정보를 만듭니다.">
    <div className="kp-prepare-flow">
      <div className="kp-file-object"><Icon name="file" /><b>발급 원본 PDF</b><span>{props.originalSize?.toLocaleString() ?? '—'} bytes</span><code>25 50 44 46 …</code><small>파일 전체 바이트</small></div>
      <Arrow label="전체 파일" />
      <div className="kp-operation"><span>브라우저 · Web Crypto</span><h2>SHA-256</h2><code>digest(pdfBytes)</code><div className="kp-prepared-hash"><small>원본 해시 · 32 bytes</small><code>{short(props.proof?.documentHash)}</code></div></div>
      <Arrow label="원본 해시" />
      <section className="kp-sign-bundle"><span>시험 발급자 · MetaMask</span><h2>EIP-712</h2><small>ECDSA · secp256k1</small><dl><Field label="문서 ID">{short(props.proof?.documentId)}</Field><Field label="원본 해시">{short(props.proof?.documentHash)}</Field><Field label="발급시각">{time(props.proof?.issuedAt)}</Field></dl><div><Icon name="key" /><b>발급서명</b><code>{short(props.proof?.signature)}</code></div></section>
    </div>
    <div className="kp-domain"><span>서명이 적용되는 범위</span><b>chainId 11155111</b><span>+</span><code>DocumentRegistry {short(props.trusted?.contract)}</code></div>
    <Meaning>다음 단계에서는 <b>문서 ID·원본 해시·발급시각·서명</b>을 등록 거래로 보냅니다. PDF 원문은 보내지 않습니다.</Meaning>
    <Evidence label="전체 해시·서명 데이터 보기"><dl><Field label="SHA-256 documentHash">{props.proof?.documentHash}</Field><Field label="documentId · bytes32">{props.proof?.documentId}</Field><Field label="issuedAt · uint64">{props.proof?.issuedAt}</Field><Field label="EIP-712 domain">KodaDocumentRegistryDemo / 1 / 11155111 (Sepolia 테스트넷) / {props.trusted?.contract}</Field><Field label="시험 발급자">{props.trusted?.issuer}</Field><Field label="signature · 65 bytes">{props.proof?.signature}</Field></dl><p>PDF 해시는 SHA-256, EIP-712 서명용 데이터 해싱은 Keccak-256을 사용합니다. 개인키는 MetaMask 안에 유지되며 시험 주소가 공식 KODA 신원을 뜻하지는 않습니다.</p></Evidence>
  </Frame>;
}
export function RegisterScene(props: PresentationProps) {
  const included = props.result?.receiptBlockNumber ?? props.receiptBlock;
  return <Frame eyebrow="KODA → Ethereum · 공개된 대조 기준" title="검증정보를 등록하고, 블록 포함을 확인합니다" description="컨트랙트가 발급자와 서명을 검사해 기록을 저장합니다. 최종 확정 여부는 제3자 검증에서 조회합니다.">
    <div className="kp-register-grid">
      <section className="kp-contract"><header><Icon name="chain" /><div><b>DocumentRegistry</b><span>Solidity / EVM · register(...)</span></div></header>
        <ol>{['허용된 발급자인가', '발급서명이 등록 정보와 일치하는가', '아직 등록되지 않은 문서 ID인가'].map(label => <li key={label}>{included ? <Icon name="check" /> : <i />}<span>{label}</span></li>)}</ol>
        <div className="kp-storage"><span>records[documentId]</span><b>원본 해시 + 발급 기재시각</b><code>{short(props.proof?.documentHash)}</code><small>같은 문서 ID의 덮어쓰기·삭제 기능 없음</small></div>
      </section>
      <section className="kp-register-chain" aria-label="등록 거래의 포함과 확정"><header><Icon name="chain" /><b>Ethereum</b><small>등록 거래의 관측값</small></header>
        <div className="kp-recorded-block"><span>등록 거래가 포함된 블록</span><strong>{included ? `#${included}` : '포함 대기'}</strong><code>DocumentRegistered</code></div>
        <div className="kp-finality-link">↓ finalized 범위와 비교</div>
        <dl><Field label="현재 조회한 확정 블록">{props.result?.finalizedBlock ? `#${props.result.finalizedBlock}` : '제3자 검증에서 조회'}</Field><Field label="확정 기록 대조">{props.result?.chainRecordValid ? '대조 완료' : '아직 확인하지 않음'}</Field></dl>
      </section>
    </div>
    <Meaning label="이제 제3자가 확인할 기준이 생깁니다">등록된 원본 해시를 제3자가 조회해, <b>제출받은 PDF의 해시와 직접 대조</b>합니다.</Meaning>
    <ChainLinks {...props} />
    <Evidence label="등록 입력·검사 규칙·거래 보기"><dl><Field label="등록 입력">documentId · documentHash · issuedAt · signature</Field><Field label="발급자 제한">msg.sender == authorizedIssuer</Field><Field label="서명 확인">ECDSA.recover(_hashTypedDataV4(...), signature) == msg.sender</Field><Field label="최초 등록">records[documentId].documentHash == 0</Field><Field label="거래 해시">{props.proof?.transactionHash}</Field><Field label="전체 원본 해시">{props.proof?.documentHash}</Field><Field label="문서 ID">{props.proof?.documentId}</Field><Field label="발급 기재시각">{props.proof?.issuedAt}</Field><Field label="확정 판정">등록 블록 ≤ finalized 블록 · 정식 블록 및 등록 이벤트 일치</Field></dl><p>등록과 최종 확정은 구분합니다. 서명은 거래 입력에 포함되고 PDF 원문·고객명·문서에 기재된 잔고는 컨트랙트에 직접 저장하지 않습니다. 거래 value는 0 ETH이며 테스트넷 가스비는 별도입니다.</p></Evidence>
  </Frame>;
}
