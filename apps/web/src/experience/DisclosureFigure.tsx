export type DisclosureState = 'idle' | 'busy' | 'ok' | 'bad';

// Original SVG illustration in the same hairline isometric language as IssueRecordFigure.
// A redacted view: visible rows stay readable, hidden rows leave only their fingerprints,
// and all fingerprints fold into the field bundle recorded at issuance.
// Editable master: Illustrator file "KODA_열람본검증_figure.ai" (same coordinates).
export function DisclosureFigure({state}:{state:DisclosureState}) {
  return <div className={`xp-disc-figure is-${state}`}>
    <svg viewBox="0 52 360 190" role="img" aria-label="열람본의 보이는 칸과 가린 칸의 지문이 하나의 항목 지문 묶음으로 모여 발행 기록과 비교됩니다.">
      <g className="xp-disc-ground" fill="none">
        <path d="m14 198 96 48 58-29M176 213l166-83"/>
      </g>
      <g className="xp-disc-paper">
        <path className="face-top" d="m36 88 8-4 88 44-8 4Z"/>
        <path className="face-side" d="m124 132 8-4v82l-8 4Z"/>
        <path className="face-front" d="m36 88 88 44v82l-88-44Z"/>
        <path className="row-line" d="m46 104 66 33"/>
        <path className="row-partial" d="m46 117 66 33v7l-66-33Z"/>
        <path className="row-hidden" d="m46 133 66 33v7l-66-33Z"/>
        <path className="row-hidden" d="m46 149 66 33v7l-66-33Z"/>
        <path className="row-line" d="m46 168 66 33"/>
      </g>
      <g className="xp-disc-chips">
        <path className="chip shown" d="m140 158 7-3.5 7 3.5-7 3.5Z"/>
        <path className="chip hidden" d="m160 148 7-3.5 7 3.5-7 3.5Z"/>
        <path className="chip hidden" d="m180 138 7-3.5 7 3.5-7 3.5Z"/>
        <path className="chip shown" d="m200 128 7-3.5 7 3.5-7 3.5Z"/>
      </g>
      <g className="xp-disc-bundle" transform="translate(214 88)">
        <path className="face-top" d="m0 22 34-17 34 17-34 17Z"/>
        <path className="face-side" d="m34 39 34-17v38l-34 17Z"/>
        <path className="face-front" d="m0 22 34 17v38L0 60Z"/>
        <path className="bundle-mark" d="m10 48 7 7 10-14"/>
        <path className="bundle-cross" d="m11 42 14 14m0-14-14 14"/>
      </g>
      <g className="xp-disc-link" fill="none">
        <path d="m282 118 18-9"/>
      </g>
      <g className="xp-disc-block" transform="translate(296 76)">
        <path className="face-top" d="m0 15 23-12 23 12-23 12Z"/>
        <path className="face-side" d="m23 27 23-12v26l-23 12Z"/>
        <path className="face-front" d="m0 15 23 12v26L0 41Z"/>
        <path className="xp-disc-detail" d="m7 28 9 5m-9 3 9 5"/>
      </g>
    </svg>
  </div>;
}
