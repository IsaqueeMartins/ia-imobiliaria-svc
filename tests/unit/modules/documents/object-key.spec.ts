import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import {
  assertUsableObjectKey,
  isAllowedByPrefix,
  isSafeObjectKey,
} from '../../../../src/modules/documents/domain/object-key';

describe('object key validation', () => {
  it('accepts tenant scoped keys', () => {
    const key = 'tenants/tenant-123/ai-imports/document-456/original.pdf';

    expect(isSafeObjectKey(key)).toBe(true);
    expect(assertUsableObjectKey(key, ['tenants/'])).toBe(key);
  });

  it('rejects traversal, absolute and malformed keys', () => {
    expect(isSafeObjectKey('../secret.pdf')).toBe(false);
    expect(isSafeObjectKey('/etc/passwd')).toBe(false);
    expect(isSafeObjectKey('folder//file.pdf')).toBe(false);
    expect(isSafeObjectKey('folder\\file.pdf')).toBe(false);
    expect(isSafeObjectKey('folder/')).toBe(false);
    expect(isSafeObjectKey('a'.repeat(2000))).toBe(false);
    for (const key of ['../x.pdf', '/x.pdf', 'a//b.pdf', '']) {
      try {
        assertUsableObjectKey(key, []);
        throw new Error('expected failure');
      } catch (error) {
        expect((error as AppError).code).toBe(ERROR_CODES.INVALID_REQUEST);
      }
    }
  });

  it('enforces the allowed prefixes', () => {
    expect(isAllowedByPrefix('tenants/a/x.pdf', [])).toBe(true);
    expect(isAllowedByPrefix('tenants/a/x.pdf', ['tenants/a/'])).toBe(true);
    expect(isAllowedByPrefix('other/a/x.pdf', ['tenants/'])).toBe(false);

    try {
      assertUsableObjectKey('other/a/x.pdf', ['tenants/']);
      throw new Error('expected failure');
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.FORBIDDEN);
    }
  });
});
