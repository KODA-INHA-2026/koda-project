import { createHash, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { didFromPublicKey, publicKeyFromDid, toBase64Url } from '@koda/protocol';

export function newIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  const raw = Buffer.from(jwk.x!, 'base64url');
  return { did: didFromPublicKey(raw), publicKey: toBase64Url(raw), privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url') };
}
export function verifyDid(did: string, bytes: Uint8Array, signature: Uint8Array): boolean {
  if (signature.length !== 64) return false;
  const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: toBase64Url(publicKeyFromDid(did)) }, format: 'jwk' });
  return verify(null, bytes, publicKey, signature);
}
export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export { sign };
