import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const root = fileURLToPath(new URL('../', import.meta.url)); process.chdir(root);
const api = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/main.ts'], { cwd: root, stdio: 'inherit', env: { ...process.env, KODA_RECORD_MODE: process.env.KODA_RECORD_MODE ?? 'MOCK' } });
let web;
let stopping = false;
async function stop(code = 0) { if (stopping) return; stopping = true; await web?.close(); api.kill('SIGTERM'); process.exitCode = code; }
api.on('exit', code => { if (!stopping) { console.error('API exited; stopping web.'); void stop(code ?? 1); } });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => void stop());
try {
  web = await createServer({ configFile: resolve(root, 'apps/web/vite.config.ts'), root: resolve(root, 'apps/web') });
  await web.listen(); web.printUrls();
} catch (e) { console.error(e.message); await stop(1); }
