import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bytesToHex, isAddress, type Address, type Hex } from 'viem';
import { createCertificate, AS_OF, CUSTOMER } from './certificate';
import { addressUrl, artifact, connectWallet, deployRegistry, inspectDeployment, publicClient, recoverDeployment, registerDocument, restoreWallet, RPC_URL, signDocument, transactionUrl, type Connection } from './wallet';
import { getDeploymentProgress, type DeploymentProgress } from './deployment-progress';
import { sha256, verifyDocument, type Proof, type TrustedDeployment, type VerificationResult, type VerificationTraceEvent } from './verification';
import { loadIssuance, saveIssuance, type SavedIssuance } from './storage';
import { Presentation } from './Presentation';
import type { LiveStage } from './presentation-types';
import { loadRecordedIssuance, recordedDeployment, recordedProof, recordedBlock } from './recorded-evidence';
import { readReceivedFiles, serializeVerificationFile, type ReceivedProof } from './verification-file';

const short = (value?: string) => value ? `${value.slice(0, 12)}…${value.slice(-8)}` : '아직 생성 전';
const errorText = (error: unknown) => error instanceof Error ? error.message.split('\n')[0]! : String(error);
const TRUST_KEY = 'koda-live-trusted-v1';
const PENDING_KEY = 'koda-live-deployment-pending-v1';
function readPending(): { hash: Hex; issuer: Address } | undefined {
  try { const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null'); if (isAddress(v?.issuer) && /^0x[0-9a-fA-F]{64}$/.test(v?.hash)) return v; } catch { /* Invalid cached state is ignored. */ }
  return undefined;
}
function readTrusted(): TrustedDeployment | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(TRUST_KEY) ?? 'null');
    if (v?.chainId === 11155111 && isAddress(v.contract) && isAddress(v.issuer) && /^0x[0-9a-fA-F]{64}$/.test(v.deploymentTransaction)) return v;
  } catch { /* A corrupt local setup must not become a trust anchor. */ }
  return readPending() ? undefined : recordedDeployment;
}
function download(bytes: Uint8Array, name: string, type = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const [trusted, setTrusted] = useState<TrustedDeployment | undefined>(readTrusted);
  const [connection, setConnection] = useState<Connection>();
  const [saved, setSaved] = useState<SavedIssuance>();
  const [previousIssuance, setPreviousIssuance] = useState<SavedIssuance>();
  const [selected, setSelected] = useState<{ bytes: Uint8Array; name: string }>();
  const [receivedProof, setReceivedProof] = useState<ReceivedProof>();
  const [inputSource, setInputSource] = useState<'received' | 'sample'>();
  const [inputError, setInputError] = useState('');
  const [readingFiles, setReadingFiles] = useState(false);
  const inputVersion = useRef(0);
  const [stage, setStage] = useState<LiveStage>('ready');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rpcStatus, setRpcStatus] = useState('연결 점검 전');
  const [result, setResult] = useState<VerificationResult>();
  const [verificationTrace, setVerificationTrace] = useState<VerificationTraceEvent[]>([]);
  const [workingProof, setWorkingProof] = useState<Partial<Proof>>();
  const [workingSize, setWorkingSize] = useState<number>();
  const [workingPrefix, setWorkingPrefix] = useState<string>();
  const [includedBlock, setIncludedBlock] = useState<string>();
  const [pendingDeploy, setPendingDeploy] = useState(readPending);
  const [deploymentProgress, setDeploymentProgress] = useState<DeploymentProgress>();
  const [log, setLog] = useState<{ title: string; value: string }[]>([]);
  const lock = useRef(false);
  const [mode, setMode] = useState<'recorded' | 'live'>('recorded');
  const [selectedVariant, setSelectedVariant] = useState<'original' | 'altered' | 'upload'>('original');
  const proof = workingProof ?? saved?.proof;
  const receiptBlock = includedBlock ?? (mode === 'recorded' && proof?.transactionHash === recordedProof.transactionHash ? recordedBlock : undefined);
  const sharedRegistry = saved?.deployment?.contract.toLowerCase() === recordedDeployment.contract.toLowerCase()
    && saved.deployment.chainId === recordedDeployment.chainId
    && saved.deployment.issuer.toLowerCase() === recordedDeployment.issuer.toLowerCase()
    && saved.deployment.deploymentTransaction?.toLowerCase() === recordedDeployment.deploymentTransaction?.toLowerCase();
  const canDownload = Boolean(sharedRegistry && saved?.proof.transactionHash && receiptBlock && !workingProof);
  const verificationTrust = receivedProof?.deployment;
  const documentCustomer = workingProof ? CUSTOMER : saved ? saved.customer ?? '한울테크홀딩스㈜' : CUSTOMER;

  useEffect(() => { void restoreWallet().then(setConnection); }, []);
  useEffect(() => {
    if (!pendingDeploy) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const progress = await getDeploymentProgress(publicClient, pendingDeploy!.hash);
      if (cancelled) return;
      setDeploymentProgress(progress);
      if (progress.phase === 'finalized') {
        try {
          const deployment = await recoverDeployment(pendingDeploy!.hash, pendingDeploy!.issuer);
          if (!cancelled) { setError(''); acceptDeployment(deployment); }
          return;
        } catch (e) {
          if (!cancelled) setError(errorText(e));
        }
      }
      if (!cancelled && progress.phase !== 'reverted') timer = setTimeout(() => void poll(), 12_000);
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pendingDeploy]);

  useEffect(() => { loadRecordedIssuance().then(value => {
    setSaved(value);
    setNotice('보존된 실증 문서로 발급·전달 흐름을 보여줍니다. PDF와 검증정보를 내려받아 제3자 화면에서 불러올 수 있어요.');
  }).catch(e => setError(errorText(e))); }, []);
  useEffect(() => { loadIssuance().then(setPreviousIssuance).catch(e => setError(errorText(e))); }, []);
  function addLog(title: string, value: string) { setLog(items => [...items, { title, value }]); }
  function recordTrace(event: VerificationTraceEvent) {
    setVerificationTrace(items => items.some(item => item.id === event.id)
      ? items.map(item => item.id === event.id ? event : item)
      : [...items, event]);
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(errorText(e)); } finally { lock.current = false; setBusy(false); }
  }
  async function connect() { await run(async () => { const c = await connectWallet(); setConnection(c); setNotice(`Sepolia 시험 계정 연결: ${c.account}`); }); }
  async function checkRpc() { await run(async () => {
    const [chainId, block] = await Promise.all([publicClient.getChainId(), publicClient.getBlock({ blockTag: 'finalized' })]);
    if (chainId !== 11155111) throw new Error('조회 RPC가 Sepolia가 아닙니다.');
    setRpcStatus(`Sepolia 연결 확인 · finalized 블록 ${block.number}`);
  }); }
  function acceptDeployment(deployment: TrustedDeployment) {
    localStorage.setItem(TRUST_KEY, JSON.stringify(deployment)); setTrusted(deployment);
    localStorage.removeItem(PENDING_KEY); setPendingDeploy(undefined);
    setNotice('배포 코드·고정 발급자·최종 확정을 확인했습니다. 이제 문서를 서명·등록할 수 있습니다.');
  }
  async function deploy() { await run(async () => {
    if (!connection) throw new Error('시험 발급자 지갑을 먼저 연결해 주세요.');
    const deployment = await deployRegistry(connection, hash => { const pending = { hash, issuer: connection.account }; localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); setPendingDeploy(pending); setNotice('배포 거래가 전송됐습니다. 블록 포함 이후 최종 확정까지 기다립니다.'); });
    acceptDeployment(deployment);
  }); }
  async function recover() { await run(async () => { if (pendingDeploy) acceptDeployment(await recoverDeployment(pendingDeploy.hash, pendingDeploy.issuer)); }); }
  async function submit(value: SavedIssuance) {
    if (!value.deployment || !connection) throw new Error('이 문서의 배포 설정과 Sepolia 시험 발급자 연결이 필요해요.');
    setStage('register');
    const hash = await registerDocument(connection, value.deployment, value.proof);
    const registered = { ...value, proof: { ...value.proof, transactionHash: hash } };
    setSaved(registered); setPreviousIssuance(registered); setWorkingProof(undefined); await saveIssuance(registered); addLog('등록 트랜잭션', hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (receipt.status !== 'success') throw new Error('등록 거래가 되돌려졌습니다. 체인에 등록되지 않았습니다.');
    setIncludedBlock(receipt.blockNumber.toString()); setStage('included'); addLog('블록 포함', `${receipt.blockNumber} · ${receipt.blockHash}`);
    setNotice('제3자 화면에서 실제 기록을 조회할 수 있습니다. 확정 전이면 ‘확정 대기’로 표시됩니다.');
  }
  async function issue() { await run(async () => {
    if (!trusted || !connection) throw new Error('Sepolia 컨트랙트와 시험 발급자 연결이 필요합니다.');
    clearFiles();
    await inspectDeployment(trusted); setMode('live'); setSelectedVariant('original'); setLog([]); setResult(undefined); setNotice('새 문서 발급을 진행하고 있어요. MetaMask 요청은 직접 확인해 주세요.');
    setStage('pdf');
    const documentId = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
    const issuedAt = Math.floor(Date.now() / 1000).toString();
    setWorkingProof({ documentId, issuedAt }); setWorkingSize(undefined); setWorkingPrefix(undefined); setIncludedBlock(undefined); setSaved(undefined); setSelected(undefined);
    const original = await createCertificate(documentId, issuedAt);
    const altered = await createCertificate(documentId, issuedAt, true);
    setWorkingSize(original.byteLength);
    setWorkingPrefix(bytesToHex(original.slice(0, 24)));
    addLog('원본 확정', `${original.byteLength.toLocaleString()} bytes · 100 BTC`);
    setStage('hash'); const documentHash = await sha256(original); setWorkingProof({ documentId, issuedAt, documentHash }); addLog('SHA-256', documentHash);
    setStage('sign'); const message = { documentId, documentHash, issuedAt };
    const signature = await signDocument(connection, trusted, message); addLog('발급서명', signature);
    const value: SavedIssuance = { original, altered, customer: CUSTOMER, deployment: trusted, proof: { ...message, signature } };
    await saveIssuance(value); setSaved(value); setPreviousIssuance(value); setWorkingProof(undefined);
    await submit(value);
  }); }
  async function verify() { await run(async () => {
    if (!verificationTrust || !receivedProof || !selected || readingFiles) throw new Error('전달받은 증명서 PDF와 검증정보 JSON을 먼저 불러와 주세요.');
    setStage('verify'); setResult(undefined); setVerificationTrace([]); setNotice('');
    const deploymentEvent = { id: 'deployment-validation', operation: '배포 코드·고정 발급자 검증', location: 'ethereum' } as const;
    recordTrace({ ...deploymentEvent, state: 'running', detail: verificationTrust.contract });
    try {
      await inspectDeployment(verificationTrust);
      recordTrace({ ...deploymentEvent, state: 'success', detail: '런타임 코드·배포 트랜잭션·고정 발급자 일치' });
    } catch (deploymentError) {
      recordTrace({ ...deploymentEvent, state: 'failure', detail: errorText(deploymentError) });
      setResult({ status: 'unavailable', message: '배포 코드와 발급자 신뢰 기준을 확인할 수 없어 대조를 완료하지 못했습니다.' });
      setStage('result');
      throw deploymentError;
    }
    const checked = await verifyDocument(
      selected.bytes,
      receivedProof.proof,
      verificationTrust,
      publicClient,
      recordTrace,
    );
    setResult(checked); setStage(checked.status === 'match' ? 'finalized' : 'result');
    addLog('제3자 조회 결과', checked.message);
  }); }
  function clearFiles() {
    inputVersion.current++;
    setSelected(undefined); setReceivedProof(undefined); setInputSource(undefined); setInputError('');
    setReadingFiles(false); setResult(undefined); setVerificationTrace([]);
  }
  async function selectFiles(files: File[]) {
    if (!files.length || busy) return;
    const version = ++inputVersion.current;
    setReadingFiles(true); setInputError(''); setResult(undefined); setVerificationTrace([]);
    try {
      const received = await readReceivedFiles(files, [recordedDeployment]);
      if (inputVersion.current !== version) return;
      if (received.pdf) setSelected(received.pdf);
      if (received.verification) setReceivedProof(received.verification);
      setSelectedVariant('upload'); setInputSource('received'); setError('');
    } catch (e) {
      if (inputVersion.current !== version) return;
      setSelected(undefined); setReceivedProof(undefined); setInputSource(undefined);
      setInputError(errorText(e));
    } finally { if (inputVersion.current === version) setReadingFiles(false); }
  }
  function selectSample(variant: 'original' | 'altered') {
    if (!saved?.deployment || !canDownload || busy || readingFiles) return;
    clearFiles();
    setSelectedVariant(variant);
    setSelected({ bytes: saved[variant], name: variant === 'original' ? 'BTC잔고_원본.pdf' : 'BTC잔고_120BTC_변경본.pdf' });
    setReceivedProof({ name: 'BTC잔고_검증정보.json', proof: saved.proof, deployment: recordedDeployment });
    setInputSource('sample');
  }
  async function replayRecorded() { await run(async () => {
    const value = await loadRecordedIssuance();
    clearFiles();
    setSaved(value); setWorkingProof(undefined); setIncludedBlock(undefined); setSelectedVariant('original'); setResult(undefined); setVerificationTrace([]);
    setMode('recorded'); setStage('ready');
    setNotice('2026년 11월 6일 공개 실증 기록을 불러왔어요. 현재 상태는 다시 조회해 주세요.');
  }); }
  async function resumePrevious() { await run(async () => {
    if (!previousIssuance?.deployment) return;
    clearFiles();
    setSaved(previousIssuance); setTrusted(previousIssuance.deployment); setWorkingProof(undefined); setIncludedBlock(undefined); setSelectedVariant('original'); setResult(undefined); setVerificationTrace([]);
    setMode('live'); setStage('register');
    const source = previousIssuance.deployment;
    if (source.chainId !== recordedDeployment.chainId || source.contract.toLowerCase() !== recordedDeployment.contract.toLowerCase()
      || source.issuer.toLowerCase() !== recordedDeployment.issuer.toLowerCase()
      || source.deploymentTransaction?.toLowerCase() !== recordedDeployment.deploymentTransaction?.toLowerCase()) {
      throw new Error('공개된 발급 계약과 저장된 배포정보가 다릅니다. 발급 자료를 전달할 수 없습니다.');
    }
    if (previousIssuance.proof.transactionHash) {
      const receipt = await publicClient.getTransactionReceipt({ hash: previousIssuance.proof.transactionHash });
      if (receipt.status !== 'success') throw new Error('등록 거래가 되돌려졌습니다. 발급 자료를 전달할 수 없습니다.');
      const checked = await verifyDocument(previousIssuance.original, previousIssuance.proof, recordedDeployment, publicClient);
      if (checked.status !== 'match' || !checked.receiptBlockNumber) throw new Error(`저장된 발급 자료의 등록을 확인하지 못했습니다. ${checked.message}`);
      setIncludedBlock(checked.receiptBlockNumber); setStage('included');
    }
    setNotice('최근 발급 자료를 불러왔습니다. 블록 포함과 최종 확정 여부는 구분하며, 제3자 검증에서 최종 확정을 다시 확인합니다.');
  }); }
  const setup = <>
    <details className="setup" open={!trusted || undefined}>
      <summary>실행 준비 <span>{trusted ? `배포 확정 · ${short(trusted.contract)}` : pendingDeploy ? '배포 거래 전송됨 · 확정 확인 중' : '시험 발급자 연결 · 컨트랙트 배포'}</span></summary>
      <div className="setup-body">
        <p>발표자용 실행 도구 · KODA의 실제 운영 시스템이 아닙니다. 개인키는 MetaMask에 유지됩니다.</p>
        <div className="setup-actions"><button disabled={busy} onClick={checkRpc}>공개 RPC 연결 점검</button><button disabled={busy} onClick={connect}>{connection ? '계정 다시 연결' : 'MetaMask 연결'}</button><button disabled={busy || !connection || !!trusted || !!pendingDeploy} onClick={deploy}>Sepolia 컨트랙트 배포</button>{pendingDeploy && <button disabled={busy} onClick={recover}>배포 결과 다시 조회</button>}</div><p role="status">{rpcStatus}</p>
        {pendingDeploy && <div className="deployment-progress" role="status"><b>{deploymentProgress?.message ?? '배포 거래 상태를 조회하고 있습니다.'}</b><p>배포 블록 {deploymentProgress?.includedBlock ?? '포함 대기'} · 현재 finalized 블록 {deploymentProgress?.finalizedBlock ?? '조회 중'} · 12초마다 자동 조회</p></div>}
        <dl><dt>시험 발급자</dt><dd>{trusted?.issuer ?? pendingDeploy?.issuer ?? connection?.account ?? '연결 전'}</dd><dt>지갑 연결</dt><dd>{connection ? connection.account : '미연결 · 발급할 때 MetaMask 연결 필요'}</dd><dt>기록 계약</dt><dd>{(trusted?.contract ?? deploymentProgress?.contract) ? <a href={addressUrl((trusted?.contract ?? deploymentProgress!.contract)!)} target="_blank" rel="noreferrer">{trusted?.contract ?? deploymentProgress?.contract} ↗</a> : pendingDeploy ? '배포 거래 전송됨 · 계약 주소 조회 중' : '배포 전'}</dd><dt>배포 내용</dt><dd>DocumentRegistry · 고정 발급자 1명 · ETH 전송액 0 · 가스만 Sepolia ETH로 지불</dd><dt>컴파일</dt><dd>Solidity {artifact.compiler.version} / OpenZeppelin EIP712·ECDSA</dd><dt>조회 RPC</dt><dd>{RPC_URL}</dd></dl>
        {(pendingDeploy?.hash ?? trusted?.deploymentTransaction) && <a href={transactionUrl((pendingDeploy?.hash ?? trusted!.deploymentTransaction)!)} target="_blank" rel="noreferrer">배포 트랜잭션 확인 ↗</a>}
      </div>
    </details>
    <div className="issuer-actions">
      <div className="setup-actions"><button disabled={busy} onClick={replayRecorded}>공개 실증 기록으로 돌아가기</button>{previousIssuance?.deployment && previousIssuance.proof.transactionHash !== recordedProof.transactionHash && <button disabled={busy} onClick={resumePrevious}>이 브라우저의 최근 발급 불러오기</button>}</div>
      <p>다음 발급 사례: {CUSTOMER} · 100 BTC. 기존 한울테크홀딩스 실증 문서는 그대로 보존해요.</p>
      <p>새 발급은 MetaMask에서 문서 서명과 등록 거래를 직접 승인해야 해요.</p>
      {saved?.deployment && !sharedRegistry && <p role="status">새 시험 계약은 이 공개 검증 화면의 신뢰 목록에 아직 등록되지 않았습니다. 고객사 전달 기능은 사전에 공개한 계약에서 등록한 자료에만 열립니다.</p>}
      <div className="setup-actions">{saved && !saved.proof.transactionHash && <button disabled={busy || !trusted || !connection} onClick={() => void run(() => submit(saved))}>서명한 문서 등록 재시도</button>}<button className="primary" disabled={busy || !trusted || !connection} onClick={issue}>인하테크홀딩스 증명서 발급·등록</button></div>
      {!connection && <p>새로 발급하려면 위에서 시험 발급자 지갑을 연결해 주세요. 기존 문서 조회에는 지갑이 필요 없어요.</p>}
    </div>
  </>;
  const evidence = <>
    <details className="evidence"><summary>실제 입력·처리 결과 보기</summary><div className="evidence-body"><p>BTC 잔고의 사실성·현재 유효성·중간 수정 이력 전체는 검증하지 않습니다. 공식 KODA 발급자 인증도 아닙니다.</p><dl><dt>문서 ID</dt><dd>{proof?.documentId ?? '생성 전'}</dd><dt>발급 기재시각</dt><dd>{proof ? new Date(Number(proof.issuedAt) * 1000).toISOString() : '생성 전'}</dd><dt>서명된 해시</dt><dd>{proof?.documentHash ?? '생성 전'}</dd><dt>발급서명 σ</dt><dd>{proof?.signature ?? '서명 전'}</dd></dl>{log.map((item,i) => <div className="log-line" key={i}><span>{item.title}</span><code>{item.value}</code></div>)}</div></details>
  </>;
  return <Presentation
    stage={stage} mode={mode} busy={busy} customer={documentCustomer} asOf={AS_OF}
    proof={proof} trusted={workingProof ? trusted : saved?.deployment} originalSize={workingProof ? workingSize : saved?.original.byteLength}
    pdfHeaderHex={workingProof ? workingPrefix : saved ? bytesToHex(saved.original.slice(0, 24)) : undefined}
    selectedName={selected?.name} selectedProofName={receivedProof?.name} selectedVariant={selectedVariant} inputSource={inputSource} inputError={inputError} inputLoading={readingFiles}
    verificationProof={receivedProof?.proof} verificationTrust={verificationTrust} result={result} verificationTrace={verificationTrace}
    receiptBlock={receiptBlock}
    canVerify={Boolean(verificationTrust && receivedProof && selected && !readingFiles)} canDownload={canDownload} notice={notice} error={error}
    setup={setup} evidence={evidence}
    onVerify={() => void verify()} onSelectSample={selectSample}
    onSelectFiles={files => void selectFiles(files)} onClearFiles={clearFiles}
    onDownload={variant => canDownload && saved && download(saved[variant], variant === 'original' ? 'BTC잔고_원본.pdf' : 'BTC잔고_120BTC_변경본.pdf')}
    onDownloadProof={() => canDownload && saved && download(new TextEncoder().encode(serializeVerificationFile(saved.proof, recordedDeployment)), 'BTC잔고_검증정보.json', 'application/json')}
  />;
}
createRoot(document.getElementById('root')!).render(<App/>);
