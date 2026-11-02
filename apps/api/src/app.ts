import { registerAccounting } from './accounting.js';
import { registerDemoWallet, type DemoWallet } from './services/demo-wallet.js';
import { sourceFile } from './services/source-file.js';
import Fastify, { LogController, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { AUTH_CHALLENGE_MS, SESSION_MS, fromBase64Url, loginBytes, toBase64Url, publicKeyFromDid, principalSchema, financeSummarySchema, type Challenge, type ChallengeDTO, type SessionDTO } from '@koda/protocol';
import { hash, randomToken, verifyDid } from './crypto/keys.js';
import { principalDTO, toFinanceSummary } from './policy/evidence.js';
import type { PrincipalRow, EvidenceRow } from './repositories/database.js';
import type { TrustedConfig, AnchorReadPort } from '@koda/protocol';
import { ApiError } from './errors.js';
import { registerWorkflows } from './workflows.js';
import { registerIssuer, type IssuerRuntime } from './issuer.js';


interface SessionRow { tokenHash: string; principalId: string; expiresAt: number; revokedAt: number | null; csrf: string }
interface ChallengeRow { challengeId: string; did: string; audience: string; signingBytes: string; expiresAt: number; consumedAt: number | null }
interface Options { db: DatabaseSync; origin: string; now?: () => number; logger?: boolean; trusted?: TrustedConfig; anchor?: AnchorReadPort; issuer?: IssuerRuntime; demoWallet?:DemoWallet }
const emptyQuery = { type: 'object', additionalProperties: false, properties: {} } as const;
const errorSchema = { type: 'object', additionalProperties: false, required: ['code','message','requestId'], properties: { code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } } };
const sessionSchema = { type: 'object', additionalProperties: false, required: ['principal','expiresAt','csrf'], properties: { principal: principalSchema, expiresAt: { type: 'string' }, csrf: { type: 'string' } } };

export function buildApp({ db, origin, now = Date.now, logger = false, trusted, anchor, issuer, demoWallet }: Options) {
  const pdf=issuer?.pdf;
  const publishedJoin=pdf ? "JOIN anchor_jobs a USING(evidenceId,version)" : "JOIN anchor_records a USING(evidenceId,version)";
  const publishedFilter=pdf ? " AND a.status='CONFIRMED'" : '';
  async function summary(row:EvidenceRow, canShare:boolean) {
    const value=toFinanceSummary(row,canShare,pdf?undefined:db.prepare('SELECT txHash,blockHash,instanceId FROM anchor_records WHERE evidenceId=? AND version=?').get(row.evidenceId,row.version) as unknown as import('@koda/protocol').AnchorLocator);
    if(pdf?.internalRoles){value.canShare=false;value.canHandoff=Boolean(db.prepare("SELECT 1 FROM principals WHERE organizationId=? AND role='ACCOUNTING' AND active=1").get(row.tenantId));}
    if(pdf) { const source=sourceFile(db,row.evidenceId,row.version);value.fileHash=source.proof.fileHash;try { value.mockRecord=await pdf.adapter.read(source.proof.fileHash) ?? undefined; } catch { /* do not invent a successful record */ } }
    return value;
  }
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.origin !== origin || parsedOrigin.protocol !== 'http:' || parsedOrigin.hostname !== 'localhost') throw new Error('This demo requires an exact http://localhost origin');
  const app = Fastify({ logger, logController: new LogController({ disableRequestLogging: true }), bodyLimit: 8192, genReqId: () => randomUUID(),
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } } });
  app.register(cookie);
  const rateWindows = new Map<string, { count: number; until: number }>();
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer').header('X-Content-Type-Options', 'nosniff');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin !== origin) throw new ApiError(403, 'ORIGIN_DENIED', '허용된 로컬 화면에서 다시 요청해 주세요.');
    if (req.url.split('?')[0]?.startsWith('/api/auth/')) {
      for (const [ip, window] of rateWindows) if (window.until <= now()) rateWindows.delete(ip);
      const window = rateWindows.get(req.ip) ?? { count: 0, until: now() + 60_000 };
      window.count++; rateWindows.set(req.ip, window);
      if (window.count > 60) throw new ApiError(429, 'RATE_LIMIT', '요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    }
  });
  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown; code?: string }, req, reply) => {
    const status = error instanceof ApiError ? error.statusCode : error.validation || error.statusCode === 400 ? 400 : error.statusCode === 413 ? 413 : 500;
    const code = error instanceof ApiError ? error.code : status === 400 ? 'INVALID_INPUT' : status === 413 ? 'BODY_TOO_LARGE' : 'INTERNAL_ERROR';
    // No bodies, URLs, cookies, signatures, SQL parameters or private values enter logs.
    if (status >= 500) app.log.error({ requestId: req.id, code }, 'API request failed');
    reply.code(status).send({ code, message: error instanceof ApiError ? error.message : status === 400 ? '입력 형식을 확인해 주세요.' : status === 413 ? '입력이 너무 큽니다.' : '요청을 처리하지 못했습니다. 다시 시도해 주세요.', requestId: req.id });
  });
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ code: 'NOT_FOUND', message: '요청한 자료를 찾을 수 없습니다.', requestId: req.id }));
  function session(req: FastifyRequest) {
    const token = req.cookies.koda_session;
    const s = token && /^[A-Za-z0-9_-]{43}$/.test(token) ? db.prepare('SELECT * FROM sessions WHERE tokenHash=?').get(hash(token)) as unknown as SessionRow | undefined : undefined;
    const p = s ? db.prepare('SELECT * FROM principals WHERE id=? AND active=1').get(s.principalId) as unknown as PrincipalRow | undefined : undefined;
    if (!s || !p || s.revokedAt !== null || now() >= s.expiresAt) throw new ApiError(401, 'AUTH_REQUIRED', '인증이 필요하거나 세션이 만료되었습니다. 다시 인증해 주세요.');
    return { s, p };
  }
  function finance(req: FastifyRequest) {
    const auth = session(req);
    if (auth.p.role !== 'FINANCE') throw new ApiError(403, 'ROLE_DENIED', '이 역할에는 재무 증빙 조회 권한이 없습니다.');
    return auth;
  }
  const commonResponses = { '4xx': errorSchema, '5xx': errorSchema };
  registerDemoWallet(app,db,origin,now,pdf?.internalRoles?demoWallet:undefined);

  app.get('/api/health', { schema: { response: { 200: { type: 'object', properties: { ready: { type: 'boolean' }, scope: { type: 'string' } }, additionalProperties: false } } } }, async () => ({ ready: true, scope: pdf ? 'MOCK_PDF_PRD_V03' : 'LOCAL_FIRST_DEMO' }));
  app.get('/api/demo/principals', { schema: { querystring: emptyQuery, response: { 200: { type: 'array', items: principalSchema }, ...commonResponses } } }, async () =>
    (db.prepare('SELECT * FROM principals WHERE active=1 ORDER BY rowid').all() as unknown as PrincipalRow[]).map(principalDTO));

  app.post<{ Body: { did: string } }>('/api/auth/challenge', { schema: {
    body: { type: 'object', additionalProperties: false, required: ['did'], properties: { did: { type: 'string', minLength: 10, maxLength: 64 } } },
    response: { 200: { type: 'object', additionalProperties: false, required: ['challengeId','did','audience','nonce','expiresAt','signingBytes'], properties: Object.fromEntries(['challengeId','did','audience','nonce','expiresAt','signingBytes'].map(k => [k, { type: 'string' }])) }, ...commonResponses },
  } }, async req => {
    try { publicKeyFromDid(req.body.did); } catch { throw new ApiError(400, 'DID_PROFILE', '지원하는 Ed25519 did:key 형식을 확인해 주세요.'); }
    if (!db.prepare('SELECT id FROM principals WHERE did=? AND active=1').get(req.body.did)) throw new ApiError(401, 'AUTH_FAILED', '등록된 데모 신원을 확인해 주세요.');
    db.prepare('DELETE FROM auth_challenges WHERE expiresAt<=?').run(now());
    const c: Challenge = { challengeId: randomUUID(), did: req.body.did, audience: origin, nonce: randomToken(), expiresAt: new Date(now() + AUTH_CHALLENGE_MS).toISOString() };
    const signingBytes = toBase64Url(loginBytes(c));
    db.prepare('INSERT INTO auth_challenges VALUES (?,?,?,?,?,NULL)').run(c.challengeId, c.did, origin, signingBytes, Date.parse(c.expiresAt));
    return { ...c, signingBytes } satisfies ChallengeDTO;
  });

  app.post<{ Body: { challengeId: string; signature: string } }>('/api/auth/verify', { schema: {
    body: { type: 'object', additionalProperties: false, required: ['challengeId','signature'], properties: { challengeId: { type: 'string', maxLength: 64 }, signature: { type: 'string', pattern: '^[A-Za-z0-9_-]{86}$' } } },
    response: { 200: sessionSchema, ...commonResponses },
  } }, async (req, reply) => {
    const c = db.prepare('SELECT * FROM auth_challenges WHERE challengeId=?').get(req.body.challengeId) as unknown as ChallengeRow | undefined;
    const p = c ? db.prepare('SELECT * FROM principals WHERE did=? AND active=1').get(c.did) as unknown as PrincipalRow | undefined : undefined;
    const failure = () => new ApiError(401, 'AUTH_FAILED', '키가 일치하지 않거나 인증 요청이 만료·사용되었습니다. 다시 인증해 주세요.');
    if (!c || !p || c.consumedAt !== null || now() >= c.expiresAt || c.audience !== origin) throw failure();
    let valid = false;
    try { valid = verifyDid(c.did, fromBase64Url(c.signingBytes), fromBase64Url(req.body.signature)); } catch { /* same public error */ }
    if (!valid) throw failure();
    const token = randomToken(); const csrf = randomToken(); const expiresAt = now() + SESSION_MS;
    db.exec('BEGIN IMMEDIATE');
    try {
      const consumed = db.prepare('UPDATE auth_challenges SET consumedAt=? WHERE challengeId=? AND consumedAt IS NULL AND expiresAt>?').run(now(), c.challengeId, now());
      if (consumed.changes !== 1) throw failure();
      // A fresh login invalidates the previous session in this browser.
      if (req.cookies.koda_session) db.prepare('UPDATE sessions SET revokedAt=? WHERE tokenHash=?').run(now(), hash(req.cookies.koda_session));
      db.prepare('INSERT INTO sessions VALUES (?,?,?,NULL,?)').run(hash(token), p.id, expiresAt, csrf);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    reply.setCookie('koda_session', token, { httpOnly: true, sameSite: 'strict', path: '/api', secure: false, maxAge: SESSION_MS / 1000 });
    return { principal: principalDTO(p), expiresAt: new Date(expiresAt).toISOString(), csrf } satisfies SessionDTO;
  });
  app.get('/api/me', { schema: { querystring: emptyQuery, response: { 200: sessionSchema, ...commonResponses } } }, async req => {
    const { s, p } = session(req); return { principal: principalDTO(p), expiresAt: new Date(s.expiresAt).toISOString(), csrf: s.csrf } satisfies SessionDTO;
  });
  app.post('/api/auth/logout', { schema: { response: commonResponses } }, async (req, reply) => {
    const { s } = session(req);
    const provided = req.headers['x-csrf-token'];
    if (typeof provided !== 'string' || Buffer.byteLength(provided) !== Buffer.byteLength(s.csrf) || !timingSafeEqual(Buffer.from(provided), Buffer.from(s.csrf))) throw new ApiError(403, 'CSRF_DENIED', '화면을 새로고침한 뒤 다시 시도해 주세요.');
    db.prepare('UPDATE sessions SET revokedAt=? WHERE tokenHash=?').run(now(), s.tokenHash);
    reply.clearCookie('koda_session', { path: '/api', httpOnly: true, sameSite: 'strict' }).code(204).send();
  });
  app.get('/api/finance/evidence', { schema: { querystring: emptyQuery, response: { 200: { type: 'array', items: financeSummarySchema }, ...commonResponses } } }, async req => {
    const { p } = finance(req);
    const rows = db.prepare('SELECT e.* FROM evidence_versions e '+publishedJoin+' WHERE e.tenantId=?'+publishedFilter+' ORDER BY e.evidenceId DESC,e.version DESC').all(p.organizationId) as unknown as EvidenceRow[];
    return Promise.all(rows.map(row => summary(row, Boolean((trusted || pdf) && db.prepare("SELECT 1 FROM auditor_assignments a JOIN principals p ON a.auditorDid=p.did WHERE a.tenantId=? AND p.active=1 AND p.role='AUDITOR'").get(row.tenantId)))));
  });
  app.get<{ Params: { id: string; version: string } }>('/api/finance/evidence/:id/versions/:version', { schema: {
    querystring: emptyQuery, params: { type: 'object', additionalProperties: false, required: ['id','version'], properties: { id: { type: 'string', maxLength: 80, pattern: '^[A-Za-z0-9-]+$' }, version: { type: 'string', pattern: '^[1-9][0-9]{0,8}$' } } },
    response: { 200: financeSummarySchema, ...commonResponses },
  } }, async req => {
    const { p } = finance(req);
    const row = db.prepare('SELECT e.* FROM evidence_versions e '+publishedJoin+' WHERE e.evidenceId=? AND e.version=? AND e.tenantId=?'+publishedFilter).get(req.params.id, Number(req.params.version), p.organizationId) as unknown as EvidenceRow | undefined;
    if (!row) throw new ApiError(404, 'NOT_FOUND', '요청한 자료를 찾을 수 없습니다.');
    return summary(row, Boolean((trusted || pdf) && db.prepare("SELECT 1 FROM auditor_assignments a JOIN principals p ON a.auditorDid=p.did WHERE a.tenantId=? AND p.active=1 AND p.role='AUDITOR'").get(row.tenantId)));
  });
  registerAccounting(app, { db, session, finance, now, trusted, anchor, pdf });
  registerWorkflows(app, { db, session, finance, now, trusted, anchor, pdf });
  const issuerIdle = registerIssuer(app, { db, session, finance, now, trusted, anchor, pdf }, issuer);
  return Object.assign(app, { issuerIdle });
}
