import { DatabaseSync } from 'node:sqlite';
import { resolve, sep, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { canonicalJson, parseCanonical, validatePayload, evidenceFile, verifyEnvelope, type TrustedConfig } from '@koda/protocol';
import { readFileSync } from 'node:fs';
import { evidenceEnvelope } from '../apps/api/src/services/verification.js';
import type { EvidenceRow } from '../apps/api/src/repositories/database.js';
import { anchorReader } from '@koda/chain/reader';
const dir = process.env.KODA_DATA_DIR && resolve(process.env.KODA_DATA_DIR);
if (!dir || !dir.startsWith(resolve('.demo') + sep)) throw new Error('Explicit isolated KODA_DATA_DIR required');
const db = new DatabaseSync(join(dir,'demo.sqlite'), { readOnly: true });
try {
  const row = db.prepare('SELECT * FROM evidence_versions WHERE evidenceId=? AND version=1').get('KODA-20260930-GAON') as unknown as EvidenceRow | undefined;
  if (!row) throw new Error('Issue the GAON-Q3-V03 candidate through the authenticated app first.');
  const envelope = evidenceEnvelope(db,row), trusted = JSON.parse(readFileSync(join(dir,'trusted.json'),'utf8')) as TrustedConfig;
  const result = await verifyEnvelope(envelope,trusted,{mode:'SERVER_MEDIATED',anchor:anchorReader(trusted)});
  if(result.status !== 'VALID') throw new Error('Original verification must pass before preparing demo files.');
  const copy = structuredClone(envelope); const payload = parseCanonical(copy.payloadCanonical); validatePayload(payload);
  const btc = payload.assets.find(a=>a.code==='BTC'); if(btc?.quantity !== '12.4500') throw new Error('Unexpected source quantity'); btc.quantity='15.4500'; copy.payloadCanonical=canonicalJson(payload);
  const output=join(dir,'files'); mkdirSync(output,{recursive:true,mode:0o700});
  // Exclusive creation prevents accidentally overwriting a user-edited demo copy.
  writeFileSync(join(output,'gaon-original.json'),evidenceFile(envelope),{mode:0o600,flag:'wx'});
  writeFileSync(join(output,'gaon-mail-copy.json'),evidenceFile(copy),{mode:0o600,flag:'wx'});
  console.log('Prepared two private JSON demo files under KODA_DATA_DIR/files. Issued source unchanged.');
} finally { db.close(); }
