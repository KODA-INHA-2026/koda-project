import { resolve, sep } from 'node:path';

// Tests must never fall back to the user's existing root demo state.
if (!process.env.KODA_DATA_DIR) throw new Error('Set KODA_DATA_DIR explicitly to a disposable isolated child of .demo before running stateful checks');
export const testDataDir = resolve(process.env.KODA_DATA_DIR);
const root = resolve('.demo');
if (!testDataDir.startsWith(root + sep)) throw new Error('Tests require an isolated child of .demo, never its root');
export const testOrigin = process.env.KODA_ORIGIN ?? 'http://localhost:5174';
