import { createHash } from 'node:crypto';

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function fingerprintOf(
  ...parts: readonly (string | Uint8Array | null | undefined)[]
): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    if (part === null || part === undefined) {
      hash.update('\u0000');
      continue;
    }
    hash.update(typeof part === 'string' ? Buffer.from(part, 'utf8') : part);
    hash.update('\u0001');
  }
  return hash.digest('hex');
}
