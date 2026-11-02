import { prepareInternalRoles } from '../apps/api/src/services/internal-access.js';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { newIdentity } from '../apps/api/src/crypto/keys.js';
import { openDatabase, insertPrincipal } from '../apps/api/src/repositories/database.js';
import { migrateSourceFiles } from '../apps/api/src/services/source-file.js';
import { demoPeople, accountingPeople } from '../apps/api/src/fixtures/synthetic.js';
const dir=resolve(process.env.KODA_DATA_DIR ?? '');
if(!process.env.KODA_DATA_DIR || !dir.startsWith(resolve('.demo')+sep))throw new Error('Explicit isolated .demo child required');
if(existsSync(dir))throw new Error('Target exists. No overwrite, reset or migration of existing environments. Choose a new isolated directory.');
mkdirSync(join(dir,'keys'),{recursive:true,mode:0o700});chmodSync(dir,0o700);
const db=openDatabase(join(dir,'demo.sqlite'));migrateSourceFiles(db);prepareInternalRoles(db);
const write=(name:string,data:unknown)=>writeFileSync(join(dir,name),JSON.stringify(data,null,2),{mode:0o600});
try {
  for(const p of [...demoPeople,...accountingPeople]){const key=newIdentity();insertPrincipal(db,{...p,organizationName:p.id==='finance-a'?'㈜가온테크':p.id==='auditor-b'?'한울회계법인':p.organizationName,did:key.did,keyFile:p.id+'.json'});write('keys/'+p.id+'.json',{format:'koda-demo-key/1',principalId:p.id,did:key.did,pkcs8:key.privateKey});if(p.id==='auditor-b')db.prepare('INSERT INTO auditor_assignments VALUES (?,?)').run('tenant-a',key.did);}
  const issuer=newIdentity();write('keys/issuer-signing.json',issuer);db.prepare('INSERT INTO issuer_trust VALUES (?,?)').run(issuer.did,issuer.publicKey);write('mock-config.json',{mode:'MOCK',internalRoles:true,issuerSigningDid:issuer.did});
} finally {db.close();chmodSync(join(dir,'demo.sqlite'),0o600);}
console.log('MOCK environment prepared. No RPC, writer key, pre-issued document or external network.');
