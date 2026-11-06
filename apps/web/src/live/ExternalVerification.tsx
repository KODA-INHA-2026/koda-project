import { useEffect, useState } from 'react';
import './external-verification.css';

type Run = { status: string; message: string; fileHash?: string; signedHash?: string; chainHash?: string; receiptBlockNumber?: string; finalizedBlock?: string; documentId?: string; checkedAt?: string };
type Manifest = { packageFile: string; generatedAt: string; runtime: string; command: string; rpc: string; runs: { original: Run; altered: Run }; files: string[] };
const short = (value?: string) => value ? `${value.slice(0, 12)}…${value.slice(-8)}` : '확인 전';

export function ExternalVerification() {
  const [manifest, setManifest] = useState<Manifest>();
  const [variant, setVariant] = useState<'original' | 'altered'>('original');
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}external-verifier/manifest.json`)
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(value => { if (active) setManifest(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const run = manifest?.runs[variant];
  const matches = run?.status === 'match';
  return <article className="ev-root">
    <header className="ve-stage-heading"><span>03 · 외부 검증 방식 · 검토용 초안</span><h1>수신자의 환경에서도 같은 자료를 검증합니다</h1><p>공개된 검증 규격과 코드를 실행해, 같은 PDF를 같은 Ethereum 기록과 대조합니다.</p></header>
    <div className="ev-route" aria-label="외부 검증 입력과 조회 흐름">
      <section><small>고객사가 제출</small><strong>PDF + 검증정보</strong><p>02에서 사용한 같은 두 파일</p></section><span aria-hidden="true">→</span>
      <section className="is-local"><small>외부 수신자 · 자신의 컴퓨터</small><strong>공개 검증 코드 실행</strong><p>파일 해시 · 발급서명 · 등록 기록 대조</p></section><span aria-hidden="true">↔</span>
      <section><small>조회할 공통 기준</small><strong>Ethereum</strong><p>같은 DocumentRegistry</p></section>
    </div>
    <div className="ev-workbench">
      <section className="ev-package">
        <span className="ev-kicker">직접 재현하기</span><h2>검증에 필요한 자료를 함께 제공합니다</h2>
        <ul><li><strong>검증 규격</strong><span>입력 형식과 판정 조건</span></li><li><strong>실행 코드</strong><span>대시보드와 같은 검증 로직</span></li><li><strong>공개 신뢰 기준</strong><span>미리 확인한 발급자와 컨트랙트</span></li></ul>
        {manifest ? <a className="ev-download" href={`${import.meta.env.BASE_URL}external-verifier/${manifest.packageFile}`} download>외부 검증 초안 받기 <span aria-hidden="true">↓</span></a> : <p role="status">{error ? '실행 자료를 불러오지 못했습니다. 페이지를 다시 열어 주세요.' : '실행 자료를 불러오고 있습니다.'}</p>}
        <p className="ev-note">지갑이나 서명 승인은 필요하지 않습니다. Node.js 실행 환경과 Ethereum 조회 연결을 사용합니다.</p>
      </section>
      <section className="ev-run" aria-label="별도 환경에서 실행한 실제 검증 결과">
        <header><div><small>별도 Node.js 환경</small><h2>실제 실행 기록</h2></div><span>기록 보기</span></header>
        <div className="ev-run-select" role="group" aria-label="외부 실행 기록 선택"><button aria-pressed={variant === 'original'} onClick={() => setVariant('original')}>발급 원본</button><button aria-pressed={variant === 'altered'} onClick={() => setVariant('altered')}>120 BTC 변경본</button></div>
        <div className="ev-command"><span>실행 명령</span><code>{manifest?.command ?? '실행 자료 확인 중'}</code></div>
        {run && <div className={`ev-verdict ${matches ? 'is-match' : 'is-mismatch'}`}><span aria-hidden="true">{matches ? '✓' : '×'}</span><strong>{matches ? '등록 원본과 일치' : run.status === 'file-mismatch' ? '등록 원본과 불일치' : '검증 미완료'}</strong></div>}
        <dl><div><dt>제출 PDF 해시</dt><dd>{short(run?.fileHash)}</dd></div><div><dt>Ethereum 등록 해시</dt><dd>{short(run?.chainHash)}</dd></div><div><dt>조회 기준 블록</dt><dd>{run?.finalizedBlock ?? '확인 전'} <small>finalized</small></dd></div></dl>
        <p className="ev-note">이 화면은 별도 실행 결과를 보여줍니다. 자료를 내려받으면 본인의 환경에서 새로 조회할 수 있습니다.</p>
        {run?.checkedAt && <time dateTime={run.checkedAt}>{new Date(run.checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST 실행</time>}
      </section>
    </div>
    <aside className="ev-feedback"><strong>KODA에 확인할 부분</strong><p>제3자에게 대시보드 이용을 제공할지, 별도 검증 도구를 배포할지 두 방식을 비교하기 위한 초안입니다. 실제 이용 권한과 운영 방식은 아직 정하지 않았습니다.</p></aside>
    <details className="ve-evidence"><summary>외부 검증의 범위와 신뢰 기준</summary><p>같은 코드를 다른 환경에서 실행할 수 있다는 의미입니다. 독립된 기관의 코드 감사를 받았다는 뜻은 아닙니다. 제출 JSON이 발급자나 조회 서버를 임의로 지정하지 못하도록 하고, 공개 패키지에 고정한 발급자·계약과 대조합니다. RPC 응답에 대한 의존은 남으며, 별도 노드·조회 경로의 선택은 운영 설계에서 정해야 합니다.</p><p>SHA-256, EIP-712/ECDSA, 컨트랙트와 판정 규칙은 02와 같습니다. 새 배포·서명·거래 없이 기존 등록 기록을 조회합니다.</p></details>
  </article>;
}
