import crypto from 'crypto';

const DEFAULT_SECRET = 'local-dev-alert-secret-key-please-override';

function getKeyMaterial(): Buffer {
  const secret = process.env.ALERT_SECRET_KEY || DEFAULT_SECRET;
  return crypto.createHash('sha256').update(secret).digest();
}

const KEY = getKeyMaterial();

export function encryptSecret(value?: string | null): string | null {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(value?: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('enc:')) {
    return value;
  }
  const parts = value.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted payload');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

