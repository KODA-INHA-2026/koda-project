import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { accountingSummarySchema, internalGrantSchema, strictObject, MAX_GRANT_MS, DEFAULT_GRANT_MS, canonicalJson, type AccountingSummaryDTO } from '@koda/protocol';
import { csrf, documentParams, type WorkflowContext } from './workflows.js';
import { hash } from './crypto/keys.js';
import { ApiError } from './errors.js';
import { payloadOf, type EvidenceRow } from './repositories/database.js';
import { toFinanceSummary } from './policy/evidence.js';
import { sourceFile } from './services/source-file.js';
import { verifyRow } from './services/verification.js';
import { internalGrantDTO, requireAccountingGrant, type InternalGrantRow } from './services/internal-access.js';

export function registerAccounting(app: FastifyInstance, ctx: WorkflowContext) {
  const { db,session,finance,now,pdf,trusted,anchor }=ctx;
  if(!pdf?.internalRoles)return;
  const empty=strictObject({});
  const idParams=strictObject({id:{type:'string',pattern:'^[A-Za-z0-9-]{1,80}$'}});
  function document(id:string,version:number,tenant:string) {
    const row=db.prepare("SELECT e.* FROM evidence_versions e JOIN anchor_jobs a USING(evidenceId,version) WHERE e.evidenceId=? AND e.version=? AND e.tenantId=? AND a.status='CONFIRMED'").get(id,version,tenant) as unknown as EvidenceRow|undefined;
    if(!row)throw new ApiError(404,'NOT_FOUND','발행된 증빙을 찾을 수 없습니다.');return row;
  }
  function event(actor:string,g:InternalGrantRow,type:string,result:string) {
    db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),g.tenantId,actor,g.evidenceId,g.version,g.id,type,result,'SERVER',now());
  }
  app.get('/api/finance/accountants',{schema:{querystring:empty,response:{200:{type:'array',items:strictObject({did:{type:'string'},name:{type:'string'},organizationName:{type:'string'}})}}}},async req=>{
    const {p}=finance(req);return db.prepare("SELECT did,name,organizationName FROM principals WHERE role='ACCOUNTING' AND active=1 AND organizationId=? ORDER BY name").all(p.organizationId);
  });
  const grantPath='/api/finance/evidence/:id/versions/:version/internal-grants';
  app.get<{Params:{id:string;version:string}}>(grantPath,{schema:{params:documentParams,querystring:empty,response:{200:{type:'array',items:internalGrantSchema}}}},async req=>{
    const {p}=finance(req);document(req.params.id,Number(req.params.version),p.organizationId);
    return (db.prepare('SELECT * FROM internal_grants WHERE tenantId=? AND evidenceId=? AND version=? ORDER BY createdAt DESC,rowid DESC').all(p.organizationId,req.params.id,Number(req.params.version)) as unknown as InternalGrantRow[]).map(g=>internalGrantDTO(db,g,now()));
  });
  app.post<{Params:{id:string;version:string};Body:{recipientDid:string;expiresAt?:string;idempotencyKey:string}}>(grantPath,{schema:{params:documentParams,querystring:empty,body:strictObject({recipientDid:{type:'string',maxLength:64},expiresAt:{type:'string',maxLength:30},idempotencyKey:{type:'string',pattern:'^[A-Za-z0-9-]{16,80}$'}},['recipientDid','idempotencyKey']),response:{200:internalGrantSchema,201:internalGrantSchema}}},async(req,reply)=>{
    const auth=finance(req);csrf(req,auth);const row=document(req.params.id,Number(req.params.version),auth.p.organizationId);
    const requestHash=hash(canonicalJson({...req.body,evidenceId:row.evidenceId,version:row.version}));
    const replay=()=>{const old=db.prepare('SELECT * FROM internal_grants WHERE createdBy=? AND idempotencyKey=?').get(auth.p.id,req.body.idempotencyKey) as unknown as InternalGrantRow|undefined;if(old&&old.requestHash!==requestHash)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','이미 다른 조건으로 처리한 요청입니다. 인계 현황을 확인해 주세요.');return old;};
    const old=replay();if(old)return internalGrantDTO(db,old,now());
    const expiresAt=req.body.expiresAt===undefined?now()+DEFAULT_GRANT_MS:Date.parse(req.body.expiresAt);
    const check=()=>{
      if(!db.prepare("SELECT 1 FROM principals WHERE did=? AND role='ACCOUNTING' AND active=1 AND organizationId=?").get(req.body.recipientDid,auth.p.organizationId))throw new ApiError(403,'RECIPIENT_DENIED','같은 회사의 등록된 회계담당자만 선택할 수 있습니다.');
      if(!Number.isFinite(expiresAt)||expiresAt<=now()||expiresAt>now()+MAX_GRANT_MS||(req.body.expiresAt!==undefined&&new Date(expiresAt).toISOString()!==req.body.expiresAt))throw new ApiError(400,'INVALID_EXPIRY','현재 이후부터 최대 7일 이내의 만료 시각을 선택해 주세요.');
    };check();
    const verified=await verifyRow(db,row,trusted,now,anchor,pdf);
    if(verified.status!=='VALID')throw new ApiError(409,'RECORD_UNAVAILABLE','발행 기록을 확인하지 못했습니다. 기록 확인 후 인계를 다시 시도해 주세요.');
    const current=finance(req);csrf(req,current);if(current.p.id!==auth.p.id||current.p.organizationId!==auth.p.organizationId)throw new ApiError(403,'ROLE_DENIED','신원이 변경되었습니다. 다시 인증해 주세요.');check();
    db.exec('BEGIN IMMEDIATE');try{
      const concurrent=replay();if(concurrent){db.exec('COMMIT');return internalGrantDTO(db,concurrent,now());}
      const g:InternalGrantRow={id:randomUUID(),tenantId:row.tenantId,evidenceId:row.evidenceId,version:row.version,recipientDid:req.body.recipientDid,createdBy:auth.p.id,createdAt:now(),expiresAt,revokedAt:null,firstOpenedAt:null,idempotencyKey:req.body.idempotencyKey,requestHash};
      db.prepare('INSERT INTO internal_grants VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?,?)').run(g.id,g.tenantId,g.evidenceId,g.version,g.recipientDid,g.createdBy,g.createdAt,g.expiresAt,g.idempotencyKey,g.requestHash);
      event(auth.p.id,g,'INTERNAL_GRANTED','ACTIVE');db.exec('COMMIT');reply.code(201);return internalGrantDTO(db,g,now());
    }catch(e){db.exec('ROLLBACK');throw e;}
  });
  app.post<{Params:{id:string}}>('/api/internal-grants/:id/revoke',{schema:{params:idParams,querystring:empty,response:{200:internalGrantSchema}}},async req=>{
    const auth=finance(req);csrf(req,auth);const g=db.prepare('SELECT * FROM internal_grants WHERE id=? AND tenantId=?').get(req.params.id,auth.p.organizationId) as unknown as InternalGrantRow|undefined;
    if(!g)throw new ApiError(404,'NOT_FOUND','인계 권한을 찾을 수 없습니다.');
    db.exec('BEGIN IMMEDIATE');try{if(g.revokedAt===null){g.revokedAt=now();db.prepare('UPDATE internal_grants SET revokedAt=? WHERE id=?').run(g.revokedAt,g.id);event(auth.p.id,g,'INTERNAL_REVOKED','REVOKED');}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    return internalGrantDTO(db,g,now());
  });
  async function summary(req:import('fastify').FastifyRequest,id:string,version:number):Promise<AccountingSummaryDTO>{
    const {p}=session(req);const g=requireAccountingGrant(db,p,id,version,now());const row=document(id,version,p.organizationId);const payload=payloadOf(row);
    const value=toFinanceSummary(row,true);const file=sourceFile(db,id,version);value.fileHash=file.proof.fileHash;
    try{value.mockRecord=await pdf!.adapter.read(file.proof.fileHash)??undefined;}catch{/* no success invented */}
    const current=session(req);const valid=requireAccountingGrant(db,current.p,id,version,now());
    if(current.p.id!==p.id||valid.id!==g.id)throw new ApiError(403,'ACCESS_CHANGED','열람 권한이 변경되었습니다. 다시 열어 주세요.');
    return {...value,internalGrant:internalGrantDTO(db,g,now()),journal:payload.movements.map(m=>({occurredAt:m.occurredAt,asset:m.asset,quantity:m.quantity}))};
  }
  app.get('/api/accounting/evidence',{schema:{querystring:empty,response:{200:{type:'array',items:accountingSummarySchema}}}},async req=>{
    const {p}=session(req);if(p.role!=='ACCOUNTING')throw new ApiError(403,'ROLE_DENIED','회계담당자만 접근할 수 있습니다.');
    const rows=db.prepare('SELECT DISTINCT evidenceId,version FROM internal_grants WHERE tenantId=? AND recipientDid=? AND revokedAt IS NULL AND expiresAt>?').all(p.organizationId,p.did,now());
    return Promise.all(rows.map(r=>summary(req,String(r.evidenceId),Number(r.version))));
  });
  app.get<{Params:{id:string;version:string}}>('/api/accounting/evidence/:id/versions/:version',{schema:{params:documentParams,querystring:empty,response:{200:accountingSummarySchema}}},req=>summary(req,req.params.id,Number(req.params.version)));
  app.post<{Params:{id:string;version:string};Body:{viewId:string}}>('/api/accounting/evidence/:id/versions/:version/open',{schema:{params:documentParams,querystring:empty,body:strictObject({viewId:{type:'string',pattern:'^[A-Za-z0-9-]{16,80}$'}})}},async(req,reply)=>{
    const auth=session(req);csrf(req,auth);const g=requireAccountingGrant(db,auth.p,req.params.id,Number(req.params.version),now());
    const id=hash(canonicalJson({actor:auth.p.id,grant:g.id,viewId:req.body.viewId,type:'ACCOUNTING_OPENED'}));
    db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT OR IGNORE INTO audit_events VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,g.tenantId,auth.p.id,g.evidenceId,g.version,g.id,'ACCOUNTING_OPENED','ALLOWED','SERVER',now());db.prepare('UPDATE internal_grants SET firstOpenedAt=COALESCE(firstOpenedAt,?) WHERE id=?').run(now(),g.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return reply.code(204).send();
  });
}
