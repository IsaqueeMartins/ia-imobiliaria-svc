import { AppError } from '../../../shared/errors/app-error';

const MAX_OBJECT_KEY_LENGTH = 1024;

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}

export function isSafeObjectKey(objectKey: string): boolean {
  if (objectKey.length === 0 || objectKey.length > MAX_OBJECT_KEY_LENGTH) {
    return false;
  }
  if (objectKey.startsWith('/') || objectKey.endsWith('/')) {
    return false;
  }
  if (objectKey.includes('..') || objectKey.includes('//') || objectKey.includes('\\')) {
    return false;
  }
  return !hasControlCharacters(objectKey);
}

export function isAllowedByPrefix(objectKey: string, allowedPrefixes: readonly string[]): boolean {
  if (allowedPrefixes.length === 0) {
    return true;
  }
  return allowedPrefixes.some((prefix) => objectKey.startsWith(prefix));
}

export function assertUsableObjectKey(
  objectKey: string,
  allowedPrefixes: readonly string[],
): string {
  if (!isSafeObjectKey(objectKey)) {
    throw AppError.invalidRequest('The objectKey is malformed.', { objectKey });
  }
  if (!isAllowedByPrefix(objectKey, allowedPrefixes)) {
    throw AppError.forbidden('The objectKey is outside the allowed storage prefixes.');
  }
  return objectKey;
}
