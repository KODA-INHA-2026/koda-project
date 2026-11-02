import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = resolve('.demo'); mkdirSync(dir, { recursive: true, mode: 0o700 });
const pidPath = resolve(dir, 'chain-process.json');
const probe = async () => {
  try { const res = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(1000) }); return (await res.json()).result === '0x7a69'; } catch { return false; }
};
if (process.argv[2] === 'stop') {
  if (!existsSync(pidPath)) { console.log('No managed chain process.'); process.exit(0); }
  const { pid } = JSON.parse(readFileSync(pidPath, 'utf8'));
  // Only the PID recorded by this repository's local launcher is targeted.
  try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'inherit' }); else process.kill(-pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  console.log('Local chain stop requested. Its in-memory state will be lost.');
} else {
  if (await probe()) { console.log('Local chain already reachable at http://127.0.0.1:8545'); process.exit(0); }
  const log = openSync(resolve(dir, 'chain.log'), 'a', 0o600);
  const child = spawn(process.execPath, ['scripts/chain-dev.mjs'], { cwd: process.cwd(), detached: true, stdio: ['ignore', log, log] });
  writeFileSync(pidPath, JSON.stringify({ pid: child.pid }), { mode: 0o600 }); child.unref();
  for (let i = 0; i < 60; i++) { if (await probe()) { console.log('Local chain ready at http://127.0.0.1:8545 (log: .demo/chain.log)'); process.exit(0); } await new Promise(r => setTimeout(r, 500)); }
  throw new Error('Chain did not become ready; inspect .demo/chain.log');
}
