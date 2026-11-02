import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { canonicalJson, parseCanonical, didFromPublicKey, publicKeyFromDid, loginBytes, toBase64Url, fromBase64Url } from '../packages/protocol/src/index.ts';

test('T-05: JCS preserves arrays and Unicode, sorts object keys, rejects malformed inputs', () => {
  assert.equal(canonicalJson({ z: '가', a: [2, 1], q: '1.00000001' }), '{"a":[2,1],"q":"1.00000001","z":"가"}');
  assert.throws(() => canonicalJson({ value: NaN }));
  assert.throws(() => canonicalJson({ value: '\ud800' }));
  assert.throws(() => parseCanonical('{"a":1,"a":2}'));
  assert.throws(() => parseCanonical('{ "a":1}'));
  assert.equal(canonicalJson('é') === canonicalJson('é'), false);
});

test('T-02: did:key roundtrip is exact and rejects other profiles and encodings', () => {
  const key = new Uint8Array(32).fill(12);
  const did = didFromPublicKey(key);
  assert.deepEqual(publicKeyFromDid(did), key);
  for (const invalid of [` ${did}`, did + ' ', 'did:web:example.com', 'did:key:zabc']) assert.throws(() => publicKeyFromDid(invalid));
});

test('T-05: real Ed25519 signatures bind exact login domain and challenge bytes', () => {
  const pair = generateKeyPairSync('ed25519');
  const challenge = { challengeId: 'one', did: 'test', audience: 'http://localhost:5173', nonce: 'random', expiresAt: '2026-11-02T00:01:30.000Z' };
  const bytes = loginBytes(challenge);
  const signature = sign(null, bytes, pair.privateKey);
  assert.equal(verify(null, bytes, pair.publicKey, signature), true);
  assert.equal(verify(null, loginBytes({ ...challenge, nonce: 'different' }), pair.publicKey, signature), false);
  assert.deepEqual(fromBase64Url(toBase64Url(signature)), new Uint8Array(signature));
  assert.throws(() => fromBase64Url('bad='));
});
