import { useEffect, useState, type ReactNode } from 'react';
import { addressUrl, transactionUrl } from './wallet';
import { ArchitectureMap, type SceneId } from './ArchitectureMap';
import type { LiveStage, PresentationProps } from './presentation-types';
import './presentation.css';
import { verificationProgress } from './verification-progress';
import type { VerificationResult } from './verification';

const REVIEW_INTERVAL = 3_500;
const REVIEW_EXPLANATIONS: Record<string, string> = {
  deployment: 'Ethereum에서 배포 코드와 발급자 설정을 읽어, 조회할 컨트랙트가 맞는지 확인하는 단계입니다.',
  hash: '제3자의 브라우저에서 제출 PDF 전체 바이트의 SHA-256 해시를 계산하는 단계입니다.',
  signature: '브라우저에서 EIP-712 서명으로부터 발급자 주소를 복구해, 미리 정한 주소와 대조하는 단계입니다.',
  chain: 'Ethereum에서 등록 거래와 최종 확정을 확인하고, 같은 확정 블록의 발급자·문서 기록을 읽는 단계입니다.',
  comparison: '브라우저에서 제출 PDF·발급서명 데이터·Ethereum 기록의 해시를 대조하는 단계입니다.',
};
type ReviewControls = {
  index: number;
  playing: boolean;
  reducedMotion: boolean;
  steps: ReturnType<typeof verificationProgress>;
  select: (index: number) => void;
  toggle: () => void;
};

const SCENES: { id: SceneId; label: string }[] = [
  { id: 'intro', label: '전체 흐름' }, { id: 'pdf', label: '증명서 발급' },
  { id: 'hash', label: '해시 계산' }, { id: 'sign', label: '발급자 서명' },
  { id: 'contract', label: '검증정보 등록' }, { id: 'block', label: '등록 확정' },
  { id: 'handoff', label: '고객사 제출' }, { id: 'verify', label: '문서 검증' },
];
const LIVE_SCENE: Record<LiveStage, SceneId> = { ready: 'intro', pdf: 'pdf', hash: 'hash', sign: 'sign', register: 'contract', included: 'block', verify: 'verify', finalized: 'verify', result: 'verify' };
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
function Digest({ value }: { value?: string }) {
  return <div className="kp-digest"><span>원본의 해시</span><div className="kp-digest-mark" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ height: `${10 + (parseInt(value?.[i + 2] ?? '8', 16) % 5) * 5}px` }} />)}</div><code>{value ? short(value) : '아직 생성되지 않음'}</code></div>;
}
function Chain({ receiptBlock, finalized }: { receiptBlock?: string; finalized?: string }) {
  return <div className="kp-chain-visual" aria-label="Ethereum 블록 연결 구조 개념도"><div className="kp-chain-caption"><Icon name="chain" /><b>Ethereum</b><span>블록 연결 구조 · 개념도</span></div><div className="kp-blocks"><div className="kp-block is-context"><span>앞선 블록</span><i /><i /></div><div className="kp-block-link"><i /><span>연결</span></div><div className="kp-block is-record"><span>등록 거래가 포함된 블록</span><strong>{receiptBlock ? `#${receiptBlock}` : '블록 포함 전'}</strong><code>register(...)</code></div><div className="kp-block-link"><i /><span>연결</span></div><div className="kp-block is-context"><span>후속 블록</span><i /><i /></div></div><div className="kp-chain-status"><span>테스트 실행 관측값</span><b>{finalized ? `현재 조회한 finalized #${finalized}` : '최종 확정 여부는 별도 조회'}</b></div></div>;
}
function ChainLinks({ proof, trusted }: Pick<PresentationProps, 'proof' | 'trusted'>) { return <div className="kp-links">{proof?.transactionHash && <a href={transactionUrl(proof.transactionHash)} target="_blank" rel="noreferrer">테스트 등록 거래 ↗</a>}{trusted && <a href={addressUrl(trusted.contract)} target="_blank" rel="noreferrer">테스트 컨트랙트 ↗</a>}</div>; }

function IntroScene(props: PresentationProps) {
  return <Frame eyebrow="외부에 제출된 증명서의 검증" title="발급한 문서를, 제3자가 직접 확인합니다" description="고객사가 제출한 BTC 잔고 증명서의 출처와 원본 일치 여부를 확인합니다."><div className="kp-intro-visual"><div><span className="kp-object-label">KODA가 발급한 원본</span><Paper customer={props.customer} compact /></div><div className="kp-intro-bridge"><span>검증정보 등록</span><i /><div><Icon name="chain" /><strong>문서 검증정보</strong><small>Ethereum · DocumentRegistry</small></div><i /><span>제3자가 조회·대조</span></div><div className="kp-intro-result"><Icon name="check" /><span className="kp-object-label">제3자가 확인할 것</span><ol className="kp-questions"><li>KODA가 발급한 문서인지</li><li>발급 당시 원본과 일치하는지</li><li>이후 변경되지 않았는지</li></ol></div></div><Meaning label="우리가 추가하는 기능"><b>문서 검증정보를 Ethereum에 등록</b>하고,<br />제3자가 그 기록과 <b>제출받은 PDF를 대조</b>합니다.</Meaning><p className="kp-context-note">가상 증명서로 실제 서명·등록을 수행한 기록입니다. 제3자 검증에서는 현재 체인 기록을 다시 조회합니다.</p></Frame>;
}
function PdfScene(props: PresentationProps) {
  return <Frame eyebrow="KODA · 기존 증명서 발급 업무" title="KODA가 BTC 잔고 증명서를 발급합니다" description="법인 한 곳의 수탁 BTC 잔고를 기재한 PDF를 기준 원본으로 사용합니다."><div className="kp-pdf-stage"><Paper customer={props.customer} asOf={props.asOf} issuedAt={props.proof?.issuedAt} /><div className="kp-pdf-explanation"><span className="kp-operation-label">최종 PDF 바이트</span><h2>잔고 기준시점과<br />발급시각을 구분합니다</h2><p>기준시점은 잔고를 집계한 때, 발급시각은 문서를 만든 때입니다.</p><dl><Field label="증명 범위">법인 1곳의 KODA 수탁 BTC 전체 잔고</Field><Field label="원본 파일 크기">{props.originalSize ? `${props.originalSize.toLocaleString()} bytes` : '생성 전'}</Field></dl></div></div><Meaning>발급을 마친 <b>PDF 파일 전체</b>로 다음 단계의 해시를 계산합니다.</Meaning><Evidence><dl><Field label="PDF 시작 24 bytes">{props.pdfHeaderHex}</Field><Field label="발급 기재시각 (Unix seconds)">{props.proof?.issuedAt}</Field></dl><p>데모에서는 브라우저가 가상 PDF를 생성합니다. 실제 KODA의 양식·서버와 연동한 것은 아닙니다.</p></Evidence></Frame>;
}
function HashScene(props: PresentationProps) {
  return <Frame eyebrow="KODA 측 처리 · PDF → 해시" title="원본 PDF의 해시를 계산합니다" description="PDF의 특정 항목이 아니라, 파일 전체 바이트를 계산에 사용합니다."><div className="kp-transform"><div className="kp-file-object"><Icon name="file" /><b>원본 PDF</b><span>{props.originalSize?.toLocaleString() ?? '—'} bytes</span><div className="kp-byte-strip">25 50 44 46 …</div></div><Arrow label="전체 바이트" /><div className="kp-operation"><span>Web Crypto API</span><h2>SHA-256</h2><div className="kp-scan" aria-hidden="true"><i /><i /><i /></div><code>digest(pdfBytes)</code></div><Arrow label="32 bytes" /><Digest value={props.proof?.documentHash} /></div><Meaning>이 <b>원본 해시</b>에 문서 ID와 발급시각을 더해 서명합니다.<br />제3자도 제출받은 PDF에 같은 SHA-256 계산을 수행합니다.</Meaning><Evidence label="실제 SHA-256 값 보기"><dl><Field label="documentHash · 전체 32 bytes">{props.proof?.documentHash}</Field><Field label="실제 호출">crypto.subtle.digest('SHA-256', pdfBytes)</Field></dl><p>막대 모양은 해시 일부를 시각화한 보조 표현입니다. 판정에는 전체 해시를 사용합니다.</p></Evidence></Frame>;
}
function SignScene(props: PresentationProps) {
  return <Frame eyebrow="KODA 측 처리 · 발급자 서명" title="발급자가 문서 검증정보에 서명합니다" description="문서 ID·원본 해시·발급 기재시각을 묶어 발급자가 서명합니다."><div className="kp-sign-stage"><section className="kp-message"><span className="kp-operation-label">서명할 정보 · Document</span><dl><Field label="문서 ID">{short(props.proof?.documentId)}</Field><Field label="원본 해시">{short(props.proof?.documentHash)}</Field><Field label="발급 기재시각">{time(props.proof?.issuedAt)} KST</Field></dl></section><Arrow label="서명 요청" /><div className="kp-signing"><Icon name="key" /><h2>EIP-712</h2><b>ECDSA · secp256k1</b><span>시험 발급자 MetaMask</span></div><Arrow label="서명 생성" /><div className="kp-signature"><Icon name={props.proof?.signature ? 'check' : 'key'} /><b>발급서명</b><code>{short(props.proof?.signature)}</code></div></div><div className="kp-domain"><span>EIP-712 서명 대상 구분</span><b>chainId 11155111</b><span>+</span><code>DocumentRegistry {short(props.trusted?.contract)}</code></div><Meaning>서명에서 복구한 주소로 <b>미리 정한 발급자가 서명했는지</b> 확인할 수 있습니다. 다음 단계에서 이 정보와 서명을 등록 거래로 보냅니다.</Meaning><Evidence label="서명 원문·EIP-712 데이터 보기"><dl><Field label="domain.name / version">KodaDocumentRegistryDemo / 1</Field><Field label="domain.chainId / verifyingContract">11155111 (Sepolia 테스트넷) / {props.trusted?.contract}</Field><Field label="documentId · bytes32">{props.proof?.documentId}</Field><Field label="documentHash · bytes32">{props.proof?.documentHash}</Field><Field label="issuedAt · uint64">{props.proof?.issuedAt}</Field><Field label="시험 발급자 주소">{props.trusted?.issuer}</Field><Field label="signature · 65 bytes">{props.proof?.signature}</Field></dl><p>개인키는 MetaMask 안에 유지됩니다. 시험 발급자 주소는 공식 KODA 신원 인증을 뜻하지 않습니다.</p></Evidence></Frame>;
}
function ContractScene(props: PresentationProps) {
  const included = Boolean(props.receiptBlock || props.result?.chainRecordValid);
  return <Frame eyebrow="KODA → Ethereum · 검증정보 등록" title="문서 검증정보를 Ethereum에 등록합니다" description="register(...) 거래가 실행되면 컨트랙트가 권한과 서명을 검사합니다."><div className="kp-register-stage"><div className="kp-packet"><span>KODA 시험 발급자</span><h2>register(...)</h2><p>문서 ID · 원본 해시<br />발급시각 · 서명</p><span className="kp-packet-tag">PDF 원문 제외</span></div><Arrow label="트랜잭션" /><section className="kp-contract"><header><Icon name="chain" /><div><b>DocumentRegistry</b><span>Ethereum · Solidity / EVM</span></div></header><ol>{['허용된 발급자가 보냈는가', '발급자의 서명이 등록 정보와 일치하는가', '같은 문서 ID가 아직 없는가'].map(item => <li key={item}>{included ? <Icon name="check" /> : <i />}<span>{item}</span></li>)}</ol><div className="kp-storage"><span>통과 후 저장 · records[documentId]</span><b>원본 해시 + 발급 기재시각</b><code>{short(props.proof?.documentHash)}</code></div></section></div><Meaning label="등록 규칙과 조회">컨트랙트는 <b>같은 문서 ID의 덮어쓰기를 거부</b>합니다. 등록 거래가 확정되면 제3자도 Ethereum에서 이 기록을 읽을 수 있습니다.</Meaning><ChainLinks {...props} /><Evidence label="컨트랙트 검사·등록 입력 보기"><dl><Field label="허용 발급자">msg.sender == authorizedIssuer</Field><Field label="입력 검사">documentId ≠ 0 · documentHash ≠ 0 · issuedAt ≠ 0</Field><Field label="최초 등록 검사">records[documentId].documentHash == 0</Field><Field label="서명 검사">ECDSA.recover(_hashTypedDataV4(...), signature) == msg.sender</Field><Field label="documentId">{props.proof?.documentId}</Field><Field label="documentHash">{props.proof?.documentHash}</Field><Field label="issuedAt">{props.proof?.issuedAt}</Field><Field label="signature · 거래 입력에 포함">{props.proof?.signature}</Field><Field label="storage">documentHash · issuedAt</Field><Field label="event">DocumentRegistered(documentId, documentHash, issuedAt)</Field></dl><p>서명은 공개 거래 입력에 남습니다. PDF 원문·고객명·BTC 수량은 계약 필드에 저장하지 않습니다. 거래 value는 0 ETH이며 Sepolia 가스비는 별도입니다.</p></Evidence></Frame>;
}
function BlockScene(props: PresentationProps) {
  const included = props.result?.receiptBlockNumber ?? props.receiptBlock;
  return <Frame eyebrow="Ethereum · 블록 포함과 최종 확정" title="등록 거래가 확정됐는지 확인합니다" description="거래가 블록에 포함된 뒤, 그 블록이 finalized 범위에 들었는지 확인합니다."><Chain receiptBlock={included} finalized={props.result?.finalizedBlock} /><ol className="kp-confirmation"><li><span>1</span><b>거래 제출</b><small>{props.proof?.transactionHash ? '거래 해시 있음' : '제출 전'}</small></li><li className={included ? 'has-evidence' : ''}><span>2</span><b>블록 포함</b><small>{included ? `영수증 · #${included}` : '포함 대기'}</small></li><li className={props.result?.chainRecordValid ? 'has-evidence' : ''}><span>3</span><b>최종 확정 조회</b><small>{props.result?.chainRecordValid ? '확정 기록과 대조 완료' : '제3자 검증에서 현재 상태 조회'}</small></li></ol><Meaning>제3자는 <b>등록 블록 번호와 finalized 블록 번호를 비교</b>한 뒤, 같은 확정 블록에서 발급자와 문서 기록을 읽습니다.</Meaning><ChainLinks {...props} /><Evidence label="실제 거래·블록 값 보기"><dl><Field label="transactionHash">{props.proof?.transactionHash}</Field><Field label="등록 영수증 blockNumber">{included ?? '조회 전'}</Field><Field label="현재 조회한 finalized block">{props.result?.finalizedBlock ?? '제3자 실시간 조회 전'}</Field><Field label="판정 조건">receipt.blockNumber ≤ finalized.number · 정식 블록·이벤트 일치</Field></dl><p>블록 그림은 연결 구조를 설명합니다. 앞선 블록과 후속 블록을 별도로 조회·검증한 화면은 아닙니다.</p></Evidence></Frame>;
}
function HandoffScene(props: PresentationProps) {
  return <Frame eyebrow="고객사 → 제3자 · 증명서 제출" title="고객사가 증명서를 제출합니다" description="고객사는 KODA에서 받은 PDF를 보관하고, 외부감사인 등 제출처에 전달합니다."><div className="kp-handoff-stage"><div className="kp-customer"><span>법인 고객</span><h2>{props.customer}</h2><Paper customer={props.customer} compact /><button className="kp-outline" onClick={() => props.onDownload('original')}><Icon name="download" />원본 PDF 내려받기</button></div><Arrow label="기존 방식으로 제출" /><div className="kp-recipient"><span>제3자</span><h2>외부감사인 등<br />증빙을 받는 사람</h2><p>제출받은 PDF와 발급 당시의<br />등록 기록을 대조합니다.</p><div className="kp-reference"><Icon name="chain" /><span>Ethereum에 남아 있는<br /><b>발급 검증정보</b></span></div></div></div><Meaning>제3자는 <b>제출받은 PDF와 해당 문서의 검증정보</b>를 함께 사용합니다.</Meaning><p className="kp-preloaded">데모에서는 문서 ID·발급서명·컨트랙트·등록 거래 정보를 미리 불러옵니다. PDF에서 이 정보를 자동으로 찾는 기능은 아닙니다.</p><Evidence><dl><Field label="연결할 문서 ID">{props.proof?.documentId}</Field><Field label="기존 등록 거래">{props.proof?.transactionHash}</Field></dl><p>외부 JSON 패키지 배포는 아직 구현 범위가 아닙니다. 데모는 이미 등록된 문서와 검증정보를 함께 불러옵니다.</p></Evidence></Frame>;
}
function resultTitle(status?: string) {
  const labels: Record<string, string> = { match: '발급 원본과 일치해요', 'file-mismatch': '발급 원본과 달라요', 'signature-mismatch': '발급서명을 확인할 수 없어요', 'not-registered': '확정된 등록 기록이 없어요', pending: '최종 확정을 기다리고 있어요', unavailable: '검증에 필요한 정보를 확인하지 못했어요', invalid: '문서와 검증정보를 확인해 주세요' };
  return status ? labels[status] ?? status : '발급 원본과 대조해 보세요';
}
function VerifierScene(props: PresentationProps & { review?: ReviewControls }) {
  const { result, busy, verificationTrace: trace = [] } = props;
  const review = props.review;
  const reviewedStep = review?.steps[review.index];
  const active = trace.find(event => event.state === 'running') ?? trace.at(-1);
  const tone = result?.status === 'match' ? 'good' : ['file-mismatch', 'signature-mismatch', 'invalid'].includes(result?.status ?? '') ? 'bad' : 'neutral';
  const unresolved = !result ? '검증 전' : result.status === 'pending' ? '확정 대기' : '미확인';
  const nextAction: Record<string, string> = {
    unavailable: trace.some(event => event.id === 'sha256' && event.state === 'failure') ? 'PDF를 다시 선택한 뒤 검증해 주세요.' : '아래 처리 기록을 확인한 뒤 다시 검증해 주세요.',
    pending: '잠시 후 다시 검증해 주세요.',
    'not-registered': '문서 ID와 등록 거래가 맞는지 확인해 주세요.',
    'signature-mismatch': '발급자와 서명 정보가 맞는지 확인해 주세요.',
    invalid: '문서와 검증정보가 같은 발급 건인지 확인해 주세요.',
  };
  return <Frame eyebrow="제3자 · 문서 검증과 Ethereum 조회" title="제출받은 PDF를 발급 기록과 대조합니다" description="파일은 브라우저에서 계산하고, 등록 기록은 Ethereum에서 조회합니다.">
    <div className="kp-verification-layout">
      <section className="kp-verifier-app" aria-label="제3자 문서 검증">
        <header><strong>KODA</strong><span>제출 문서 검증</span><small>제3자 화면</small></header>
        <div className="kp-verifier-body">
          <h2>BTC 잔고 증명서</h2>
          <p className="kp-input-hint">가상 증명서의 원본과 변경본을 비교해 보세요.</p>
          <div className="kp-samples" role="group" aria-label="시연 파일 선택">
            <button disabled={busy} aria-pressed={props.selectedVariant === 'original'} className={props.selectedVariant === 'original' ? 'is-selected' : ''} onClick={() => props.onSelectSample('original')}><Icon name="file" /><span><b>발급 원본</b><small>100 BTC</small></span></button>
            <button disabled={busy} aria-pressed={props.selectedVariant === 'altered'} className={props.selectedVariant === 'altered' ? 'is-selected' : ''} onClick={() => props.onSelectSample('altered')}><Icon name="file" /><span><b>변경본</b><small>120 BTC</small></span></button>
          </div>
          <label className="kp-upload"><Icon name="upload" /><span><b>제출받은 PDF 선택</b><small>{props.selectedName ?? '10 MiB 이하 PDF'}</small></span><input disabled={busy} type="file" accept="application/pdf,.pdf" onChange={e => props.onSelectFile(e.target.files?.[0])} /></label>
          <div className="kp-proof-context"><span>{props.proof ? '미리 불러온 발급정보와 대조해요' : '발급정보를 준비하고 있어요'}</span><code>문서 ID {short(props.proof?.documentId)}</code></div>
          <button className="kp-primary" disabled={!props.canVerify || busy} onClick={props.onVerify}>{busy ? '문서 검증 중' : result ? '다시 검증하기' : '문서 검증하기'}<Icon name="arrow" /></button>
          <div className={`kp-result is-${tone}`} aria-live="polite" aria-busy={busy}>
            <h3>{busy ? '문서와 발급 기록을 확인하고 있어요' : resultTitle(result?.status)}</h3>
            <ul>
              <li><span>KODA가 발급한 문서인지</span><b>{result?.signatureValid ? '시험 서명 확인' : result?.signatureValid === false ? '확인 불가' : unresolved}</b></li>
              <li><span>발급 당시 원본과 일치하는지</span><b>{result?.fileMatch === true ? '일치' : result?.fileMatch === false ? '불일치' : unresolved}</b></li>
              <li><span>이후 변경되지 않았는지</span><b>{result?.fileMatch === true ? '변경 없음' : result?.fileMatch === false ? '변경 있음' : unresolved}</b></li>
            </ul>
            <p className="kp-result-scope">변경 여부는 현재 제출본과 발급 원본을 비교한 결과예요.</p>
            {result && !['match', 'file-mismatch'].includes(result.status) && <p className="kp-result-help">{result.message}<br />{nextAction[result.status]}</p>}
          </div>
        </div>
        <footer>시험 발급자로 시연합니다. 공식 KODA 신원·실제 BTC 잔고를 인증하지 않습니다.</footer>
      </section>
      <section className="kp-verify-process" aria-label="문서 검증 기술 처리">
        <span className="kp-operation-label">{review ? '처리 기록 다시 보기' : '검증 과정'}</span>
        {review && <div className="kp-review-controls" aria-label="처리 기록 재생">
          <button aria-label="이전 처리 기록" disabled={review.index === 0} onClick={() => review.select(review.index - 1)}><Icon name="back" /></button>
          <button aria-label={review.playing ? '처리 기록 일시정지' : '처리 기록 재생'} disabled={review.reducedMotion || review.steps.length < 2} onClick={review.toggle}><Icon name={review.playing ? 'pause' : 'play'} /></button>
          <button aria-label="다음 처리 기록" disabled={review.index === review.steps.length - 1} onClick={() => review.select(review.index + 1)}><Icon name="arrow" /></button>
          <span>{review.index + 1} / {review.steps.length}<small>{review.playing ? '3.5초씩 보기' : '직접 선택해서 보기'}</small></span>
        </div>}
        <ol>{verificationProgress(trace, busy, result).map((item, i) => <li className={`is-${item.state}${reviewedStep?.id === item.id ? ' is-reviewing' : ''}`} key={item.id} data-step={item.id}>
          <button className="kp-step-select" aria-label={`${item.title} 처리 기록 보기`} aria-current={reviewedStep?.id === item.id ? 'step' : undefined} disabled={!review || item.state === 'idle'} onClick={() => review?.select(review.steps.findIndex(step => step.id === item.id))}>{item.state === 'success' ? <Icon name="check" /> : i + 1}</button>
          <div><b>{item.title}</b><small>{item.tech}</small></div><em>{item.statusLabel}</em>
        </li>)}</ol>
        <div className="kp-now" role="status"><span>{reviewedStep ? `실행 종료 · 이 단계의 결과: ${reviewedStep.statusLabel}` : busy ? '지금 실행 중' : result ? '이번 검증 결과' : '검증 대기'}</span><b>{reviewedStep ? REVIEW_EXPLANATIONS[reviewedStep.id] : busy ? active?.operation ?? '검증 준비' : result ? resultTitle(result.status) : '문서를 선택하고 검증해 주세요'}</b></div>
        <div className="kp-signer-result"><span>서명에서 복구한 발급자</span><code>{result?.recoveredAddress ? short(result.recoveredAddress) : '서명 확인 전'}</code></div>
        <p className="kp-rpc-note">{review && <>실제 실행은 끝났습니다. 기록을 다시 보는 동안 추가 조회는 하지 않습니다.<br /></>}지갑 연결 없이 PublicNode로 조회합니다. PDF는 브라우저 안에서 처리합니다.</p>
      </section>
    </div>
    <div className={`kp-hash-ledger is-${tone}`} aria-label="세 해시 대조 결과">
      <div><span>제출 PDF · Hfile</span><code>{result?.fileHash ? short(result.fileHash) : '계산 전'}</code></div>
      <b aria-label={result?.fileMatch === true ? '같음' : result?.fileMatch === false ? '다름' : '대조 전'}>{result?.fileMatch === true ? '=' : result?.fileMatch === false ? '≠' : '·'}</b>
      <div><span>서명 데이터 · Hsigned</span><code>{props.proof?.documentHash ? short(props.proof.documentHash) : '준비 전'}</code></div>
      <b aria-label={result?.chainRecordValid === true ? '같음' : '대조 전'}>{result?.chainRecordValid === true ? '=' : '·'}</b>
      <div><span>Ethereum 기록 · Hchain</span><code>{result?.chainHash ? short(result.chainHash) : '조회 전'}</code></div>
    </div>
    <Meaning label="Ethereum 기록을 사용하는 이유">제3자가 <b>발급 당시 등록된 기준을 직접 조회</b>해 제출 문서와 대조할 수 있습니다. 발급기관에 문서의 진위를 다시 문의하는 것 외에, 공개 기록을 확인하는 경로가 생깁니다.</Meaning>
    <ChainLinks {...props} />
    <Evidence label="전체 해시·발급자·실제 조회 기록 보기">
      <dl><Field label="제출 PDF · Hfile">{result?.fileHash ?? '계산 전'}</Field><Field label="서명된 해시 · Hsigned">{result?.signedHash ?? props.proof?.documentHash}</Field><Field label="확정 체인 해시 · Hchain">{result?.chainHash ?? '조회 전'}</Field><Field label="복구한 발급자">{result?.recoveredAddress ?? '확인 전'}</Field><Field label="신뢰할 시험 발급자">{props.trusted?.issuer}</Field><Field label="문서 ID">{props.proof?.documentId}</Field><Field label="finalized block">{result?.finalizedBlock ?? '조회 전'}</Field><Field label="전체 판정">{result?.status ?? '실행 전'}</Field></dl>
      <ol className="kp-trace">{trace.map(item => <li key={item.id}><b>{item.state === 'success' ? '✓' : item.state === 'failure' ? '!' : '…'} {item.operation}</b><code>{item.detail}</code></li>)}</ol>
      <p>상단 과정은 실제 호출을 다섯 단계로 묶었습니다. 등록 이벤트 해석과 블록 높이 비교는 브라우저에서 수행합니다. 위 기록에서 개별 호출 순서와 결과를 확인할 수 있습니다.</p>
      <p>원본 일치와 변경 여부는 같은 파일 해시 대조의 두 질문입니다. 중간 변경·복원 이력 전체와 문서의 철회·현재 유효성은 확인하지 않습니다.</p>
      <p>신뢰할 공개키와 서명이 있으면 블록체인 없이도 원본 대조가 가능합니다. 이번 구현은 공개된 등록 기준과 재조회 경로를 더합니다. 공식 KODA 신원과 시험 발급자 주소를 연결하는 운영 체계는 미구현이며, 단일 공개 RPC를 신뢰하는 조건은 남습니다.</p>
    </Evidence>
  </Frame>;
}

function Scene({ id, props, review }: { id: SceneId; props: PresentationProps; review?: ReviewControls }) {
  if (id === 'intro') return <IntroScene {...props} />;
  if (id === 'pdf') return <PdfScene {...props} />;
  if (id === 'hash') return <HashScene {...props} />;
  if (id === 'sign') return <SignScene {...props} />;
  if (id === 'contract') return <ContractScene {...props} />;
  if (id === 'block') return <BlockScene {...props} />;
  if (id === 'handoff') return <HandoffScene {...props} />;
  return <VerifierScene {...props} review={review} />;
}
export function Presentation(props: PresentationProps) {
  const [index, setIndex] = useState(Math.max(0, SCENES.findIndex(item => item.id === LIVE_SCENE[props.stage])));
  const [playing, setPlaying] = useState(false);
  const [liveInspect, setLiveInspect] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); }; media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const current = props.mode === 'live' ? liveInspect ? SCENES.length - 1 : SCENES.findIndex(item => item.id === LIVE_SCENE[props.stage]) : index;
  const safeIndex = Math.max(0, current); const scene = SCENES[safeIndex]!;
  const [reviewState, setReviewState] = useState<{ result: VerificationResult; index: number; playing: boolean }>();
  const reviewSteps = verificationProgress(props.verificationTrace ?? [], false, props.result).filter(step => step.state !== 'idle');
  const canReview = scene.id === 'verify' && !props.busy && Boolean(props.result) && reviewSteps.length > 0;
  useEffect(() => {
    setReviewState(canReview && props.result ? { result: props.result, index: 0, playing: !reducedMotion && reviewSteps.length > 1 } : undefined);
  }, [canReview, props.result, reducedMotion]);
  const activeReview = canReview && reviewState?.result === props.result ? reviewState : undefined;
  useEffect(() => {
    if (!activeReview?.playing || reducedMotion) return;
    const timer = window.setTimeout(() => setReviewState(value => value && value.result === props.result
      ? value.index < reviewSteps.length - 1 ? { ...value, index: value.index + 1 } : { ...value, playing: false }
      : value), REVIEW_INTERVAL);
    return () => window.clearTimeout(timer);
  }, [activeReview, props.result, reducedMotion, reviewSteps.length]);
  const review: ReviewControls | undefined = activeReview ? {
    ...activeReview, reducedMotion, steps: reviewSteps,
    select: next => setReviewState(value => value ? { ...value, index: Math.max(0, Math.min(next, reviewSteps.length - 1)), playing: false } : value),
    toggle: () => setReviewState(value => value ? { ...value, index: !value.playing && value.index === reviewSteps.length - 1 ? 0 : value.index, playing: !value.playing } : value),
  } : undefined;
  const reviewedStep = review?.steps[review.index];
  const mapReview = reviewedStep ? { label: reviewedStep.title, detail: `${REVIEW_EXPLANATIONS[reviewedStep.id]} 결과: ${reviewedStep.statusLabel}`, stepId: reviewedStep.ids[0]!, state: reviewedStep.state } : undefined;
  useEffect(() => { if (props.mode !== 'live') return; const next = SCENES.findIndex(item => item.id === LIVE_SCENE[props.stage]); if (next >= 0) setIndex(next); if (['verify', 'finalized', 'result'].includes(props.stage)) setLiveInspect(true); else if (props.stage !== 'included') setLiveInspect(false); }, [props.mode, props.stage]);
  useEffect(() => { if (props.mode !== 'recorded' || !playing || reducedMotion || index >= SCENES.length - 1) return; const timer = window.setTimeout(() => setIndex(value => value + 1), 7_500); return () => window.clearTimeout(timer); }, [index, playing, props.mode, reducedMotion]);
  useEffect(() => { if (index === SCENES.length - 1) setPlaying(false); }, [index]);
  const go = (next: number) => { setPlaying(false); setIndex(Math.min(Math.max(next, 0), SCENES.length - 1)); };
  const togglePlayback = () => { if (safeIndex === SCENES.length - 1) { setIndex(0); setPlaying(true); } else setPlaying(value => !value); };
  const jump = () => { setPlaying(false); if (props.mode === 'live') setLiveInspect(true); else setIndex(SCENES.length - 1); };
  return <main className={`kp-root scene-${scene.id}${playing ? ' is-playing' : ''}`}><header className="kp-header"><div className="kp-brand"><strong>KODA</strong><span>증빙 전달·검증 기술 데모</span></div><div className="kp-mode"><i />{scene.id === 'verify' ? props.busy ? '실시간 조회·검증 중' : props.result ? '현재 조회 결과 · 지갑 불필요' : '검증 대기 · 지갑 불필요' : props.mode === 'recorded' ? '실제 등록 기록 · 처리 과정 다시 보기' : '새 문서 실제 처리 중'}</div></header><div className="kp-workspace"><aside className="kp-map-panel"><header><span>전체 아키텍처</span><b>발급부터 제3자 검증까지</b></header><ArchitectureMap scene={scene.id} busy={props.busy} trace={props.verificationTrace} result={props.result} receiptBlock={props.receiptBlock} review={mapReview} /><p className="kp-map-foot">데모 실행: 브라우저·MetaMask에서 발급자 처리를 수행합니다. 실제 KODA 시스템과는 연동하지 않았습니다.</p></aside><section className="kp-stage" aria-label="현재 처리 장면"><Scene key={scene.id} id={scene.id} props={props} review={review} />{props.error && <p className="kp-error" role="alert">{props.error}</p>}</section></div><nav className="kp-transport" aria-label="발표 장면 이동"><div className="kp-player"><button aria-label={liveInspect ? '현재 처리 장면으로 돌아가기' : '이전 장면'} disabled={props.mode === 'live' ? !liveInspect : safeIndex === 0} onClick={() => props.mode === 'live' ? setLiveInspect(false) : go(safeIndex - 1)}><Icon name="back" /></button><button aria-label={safeIndex === SCENES.length - 1 && !playing ? '처음부터 다시 재생' : playing ? '재생 일시정지' : '기록 재생'} disabled={props.mode === 'live' || reducedMotion || !props.proof} onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} /></button><span>{String(safeIndex + 1).padStart(2, '0')} / 08</span></div><ol>{SCENES.map((item, i) => <li key={item.id}><button disabled={props.mode === 'live'} aria-current={i === safeIndex ? 'step' : undefined} onClick={() => go(i)}><i />{item.label}</button></li>)}</ol><button className="kp-next" aria-label="다음 장면" disabled={safeIndex === SCENES.length - 1 || props.mode === 'live'} onClick={() => go(safeIndex + 1)}><Icon name="arrow" /></button>{scene.id !== 'verify' && props.canVerify && <button className="kp-jump" disabled={props.busy} onClick={jump}>직접 검증하기</button>}</nav><p className="kp-environment">기획 체인 <b>Ethereum</b><span aria-hidden="true"> · </span>실행 환경 <b>Sepolia 테스트넷</b></p><div className="kp-secondary"><details><summary>발표자 실행 준비</summary>{props.setup}</details><details><summary>실행 알림·전체 로그</summary>{props.notice && <p role="status">{props.notice}</p>}{props.evidence}</details></div></main>;
}
