import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const cache = resolve(process.env.KODA_DATA_DIR ?? '.demo', 'cache'); mkdirSync(cache, { recursive: true });
const port = process.env.KODA_RPC_PORT ?? '8545';
const child = spawn(process.execPath, ['node_modules/hardhat/dist/src/cli.js', '--config', 'packages/chain/hardhat.config.ts', 'node', '--network', 'default', '--hostname', '127.0.0.1', '--port', port], { stdio: 'inherit', env: { ...process.env, XDG_CACHE_HOME: cache, XDG_CONFIG_HOME: cache, XDG_DATA_HOME: cache } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
