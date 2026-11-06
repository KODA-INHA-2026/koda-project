import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [verifier, validPdf, validJson] = process.argv.slice(2);
if (!verifier || !validPdf || !validJson) throw new Error('verifier, PDF, JSON paths are required');
const temp = await mkdtemp(join(tmpdir(), 'koda-external-rejections-'));
const source = JSON.parse(await readFile(validJson, 'utf8'));

async function writeJson(name, mutate) {
  const value = structuredClone(source); mutate(value);
  const path = join(temp, name); await writeFile(path, JSON.stringify(value)); return path;
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [verifier, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject); child.on('close', code => {
      try { resolve({ code, report: JSON.parse(stdout), stderr }); } catch (error) { reject(new Error(`invalid verifier output: ${error}`)); }
    });
  });
}
const missingTx = await writeJson('missing-transaction.json', value => { delete value.proof.transactionHash; });
const rogueContract = await writeJson('rogue-contract.json', value => { value.chain.contract = `0x${'12'.repeat(20)}`; });
const rogueIssuer = await writeJson('rogue-issuer.json', value => { value.chain.issuer = `0x${'34'.repeat(20)}`; });
const oversizedJson = join(temp, 'oversized.json'); await writeFile(oversizedJson, ' '.repeat(64 * 1024 + 1));
const invalidPdf = join(temp, 'invalid.pdf'); await writeFile(invalidPdf, 'not-a-pdf');
const cases = [
  ['wrong-cli-args', []],
  ['missing-transaction-hash', [validPdf, missingTx]],
  ['rogue-contract', [validPdf, rogueContract]],
  ['rogue-issuer', [validPdf, rogueIssuer]],
  ['oversized-json', [validPdf, oversizedJson]],
  ['invalid-pdf', [invalidPdf, validJson]],
];
const results = [];
for (const [name, args] of cases) {
  const observed = await run(args);
  if (observed.code !== 1 || observed.report.status !== 'error' || observed.report.trace?.length) {
    throw new Error(`${name} was not rejected locally: ${JSON.stringify(observed)}`);
  }
  results.push({ name, exitCode: observed.code, status: observed.report.status, message: observed.report.message, traceEvents: 0 });
}
const bundle = await readFile(verifier, 'utf8');
for (const forbidden of ['requestAddresses', 'signTypedData', 'deployContract', 'writeContract', 'window.ethereum']) {
  if (bundle.includes(forbidden)) throw new Error(`write or wallet operation found in bundle: ${forbidden}`);
}
process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), cases: results, walletOrWriteOperations: false }, null, 2)}\n`);
