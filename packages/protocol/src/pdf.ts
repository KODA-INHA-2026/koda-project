import { canonicalJson, fromBase64Url, publicKeyFromDid, type EvidencePayload } from './index.js';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export interface SourceFileProofV1 {
  domain: 'KODA-SOURCE-FILE-v1'; proofVersion: 1; evidenceId: string; version: number;
  issuerSigningDid: string; fileHash: string; byteLength: number; mediaType: 'application/pdf'; signature: string;
}
export interface MockAnchorRecord { mode: 'MOCK'; fileHash: string; recordedAt: string; blockLocator: string; issuerSigningDid: string }
export type PdfStatus = 'ORIGINAL_MATCH' | 'CONTENT_CHANGED' | 'NON_ORIGINAL_COPY' | 'COMPARISON_UNAVAILABLE' | 'VERIFICATION_UNAVAILABLE';
export interface PdfDifference { field: string; label: string; before: string; after: string }
export interface PdfInspection { status: PdfStatus; reason: string; checkedAt: string; fileHash?: string; record?: MockAnchorRecord; differences: PdfDifference[]; signature: boolean; fingerprint: boolean }
export interface PdfEntry { field: string; label: string; value: string }
export function proofBytes(proof: SourceFileProofV1): Uint8Array<ArrayBuffer> {
  const { signature: _, ...body } = proof;
  return new TextEncoder().encode(canonicalJson(body));
}
export async function fileSha256(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifySourceProof(bytes: Uint8Array, proof: SourceFileProofV1, expected: { evidenceId: string; version: number; issuerSigningDid: string }): Promise<boolean> {
  if (Object.keys(proof).sort().join() !== ['domain','proofVersion','evidenceId','version','issuerSigningDid','fileHash','byteLength','mediaType','signature'].sort().join() || proof.domain !== 'KODA-SOURCE-FILE-v1' || proof.proofVersion !== 1 || proof.mediaType !== 'application/pdf' || proof.evidenceId !== expected.evidenceId || proof.version !== expected.version || proof.issuerSigningDid !== expected.issuerSigningDid || proof.byteLength !== bytes.byteLength || !/^[a-f0-9]{64}$/.test(proof.fileHash)) return false;
  const key = await crypto.subtle.importKey('raw', publicKeyFromDid(expected.issuerSigningDid), 'Ed25519', false, ['verify']);
  return await fileSha256(bytes) === proof.fileHash && await crypto.subtle.verify('Ed25519', key, fromBase64Url(proof.signature), proofBytes(proof));
}

// Every comparison value is painted as visible text. No JSON attachment or hidden
// payload is trusted. The reader accepts ONLY this bounded, reproducible grammar.
export function pdfEntries(p: EvidencePayload): PdfEntry[] {
  const entries: PdfEntry[] = [];
  const add = (field: string, label: string, value: unknown) => entries.push({ field, label, value: String(value) });
  add('schemaVersion','문서 형식',p.schemaVersion); add('evidenceId','문서 번호',p.evidenceId); add('version','버전',p.version);
  add('customerDisplayName','고객사',p.customerDisplayName); add('tenantId','시연 고객 식별',p.tenantId);
  add('asOfAt','잔고 기준 시각 UTC',p.asOfAt); add('asOfTimeZone','표시 시간대',p.asOfTimeZone);
  add('scenarioIssuedAt','시나리오 발행 시각 UTC',p.scenarioIssuedAt); add('issuedAt','실제 생성 시각 UTC',p.issuedAt);
  add('valuationQuotedAt','기준가 시각 UTC',p.valuationQuotedAt); add('valuationSourceLabel','기준가 출처',p.valuationSourceLabel);
  add('valuationBasis','평가 방식',p.valuationBasis); add('issuerSigningDid','발행 서명 DID',p.issuerSigningDid); add('demo','모의 데이터',p.demo);
  p.assets.forEach((a,i) => { for (const [k,label] of Object.entries({code:'자산 코드',name:'자산명',quantity:'수탁 수량',valuationAmount:'평가액 KRW',valuationCurrency:'통화',custodyAddress:'보관 지갑 주소'})) add(`assets.${i}.${k}`,`${i+1}. ${label}`,a[k as keyof typeof a]); });
  add('movementCount','3분기 거래 건수',p.movements.length);
  p.movements.forEach((m,i) => { for (const [k,label] of Object.entries({id:'거래 번호',asset:'거래 자산',quantity:'거래 수량',occurredAt:'거래 시각 UTC',counterpartyName:'거래 상대방',counterpartyAddress:'상대방 주소',transactionReference:'거래 참조'})) add(`movements.${i}.${k}`,`거래 ${String(i+1).padStart(2,'0')} ${label}`,m[k as keyof typeof m]); });
  return entries;
}
const ascii = (s: string) => new TextEncoder().encode(s);
function join(parts: Uint8Array[]): Uint8Array<ArrayBuffer> { const result = new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let at=0; for (const p of parts) { result.set(p,at); at+=p.length; } return result; }
function binary(bytes: Uint8Array) { let s=''; for(let i=0;i<bytes.length;i+=8192) s+=String.fromCharCode(...bytes.subarray(i,i+8192)); return s; }
const hex = (s: string) => Array.from(s, c => c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
function unhex(s: string) { let text=''; for(let i=0;i<s.length;i+=4) text+=String.fromCharCode(parseInt(s.slice(i,i+4),16)); return text; }
function fontMetrics(font: Uint8Array) {
  const d=new DataView(font.buffer,font.byteOffset,font.byteLength); const table: Record<string,number>={};
  for(let i=0;i<d.getUint16(4);i++) { const at=12+i*16; table[binary(font.subarray(at,at+4))]=d.getUint32(at+8); }
  if (!table.glyf || !table.cmap || !table.hmtx || !table.head || !table.hhea) throw new Error('지원 TrueType 폰트가 아닙니다.');
  const units=d.getUint16(table.head+18); const metrics=d.getUint16(table.hhea+34); let format4=0, format12=0;
  for(let i=0;i<d.getUint16(table.cmap+2);i++) { const at=table.cmap+d.getUint32(table.cmap+4+i*8+4); if(d.getUint16(at)===4) format4=at; if(d.getUint16(at)===12) format12=at; }
  function glyph(cp:number):number {
    if(format12) { for(let i=0;i<d.getUint32(format12+12);i++) { const at=format12+16+i*12, start=d.getUint32(at),end=d.getUint32(at+4); if(cp>=start&&cp<=end)return d.getUint32(at+8)+cp-start; } }
    if(format4) { const n=d.getUint16(format4+6)/2; for(let i=0;i<n;i++) { const end=d.getUint16(format4+14+i*2),start=d.getUint16(format4+16+n*2+i*2); if(cp>=start&&cp<=end) {const delta=d.getInt16(format4+16+n*4+i*2),offAt=format4+16+n*6+i*2,off=d.getUint16(offAt); if(!off)return (cp+delta)&65535; const g=d.getUint16(offAt+off+(cp-start)*2); return g?(g+delta)&65535:0;} } }
    return 0;
  }
  const width = (cp:number) => Math.round(d.getUint16(table.hmtx!+Math.min(glyph(cp),metrics-1)*4)*1000/units);
  return { glyph,width };
}
function visibleLines(entries: PdfEntry[], font: Uint8Array): string[] {
  const {width,glyph}=fontMetrics(font); const lines:string[]=[];
  for(const e of entries) {
    if (!e.label || /[\r\n\x00-\x1f]/.test(e.value+e.label) || e.value.length>512) throw new Error('지원 PDF 텍스트 범위를 벗어났습니다.');
    let line='',w=0;
    for(const c of `${e.label}: ${e.value}`) { const cp=c.codePointAt(0)!; if(cp>65535||!glyph(cp))throw new Error('폰트에 없는 글자입니다.'); const cw=width(cp)/100; if(w+cw>510) {lines.push(line);line='  ';w=width(32)/50;} line+=c;w+=cw; }
    lines.push(line);
  }
  return lines;
}
export function createSupportedPdf(entries: PdfEntry[], font: Uint8Array, salt: string, revision = 'original'): Uint8Array<ArrayBuffer> {
  return serializePdf(visibleLines(entries,font),font,salt,revision);
}
function serializePdf(lines: string[], font: Uint8Array, salt: string, revision: string): Uint8Array<ArrayBuffer> {
  if(!/^[A-Za-z0-9_-]{43}$/.test(salt)||!/^[A-Za-z0-9-]{1,64}$/.test(revision)||lines.length>500) throw new Error('지원 PDF 형식이 아닙니다.');
  const title='KODA | 디지털 자산 잔고 증명서'; const note='모의 데이터 · 시연용 모의 체인 · 실제 기록 아님';
  const disclaimer='발행 파일 동일성 확인용 · 실제 자산 또는 최초 입력값의 진실성을 증명하지 않습니다.';
  const pages=Array.from({length:Math.ceil(lines.length/36)},(_,i)=>lines.slice(i*36,(i+1)*36));
  const {glyph,width}=fontMetrics(font); const chars=[...new Set(Array.from([title,note,disclaimer,...lines,...pages.map((_,i)=>`${i+1} / ${pages.length}`)].join(''),c=>c.charCodeAt(0)))].sort((a,b)=>a-b);
  const mapping=new Uint8Array((Math.max(...chars)+1)*2);const mapview=new DataView(mapping.buffer);for(const cp of chars)mapview.setUint16(cp*2,glyph(cp));
  let cmap='/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /KODA-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
  for(let i=0;i<chars.length;i+=100){const group=chars.slice(i,i+100);cmap+=group.length+' beginbfchar\n'+group.map(cp=>`<${cp.toString(16).padStart(4,'0')}> <${cp.toString(16).padStart(4,'0')}>`).join('\n')+'\nendbfchar\n';}cmap+='endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
  const stream=(data:Uint8Array,extra='')=>join([ascii(`<< /Length ${data.length}${extra} >>\nstream\n`),data,ascii('\nendstream')]);
  const objects:Uint8Array[]=[]; const add=(x:string|Uint8Array)=>objects.push(typeof x==='string'?ascii(x):x);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${pages.map((_,i)=>`${10+i*2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  add('<< /Type /Font /Subtype /Type0 /BaseFont /PretendardVariable /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 8 0 R >>');
  add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /PretendardVariable /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /CIDToGIDMap 7 0 R /DW 1000 /W [${chars.map(cp=>`${cp} [${width(cp)}]`).join(' ')}] >>`);
  add('<< /Type /FontDescriptor /FontName /PretendardVariable /Flags 4 /FontBBox [-1200 -600 2200 1800] /ItalicAngle 0 /Ascent 1000 /Descent -250 /CapHeight 700 /StemV 80 /FontFile2 6 0 R >>');
  add(stream(font,` /Length1 ${font.length}`));add(stream(mapping));add(stream(ascii(cmap)));
  add(`<< /Producer (KODA-supported-text-pdf-1) /KODASalt (${salt}) /KODARevision (${revision}) >>`);
  pages.forEach((page,i)=>{add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${11+i*2} 0 R >>`);
    const draw=(t:string,size:number,x:number,y:number)=>`BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm <${hex(t)}> Tj ET\n`;
    let content='%KODA-TEXT\n'+draw(title,18,40,794)+draw(note,10,40,768)+'%KODA-VALUES\n';page.forEach((line,j)=>content+=draw(line,10,40,738-j*18));content+='%KODA-END\n'+draw(disclaimer,9,40,64)+draw(`${i+1} / ${pages.length}`,10,280,40);add(stream(ascii(content)));
  });
  const parts=[ascii('%PDF-1.7\n%KODA-PDF-1\n')];const offsets=[0];let at=parts[0]!.length;
  objects.forEach((o,i)=>{offsets.push(at);const b=join([ascii(`${i+1} 0 obj\n`),o,ascii('\nendobj\n')]);parts.push(b);at+=b.length;});
  parts.push(ascii(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>o.toString().padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R /Info 9 0 R >>\nstartxref\n${at}\n%%EOF\n`));return join(parts);
}
export function readSupportedPdf(bytes: Uint8Array, font: Uint8Array, expected: PdfEntry[]): PdfEntry[] {
  if(bytes.length>MAX_PDF_BYTES)throw new Error('파일은 10 MiB 이하여야 합니다.');
  const raw=binary(bytes);if(!raw.startsWith('%PDF-1.7\n%KODA-PDF-1\n'))throw new Error('지원 텍스트 PDF가 아닙니다.');
  const meta=/\/KODASalt \(([A-Za-z0-9_-]{43})\) \/KODARevision \(([A-Za-z0-9-]{1,64})\)/.exec(raw);if(!meta)throw new Error('PDF 메타데이터를 판독할 수 없습니다.');
  const lines:string[]=[];for(const m of raw.matchAll(/%KODA-VALUES\n([\s\S]*?)%KODA-END\n/g)){for(const line of m[1]!.trimEnd().split('\n')){const match=/^BT \/F1 10 Tf 1 0 0 1 40 \d+ Tm <([0-9a-f]+)> Tj ET$/.exec(line);if(!match||match[1]!.length%4)throw new Error('PDF 표시 구조가 다릅니다.');lines.push(unhex(match[1]!));}}
  // Rebuild and compare the ENTIRE file, including glyph map, font, objects, xref,
  // operators, positions and trailer. Extra/hidden text, images, overlays, actions,
  // attachments, encryption and incremental updates cannot pass this check.
  const reconstructed=serializePdf(lines,font,meta[1]!,meta[2]!);
  if(reconstructed.length!==bytes.length||!reconstructed.every((b,i)=>b===bytes[i]))throw new Error('지원 범위 밖 PDF 구조입니다.');
  const joined:string[]=[];for(const line of lines){if(line.startsWith('  ')){if(!joined.length)throw new Error('텍스트 순서 오류');joined[joined.length-1]+=line.slice(2);}else joined.push(line);}
  if(joined.length!==expected.length)throw new Error('전체 비교 항목을 판독할 수 없습니다.');
  const actual=expected.map((e,i)=>{const prefix=e.label+': ';if(!joined[i]!.startsWith(prefix))throw new Error('문서 항목이 다릅니다.');return {...e,value:joined[i]!.slice(prefix.length)};});
  if(canonicalJson(visibleLines(actual,font))!==canonicalJson(lines))throw new Error('PDF 줄바꿈 또는 표시 범위가 다릅니다.');
  return actual;
}
export async function inspectPdf(selected: Uint8Array, original: Uint8Array, proof: SourceFileProofV1, payload: EvidencePayload, issuerSigningDid: string, record: MockAnchorRecord | null, font: Uint8Array): Promise<PdfInspection> {
  const base: PdfInspection={status:'VERIFICATION_UNAVAILABLE',reason:'원본의 서명 또는 모의 기록을 확인할 수 없습니다. 원본 검증을 다시 시도해 주세요.',checkedAt:new Date().toISOString(),differences:[],signature:false,fingerprint:false};
  try {
    base.signature=await verifySourceProof(original,proof,{evidenceId:payload.evidenceId,version:payload.version,issuerSigningDid});
    if(!base.signature || payload.issuerSigningDid!==issuerSigningDid || !record || record.mode!=='MOCK' || record.fileHash!==proof.fileHash || record.issuerSigningDid!==issuerSigningDid || !/^MOCK-[1-9][0-9]*$/.test(record.blockLocator) || !Number.isFinite(Date.parse(record.recordedAt)))return base;
    const expected=pdfEntries(payload);const baseline=readSupportedPdf(original,font,expected);
    if(baseline.some((e,i)=>e.value!==expected[i]!.value))return base;
    base.record=record;
    if(selected.length>MAX_PDF_BYTES)return {...base,status:'COMPARISON_UNAVAILABLE',reason:'파일은 10 MiB 이하여야 합니다. 더 작은 지원 PDF를 선택해 주세요.'};
    base.fileHash=await fileSha256(selected);base.fingerprint=base.fileHash===proof.fileHash;
    if(base.fingerprint)return {...base,status:'ORIGINAL_MATCH',reason:'KODA가 발행한 원본과 같습니다.'};
    let actual:PdfEntry[];try{actual=readSupportedPdf(selected,font,expected);}catch{return {...base,status:'COMPARISON_UNAVAILABLE',reason:'지문이 다르며 내용 비교 불가입니다. KODA 지원 텍스트 PDF 원본을 다시 받아 주세요.'};}
    if(actual.some((e,i)=>['schemaVersion','evidenceId','version','tenantId'].includes(e.field)&&e.value!==expected[i]!.value))return {...base,status:'COMPARISON_UNAVAILABLE',reason:'다른 문서 또는 버전입니다. 이 권한에 연결된 파일을 선택해 주세요.'};
    const differences=actual.flatMap((e,i)=>e.value===expected[i]!.value?[]:[{field:e.field,label:e.label,before:expected[i]!.value,after:e.value}]);
    return {...base,differences,status:differences.length?'CONTENT_CHANGED':'NON_ORIGINAL_COPY',reason:differences.length?'체인 기록과 다릅니다.':'원본 아님 · 재저장 사본 또는 열람본'};
  }catch{return base;}
}
