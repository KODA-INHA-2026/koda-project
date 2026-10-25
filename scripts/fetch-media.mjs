import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assetsRoot=path.join(root,'landing','dist','assets');
const manifest=JSON.parse(await fs.readFile(path.join(root,'media-manifest.json'),'utf8'));
const verifyOnly=process.argv.includes('--verify');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const item of manifest.assets){
  if(typeof item.path!=='string'||!/^landing\/dist\/assets\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+$/.test(item.path)||item.path.split('/').some(part=>part==='.'||part==='..')||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('Invalid media manifest entry');
  const target=path.resolve(root,item.path);
  if(!target.startsWith(assetsRoot+path.sep))throw Error('Media path escapes public assets');
  let current=root;
  for(const part of item.path.split('/')){
    current=path.join(current,part);
    try{if((await fs.lstat(current)).isSymbolicLink())throw Error('Linked media path is not allowed');}
    catch(error){if(error.code==='ENOENT')break;throw error;}
  }
  let cached;try{cached=await fs.readFile(target);}catch{}
  if(cached&&cached.length===item.bytes&&digest(cached)===item.sha256){console.log(`Verified ${item.path}`);continue;}
  if(verifyOnly)throw Error(`Missing or changed media: ${item.path}. Run npm run media:fetch.`);
  const url=new URL(item.url);if(url.protocol!=='https:')throw Error('Media URLs must use HTTPS');
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error(`Download failed (${response.status}): ${item.url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==item.bytes||digest(bytes)!==item.sha256)throw Error(`Integrity mismatch: ${item.path}. Public media may have changed; update the manifest only after reviewing the release.`);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target+'.download',bytes);await fs.rename(target+'.download',target);
  console.log(`Downloaded and verified ${item.path}`);
}
