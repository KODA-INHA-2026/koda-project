import { existsSync, readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { buildApp } from './app.js';
import { openDatabase } from './repositories/database.js';
import { MockAnchorAdapter } from './services/source-file.js';
import type { TrustedConfig } from '@koda/protocol';
import type { IssuerRuntime } from './issuer.js';
import { clickableIdentities, type DemoWallet } from './services/demo-wallet.js';
const mode=process.env.KODA_RECORD_MODE;
if(mode!=='MOCK' && mode!=='LOCAL_EVM')throw new Error('KODA_RECORD_MODE must be explicitly MOCK or LOCAL_EVM. No fallback.');
const dir=resolve(process.env.KODA_DATA_DIR ?? '');
if(!process.env.KODA_DATA_DIR || !dir.startsWith(resolve('.demo')+sep))throw new Error('Explicit isolated KODA_DATA_DIR required');
const dbPath=resolve(dir,'demo.sqlite');if(!existsSync(dbPath))throw new Error('Prepare a new isolated environment first.');
if(mode==='MOCK' && !existsSync(resolve(dir,'mock-config.json')))throw new Error('Not a prepared MOCK environment. Existing DB is untouched.');
const db=openDatabase(dbPath);
const keyFile=JSON.parse(readFileSync(resolve(dir,'keys/issuer-signing.json'),'utf8'));
const key=createPrivateKey({key:Buffer.from(keyFile.privateKey,'base64url'),format:'der',type:'pkcs8'});
const signer=(bytes:Uint8Array)=>sign(null,bytes,key).toString('base64url');
let trusted:TrustedConfig|undefined;let issuer:IssuerRuntime;let demoWallet:DemoWallet|undefined;
if(mode==='MOCK'){
  const config=JSON.parse(readFileSync(resolve(dir,'mock-config.json'),'utf8'));
  if(config.mode!=='MOCK'||config.issuerSigningDid!==keyFile.did)throw new Error('MOCK trust mismatch');
  issuer={sign:signer,pdf:{internalRoles:config.internalRoles===true,font:readFileSync(resolve('apps/web/public/fonts/PretendardVariable.ttf')),issuerSigningDid:config.issuerSigningDid,adapter:new MockAnchorAdapter(db)}};
  if(config.internalRoles===true&&process.env.KODA_CLICK_DEMO==='1'){
    const demoKeys=new Map(clickableIdentities.map(id=>{
      const k=JSON.parse(readFileSync(resolve(dir,'keys',id+'.json'),'utf8'));
      if(k.format!=='koda-demo-key/1'||k.principalId!==id)throw new Error('Invalid isolated demo identity');
      return[id,{did:k.did,key:createPrivateKey({key:Buffer.from(k.pkcs8,'base64url'),format:'der',type:'pkcs8'})}];
    }));
    demoWallet=(id,did,bytes)=>{const k=demoKeys.get(id as typeof clickableIdentities[number]);if(!k||k.did!==did)throw new Error('Demo identity binding mismatch');return sign(null,bytes,k.key).toString('base64url');};
  }
}else{
  // Legacy regression mode is opt-in; no EVM client or writer is created in MOCK.
  const {resumeCommitment}=await import('@koda/chain/issuance');
  trusted=JSON.parse(readFileSync(resolve(dir,'trusted.json'),'utf8')) as TrustedConfig;
  const writer=JSON.parse(readFileSync(resolve(dir,'keys/chain-writer.json'),'utf8'));
  issuer={sign:signer,anchor:(commitment,tx,sent)=>resumeCommitment(trusted!,writer.privateKey,commitment,tx,sent)};
}
const app=buildApp({db,origin:process.env.KODA_ORIGIN ?? 'http://localhost:5186',logger:true,trusted,issuer,demoWallet});
await app.listen({host:'127.0.0.1',port:Number(process.env.KODA_API_PORT ?? 3016)});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,async()=>{await app.close();db.close();process.exit(0);});
