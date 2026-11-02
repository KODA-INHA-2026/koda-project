import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]); }
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
if (tracked.some(p => /(^|\/)(local-design|\.demo|node_modules)(\/|$)|\.(sqlite|pem)$/.test(p))) throw new Error('Private/runtime material is tracked by Git');
execFileSync('git', ['check-ignore', '.demo/keys/finance-a.json', 'local-design/README.md']);
const privateValues = [];
const dataDir = resolve(process.env.KODA_DATA_DIR ?? '.demo/overnight-20261102');
if (!dataDir.startsWith(resolve('.demo') + sep)) throw new Error('Boundary scan requires isolated .demo child');
if (existsSync(join(dataDir, 'keys'))) for (const file of files(join(dataDir, 'keys'))) {
  const key = JSON.parse(readFileSync(file, 'utf8')); for (const field of ['pkcs8','privateKey']) if (key[field]) privateValues.push(key[field]);
}
if (existsSync(join(dataDir, 'demo.sqlite'))) {
  const db = new DatabaseSync(join(dataDir, 'demo.sqlite'), { readOnly: true });
  for (const row of db.prepare('SELECT * FROM evidence_versions').all()) {
    const p = JSON.parse(row.payloadCanonical);
    privateValues.push(row.payloadCanonical, row.salt, row.signature, row.statementCanonical, ...p.assets.map(a => a.custodyAddress), ...p.movements.flatMap(m => [m.counterpartyAddress,m.transactionReference]));
  } db.close();
}
const webFiles = existsSync('apps/web/dist') ? files('apps/web/dist') : [];
if (!webFiles.length) throw new Error('Build the web app before checking its distribution');
for (const file of webFiles) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('SYNTHETIC_PRIVATE_') || text.includes('local-design/') || privateValues.some(value => text.includes(value))) throw new Error('Private material found in web distribution: ' + file);
}
const logFiles = existsSync(dataDir) ? readdirSync(dataDir).filter(f => f.endsWith('.log')).map(f => join(dataDir,f)) : [];
for (const file of logFiles) {
  const text = readFileSync(file, 'utf8');
  if (privateValues.some(value => text.includes(value))) throw new Error('Private value found in log: ' + file);
}
console.log(`Boundary PASS: ${webFiles.length} web artifacts and ${logFiles.length} logs scanned; ${privateValues.length} private values absent; Git exclusion confirmed.`);
