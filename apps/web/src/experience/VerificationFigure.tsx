import type { FileResult } from '../proof/model';

type Stage = 'idle' | 'checking' | 'comparing' | 'reading' | 'complete' | 'error';

// Read-only verification: the ledger blocks never move or change with the result.
export function VerificationFigure({stage, result, original, label}:{stage:Stage;result:FileResult|null;original:boolean;label:string}) {
  const outcome=stage==='complete'?(result??'match'):'pending';
  return <div className={`xp-ledger-figure xp-verification-figure stage-${stage} outcome-${outcome}`}>
    <svg viewBox="0 40 360 215" role="img" aria-label={label}>
      <g className="xp-ledger-ground" fill="none">
        <path d="m13 205 77 39 59-30m57 2 145-73m-137 82 137-69"/>
      </g>
      <g className="xp-verify-routes" fill="none">
        <path d="M93 132v-17l46-24m139 54v-31l-37-20"/>
        <path className="xp-verify-bridge" d="M168 84h52"/>
      </g>
      <g className="xp-verify-file">
        <path className="face-top" d="m24 197 27-14 82 41-27 14Z"/>
        <path className="face-side" d="m106 238 27-14v7l-27 14Z"/>
        <path className="face-front" d="m24 197 82 41v7l-82-41Z"/>
        <path className="face-side" d="m42 89 7-4 66 33v103l-7 4Z"/>
        <path className="face-paper" d="m42 89 45 23 21 31v82l-66-33Z"/>
        <path d="m87 112 0 21 21 10"/>
        <path className="xp-verify-file-lines" d="m54 129 22 11m-22 4 41 20m-41-5 41 20m-41-5 41 20m-41-5 22 11"/>
        <path className="xp-verify-scan" d="m49 143 52 26"/>
      </g>
      <g className="xp-ledger-links" fill="none"><path d="m249 174 16-8m35-20 16-8"/></g>
      {[{x:308,y:101},{x:257,y:129},{x:206,y:157}].map(({x,y})=><g key={x} className="xp-ledger-block existing" transform={`translate(${x} ${y})`}>
        <path className="face-top" d="m0 15 23-12 23 12-23 12Z"/>
        <path className="face-side" d="m23 27 23-12v26l-23 12Z"/>
        <path className="face-front" d="m0 15 23 12v26L0 41Z"/>
        <path className="xp-ledger-detail" d="m7 28 9 5m-9 3 9 5"/>
      </g>)}
      <g className="xp-verify-file-print" transform="translate(113 62)">
        <g className="xp-verify-print-motion">
          <path className="face-paper" d="m0 15 23-12 33 17-23 12Z"/>
          <path className="face-side" d="m0 15 33 17v6L0 21Zm33 17 23-12v6L33 38Z"/>
          <path className="xp-verify-print-same" d="m12 14 11-6 20 10-11 6Zm4 0 7-3 13 7-4 2m-10-4 4 2"/>
          <path className="xp-verify-print-different" d="m12 14 11-6 20 10-11 6Zm6 0 5-2 7 4m-6 3 5 2 7-4"/>
        </g>
      </g>
      <g className="xp-verify-record-print" transform="translate(219 62)">
        <path className="face-paper" d="m0 15 23-12 33 17-23 12Z"/>
        <path className="face-side" d="m0 15 33 17v6L0 21Zm33 17 23-12v6L33 38Z"/>
        <path d="m12 14 11-6 20 10-11 6Zm4 0 7-3 13 7-4 2m-10-4 4 2"/>
      </g>
      <g className="xp-verify-verdict">
        <circle cx="194" cy="83" r="16"/>
        <path d="M187 79h14m-14 8h14"/>
        {outcome!=='match'&&<path d="m199 73-10 20"/>}
      </g>
    </svg>
    <div className="xp-ledger-caption"><span>{original?'KODA 원본 파일':'검사할 사본'}</span><span>기존 체인 기록</span></div>
  </div>;
}
