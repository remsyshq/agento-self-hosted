import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { readFileSync, writeFileSync, chmodSync, existsSync } from 'fs';
import { join } from 'path';
import { getDataDir } from '../../config.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let _masterKey: Buffer | null = null;

export function getMasterKeyPath(): string {
  return join(getDataDir(), 'master.key');
}

export function generateMasterKey(): string {
  const keyPath = getMasterKeyPath();
  const key = randomBytes(KEY_LENGTH);
  writeFileSync(keyPath, key.toString('hex') + '\n');
  chmodSync(keyPath, 0o600);
  return key.toString('hex');
}

export function loadMasterKey(): Buffer {
  if (_masterKey) return _masterKey;

  const keyPath = getMasterKeyPath();
  if (!existsSync(keyPath)) {
    throw new Error(`Master key not found at ${keyPath}. Run "agento init" first.`);
  }

  const hex = readFileSync(keyPath, 'utf-8').trim();
  _masterKey = Buffer.from(hex, 'hex');
  return _masterKey;
}

export function encrypt(plaintext: string): string {
  const key = loadMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encryptedStr: string): string {
  const key = loadMasterKey();
  const [ivHex, authTagHex, ciphertextHex] = encryptedStr.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function generateApiSecret(): string {
  return randomBytes(32).toString('hex');
}

export function generateGatewayToken(): string {
  return randomBytes(24).toString('base64url');
}
