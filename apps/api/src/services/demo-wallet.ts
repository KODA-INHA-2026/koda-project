import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { fromBase64Url, publicKeyFromDid, strictObject } from '@koda/protocol';
import { ApiError } from '../errors.js';

// Explicitly enabled demo identities only. Never accepts arbitrary bytes or a key path.
export const clickableIdentities = ['issuer','finance-a','accounting-a','auditor-b'] as const;
export type DemoWallet = (id: string, did: string, bytes: Uint8Array) => string;
export function registerDemoWallet(app: FastifyInstance, db: DatabaseSync, origin: string, now:()=>number, wallet?:DemoWallet) {
  app.get('/api/demo/auth-mode',async()=>({mode:wallet?'CLICK':'FILE',identities:wallet?clickableIdentities:[]}));
  if(!wallet)return;
  const principalId={type:'string',enum:[...clickableIdentities]};
  const text={type:'string'};
  const resolve=(id:string)=>{
    if(!clickableIdentities.includes(id as typeof clickableIdentities[number]))throw new ApiError(403,'DEMO_IDENTITY_DENIED','준비된 시연 신원을 선택해 주세요.');
    const p=db.prepare('SELECT id,did FROM principals WHERE id=? AND active=1').get(id);
    if(!p)throw new ApiError(401,'DEMO_IDENTITY_UNAVAILABLE','이 시연 신원이 비활성화됐습니다. 다른 역할을 선택하거나 준비 상태를 확인해 주세요.');
    publicKeyFromDid(String(p.did));return {id:String(p.id),did:String(p.did)};
  };
  app.post<{Body:{principalId:string}}>('/api/auth/demo-resolve',{schema:{body:strictObject({principalId}),response:{200:strictObject({mode:{const:'MOCK',type:'string'},did:text,resolvedAt:text})}}},async req=>{
    // Local registry adapter: reads the registered DID, not an external DID blockchain.
    const p=resolve(req.body.principalId);return{mode:'MOCK',did:p.did,resolvedAt:new Date(now()).toISOString()};
  });
  app.post<{Body:{principalId:string;challengeId:string}}>('/api/auth/demo-sign',{schema:{body:strictObject({principalId,challengeId:{type:'string',maxLength:64}}),response:{200:strictObject({signature:text,mode:{type:'string',const:'MOCK'}})}}},async req=>{
    const p=resolve(req.body.principalId);
    const c=db.prepare('SELECT * FROM auth_challenges WHERE challengeId=?').get(req.body.challengeId);
    if(!c||c.did!==p.did||c.audience!==origin||c.consumedAt!==null||Number(c.expiresAt)<=now())throw new ApiError(401,'AUTH_FAILED','인증 요청이 만료되었거나 신원이 다릅니다. 역할을 다시 눌러 주세요.');
    return{signature:wallet(p.id,p.did,fromBase64Url(String(c.signingBytes))),mode:'MOCK'};
  });
}
