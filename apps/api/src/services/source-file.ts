import type { DatabaseSync } from 'node:sqlite';
import { createSupportedPdf, fileSha256, inspectPdf, pdfEntries, proofBytes, canonicalJson, type SourceFileProofV1, type MockAnchorRecord, type EvidencePayload } from '@koda/protocol';
import { ApiError } from '../errors.js';
import type { EvidenceRow } from '../repositories/database.js';

export function migrateSourceFiles(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS source_files (evidenceId TEXT NOT NULL, version INTEGER NOT NULL, bytes BLOB NOT NULL, proof TEXT NOT NULL, PRIMARY KEY(evidenceId,version), FOREIGN KEY(evidenceId,version) REFERENCES evidence_versions(evidenceId,version));
  CREATE TRIGGER IF NOT EXISTS source_files_no_update BEFORE UPDATE ON source_files BEGIN SELECT RAISE(ABORT,'Immutable source PDF'); END;
  CREATE TRIGGER IF NOT EXISTS source_files_no_delete BEFORE DELETE ON source_files BEGIN SELECT RAISE(ABORT,'Immutable source PDF'); END;
  CREATE TABLE IF NOT EXISTS mock_anchors (sequence INTEGER PRIMARY KEY AUTOINCREMENT, fileHash TEXT NOT NULL UNIQUE, recordedAt TEXT NOT NULL, issuerSigningDid TEXT NOT NULL);
  INSERT OR IGNORE INTO schema_migrations VALUES (4);`);
}
export class MockAnchorAdapter {
  constructor(private db: DatabaseSync, private now = Date.now) {}
  async read(fileHash: string): Promise<MockAnchorRecord | null> {
    const row=this.db.prepare('SELECT * FROM mock_anchors WHERE fileHash=?').get(fileHash);
    return row?{mode:'MOCK',fileHash:String(row.fileHash),recordedAt:String(row.recordedAt),blockLocator:'MOCK-'+row.sequence,issuerSigningDid:String(row.issuerSigningDid)}:null;
  }
  async record(fileHash:string,issuerSigningDid:string) {
    if(!/^[a-f0-9]{64}$/.test(fileHash))throw new Error('Invalid file hash');
    this.db.prepare('INSERT OR IGNORE INTO mock_anchors(fileHash,recordedAt,issuerSigningDid) VALUES (?,?,?)').run(fileHash,new Date(this.now()).toISOString(),issuerSigningDid);
    const record=await this.read(fileHash);
    if(!record||record.issuerSigningDid!==issuerSigningDid)throw new Error('Record binding mismatch');return record;
  }
}
export interface PdfRuntime { internalRoles?: boolean; font: Uint8Array; issuerSigningDid: string; adapter: MockAnchorAdapter }
export async function makeSourceFile(payload: EvidencePayload, salt:string, runtime:PdfRuntime, sign:(bytes:Uint8Array)=>string) {
  const bytes=createSupportedPdf(pdfEntries(payload),runtime.font,salt);
  const proof:SourceFileProofV1={domain:'KODA-SOURCE-FILE-v1',proofVersion:1,evidenceId:payload.evidenceId,version:payload.version,issuerSigningDid:runtime.issuerSigningDid,fileHash:await fileSha256(bytes),byteLength:bytes.length,mediaType:'application/pdf',signature:''};
  proof.signature=sign(proofBytes(proof));return {bytes,proof};
}
export function sourceFile(db:DatabaseSync,id:string,version:number) {
  const row=db.prepare('SELECT bytes,proof FROM source_files WHERE evidenceId=? AND version=?').get(id,version);
  if(!row)throw new ApiError(409,'SOURCE_UNAVAILABLE','고정 원본 PDF가 없습니다. 발행 상태를 확인해 주세요.');
  return {bytes:new Uint8Array(row.bytes as Uint8Array),proof:JSON.parse(String(row.proof)) as SourceFileProofV1};
}
export async function verifyPdfRow(db:DatabaseSync,row:EvidenceRow,runtime:PdfRuntime) {
  const p=JSON.parse(row.payloadCanonical) as EvidencePayload;const source=sourceFile(db,row.evidenceId,row.version);
  if(!db.prepare('SELECT 1 FROM issuer_trust WHERE did=?').get(runtime.issuerSigningDid))throw new ApiError(503,'TRUST_UNAVAILABLE','발행자 신뢰 설정을 확인하지 못했습니다.');
  let record:MockAnchorRecord|null=null;try{record=await runtime.adapter.read(source.proof.fileHash);}catch{/* no RPC fallback */}
  return inspectPdf(source.bytes,source.bytes,source.proof,p,runtime.issuerSigningDid,record,runtime.font);
}
export const sourceProofText=(proof:SourceFileProofV1)=>canonicalJson(proof);
