import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SECRET_SHAPE = /^chr_([a-z0-9-]+)_[0-9A-Za-z]+$/;
const RADIX = BigInt(62);
const ZERO = BigInt(0);

const base62 = (bytes: Buffer) => {
  let remaining = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';
  while (remaining > ZERO) {
    encoded = BASE62[Number(remaining % RADIX)] + encoded;
    remaining /= RADIX;
  }
  return encoded || '0';
};

export const issueSecret = (holderSlug: string) => `chr_${holderSlug}_${base62(randomBytes(32))}`;

export const holderSlugOfSecret = (secret: string) => SECRET_SHAPE.exec(secret)?.[1] ?? null;

export const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');

export const hashesMatch = (left: string, right: string) =>
  left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));

export const passwordMatches = (candidate: string, expected: string) => hashesMatch(hashSecret(candidate), hashSecret(expected));
