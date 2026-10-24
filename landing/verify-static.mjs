import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'dist');
for(const name of ['embla-carousel','motion','motion-dom','motion-utils'])assert(fs.readFileSync(path.join(root,'assets/licenses',`${name}-LICENSE.txt`),'utf8').includes('Permission is hereby granted'),'Missing MIT notice');
for(const name of ['index.html','workspace.html','research.html','brand.html','verification.html']){
 const html=fs.readFileSync(path.join(root,name),'utf8');
 for(const [,attr,url] of html.matchAll(/\b(src|href|poster)="([^"]+)"/g)){
  if(url.startsWith('#')||/^https?:/.test(url))continue;
  assert(fs.existsSync(path.join(root,url.split(/[?#]/)[0])),`Missing ${name} ${attr}: ${url}`);
 }
}
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.equal([...home.matchAll(/<video\b/g)].length,1,'Publish exactly one product film');
assert(!/90s|90초|90-second|commercial-blueprint/i.test(home),'Retired film reference in home');
for(const file of fs.readdirSync(path.join(root,'assets')))assert(!/90s|commercial-blueprint/i.test(file),`Retired public film asset: ${file}`);
const movies=fs.readdirSync(path.join(root,'assets')).filter(file=>/\.(mp4|webm|mov)$/i.test(file));
assert.deepEqual(movies,['koda-concept-demo-30s-v7.mp4'],'Publish only the current 30-second film');
const vtt=fs.readFileSync(path.join(root,'assets/koda-concept-demo-30s-v7-ko.vtt'),'utf8');
assert(vtt.startsWith('WEBVTT'),'Invalid VTT header');
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'assets/demo-fixtures.json'),'utf8'));
assert.equal(fixtures.isDemo,true);
assert.deepEqual(fixtures.scenarios.map(x=>x.id),['match','mismatch','stale']);
const commercial=JSON.parse(fs.readFileSync(path.join(root,'assets/commercial-cases.json'),'utf8'));
assert.deepEqual(commercial.cases.map(c=>c.id),['export','game','audit']);
const game=commercial.cases.find(c=>c.id==='game');assert.equal(game.partners.reduce((sum,p)=>sum+p.amount,0),game.amount);
const audit=commercial.cases.find(c=>c.id==='audit');assert.equal(audit.transactions.length,audit.transactionCount);
assert.deepEqual(audit.transactions.map(t=>[t.asset,t.amount]),[['USDC',5000],['ETH',-1],['BTC',0.1]]);
const tokens=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'design/visual-tokens.json'),'utf8'));
const css=fs.readFileSync(path.join(root,'tokens.css'),'utf8');
for(const [k,v] of Object.entries(tokens.colors))assert(css.includes(`--${k}: ${v};`),`Token drift: ${k}`);
console.log('PASS: five pages, linked assets, one current 30-second film, captions, distinct client fixtures, settlement total, audit transaction consistency and shared tokens.');
