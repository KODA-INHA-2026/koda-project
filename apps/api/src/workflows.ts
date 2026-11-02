import { requireAccountingGrant, requireParentGrant } from './services/internal-access.js';
import { sourceFile, type PdfRuntime } from './services/source-file.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { canonicalJson, MAX_GRANT_MS, DEFAULT_GRANT_MS, strictObject, grantSchema, grantCreatedSchema, auditAccessSchema, eventSchema, verificationSchema, trustedSchema, type GrantDTO, type AuditEventDTO, type TrustedConfig, type AnchorReadPort } from '@koda/protocol';
import { hash, randomToken } from './crypto/keys.js';
import { ApiError } from './errors.js';
import { evidenceEnvelope, verifyRow } from './services/verification.js';
import type { EvidenceRow, PrincipalRow } from './repositories/database.js';

export interface Auth { p: PrincipalRow; s: { tokenHash: string; csrf: string } }
export interface WorkflowContext { db: DatabaseSync; session: (req: FastifyRequest) => Auth; finance: (req: FastifyRequest) => Auth; now: () => number; trusted?: TrustedConfig; anchor?: AnchorReadPort; pdf?: PdfRuntime }
export function csrf(req: FastifyRequest, auth: Auth) {
  const token = req.headers['x-csrf-token'];
  if (typeof token !== 'string' || Buffer.byteLength(token) !== Buffer.byteLength(auth.s.csrf) || !timingSafeEqual(Buffer.from(token), Buffer.from(auth.s.csrf))) throw new ApiError(403, 'CSRF_DENIED', '화면을 새로고침한 뒤 다시 시도해 주세요.');
}
export const documentParams = strictObject({ id: { type: 'string', maxLength: 80, pattern: '^[A-Za-z0-9-]+$' }, version: { type: 'string', pattern: '^[1-9][0-9]{0,8}$' } });
const idParams = strictObject({ id: { type: 'string', maxLength: 80, pattern: '^[A-Za-z0-9-]+$' } });
const noQuery = strictObject({});
interface GrantRow { id: string; tokenHash: string; tenantId: string; evidenceId: string; version: number; auditorDid: string; auditorOrganizationId: string; scope: 'AUDIT_FULL'; createdBy: string; createdAt: number; expiresAt: number; revokedAt: number | null; idempotencyKey: string; requestHash: string }
const missing = () => new ApiError(404, 'ACCESS_UNAVAILABLE', '이 공유에 접근할 수 없습니다. 인증 신원과 전달받은 링크를 확인해 주세요.');
export function registerWorkflows(app: FastifyInstance, ctx: WorkflowContext) {
  const { db, session, finance, now, trusted, anchor, pdf } = ctx;
  const managerPrefix=pdf?.internalRoles?'/api/accounting':'/api/finance';
  function manager(req:FastifyRequest){
    if(!pdf?.internalRoles)return finance(req);
    const auth=session(req);if(auth.p.role!=='ACCOUNTING')throw new ApiError(403,'ROLE_DENIED','외부 감사 권한은 인계받은 회계담당자가 생성합니다. 재무담당자는 먼저 회계에 인계해 주세요.');return auth;
  }
  function shareAccess(req:FastifyRequest,id:string,version:number){const auth=manager(req);if(pdf?.internalRoles)requireAccountingGrant(db,auth.p,id,version,now());return auth;}
  function document(id: string, version: number, tenant: string) {
    const row = db.prepare('SELECT * FROM evidence_versions WHERE evidenceId=? AND version=? AND tenantId=?').get(id, version, tenant) as unknown as EvidenceRow | undefined;
    if (!row) throw missing(); return row;
  }
  function event(p: PrincipalRow, g: Pick<GrantRow,'tenantId'|'evidenceId'|'version'> & { id?: string }, type: string, result: string, source: 'SERVER' | 'CLIENT_REPORTED' = 'SERVER') {
    db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), g.tenantId, p.id, g.evidenceId, g.version, g.id ?? null, type, result, source, now());
  }
  function dto(g: GrantRow): GrantDTO {
    const person = db.prepare('SELECT name,organizationName FROM principals WHERE did=?').get(g.auditorDid);
    const opened = db.prepare("SELECT MIN(at) AS firstAt, MAX(at) AS lastAt FROM audit_events WHERE grantId=? AND actor IN (SELECT id FROM principals WHERE did=?) AND type='OPENED' AND result='ALLOWED'").get(g.id, g.auditorDid);
    return { auditorOrganizationName: String(person?.organizationName ?? '등록 기관'), firstOpenedAt: opened?.firstAt == null ? null : new Date(Number(opened.firstAt)).toISOString(), lastOpenedAt: opened?.lastAt == null ? null : new Date(Number(opened.lastAt)).toISOString(), id: g.id, evidenceId: g.evidenceId, version: g.version, auditorDid: g.auditorDid, auditorName: String(person?.name ?? '등록 감사인'), scope: 'AUDIT_FULL', createdAt: new Date(g.createdAt).toISOString(), expiresAt: new Date(g.expiresAt).toISOString(), status: g.revokedAt !== null ? 'REVOKED' : now() >= g.expiresAt ? 'EXPIRED' : 'ACTIVE' };
  }
  function authorize(req: FastifyRequest, g: GrantRow | undefined) {
    const { p } = session(req);
    if (!g) throw missing();
    if (p.role !== 'AUDITOR' || p.did !== g.auditorDid || p.organizationId !== g.auditorOrganizationId || g.scope !== 'AUDIT_FULL' || !db.prepare('SELECT 1 FROM auditor_assignments WHERE tenantId=? AND auditorDid=?').get(g.tenantId, p.did)) {
      event(p, g, 'ACCESS_DENIED', 'DENIED'); throw missing();
    }
    if (g.revokedAt !== null || now() >= g.expiresAt) {
      event(p, g, 'ACCESS_DENIED', g.revokedAt !== null ? 'REVOKED' : 'EXPIRED');
      throw new ApiError(410, g.revokedAt !== null ? 'GRANT_REVOKED' : 'GRANT_EXPIRED', g.revokedAt !== null ? '이 공유는 철회되었습니다. 공유한 담당자에게 새 링크를 요청해 주세요.' : '이 공유의 기한이 지났습니다. 공유한 담당자에게 새 링크를 요청해 주세요.');
    }
    if(pdf?.internalRoles)requireParentGrant(db,g.id,now());
    return { p, row: document(g.evidenceId, g.version, g.tenantId) };
  }
  function opened(p: PrincipalRow, g: GrantRow, viewId: string) {
    const id = hash(canonicalJson({ actor: p.id, grant: g.id, viewId, type: 'OPENED' }));
    db.prepare('INSERT OR IGNORE INTO audit_events VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, g.tenantId, p.id, g.evidenceId, g.version, g.id, 'OPENED', 'ALLOWED', 'SERVER', now());
  }
  const byId = (id: string) => db.prepare('SELECT * FROM share_grants WHERE id=?').get(id) as unknown as GrantRow | undefined;

  if (pdf) {
    app.get('/api/verification/file-trust', async req => { session(req); return { mode: 'MOCK', issuerSigningDid: pdf.issuerSigningDid }; });
    app.get<{ Params: { id: string } }>('/api/grants/:id/file', { schema: { params: idParams, querystring: noQuery } }, async (req, reply) => {
      const { row } = authorize(req, byId(req.params.id)); const source = sourceFile(db,row.evidenceId,row.version);
      return reply.type('application/pdf').header('Content-Disposition','attachment; filename="'+row.evidenceId+'.pdf"').send(Buffer.from(source.bytes));
    });
    app.get<{ Params: { id: string } }>('/api/grants/:id/anchor-record', { schema: { params: idParams, querystring: noQuery } }, async req => {
      const g=byId(req.params.id); const {row}=authorize(req,g); const source=sourceFile(db,row.evidenceId,row.version);
      let record; try { record=await pdf.adapter.read(source.proof.fileHash); } catch { throw new ApiError(503,'RECORD_UNAVAILABLE','모의 기록 조회에 실패했습니다. 다시 시도해 주세요.'); }
      authorize(req,byId(req.params.id)); if(!record)throw new ApiError(503,'RECORD_MISSING','모의 기록을 찾을 수 없습니다. 발행 담당자에게 확인해 주세요.'); return record;
    });
    app.get<{ Params: { id: string } }>('/api/grants/:id/events', { schema: { params: idParams, querystring: noQuery, response: { 200: { type: 'array', items: eventSchema } } } }, async req => {
      const g=byId(req.params.id); authorize(req,g);
      return db.prepare('SELECT * FROM audit_events WHERE grantId=? ORDER BY at DESC,rowid DESC LIMIT 100').all(g!.id).map(r=>({...r,at:new Date(Number(r.at)).toISOString()}));
    });
    app.post<{ Params: { id: string }; Body: { schemaVersion: string; status: string } }>('/api/grants/:id/file-verification-events', { schema: { params: idParams, querystring: noQuery, body: strictObject({ schemaVersion: { const: 'pdf-inspection/1' }, status: { enum: ['ORIGINAL_MATCH','CONTENT_CHANGED','NON_ORIGINAL_COPY','COMPARISON_UNAVAILABLE','VERIFICATION_UNAVAILABLE'] } }) } }, async (req,reply) => {
      csrf(req,session(req));const g=byId(req.params.id);const {p}=authorize(req,g);event(p,g!,'PDF_VERIFIED',req.body.status,'CLIENT_REPORTED');return reply.code(204).send();
    });
  }
  app.get('/api/verification/trust', { schema: { querystring: noQuery, response: { 200: trustedSchema } } }, async req => {
    session(req); if (!trusted) throw new ApiError(503, 'TRUST_UNAVAILABLE', '검증 기준을 불러올 수 없습니다.'); return trusted;
  });
  app.post<{ Params: { id:string; version:string }; Body: { viewId:string } }>('/api/finance/evidence/:id/versions/:version/open', { schema: { params: documentParams, querystring: noQuery, body: strictObject({viewId:{type:'string',pattern:'^[A-Za-z0-9-]{16,80}$'}}) } }, async (req,reply)=>{
    const auth=finance(req);csrf(req,auth);const row=document(req.params.id,Number(req.params.version),auth.p.organizationId);
    const id=hash(canonicalJson({actor:auth.p.id,evidenceId:row.evidenceId,version:row.version,viewId:req.body.viewId,type:'FINANCE_OPENED'}));
    db.prepare('INSERT OR IGNORE INTO audit_events VALUES (?,?,?,?,?,NULL,?,?,?,?)').run(id,row.tenantId,auth.p.id,row.evidenceId,row.version,'FINANCE_OPENED','ALLOWED','SERVER',now());return reply.code(204).send();
  });
  app.get(managerPrefix+'/auditors', { schema: { querystring: noQuery, response: { 200: { type: 'array', items: strictObject({ did: { type: 'string' }, name: { type: 'string' }, organizationName: { type: 'string' } }) } } } }, async req => {
    const { p } = manager(req);
    return db.prepare("SELECT p.did,p.name,p.organizationName FROM principals p JOIN auditor_assignments a ON a.auditorDid=p.did WHERE a.tenantId=? AND p.active=1 AND p.role='AUDITOR' ORDER BY p.name").all(p.organizationId);
  });
  app.post<{ Params: { id: string; version: string } }>('/api/finance/evidence/:id/versions/:version/verify', { schema: { params: documentParams, querystring: noQuery, response: { 200: verificationSchema } } }, async req => {
    const auth = finance(req); csrf(req, auth); const row = document(req.params.id, Number(req.params.version), auth.p.organizationId);
    const result = await verifyRow(db, row, trusted, now, anchor, pdf);
    const current = finance(req); csrf(req, current); document(row.evidenceId, row.version, current.p.organizationId);
    event(current.p, row, 'VERIFIED', result.status); return result;
  });
  app.post<{ Params: { id: string; version: string }; Body: { auditorDid: string; expiresAt?: string; idempotencyKey: string } }>('/api/evidence/:id/versions/:version/grants', { schema: {
    params: documentParams, querystring: noQuery, body: strictObject({ auditorDid: { type: 'string', maxLength: 64 }, expiresAt: { type: 'string', maxLength: 30 }, idempotencyKey: { type: 'string', pattern: '^[A-Za-z0-9-]{16,80}$' } }, ['auditorDid','idempotencyKey']), response: { 200: grantCreatedSchema, 201: grantCreatedSchema },
  } }, async (req, reply) => {
    const auth = shareAccess(req,req.params.id,Number(req.params.version)); csrf(req, auth);
    const row = document(req.params.id, Number(req.params.version), auth.p.organizationId);
    const parent=pdf?.internalRoles?requireAccountingGrant(db,auth.p,row.evidenceId,row.version,now()):null;
    const requestHash = hash(canonicalJson({ ...req.body, evidenceId: row.evidenceId, version: row.version }));
    function replay() {
      const old = db.prepare('SELECT * FROM share_grants WHERE createdBy=? AND idempotencyKey=?').get(auth.p.id, req.body.idempotencyKey) as unknown as GrantRow | undefined;
      if (!old) return undefined;
      if (old.tenantId !== auth.p.organizationId || old.requestHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', '이 요청은 다른 조건으로 이미 처리되었습니다. 공유 현황을 확인해 주세요.');
      return { grant: dto(old), replayed: true };
    }
    const old = replay(); if (old) return old;
    const requestedExpiry = req.body.expiresAt === undefined ? now() + DEFAULT_GRANT_MS : Date.parse(req.body.expiresAt);
    const expiresAt = parent ? Math.min(requestedExpiry,parent.expiresAt) : requestedExpiry;
    const validRecipient = () => db.prepare("SELECT p.organizationId FROM principals p JOIN auditor_assignments a ON p.did=a.auditorDid WHERE a.tenantId=? AND p.did=? AND p.active=1 AND p.role='AUDITOR'").get(auth.p.organizationId, req.body.auditorDid);
    const recipient = validRecipient();
    if (!recipient) throw new ApiError(403, 'RECIPIENT_DENIED', '이 회사에 등록된 감사인만 선택할 수 있습니다.');
    const expiryCheck = () => { if (!Number.isFinite(requestedExpiry) || requestedExpiry > now() + MAX_GRANT_MS || !Number.isFinite(expiresAt) || expiresAt <= now() || expiresAt > now() + MAX_GRANT_MS || (req.body.expiresAt !== undefined && new Date(requestedExpiry).toISOString() !== req.body.expiresAt)) throw new ApiError(400, 'INVALID_EXPIRY', '만료는 현재 이후부터 최대 7일까지 지정해 주세요.'); };
    expiryCheck();
    const verified = await verifyRow(db, row, trusted, now, anchor, pdf);
    if (verified.status !== 'VALID') throw new ApiError(409, 'ANCHOR_UNAVAILABLE', '발행 기록을 확인하지 못해 공유를 만들지 않았습니다. 기록 상태를 확인한 뒤 권한 생성을 다시 시도해 주세요.');
    const current = shareAccess(req,row.evidenceId,row.version); csrf(req, current); document(row.evidenceId, row.version, current.p.organizationId);
    if (!validRecipient() || current.p.organizationId !== auth.p.organizationId) throw missing(); expiryCheck();
    if(parent && requireAccountingGrant(db,current.p,row.evidenceId,row.version,now()).id!==parent.id)throw missing();
    db.exec('BEGIN IMMEDIATE');
    try {
      const concurrent = replay(); if (concurrent) { db.exec('COMMIT'); return concurrent; }
      const token = randomToken(); const id = randomUUID();
      db.prepare('INSERT INTO share_grants (id,tokenHash,tenantId,evidenceId,version,auditorDid,auditorOrganizationId,scope,createdBy,createdAt,expiresAt,revokedAt,idempotencyKey,requestHash) VALUES (?,?,?,?,?,?,?,\'AUDIT_FULL\',?,?,?,NULL,?,?)').run(id, hash(token), row.tenantId, row.evidenceId, row.version, req.body.auditorDid, String(recipient.organizationId), auth.p.id, now(), expiresAt, req.body.idempotencyKey, requestHash);
      if(parent)db.prepare('INSERT INTO grant_lineage VALUES (?,?)').run(id,parent.id);
      const g = byId(id)!; event(current.p, g, 'GRANT_CREATED', 'ACTIVE'); db.exec('COMMIT'); reply.code(201); return { grant: dto(g), token, replayed: false };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  app.post<{ Body: { token: string; viewId?: string } }>('/api/grants/open', { schema: { querystring: noQuery, body: strictObject({ token: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' }, viewId: { type: 'string', pattern: '^[A-Za-z0-9-]{16,80}$' } }, ['token']), response: { 200: auditAccessSchema } } }, async req => {
    const auth = session(req); csrf(req, auth);
    const g = db.prepare('SELECT * FROM share_grants WHERE tokenHash=?').get(hash(req.body.token)) as unknown as GrantRow | undefined;
    const { p, row } = authorize(req, g); const envelope = evidenceEnvelope(db, row); opened(p, g!, req.body.viewId ?? randomUUID()); return { grant: dto(g!), envelope, authorizationCheckedAt: new Date(now()).toISOString() };
  });
  app.get<{ Params: { id: string } }>('/api/grants/:id/evidence', { schema: { params: idParams, querystring: noQuery, response: { 200: auditAccessSchema } } }, async req => {
    const g = byId(req.params.id); const { row } = authorize(req, g); return { grant: dto(g!), envelope: evidenceEnvelope(db, row), authorizationCheckedAt: new Date(now()).toISOString() };
  });
  app.post<{ Params: { id: string }; Body: { viewId: string } }>('/api/grants/:id/open', { schema: { params: idParams, querystring: noQuery, body: strictObject({ viewId: { type: 'string', pattern: '^[A-Za-z0-9-]{16,80}$' } }), response: { 200: auditAccessSchema } } }, async req => {
    csrf(req, session(req)); const g = byId(req.params.id); const { p, row } = authorize(req, g);
    const envelope = evidenceEnvelope(db, row); opened(p, g!, req.body.viewId);
    return { grant: dto(g!), envelope, authorizationCheckedAt: new Date(now()).toISOString() };
  });
  app.post<{ Params: { id: string }; Body: { status: 'VALID' | 'INVALID' | 'UNVERIFIABLE' } }>('/api/grants/:id/verification-events', { schema: { params: idParams, querystring: noQuery, body: strictObject({ status: { enum: ['VALID','INVALID','UNVERIFIABLE'] } }) } }, async (req, reply) => {
    csrf(req, session(req)); const g = byId(req.params.id); const { p } = authorize(req, g); event(p, g!, 'VERIFIED', req.body.status, 'CLIENT_REPORTED'); reply.code(204).send();
  });
  const documentQuery = strictObject({ evidenceId: { type: 'string', maxLength: 80 }, version: { type: 'string', pattern: '^[1-9][0-9]{0,8}$' } }, []);
  app.get<{ Querystring: { evidenceId?: string; version?: string } }>(managerPrefix+'/grants', { schema: { querystring: documentQuery, response: { 200: { type: 'array', items: grantSchema } } } }, async req => {
    const { p } = manager(req); const { evidenceId, version } = req.query;
    const rows = db.prepare('SELECT * FROM share_grants WHERE tenantId=? AND (? IS NULL OR evidenceId=?) AND (? IS NULL OR version=?) ORDER BY createdAt DESC,id DESC').all(p.organizationId, evidenceId ?? null, evidenceId ?? null, version ?? null, version ?? null) as unknown as GrantRow[]; return rows.filter(g=>!pdf?.internalRoles||g.createdBy===p.id).map(dto);
  });
  app.post<{ Params: { id: string } }>('/api/grants/:id/revoke', { schema: { params: idParams, querystring: noQuery, response: { 200: grantSchema } } }, async req => {
    const auth = manager(req); csrf(req, auth); const g = byId(req.params.id); if (!g || g.tenantId !== auth.p.organizationId || (pdf?.internalRoles && g.createdBy!==auth.p.id)) throw missing();
    db.exec('BEGIN IMMEDIATE'); try { if (g.revokedAt === null) { db.prepare('UPDATE share_grants SET revokedAt=? WHERE id=?').run(now(), g.id); event(auth.p, g, 'GRANT_REVOKED', 'REVOKED'); } db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    return dto(byId(g.id)!);
  });
  for(const logPrefix of pdf?.internalRoles?['/api/finance','/api/accounting']:['/api/finance']) app.get<{ Querystring: { evidenceId?: string; version?: string } }>(logPrefix+'/events', { schema: { querystring: documentQuery, response: { 200: { type: 'array', items: eventSchema } } } }, async req => {
    const { p } = logPrefix==='/api/accounting'?manager(req):finance(req); const { evidenceId, version } = req.query;
    if(p.role==='ACCOUNTING'){if(!evidenceId||!version)throw new ApiError(400,'DOCUMENT_REQUIRED','문서별로 기록을 조회해 주세요.');requireAccountingGrant(db,p,evidenceId,Number(version),now());}
    const rows = db.prepare('SELECT id,actor,evidenceId,version,grantId,type,result,source,at FROM audit_events WHERE tenantId=? AND (? IS NULL OR evidenceId=?) AND (? IS NULL OR version=?) ORDER BY at DESC,rowid DESC LIMIT 100').all(p.organizationId, evidenceId ?? null, evidenceId ?? null, version ?? null, version ?? null);
    return rows.map(r => ({ id: String(r.id), actor: String(r.actor), evidenceId: String(r.evidenceId), version: Number(r.version), grantId: r.grantId === null ? null : String(r.grantId), type: String(r.type), result: String(r.result), source: r.source, at: new Date(Number(r.at)).toISOString() })) as AuditEventDTO[];
  });
}
