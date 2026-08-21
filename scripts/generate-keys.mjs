import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const secretsDir = join(root, 'secrets');
mkdirSync(secretsDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(join(secretsDir, 'jwt-private.pem'), privateKey, { mode: 0o600 });
writeFileSync(join(secretsDir, 'jwt-public.pem'), publicKey, { mode: 0o644 });
console.log('Claves RSA generadas en ./secrets');
