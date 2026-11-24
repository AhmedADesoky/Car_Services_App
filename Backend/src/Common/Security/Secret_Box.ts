import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM for small station secrets (staff 2FA secrets). Format: [12 IV][16 tag][ciphertext].
 * The AAD binds a ciphertext to its owner (tenant + user), so a value copied to another row fails to decrypt.
 * Key: STATION_SECRETS_KEY (32 random bytes, base64). Replaced by the per-station Crypto_Service (SEC-04) later.
 */
@Injectable()
export class Secret_Box {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.STATION_SECRETS_KEY ?? '';
    const key = Buffer.from(raw, 'base64');
    if (key.length === 32) {
      this.key = key;
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('STATION_SECRETS_KEY (32 bytes, base64) is required in production');
    } else {
      new Logger('Secret_Box').warn('STATION_SECRETS_KEY missing: using a development-only key');
      this.key = createHash('sha256').update('development-only-station-secrets-key').digest();
    }
  }

  seal(plain: string, aad: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }

  open(blob: Buffer, aad: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, blob.subarray(0, 12));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(blob.subarray(12, 28));
    return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString('utf8');
  }
}
