import {
  safeStringify,
  sanitizeLogPayload,
  sanitizeLogValue,
} from '../../../../src/shared/logging/log-sanitizer';

describe('log sanitizer', () => {
  it('redacts sensitive keys', () => {
    const payload = sanitizeLogPayload({
      apiKey: 'secret-value',
      'X-API-Key': 'secret-value',
      authorization: 'Bearer token',
      idempotencyKey: 'idem',
      geminiApiKey: 'secret',
      nested: { password: 'pwd', accessKeyId: 'key' },
      keep: 'visible',
    });

    expect(payload.apiKey).toBe('[REDACTED]');
    expect(payload['X-API-Key']).toBe('[REDACTED]');
    expect(payload.authorization).toBe('[REDACTED]');
    expect(payload.idempotencyKey).toBe('[REDACTED]');
    expect(payload.geminiApiKey).toBe('[REDACTED]');
    expect((payload.nested as Record<string, unknown>).password).toBe('[REDACTED]');
    expect((payload.nested as Record<string, unknown>).accessKeyId).toBe('[REDACTED]');
    expect(payload.keep).toBe('visible');
  });

  it('never logs binary content', () => {
    expect(sanitizeLogValue(Buffer.from('%PDF-1.7 content'))).toBe('<binary:16 bytes>');
  });

  it('truncates long strings', () => {
    const sanitized = sanitizeLogValue('a'.repeat(5000)) as string;

    expect(sanitized.length).toBeLessThan(1100);
    expect(sanitized).toContain('[truncated:5000]');
  });

  it('handles circular references', () => {
    const circular: Record<string, unknown> = { name: 'root' };
    circular.self = circular;

    expect(() => sanitizeLogValue(circular)).not.toThrow();
    expect((sanitizeLogValue(circular) as Record<string, unknown>).self).toBe('[Circular]');
  });

  it('serializes errors without stack traces', () => {
    const error = new Error('boom');
    const payload = sanitizeLogPayload({ error });

    expect(payload.error).toEqual({ name: 'Error', message: 'boom' });
  });

  it('falls back to a safe payload when serialization fails', () => {
    const broken: Record<string, unknown> = {};
    broken.self = broken;

    expect(safeStringify(broken)).toBe(
      JSON.stringify({ level: 'error', msg: 'log_serialization_failed' }),
    );
    expect(
      safeStringify({
        level: 'info',
        toJSON: () => {
          throw new Error('nope');
        },
      }),
    ).toContain('log_serialization_failed');
  });
});
