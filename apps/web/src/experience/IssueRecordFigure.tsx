type Phase = 'idle' | 'creating' | 'signing' | 'connecting' | 'complete' | 'failed';

// Original SVG illustration: Hairline-inspired linework, driven by issuance state.
// The document stays in the vault; only its fingerprint travels to the ledger.
export function IssueRecordFigure({phase}:{phase:Phase}) {
  return <div className={`xp-ledger-figure is-${phase}`}>
    <svg viewBox="0 45 360 215" role="img" aria-label="원본 문서는 KODA 보관소에 남고, 문서 지문만 블록체인의 새 기록에 연결됩니다.">
      <g className="xp-ledger-ground" fill="none">
        <path d="m12 202 100 50 64-32M174 219l166-83M181 228l166-83"/>
        <path d="m32 208 80 40 43-22"/>
      </g>
      <g className="xp-ledger-vault">
        <path className="face-top" d="m23 83 47-25 91 45-47 26Z"/>
        <path className="face-side" d="m114 129 47-26v110l-47 25Z"/>
        <path className="face-front" d="m23 83 91 46v109l-91-46Z"/>
        <path className="xp-ledger-detail" d="m32 98 72 36v89l-72-36Z"/>
        <path className="xp-ledger-detail" d="m126 137 23-12m-23 20 23-12m-23 20 23-12"/>
        <path className="xp-ledger-hinge" d="m23 116 8 4v12l-8-4m0 31 8 4v12l-8-4"/>
        <g className="xp-ledger-original">
          <path className="face-paper" d="m47 119 28 14 13 20v48l-41-20Z"/>
          <path d="m75 133 0 14 13 6m-32-10 12 6m-12 5 23 12m-23 0 23 12m-23-1 14 7"/>
        </g>
        <g className="xp-ledger-seal">
          <path d="m91 185 9 5v11l-9 3-9-12v-11Z"/>
          <path d="m86 190 4 6 6-4"/>
        </g>
      </g>
      <g className="xp-ledger-links" fill="none">
        <path className="xp-ledger-extract" d="M161 165h12l36 18"/>
        <path d="m249 174 16-8m35-20 16-8"/>
        <path className="xp-ledger-new-link" pathLength="1" d="m249 174 16-8"/>
      </g>
      <g className="xp-ledger-block existing" transform="translate(308 101)">
        <path className="face-top" d="m0 15 23-12 23 12-23 12Z"/>
        <path className="face-side" d="m23 27 23-12v26l-23 12Z"/>
        <path className="face-front" d="m0 15 23 12v26L0 41Z"/>
        <path className="xp-ledger-detail" d="m7 28 9 5m-9 3 9 5"/>
      </g>
      <g className="xp-ledger-block existing" transform="translate(257 129)">
        <path className="face-top" d="m0 15 23-12 23 12-23 12Z"/>
        <path className="face-side" d="m23 27 23-12v26l-23 12Z"/>
        <path className="face-front" d="m0 15 23 12v26L0 41Z"/>
        <path className="xp-ledger-detail" d="m7 28 9 5m-9 3 9 5"/>
      </g>
      <g transform="translate(206 157)">
        <g className="xp-ledger-block fresh">
          <path className="face-top" d="m0 15 23-12 23 12-23 12Z"/>
          <path className="face-side" d="m23 27 23-12v26l-23 12Z"/>
          <path className="face-front" d="m0 15 23 12v26L0 41Z"/>
          <path className="xp-ledger-check" d="m6 32 5 8 8-6"/>
          <path className="xp-ledger-placeholder" d="m7 28 9 5m-9 3 9 5"/>
        </g>
      </g>
      <g className="xp-ledger-fingerprint">
        <path className="face-paper" d="m168 87 23-12 33 17-23 12Z"/>
        <path className="face-side" d="m168 87 33 17v6l-33-17Zm33 17 23-12v6l-23 12Z"/>
        <g fill="none"><path d="m180 86 11-6 20 10-11 6Zm4 0 7-3 13 7-4 2m-10-4 4 2"/></g>
        <path className="xp-ledger-drop" d="M196 115v26l32 17" fill="none"/>
      </g>
    </svg>
    <div className="xp-ledger-caption"><span>원본은 보관소에</span><span>지문만 블록에</span></div>
  </div>;
}
