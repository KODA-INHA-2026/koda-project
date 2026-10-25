import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=import.meta.dirname;
const dist=path.join(root,'dist');
const data=JSON.parse(await fs.readFile(path.join(root,'prospect-companies-v13.json'),'utf8'));
assert.equal(data.classification,'prospective');
assert.match(data.notice,/잠재/);assert.match(data.notice,/실제 고객/);
assert.deepEqual(data.sectors.map(s=>s.id),['manufacturing','content','finance']);
const allIds=new Set(),allNames=new Set();
for(const sector of data.sectors){
 assert.equal(sector.companies.length,100,sector.id+' must have100 companies');
 for(const company of sector.companies){
  for(const field of ['id','name','subIndustry','website','sourceUrl','useCase','sourceNote'])assert.equal(typeof company[field],'string',sector.id+':'+field);
  assert(!allIds.has(company.id),'duplicate company id');allIds.add(company.id);
  const name=company.name.normalize('NFKC').replace(/\s|㈜|주식회사|\(주\)/g,'').toLowerCase();
  assert(!allNames.has(name),'duplicate prospect company:'+company.name);allNames.add(name);
  for(const key of ['website','sourceUrl']){const url=new URL(company[key]);assert(['https:','http:'].includes(url.protocol));assert(!url.username&&!url.password);}
 }
}
await fs.writeFile(path.join(dist,'assets/prospect-companies-v13.json'),JSON.stringify(data,null,2)+'\n');
const navLinks='<a href="industries.html">산업별 활용</a><a href="index.html#tasks">확인 업무</a><a href="research.html">서비스 원리</a><a href="brand.html">브랜드</a>';
const header=(home,wide=false)=>`<header class="product-nav koda-public-nav ${home?'koda-topbar ':''}${wide?'industry-wrap':'wrap'}"><a class="brand-lockup" href="index.html" aria-label="KODA Workspace 홈"><img src="assets/koda.svg" width="117" height="26" alt="KODA"><span>Workspace</span></a><nav aria-label="주 메뉴">${navLinks}</nav><details class="brand-mobile-menu"><summary>메뉴 <span aria-hidden="true">＋</span></summary><div><a href="index.html">홈</a>${navLinks}<a href="verification.html">받은 자료 확인</a><a href="index.html#films">30초 영상</a><a href="workspace.html">워크스페이스 열기</a></div></details><a class="nav-open" href="workspace.html">워크스페이스 열기 <span aria-hidden="true">↗</span></a></header>`;
const foundation=await fs.readFile(path.join(root,'capability-section.html'),'utf8');
const replaceSection=(html,start,end,body,before)=>{
 const content=start+body+end;
 if(html.includes(start)){const from=html.indexOf(start),to=html.indexOf(end,from)+end.length;assert(to>from);return html.slice(0,from)+content+html.slice(to);}
 assert(html.includes(before),'missing insertion anchor:'+before);return html.replace(before,content+before);
};
const preview=`<div class="industry-preview"><div class="industry-preview-heading"><strong>산업별 활용을 더 넓게.</strong><p>잠재 활용 기업 · 실제 고객·제휴 관계 아님</p></div><div class="industry-preview-links">${data.sectors.map(s=>`<a href="industries.html?sector=${s.id}">${s.label}<span>잠재 기업 100곳 ↗</span></a>`).join('')}</div></div>`;
const strip='<section class="industry-capability-strip" aria-label="공개 자료로 확인한 수탁 기반"><p><strong>86.6%</strong>수탁고 기준 국내 1위</p><a href="https://www.kodax.com/" target="_blank" rel="noopener noreferrer">2024년 하반기 · KODA 공개 기준 · 보관·지갑업자 전체 수탁고 대비 ↗</a><a href="https://www.pwc.com/kr/ko/press-room/2026/20260701.html" target="_blank" rel="noopener noreferrer">ISAE 3402 Type 2 · 삼일PwC 보고서 발행 ↗</a></section>';
for(const name of ['index.html','industries.html','research.html','brand.html']){
 const file=path.join(dist,name);let html=await fs.readFile(file,'utf8');
 html=html.replace(/<header\b[\s\S]*?<\/header>/,header(name==='index.html',name==='industries.html'));
 html=html.replaceAll('href="assets/fonts-v11/IBMPlexSansKR-Medium.woff2"','href="assets/fonts-v13/SUIT-Variable.woff2"');
 if(!html.includes('href="public-type-v13.css"'))html=html.replace('</head>','<link rel="stylesheet" href="public-type-v13.css"></head>');
 if(!html.includes('src="public-ui-v13.js"'))html=html.replace('</head>','<script src="public-ui-v13.js" defer></script></head>');
 if(name==='index.html'){
  html=replaceSection(html,'<!-- CUSTODY-FOUNDATION START -->','<!-- CUSTODY-FOUNDATION END -->',foundation,'<!-- EVIDENCE-READER START -->');
  html=replaceSection(html,'<!-- INDUSTRY-PREVIEW START -->','<!-- INDUSTRY-PREVIEW END -->',preview,'<!-- PRODUCT-PREVIEW START -->');
 }
 if(name==='industries.html')html=replaceSection(html,'<!-- CAPABILITY-STRIP START -->','<!-- CAPABILITY-STRIP END -->',strip,'<section class="industry-explorer"');
 await fs.writeFile(file,html);
}
console.log('Built prospect explorer:3 sectors ×100 real companies; shared public navigation, capability evidence and typography.');
