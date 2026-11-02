import { makeSourceFile, sourceFile, sourceProofText, type PdfRuntime } from './services/source-file.js';
import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { canonicalJson, commitmentBytes, parseCanonical, toBase64Url, validatePayload, strictObject, snapshotSchema, jobSchema, eventSchema, envelopeSchema, verificationSchema, type AnchorLocator, type IssuanceJobDTO, type SnapshotDTO, type Statement } from '@koda/protocol';
import { AnchorJobError } from '@koda/chain/issuance';
import { hash } from './crypto/keys.js';
import { syntheticPayload, syntheticV3Payload, syntheticPrdPayload } from './fixtures/synthetic.js';
import { ApiError } from './errors.js';
import { csrf, documentParams, type WorkflowContext } from './workflows.js';
import { evidenceEnvelope, verifyRow } from './services/verification.js';
import type { EvidenceRow } from './repositories/database.js';

export interface IssuerRuntime {
  sign: (bytes: Uint8Array) => string;
  pdf?: PdfRuntime;
  anchor?: (commitment: `0x${string}`, priorTx: `0x${string}` | null, sent: (tx: `0x${string}`) => void) => Promise<AnchorLocator>;
}
interface JobRow { evidenceId: string; version: number; snapshotId: string; actor: string; idempotencyKey: string; requestHash: string; status: IssuanceJobDTO['status']; reasonCode: string; txHash: `0x${string}` | null; createdAt: number; updatedAt: number }
export function registerIssuer(app: FastifyInstance, ctx: WorkflowContext, runtime?: IssuerRuntime) {
  const { db, trusted, now, session, pdf } = ctx;
  const signingDid = pdf?.issuerSigningDid ?? trusted?.issuerSigningDid;
  let queue: Promise<void> = Promise.resolve(); const running = new Set<string>(); let stopping = false;
  const dto = (j: JobRow): IssuanceJobDTO => ({ evidenceId: j.evidenceId, version: j.version, snapshotId: j.snapshotId, status: j.status, reasonCode: j.reasonCode, txHash: j.txHash, createdAt: new Date(j.createdAt).toISOString(), updatedAt: new Date(j.updatedAt).toISOString() });
  const jobFor = (id: string, version: number) => db.prepare('SELECT * FROM anchor_jobs WHERE evidenceId=? AND version=?').get(id, version) as unknown as JobRow | undefined;
  function issuer(req: FastifyRequest) {
    const auth = session(req);
    if (auth.p.role !== 'ISSUER' || auth.p.organizationId !== 'koda-demo') throw new ApiError(403, 'ROLE_DENIED', '발행 담당자만 이 업무를 수행할 수 있습니다.');
    if (!runtime || !signingDid) throw new ApiError(503, 'ISSUER_UNAVAILABLE', '발행 환경을 준비하지 못했습니다. 로컬 준비 상태를 확인해 주세요.');
    return auth;
  }
  function schedule(job: JobRow) {
    const key = job.evidenceId + '/' + job.version;
    if (!runtime || !signingDid || stopping || running.has(key) || job.status === 'CONFIRMED') return;
    running.add(key);
    queue = queue.then(async () => {
      db.prepare("UPDATE anchor_jobs SET status='PENDING',reasonCode='CONFIRMING_RECORD',updatedAt=? WHERE evidenceId=? AND version=?").run(now(), job.evidenceId, job.version);
      const row = db.prepare('SELECT * FROM evidence_versions WHERE evidenceId=? AND version=?').get(job.evidenceId, job.version) as unknown as EvidenceRow;
      const statement = parseCanonical(row.statementCanonical) as Statement;
      try {
        if (pdf) {
          const source=sourceFile(db,row.evidenceId,row.version);
          await pdf.adapter.record(source.proof.fileHash,pdf.issuerSigningDid);
          db.exec('BEGIN IMMEDIATE');
          try {
            db.prepare("UPDATE anchor_jobs SET status='CONFIRMED',reasonCode='MOCK_RECORDED',updatedAt=? WHERE evidenceId=? AND version=?").run(now(),row.evidenceId,row.version);
            db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,NULL,?,?,?,?)').run(randomUUID(),row.tenantId,job.actor,row.evidenceId,row.version,'ISSUED','MOCK_RECORDED','SERVER',now());
            db.exec('COMMIT');
          } catch(e) { db.exec('ROLLBACK'); throw e; }
          return;
        }
        const record = await runtime.anchor!(statement.commitment, jobFor(job.evidenceId, job.version)!.txHash, tx => db.prepare('UPDATE anchor_jobs SET txHash=?,updatedAt=? WHERE evidenceId=? AND version=?').run(tx, now(), job.evidenceId, job.version));
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT OR IGNORE INTO anchor_records VALUES (?,?,?,?,?,?)').run(job.evidenceId, job.version, statement.commitment, record.txHash, record.blockHash, record.instanceId);
          db.prepare("UPDATE anchor_jobs SET status='CONFIRMED',reasonCode='ANCHOR_CONFIRMED',txHash=?,updatedAt=? WHERE evidenceId=? AND version=?").run(record.txHash, now(), job.evidenceId, job.version);
          db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,NULL,?,?,?,?)').run(randomUUID(), row.tenantId, job.actor, job.evidenceId, job.version, 'ISSUED', 'CONFIRMED', 'SERVER', now());
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
      } catch (e) {
        const state = e instanceof AnchorJobError ? e.state : 'UNAVAILABLE'; const reason = e instanceof AnchorJobError ? e.reasonCode : 'ISSUANCE_UNAVAILABLE';
        db.prepare('UPDATE anchor_jobs SET status=?,reasonCode=?,updatedAt=? WHERE evidenceId=? AND version=?').run(state, reason, now(), job.evidenceId, job.version);
      } finally { running.delete(key); }
    });
  }
  if (runtime && signingDid) {
    if (pdf) {
      if (!db.prepare('SELECT 1 FROM issuance_snapshots WHERE snapshotId=?').get('PRD-V03-GAON')) {
        const p=syntheticPrdPayload(signingDid);
        if(pdf.internalRoles){const values=['1942110000','1563408000','1736250000'];p.assets.forEach((a,i)=>a.valuationAmount=values[i]!);p.valuationSourceLabel='제공된 PRD HTML 목업 기준가 · 가상 출처';}
        db.prepare('INSERT INTO issuance_snapshots VALUES (?,?,?,?)').run('PRD-V03-GAON',p.evidenceId,p.version,canonicalJson(p));
      }
    } else {
    for (const tenant of ['a','b'] as const) {
      const snapshotId = 'SYNTHETIC-' + tenant + '-V2';
      if (!db.prepare('SELECT 1 FROM issuance_snapshots WHERE snapshotId=?').get(snapshotId)) {
        const payload = syntheticPayload(tenant, signingDid); payload.version = 2;
        db.prepare('INSERT INTO issuance_snapshots VALUES (?,?,?,?)').run(snapshotId, payload.evidenceId, payload.version, canonicalJson(payload));
      }
    }
    if (!db.prepare('SELECT 1 FROM issuance_snapshots WHERE snapshotId=?').get('GAON-Q3-V03')) {
      const payload = syntheticV3Payload(signingDid);
      db.prepare('INSERT INTO issuance_snapshots VALUES (?,?,?,?)').run('GAON-Q3-V03', payload.evidenceId, payload.version, canonicalJson(payload));
    }
    }
    for (const row of db.prepare("SELECT * FROM anchor_jobs WHERE status IN ('PREPARED','PENDING','UNAVAILABLE') ORDER BY createdAt").all() as unknown as JobRow[]) schedule(row);
  }
  app.addHook('onClose', async () => { stopping = true; await queue; });
  app.get('/api/issuer/snapshots', { schema: { querystring: strictObject({}), response: { 200: { type: 'array', items: snapshotSchema } } } }, async req => {
    issuer(req);
    return db.prepare('SELECT * FROM issuance_snapshots ORDER BY snapshotId').all().map(s => {
      const job = jobFor(String(s.evidenceId), Number(s.version)); return { snapshotId: String(s.snapshotId), payload: parseCanonical(String(s.payloadCanonical)), job: job ? dto(job) : null };
    }) as SnapshotDTO[];
  });
  app.post<{ Body: { snapshotId: string; idempotencyKey: string } }>('/api/issuer/evidence', { schema: { querystring: strictObject({}), body: strictObject({ snapshotId: { type: 'string', maxLength: 80 }, idempotencyKey: { type: 'string', pattern: '^[A-Za-z0-9-]{16,80}$' } }), response: { 200: jobSchema, 202: jobSchema } } }, async (req, reply) => {
    const auth = issuer(req); csrf(req, auth);
    const requestHash = hash(canonicalJson(req.body));
    const prior = db.prepare('SELECT * FROM anchor_jobs WHERE actor=? AND idempotencyKey=?').get(auth.p.id, req.body.idempotencyKey) as unknown as JobRow | undefined;
    if (prior) { if (prior.requestHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', '같은 요청 번호로 다른 자료를 발행할 수 없습니다.'); return dto(prior); }
    const snapshot = db.prepare('SELECT * FROM issuance_snapshots WHERE snapshotId=?').get(req.body.snapshotId);
    if (!snapshot) throw new ApiError(404, 'NOT_FOUND', '발행 후보를 찾을 수 없습니다.');
    const existing = jobFor(String(snapshot.evidenceId), Number(snapshot.version)); if (existing) return dto(existing);
    const payload = parseCanonical(String(snapshot.payloadCanonical)); validatePayload(payload);
    payload.issuedAt = new Date(now()).toISOString();
    if (payload.issuerSigningDid !== signingDid) throw new ApiError(409, 'TRUST_CHANGED', '발행자 기준이 바뀌었습니다. 후보 자료를 새 환경에서 준비해 주세요.');
    const salt = toBase64Url(randomBytes(32)); const commitment = '0x' + hash(commitmentBytes(payload, salt));
    const source = pdf ? await makeSourceFile(payload,salt,pdf,runtime!.sign) : null;
    const statement = source ? sourceProofText(source.proof) : canonicalJson({ domain: 'KODA-CUSTODY-DEMO-STATEMENT-v1', schemaVersion: payload.schemaVersion, evidenceId: payload.evidenceId, version: payload.version, tenantId: payload.tenantId, issuerSigningDid: payload.issuerSigningDid, commitmentAlgorithm: 'SHA-256', commitment, anchorTarget: { chainId: trusted!.chainId, contractAddress: trusted!.contractAddress, instanceId: trusted!.instanceId } });
    const signature = source?.proof.signature ?? runtime!.sign(new TextEncoder().encode(statement));
    issuer(req); csrf(req,session(req));
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO evidence_versions VALUES (?,?,?,?,?,?,?)').run(payload.evidenceId, payload.version, payload.tenantId, canonicalJson(payload), salt, statement, signature);
      if(source) db.prepare('INSERT INTO source_files VALUES (?,?,?,?)').run(payload.evidenceId,payload.version,source.bytes,sourceProofText(source.proof));
      db.prepare("INSERT INTO anchor_jobs VALUES (?,?,?,?,?,?,'PREPARED','QUEUED',NULL,?,?)").run(payload.evidenceId, payload.version, req.body.snapshotId, auth.p.id, req.body.idempotencyKey, requestHash, now(), now());
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    const job = jobFor(payload.evidenceId, payload.version)!; const response = dto(job); schedule(job); reply.code(202); return response;
  });
  app.get<{ Params: { id: string; version: string } }>('/api/issuer/evidence/:id/versions/:version', { schema: { params: documentParams, querystring: strictObject({}), response: { 200: jobSchema } } }, async req => {
    issuer(req); const job = jobFor(req.params.id, Number(req.params.version)); if (!job) throw new ApiError(404, 'NOT_FOUND', '발행 작업을 찾을 수 없습니다.'); return dto(job);
  });
  app.post<{ Params: { id: string; version: string } }>('/api/issuer/evidence/:id/versions/:version/retry', { schema: { params: documentParams, querystring: strictObject({}), response: { 200: jobSchema, 202: jobSchema } } }, async (req, reply) => {
    const auth = issuer(req); csrf(req, auth); const job = jobFor(req.params.id, Number(req.params.version)); if (!job) throw new ApiError(404, 'NOT_FOUND', '발행 작업을 찾을 수 없습니다.');
    if (job.status === 'CONFIRMED') return dto(job);
    schedule(job); reply.code(202); return dto(job);
  });
  app.get<{ Params: { id: string; version: string } }>('/api/issuer/evidence/:id/versions/:version/source', { schema: { params: documentParams, querystring: strictObject({}), response: { 200: strictObject({ envelope: envelopeSchema, verification: verificationSchema }) } } }, async req => {
    issuer(req); const row = db.prepare('SELECT * FROM evidence_versions WHERE evidenceId=? AND version=?').get(req.params.id, Number(req.params.version)) as unknown as EvidenceRow | undefined;
    if (!row) throw new ApiError(404, 'NOT_FOUND', '발행 원본을 찾을 수 없습니다.');
    const verification = await verifyRow(db, row, trusted, now, ctx.anchor, pdf);
    issuer(req);
    return { envelope: evidenceEnvelope(db, row), verification };
  });
  if(pdf) app.get<{ Params: { id:string; version:string } }>('/api/issuer/evidence/:id/versions/:version/file', { schema: { params: documentParams, querystring: strictObject({}) } }, async (req,reply) => { issuer(req);const source=sourceFile(db,req.params.id,Number(req.params.version));return reply.type('application/pdf').header('Content-Disposition','attachment; filename="'+req.params.id+'.pdf"').send(Buffer.from(source.bytes)); });
  app.get<{ Params: { id:string; version:string } }>('/api/issuer/evidence/:id/versions/:version/events', { schema: { params: documentParams, querystring: strictObject({}), response: { 200: { type:'array', items:eventSchema } } } }, async req => { issuer(req);return db.prepare('SELECT * FROM audit_events WHERE evidenceId=? AND version=? ORDER BY at DESC,rowid DESC LIMIT 100').all(req.params.id,Number(req.params.version)).map(r=>({...r,at:new Date(Number(r.at)).toISOString()})); });
  return () => queue;
}
