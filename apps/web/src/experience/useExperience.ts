import { useEffect, useRef, useState } from 'react';
import { sha256, type FileManifest, type FileResult } from '../proof/model';
import { scenes } from './data';
import { receipt } from './receipt';

const initialScene = () => {
  const id = location.hash.slice(1);
  const legacy: Record<string, number> = { 'S-01': 0, 'S-02': 0, 'S-03': 1, 'S-04': 3, 'S-05': 4, 'S-06': 4, 'S-07': 5 };
  return legacy[id] ?? Math.max(0, scenes.findIndex(s => s.id === id));
};
export function useExperience() {
  const [scene, setScene] = useState(initialScene);
  const [completed, setCompleted] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [activity, setActivity] = useState<'idle' | 'process' | 'sample'>('idle');
  const busy = activity !== 'idle';
  const processing = activity === 'process';
  const [error, setError] = useState('');
  const [failure, setFailure] = useState<{step:number; title:string; detail:string} | null>(null);
  const [manifest, setManifest] = useState<FileManifest | null>(null);
  const [checks, setChecks] = useState([false, false, false]);
  const [expires, setExpires] = useState('2026-12-31');
  const [expired, setExpired] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{kind: FileResult; hash: string; differences: {label:string; before:string; after:string}[]} | null>(null);
  const [records, setRecords] = useState<{action:string; actor:string; time:string}[]>([]);
  const operation = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const done = completed.includes(scene);
  useEffect(() => {
    const abort = new AbortController();
    fetch(import.meta.env.BASE_URL+'receipt-files/manifest.json', {signal:abort.signal}).then(r => { if(!r.ok) throw new Error(); return r.json(); }).then(setManifest).catch(e => { if(e.name !== 'AbortError') setError('시연 원본을 불러오지 못했어요. 새로고침해 주세요.'); });
    return () => { abort.abort(); operation.current++; };
  }, []);
  function go(index: number) {
    if (busy) return;
    const next = Math.max(0, Math.min(5, index));
    setScene(next); setProgress(0); setError(''); setFailure(null);
    history.replaceState(null, '', '#'+scenes[next]!.id);
  }
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.closest('button,input,select,textarea,dialog') || event.target.isContentEditable)) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); go(scene+1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(scene-1); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });
  function record(action:string) {
    setRecords(old => [{action, actor:scenes[scene]!.role, time:new Date().toLocaleTimeString('ko-KR',{hour12:false})},...old]);
  }
  async function readFile(selected:File) {
    if (selected.size > 10*1024*1024) throw new Error('10 MB 이하의 PDF를 선택해 주세요.');
    if (!manifest) throw new Error('원본을 준비하고 있어요. 잠시 후 다시 시도해 주세요.');
    const bytes = new Uint8Array(await selected.arrayBuffer());
    const hash = await sha256(bytes);
    if (hash === manifest.hash) return {kind:'match' as const, hash, differences:[]};
    try {
      const { readSupportedPdf } = await import('@koda/protocol');
      const response = await fetch(import.meta.env.BASE_URL+'fonts/PretendardVariable.ttf');
      if (!response.ok) throw new Error();
      const entries = readSupportedPdf(bytes, new Uint8Array(await response.arrayBuffer()), manifest.entries);
      const differences = entries.flatMap((e,i) => e.value !== manifest.entries[i]?.value ? [{label:e.label,before:manifest.entries[i]!.value,after:e.value}] : []);
      return {kind: differences.length ? 'changed' as const : 'copy' as const, hash, differences};
    } catch { return {kind:'unknown' as const, hash, differences:[]}; }
  }
  async function run() {
    if (busy || done) return;
    if (scene === 1 && checks.some(c=>!c)) { setError('대조 결과와 차이의 확인 필요 상태를 체크해 주세요.'); return; }
    if (scene === 3 && (!expires || expires < receipt.grantStart)) { setError('시연일인 2026년 11월 3일 이후로 열람 기간을 정해 주세요.'); return; }
    if (scene >= 4 && expired) { setError('열람 기간이 끝났어요. 시연 권한을 복원해 주세요.'); return; }
    if (scene === 5 && !file) { setError('검사할 PDF를 먼저 선택해 주세요.'); return; }
    const id = ++operation.current;
    setActivity('process'); setError(''); setFailure(null); setProgress(0);
    let runningStep=0;
    let outcome:string=scenes[scene]!.result;
    try {
      for (let step=1; step<=3; step++) {
        runningStep=step-1;
        await new Promise(resolve=>setTimeout(resolve,650));
        if (operation.current !== id) return;
        if ((scene === 0 || scene === 4) && step === 2) {
          if (!manifest) throw new Error('시연 원본이 준비되지 않았어요. 잠시 후 다시 시도해 주세요.');
          const response = await fetch(import.meta.env.BASE_URL+'receipt-files/original.pdf');
          if (!response.ok || await sha256(new Uint8Array(await response.arrayBuffer())) !== manifest.hash) throw new Error('준비된 원본의 지문이 기준 기록과 달라요.');
        }
        if (scene === 5 && step === 3) {
          const inspected = await readFile(file!);
          if (operation.current !== id) return;
          setResult(inspected);
          outcome={match:'원본 일치 · 검증 통과',changed:'검증 실패 · 원본과 내용 불일치',copy:'원본 아님 · 재저장 사본 또는 열람본',unknown:'지문 불일치 · 내용 비교 불가'}[inspected.kind];
        }
        if (operation.current !== id) return;
        setProgress(step);
      }
      setCompleted(old=>[...new Set([...old,scene])]); record(outcome);
    } catch(e) { if(operation.current === id) setFailure({step:runningStep,title:'처리를 마치지 못했어요',detail:(e instanceof Error ? e.message : '일시적으로 처리하지 못했어요.')+' 다시 시도해 주세요.'}); }
    finally { if(operation.current === id) setActivity('idle'); }
  }
  async function sample(kind:'original'|'modified'|'resaved') {
    if(busy) return;
    const id = ++operation.current;
    setError(''); setActivity('sample');
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}receipt-files/${kind}.pdf`); if(!r.ok) throw new Error();
      const bytes = await r.arrayBuffer();
      if (operation.current !== id) return;
      chooseFile(new File([bytes], {original:'수취증빙_원본.pdf',modified:'수취증빙_수정본.pdf',resaved:'수취증빙_재저장.pdf'}[kind],{type:'application/pdf'}));
    } catch { if(operation.current === id) setError('시연 파일을 불러오지 못했어요. 다시 선택해 주세요.'); }
    finally { if(operation.current === id) setActivity('idle'); }
  }
  function chooseFile(value:File) { setFile(value); setResult(null); setCompleted(old=>old.filter(i=>i!==5)); setProgress(0); setError(''); setFailure(null); }
  function reset() { operation.current++; setActivity('idle'); setCompleted([]); setProgress(0); setChecks([false,false,false]); setExpired(false); setExpires('2026-12-31'); setFile(null); setResult(null); setRecords([]); setError(''); setFailure(null); setScene(0); history.replaceState(null,'','#issue'); }
  return {scene,go,completed,done,progress,busy,processing,error,failure,manifest,checks,setChecks,expires,setExpires,expired,setExpired,file,result,records,input,run,sample,chooseFile,reset};
}
export type ExperienceState = ReturnType<typeof useExperience>;
