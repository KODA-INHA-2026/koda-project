import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { reproduceRecordedIssuance, recordedDeployment } from '../../apps/web/src/live/recorded-evidence';
import { serializeVerificationFile } from '../../apps/web/src/live/verification-file';

const [fontPath, output] = process.argv.slice(2);
if (!fontPath || !output) throw new Error('font path and output directory are required');
await mkdir(output, { recursive: true });
const issuance = reproduceRecordedIssuance(new Uint8Array(await readFile(fontPath)));
await Promise.all([
  writeFile(join(output, 'original.pdf'), issuance.original),
  writeFile(join(output, 'altered.pdf'), issuance.altered),
  writeFile(join(output, 'verification.json'), serializeVerificationFile(issuance.proof, recordedDeployment)),
]);
