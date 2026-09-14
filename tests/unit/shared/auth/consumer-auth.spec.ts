import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import {
  ApiKeyAuthenticator,
  parseApiKeyEntries,
} from '../../../../src/shared/auth/api-key.authenticator';
import { resolveTenantId } from '../../../../src/shared/auth/tenant-resolver';
import { createTestConfig } from '../../../fixtures/config.fixture';

describe('ApiKeyAuthenticator', () => {
  const authenticator = new ApiKeyAuthenticator(
    createTestConfig({ API_KEYS: 'consumer-a:tenant-a,consumer-b' }),
  );

  it('parses key and tenant pairs without exposing raw keys', () => {
    const entries = parseApiKeyEntries(['consumer-a:tenant-a', 'consumer-b']);

    expect(entries).toHaveLength(2);
    expect(entries[0].consumer.tenantId).toBe('tenant-a');
    expect(entries[1].consumer.tenantId).toBeNull();
    expect(entries[0].digest).not.toContain('consumer-a');
  });

  it('authenticates a known consumer', () => {
    expect(authenticator.authenticate('consumer-a')).toEqual({
      id: expect.stringMatching(/^key_/),
      tenantId: 'tenant-a',
    });
  });

  it('rejects unknown and malformed keys', () => {
    expect(authenticator.authenticate('consumer-c')).toBeNull();
    expect(authenticator.authenticate('short')).toBeNull();
    expect(authenticator.authenticate('')).toBeNull();
  });
});

describe('resolveTenantId', () => {
  const consumer = { id: 'key_1', tenantId: 'tenant-a' };

  it('falls back to the tenant bound to the consumer', () => {
    expect(resolveTenantId(undefined, consumer)).toBe('tenant-a');
    expect(resolveTenantId(undefined, { id: 'key_2', tenantId: null })).toBeNull();
  });

  it('accepts a matching tenant header', () => {
    expect(resolveTenantId('tenant-a', consumer)).toBe('tenant-a');
  });

  it('rejects a tenant header that does not match the consumer', () => {
    expect(() => resolveTenantId('tenant-b', consumer)).toThrow(AppError);
    try {
      resolveTenantId('tenant-b', consumer);
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.FORBIDDEN);
    }
  });

  it('rejects malformed tenant headers', () => {
    try {
      resolveTenantId('tenant b!', { id: 'key_3', tenantId: null });
      throw new Error('expected a failure');
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.INVALID_REQUEST);
    }
  });
});
