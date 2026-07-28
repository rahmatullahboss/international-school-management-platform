import { describe, expect, test } from 'vitest';

import { verifyRs256Compact } from '../../packages/modules/integrations/src/index.js';

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

describe('RS256 compact verification', () => {
  test('accepts a generated signature and rejects payload changes', async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const head = encode(
      new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'key-1' })),
    );
    const body = encode(
      new TextEncoder().encode(
        JSON.stringify({ iss: 'https://platform.example.test', sub: 'user-1' }),
      ),
    );
    const input = `${head}.${body}`;
    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      pair.privateKey,
      new TextEncoder().encode(input),
    );
    const compact = `${input}.${encode(new Uint8Array(signature))}`;
    const keyDocument = await crypto.subtle.exportKey('jwk', pair.publicKey);

    await expect(verifyRs256Compact({ compact, keyDocument })).resolves.toMatchObject({
      header: { alg: 'RS256' },
      claims: { sub: 'user-1' },
    });
    const changedBody = encode(
      new TextEncoder().encode(
        JSON.stringify({ iss: 'https://platform.example.test', sub: 'user-2' }),
      ),
    );
    await expect(
      verifyRs256Compact({
        compact: `${head}.${changedBody}.${compact.split('.')[2]}`,
        keyDocument,
      }),
    ).rejects.toThrow('LTI compact assertion signature is invalid');
  });
});
