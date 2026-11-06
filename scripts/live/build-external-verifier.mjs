import { build } from 'esbuild';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
const runFile = promisify(execFile);

const root = resolve(import.meta.dirname, '../..');
const output = join(root, 'apps/web/public/external-verifier');
const stage = await mkdtemp(join(tmpdir(), 'koda-external-verifier-'));
const fixtures = await mkdtemp(join(tmpdir(), 'koda-external-fixtures-'));
await mkdir(output, { recursive: true });
const bundle = await build({ entryPoints: [join(root, 'tools/external-verifier/verify.ts')], outfile: join(stage, 'verify.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: true, legalComments: 'linked', metafile: true });
await build({ entryPoints: [join(root, 'tools/external-verifier/create-fixtures.ts')], outfile: join(fixtures, 'create-fixtures.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22' });
await runFile(process.execPath, [join(fixtures, 'create-fixtures.mjs'), join(root, 'apps/web/public/fonts/PretendardVariable.ttf'), fixtures]);
for (const name of ['README.md', 'SPEC.md', 'verify.ts', 'check-rejections.mjs']) await copyFile(join(root, 'tools/external-verifier', name), join(stage, name));
await copyFile(join(fixtures, 'verification.json'), join(stage, 'example-verification.json'));
await mkdir(join(stage, 'licenses'));
const bundledPackages = [...new Set(Object.keys(bundle.metafile.inputs).filter(path => path.includes('node_modules/')).map(path => {
  const parts = path.split('node_modules/')[1].split('/'); return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}))].sort();
const expectedPackages = ['@noble/curves', '@noble/hashes', '@scure/base', '@scure/bip32', '@scure/bip39', 'abitype', 'canonicalize', 'isows', 'multiformats', 'ox', 'viem', 'ws'];
if (JSON.stringify(bundledPackages) !== JSON.stringify(expectedPackages)) throw new Error(`Bundled dependency licenses need review: ${bundledPackages.join(', ')}`);
const notices = ['# Third-party notices', '', 'The executable bundle includes the following packages. Their complete license texts are in `licenses/`.', ''];
for (const pkg of bundledPackages) {
  const packageJson = JSON.parse(await readFile(join(root, 'node_modules', pkg, 'package.json'), 'utf8'));
  const fileName = `${pkg.replace('@', '').replace('/', '-')}-LICENSE.txt`;
  await copyFile(join(root, 'node_modules', pkg, 'LICENSE'), join(stage, 'licenses', fileName));
  notices.push(`- ${pkg} ${packageJson.version} — ${packageJson.license ?? 'see included license text'}`);
}
await writeFile(join(stage, 'THIRD_PARTY_NOTICES.md'), `${notices.join('\n')}\n`);

async function observe(pdfName) {
  const args = [join(stage, 'verify.mjs'), join(fixtures, pdfName), join(fixtures, 'verification.json')];
  return await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, { cwd: stage, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject); child.on('close', code => {
      if (![0, 2].includes(code) || stderr) reject(new Error(`verify ${pdfName} failed (${code}): ${stderr}`));
      else resolveRun(JSON.parse(stdout));
    });
  });
}
const [originalReport, alteredReport] = await Promise.all([observe('original.pdf'), observe('altered.pdf')]);
const rejectionCheck = JSON.parse((await runFile(process.execPath, [join(root, 'tools/external-verifier/check-rejections.mjs'), join(stage, 'verify.mjs'), join(fixtures, 'original.pdf'), join(fixtures, 'verification.json')])).stdout);
await writeFile(join(output, 'original-report.json'), JSON.stringify(originalReport, null, 2));
await writeFile(join(output, 'altered-report.json'), JSON.stringify(alteredReport, null, 2));
await writeFile(join(output, 'rejection-check.json'), JSON.stringify(rejectionCheck, null, 2));
const packageFile = 'koda-external-verifier-draft.zip';
const zipPath = join(output, packageFile);
await runFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'tools/external-verifier/archive.ps1'), '-SourceDirectory', stage, '-DestinationPath', zipPath]);
const compact = report => ({ status: report.result.status, message: report.result.message, fileHash: report.result.fileHash, signedHash: report.result.signedHash, chainHash: report.result.chainHash, receiptBlockNumber: report.result.receiptBlockNumber, finalizedBlock: report.result.finalizedBlock, documentId: report.documentId, checkedAt: report.checkedAt });
const manifest = {
  format: 'koda-external-verifier-manifest/v1', packageFile, generatedAt: new Date().toISOString(), runtime: 'Node.js 22+', command: 'node verify.mjs <증명서.pdf> <검증정보.json>', rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  ...(process.env.KODA_SOURCE_COMMIT ? { sourceCommit: process.env.KODA_SOURCE_COMMIT } : {}),
  runs: { original: compact(originalReport), altered: compact(alteredReport) },
  checks: { rejectedLocally: rejectionCheck.cases.map(item => item.name), walletOrWriteOperations: rejectionCheck.walletOrWriteOperations },
  bundledPackages,
  files: ['verify.mjs', 'verify.mjs.map', 'verify.mjs.LEGAL.txt', 'verify.ts', 'check-rejections.mjs', 'README.md', 'SPEC.md', 'THIRD_PARTY_NOTICES.md', 'example-verification.json', ...bundledPackages.map(pkg => `licenses/${pkg.replace('@', '').replace('/', '-')}-LICENSE.txt`)],
};
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
