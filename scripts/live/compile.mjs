import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import solc from 'solc';

const sourceName = 'DocumentRegistry.sol';
const sourcePath = resolve('packages/chain/contracts', sourceName);
const source = readFileSync(sourcePath, 'utf8');
const optimizer = { enabled: true, runs: 200 };
const evmVersion = 'cancun';

function resolveImport(importPath) {
  const candidate = importPath.startsWith('@openzeppelin/')
    ? resolve('node_modules', importPath)
    : resolve(dirname(sourcePath), importPath);
  try {
    return { contents: readFileSync(candidate, 'utf8') };
  } catch {
    return { error: `Import not found: ${importPath}` };
  }
}

const input = {
  language: 'Solidity',
  sources: { [sourceName]: { content: source } },
  settings: {
    optimizer,
    evmVersion,
    outputSelection: {
      '*': {
        '*': [
          'abi',
          'metadata',
          'storageLayout',
          'evm.bytecode.object',
          'evm.deployedBytecode.object',
          'evm.deployedBytecode.immutableReferences',
        ],
      },
    },
  },
};

const result = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));
const diagnostics = result.errors ?? [];
for (const diagnostic of diagnostics.filter(({ severity }) => severity !== 'error')) {
  console.warn(diagnostic.formattedMessage.trim());
}
const errors = diagnostics.filter(({ severity }) => severity === 'error');
if (errors.length) throw new Error(errors.map(({ formattedMessage }) => formattedMessage).join('\n'));

const compiled = result.contracts[sourceName].DocumentRegistry;
const artifact = {
  contractName: 'DocumentRegistry',
  sourceName,
  abi: compiled.abi,
  bytecode: `0x${compiled.evm.bytecode.object}`,
  deployedBytecode: `0x${compiled.evm.deployedBytecode.object}`,
  storageLayout: compiled.storageLayout,
  immutableReferences: compiled.evm.deployedBytecode.immutableReferences,
  metadata: JSON.parse(compiled.metadata),
  compiler: {
    version: solc.version(),
    optimizer,
    evmVersion,
  },
  sourceSha256: createHash('sha256').update(source).digest('hex'),
};

for (const destination of [
  resolve('packages/chain/artifacts/DocumentRegistry.json'),
  resolve('apps/web/src/live/generated/DocumentRegistry.json'),
]) {
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(artifact, null, 2)}\n`);
}

console.log(`DocumentRegistry compiled with ${artifact.compiler.version}.`);
