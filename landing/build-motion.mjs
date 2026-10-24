import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const here=import.meta.dirname;
const cases=JSON.parse(await fs.readFile(path.join(here,'dist/assets/commercial-cases.json'),'utf8')).cases;
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const previews=[
 {label:'받은 대금 확인',hint:'비슷한 주소와 낯선 입금',icon:'receipt',scenario:'lookalike',title:'같아 보이는 주소, 한 번 더 확인해요.',description:'받은 입금의 주소와 거래 정보를 기준 자료와 함께 살펴봐요.'},
 {label:'정산할 주소 확인',hint:'파트너에게 보내기 전에',icon:'arrows-exchange',scenario:'normal',title:'파트너가 등록한 주소인지 확인해요.',description:'정산 요청과 등록 자료를 맞춘 뒤, 두 사람의 승인으로 이어가요.'},
 {label:'감사에 보낼 거래',hint:'받은 자료가 달라지지 않았는지',icon:'file-text',scenario:'tampered',title:'자료가 바뀌었다면, 공유를 멈춰요.',description:'발급처와 서명, 필요한 거래를 확인한 뒤 보낼 항목을 골라요.'}
];
const panels=cases.map((c,i)=>{const p=previews[i];return `<section class="task-panel assurance-preview-panel" id="task-panel-${c.id}" role="tabpanel" aria-labelledby="task-tab-${c.id}" tabindex="0"${i?' hidden':''} data-assurance-preview="${c.id}" data-scenario="${p.scenario}" aria-busy="true"><div class="preview-appbar"><div class="preview-company"><span class="company-monogram" aria-hidden="true">${c.company[0]}</span><div><strong>${esc(c.company)}</strong><span>${esc(c.industry)}</span></div></div><span class="preview-page-name">${p.label}</span></div><div class="preview-workspace"><div class="preview-main"><h3>${p.title}</h3><p class="preview-context">${p.description}</p><div class="preview-verdict" data-preview-verdict role="status"><span class="preview-verdict-mark" aria-hidden="true">…</span><div><strong data-preview-title>확인 내역을 불러오는 중</strong><p data-preview-summary>자료의 발급처와 대상 정보를 확인해요.</p></div></div><dl class="preview-facts" data-preview-facts></dl><ul class="preview-checks" data-preview-checks aria-label="자료 검사 항목"></ul></div><aside class="preview-aside"><div><p>자료를 확인하는 기준</p><strong>주소 · 출처 · 거래</strong><span>출처가 맞아도 요청한 주소나 거래와 다르면 다음 업무를 멈춰요.</span></div><dl><dt>발급처</dt><dd>산학프로젝트 샘플 발급키</dd><dt>확인 기준 시간</dt><dd data-preview-time>2026.10.24 14:30 KST</dd></dl><a class="button primary task-open" href="workspace.html?client=${c.id}&amp;view=detail&amp;scenario=${p.scenario}">${p.label}<span aria-hidden="true">↗</span></a></aside></div></section>`;}).join('\n');
const fragment=`<div class="task-preview"><div class="task-tabs" role="tablist" aria-label="살펴볼 확인 업무">${cases.map((c,i)=>`<button class="task-tab" id="task-tab-${c.id}" role="tab" type="button" aria-selected="${i===0}" aria-controls="task-panel-${c.id}" tabindex="${i===0?0:-1}"><img src="assets/icons/${previews[i].icon}.svg" alt="" width="22" height="22"><span><strong>${previews[i].label}</strong><small>${previews[i].hint}</small></span></button>`).join('')}</div><div class="task-panels">${panels}</div></div>`;
const htmlFile=path.join(here,'dist/index.html');
let html=await fs.readFile(htmlFile,'utf8');
html=html.replace(/<!-- PRODUCT-PREVIEW START -->[\s\S]*?<!-- PRODUCT-PREVIEW END -->/,`<!-- PRODUCT-PREVIEW START -->${fragment}<!-- PRODUCT-PREVIEW END -->`);
await fs.writeFile(htmlFile,html);
await build({entryPoints:[path.join(here,'motion-source.js')],bundle:true,format:'iife',minify:true,target:['chrome100','safari15.4'],outfile:path.join(here,'dist/product-motion.js'),legalComments:'inline'});
const licenseDir=path.join(here,'dist/assets/licenses');await fs.mkdir(licenseDir,{recursive:true});
for(const name of ['motion','motion-dom','motion-utils']){
 const filenames=await fs.readdir(path.join(here,'node_modules',name));
 const license=filenames.find(f=>/^licen[cs]e(\.md|\.txt)?$/i.test(f));
 await fs.copyFile(path.join(here,'node_modules',name,license),path.join(licenseDir,`${name}-LICENSE.txt`));
}
const brand=await fs.readFile(path.join(here,'brand-direction.html'),'utf8');
await fs.writeFile(path.join(here,'dist/brand.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KODA — 확인한 근거에서 다음 업무로</title><link rel="preload" href="assets/PretendardVariable.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="product.css"></head><body class="product-brand"><a class="skip" href="#main">본문으로 이동</a><header class="product-nav wrap"><a class="brand-lockup" href="index.html"><img src="assets/koda.svg" width="117" height="26" alt="KODA"><span>Workspace</span></a><nav aria-label="주 메뉴"><a href="workspace.html">거래 확인</a><a href="verification.html">받은 내역 확인</a><a href="research.html">서비스 원리</a><a href="index.html#films">영상</a></nav></header><main id="main" class="research-content wrap">${brand}</main><footer class="product-footer wrap"><div><strong>KODA Workspace</strong><p>산학프로젝트 프로토타입 · 샘플 발급키 · 실제 거래 없음</p></div><a href="assets/CREDITS.txt">출처와 라이선스</a></footer></body></html>`);
console.log('Built accessible assurance task tabs and Motion mini. Status is verified by the shared core at runtime.');
