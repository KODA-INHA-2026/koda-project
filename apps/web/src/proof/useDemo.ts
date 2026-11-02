import { useEffect, useRef, useState } from 'react';
import { AUDITOR, roles, saveFile, sha256, type DemoRecord, type FileManifest, type FileResult } from './model';
const clock = () => '11-09 ' + new Date().toLocaleTimeString('ko-KR', { hour12: false });
const initialScreen = () => { const value = new URLSearchParams(location.search).get('shot') ?? location.hash.slice(1); return value === 'M-01' ? 8 : /^S-0[1-8]$/.test(value) ? Number(value.slice(-1)) - 1 : 0; };
export function useDemo() {
  const [screen, setScreen] = useState(initialScreen);
  const [role, setRole] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [issueStage, setIssueStage] = useState(0);
  const [grantStage, setGrantStage] = useState(0);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [records, setRecords] = useState<DemoRecord[]>([]);
  const [expires, setExpires] = useState('2026-12-31');
  const [starts, setStarts] = useState('2026-11-09');
  const [auditor, setAuditor] = useState(AUDITOR);
  const [expired, setExpired] = useState(false);
  const [manifest, setManifest] = useState<FileManifest | null>(null);
  const [fileResult, setFileResult] = useState<FileResult>('changed');
  const [fileName, setFileName] = useState('3Q_잔고증명_최종(수정).pdf');
  const [fileHash, setFileHash] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<boolean | null>(true);
  const [publicResult, setPublicResult] = useState('');
  const [tab, setTab] = useState('');
  const [differences, setDifferences] = useState<{ field: string; label: string; before: string; after: string }[]>([]);
  const operation = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const publicInput = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);
  const shot = new URLSearchParams(location.search).has('shot');
  function record(action: string, detail: string, actor = roles[screen < 2 ? 0 : screen < 4 ? 1 : 2]!.name) {
    setRecords(previous => [{ time: clock(), actor, action, detail }, ...previous].slice(0, 40));
  }
  function go(next: number) {
    const index = (next + 9) % 9; setScreen(index); setTab(''); setNotice('');
    if (!shot) history.replaceState(null, '', '#'+(index === 8 ? 'M-01' : `S-0${index+1}`));
    if (index === 4 && !expired) record('원본 전체 열람', '한울회계법인 · KODA에 열람 기록됨 (모의)', roles[2].name);
    if (index === 2) record('열람본 열람', '일부 가림 · 원본 내려받기 없음', roles[1].name);
  }
  useEffect(() => {
    let active = true;
    fetch(import.meta.env.BASE_URL + 'proof-files/manifest.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then((m: FileManifest) => { if (active) { setManifest(m); setQuery(m.hash); setFileHash(m.changedHash); } }).catch(() => { if (active) setNotice('시연 파일을 불러오지 못했습니다. 페이지를 새로고침해 주세요.'); });
    return () => { active = false; operation.current++; };
  }, []);
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const observer = new ResizeObserver(() => setScale(el.clientWidth / 1120)); observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && (event.target.closest('input,select,textarea,button') || event.target.isContentEditable)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go(screen + (event.key === 'ArrowRight' ? 1 : -1)); }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  async function progress(label: string, stages: number, update: (value: number) => void) {
    if (busy) return false;
    const id = ++operation.current; setBusy(label);
    for (let stage = 1; stage <= stages; stage++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      if (operation.current !== id) return false;
      update(stage);
    }
    setBusy(''); return true;
  }
  async function authenticate() {
    if (authenticated) { go(role === 0 ? 1 : role === 1 ? 2 : 4); return; }
    if (await progress('DID 인증 중 · 모의', 1, () => setAuthenticated(true))) {
      record('DID 인증 완료 (모의)', roles[role]!.did, roles[role]!.name);
    }
  }
  async function issue() {
    if (issueStage === 3) { go(2); return; }
    if (await progress('발행 처리 중 · 모의', 3, setIssueStage)) record('증명서 발행·체인 기록 (모의)', '블록 #21,904,118 · 원문 제외 · 문서 지문만 기록', roles[0].name);
  }
  async function grant() {
    if (grantStage === 3 && !expired) { go(4); return; }
    if (auditor !== AUDITOR) { setNotice('시연에 등록된 한울회계법인의 감사인 DID를 지정해 주세요.'); return; }
    if (!starts || !expires || starts > expires || starts > '2026-11-09' || expires < '2026-11-09') { setNotice('시연일 2026-11-09를 포함하는 유효한 열람 기간을 지정해 주세요.'); return; }
    setNotice(''); setExpired(false);
    if (await progress('권한 전달 중 · 모의', 3, setGrantStage)) record('열람 권한 수신 (모의)', `${auditor} · 전체 항목 · ${starts} ~ ${expires}`, roles[1].name);
  }
  async function verify() {
    if (expired) { setNotice('열람 기간이 만료되었습니다. 고객사에 권한을 다시 요청해 주세요.'); return; }
    if (!manifest) { setNotice('원본 파일 준비가 끝난 뒤 다시 시도해 주세요.'); return; }
    if (busy) return;
    setBusy('원본 지문 확인 중');
    try {
      const response = await fetch(import.meta.env.BASE_URL + 'proof-files/original.pdf'); if (!response.ok) throw new Error('원본 파일을 불러오지 못했습니다.');
      const hash = await sha256(new Uint8Array(await response.arrayBuffer()));
      if (hash !== manifest.hash) throw new Error('원본과 모의 기록의 지문이 다릅니다.');
      record('원본 검증', '통과 · SHA-256 일치 · DID 서명·권한·체인 기록은 모의'); go(5);
    } catch (e) { setNotice(e instanceof Error ? e.message : '검증하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(''); }
  }
  async function inspectFile(file: File, publicOnly = false) {
    if (busy) return;
    if (!publicOnly && expired) { setNotice('열람 권한이 만료되어 원본 항목 비교를 할 수 없습니다.'); return; }
    if (file.size > 10 * 1024 * 1024) { const message = '10 MiB 이하의 파일을 선택해 주세요.'; publicOnly ? setPublicResult(message) : setNotice(message); return; }
    if (!manifest) { setNotice('시연 원본을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'); return; }
    setBusy('파일 지문 계산 중');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()); const hash = await sha256(bytes);
      if (publicOnly) { setPublicResult(hash === manifest.hash ? '문서 지문 일치 · 모의 체인 기록과 같은 원본 파일입니다.' : '일치하는 모의 기록 없음 · 파일 내용의 변경 여부는 이 화면에서 판단하지 않습니다.'); setQuery(hash); setFound(hash === manifest.hash); return; }
      let result: FileResult = hash === manifest.hash ? 'match' : 'unknown';
      let message = ''; let changes: typeof differences = [];
      if (result !== 'match') {
        try {
          const { readSupportedPdf } = await import('@koda/protocol');
          const fontResponse = await fetch(import.meta.env.BASE_URL + 'fonts/PretendardVariable.ttf'); if (!fontResponse.ok) throw new Error();
          const actual = readSupportedPdf(bytes, new Uint8Array(await fontResponse.arrayBuffer()), manifest.entries);
          changes = actual.flatMap((entry, index) => entry.value !== manifest.entries[index]?.value ? [{ field: entry.field, label: entry.label, before: manifest.entries[index]!.value, after: entry.value }] : []);
          result = changes.length ? 'changed' : 'copy';
        } catch { message = '지문은 다르지만 항목을 읽을 수 없습니다. 지원되는 시연 PDF로 다시 확인해 주세요. 위변조로 단정하지 않습니다.'; }
      }
      setFileName(file.name); setFileHash(hash); setFileResult(result); setDifferences(changes); setFileMessage(message);
      record('파일 검증', `${file.name} · ${result === 'match' ? '원본 일치' : result === 'copy' ? '재저장 사본' : result === 'changed' ? '내용 변경' : '내용 비교 불가'}`); go(6);
    } catch { setNotice('파일을 읽지 못했습니다. 다시 선택해 주세요.'); }
    finally { setBusy(''); }
  }
  async function sample(kind: 'original' | 'modified' | 'resaved', download = false) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}proof-files/${kind}.pdf`); if (!response.ok) throw new Error();
      const bytes = await response.arrayBuffer();
      const name = kind === 'original' ? '3Q_잔고증명_원본.pdf' : kind === 'modified' ? '3Q_잔고증명_최종(수정).pdf' : '3Q_잔고증명_재저장.pdf';
      if (download) saveFile(name, bytes, 'application/pdf'); else await inspectFile(new File([bytes], name, { type: 'application/pdf' }));
    } catch { setNotice('시연 파일을 불러오지 못했습니다. 다시 시도해 주세요.'); }
  }
  function search() {
    const normalized = query.trim().replace(/[,#\s]/g, '');
    setFound(Boolean(manifest && [manifest.hash, '21904118', 'did:koda:issuer:koda-ops'].includes(normalized))); setPublicResult('');
  }
  function reset() {
    operation.current++; setBusy(''); setAuthenticated(false); setRole(0); setIssueStage(0); setGrantStage(0); setExpired(false); setRecords([]); setFileResult('changed'); setFileHash(manifest?.changedHash ?? ''); setDifferences([]); setFileName('3Q_잔고증명_최종(수정).pdf'); setExpires('2026-12-31'); setStarts('2026-11-09'); setAuditor(AUDITOR); setFound(true); setQuery(manifest?.hash ?? ''); setPublicResult(''); go(0);
  }
  return { screen, role, setRole, authenticated, setAuthenticated, issueStage, grantStage, busy, notice, setNotice, records, expires, setExpires, starts, setStarts, auditor, setAuditor, expired, setExpired, manifest, fileResult, fileName, fileHash, fileMessage, differences, query, setQuery, found, publicResult, tab, setTab, stageRef, fileInput, publicInput, scale, shot, record, go, authenticate, issue, grant, verify, inspectFile, sample, search, reset };
}
export type Demo = ReturnType<typeof useDemo>;
