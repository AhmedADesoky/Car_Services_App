import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PLATFORM_CONFIG, Platform_Config } from './Platform_Config';

/** AES-256-GCM for company secrets (staff 2FA secrets). Format: [12 IV][16 tag][ciphertext]. */
@Injectable()
export class Platform_Crypto {
  private readonly key: Buffer;

  constructor(@Inject(PLATFORM_CONFIG) config: Platform_Config) {
    this.key = Buffer.from(config.PLATFORM_ENCRYPTION_KEY, 'base64');
  }

  encrypt(plain: string, aad: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }

  decrypt(blob: Buffer, aad: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, blob.subarray(0, 12));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(blob.subarray(12, 28));
    return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString('utf8');
  }
}

export const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

/** Random password that satisfies the staff policy (shown ONCE to the admin who created the account). */
export function temporaryPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*-_'];
  const all = sets.join('');
  const chars = sets.map((s) => s[randomBytes(1)[0] % s.length]);
  while (chars.length < 16) chars.push(all[randomBytes(1)[0] % all.length]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
