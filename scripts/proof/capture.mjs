import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const directory = 'docs/demo-backup'; mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1120, height: 620 }, deviceScaleFactor: 2 });
const ids = ['S-01','S-02','S-03','S-04','S-05','S-06','S-07','S-08','M-01'];
try {
  for (const id of ids) {
    await page.goto(`${process.env.KODA_PROOF_URL || 'http://localhost:5186'}/?shot=${id}`);
    await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${directory}/${id}.png` });
    const dimensions = await page.locator('.panel').evaluateAll(elements => elements.map(e => ({ height: e.clientHeight, scroll: e.scrollHeight })));
    console.log(id, JSON.stringify(dimensions));
  }
  const gallery = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KODA Proof · 오프라인 시연 백업</title><style>*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:24px;color:#15181f;background:#fff}header{display:flex;justify-content:space-between;gap:20px;align-items:center;border-bottom:2px solid;padding-bottom:14px}h1{font-size:22px;margin:0}p{font-size:12px;color:#5b616e}nav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}button{font:inherit;background:#fff;border:1px solid #15181f;padding:8px 16px;cursor:pointer}button[aria-current=true]{background:#15181f;color:#fff}img{display:block;width:100%;max-width:1500px;border:1px solid #15181f}footer{display:flex;gap:10px;margin-top:16px}</style><header><h1>KODA Proof · 화면 백업</h1><span>모의 데이터 · PRD v0.3</span></header><p>인터넷 없이 9장으로 같은 흐름을 보여줍니다. 단계 버튼 또는 좌우 방향키로 이동합니다. PNG 백업은 정적 화면입니다.</p><nav></nav><img id="screen" alt=""><footer><button id="prev">이전</button><button id="next">다음</button></footer><script>const ids=${JSON.stringify(ids)};let current=0;function render(){document.querySelector('nav').innerHTML=ids.map((id,i)=>'<button aria-current="'+(i===current)+'" data-i="'+i+'">'+id+'</button>').join('');document.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{current=+b.dataset.i;render()});document.querySelector('img').src=ids[current]+'.png';document.querySelector('img').alt=ids[current]+' · KODA 모의 시연 화면'}function go(delta){current=(current+delta+ids.length)%ids.length;render()}document.querySelector('#prev').onclick=()=>go(-1);document.querySelector('#next').onclick=()=>go(1);document.onkeydown=e=>{if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1)};render();</script></html>`;
  writeFileSync(`${directory}/index.html`, gallery);
} finally { await browser.close(); }
