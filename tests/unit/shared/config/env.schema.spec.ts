import { validateEnv } from '../../../../src/shared/config/env.schema';

const REQUIRED = {
  API_KEYS: 'consumer-key',
  GEMINI_API_KEY: 'gemini-key',
};

describe('env schema', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv({ ...REQUIRED });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.GEMINI_MODEL).toBe('gemini-3.1-flash-lite');
    expect(env.GEMINI_FALLBACK_MODELS).toEqual([]);
    expect(env.AI_FALLBACK_ENABLED).toBe(true);
    expect(env.MAX_DOCUMENT_PAGES).toBe(1000);
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.R2_ALLOWED_KEY_PREFIXES).toEqual([]);
  });

  it('parses comma separated lists and booleans', () => {
    const env = validateEnv({
      ...REQUIRED,
      GEMINI_FALLBACK_MODELS: 'gemini-3.5-flash, gemini-3.6-flash',
      CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
      AI_FALLBACK_ENABLED: 'false',
      TRUST_PROXY: 'yes',
    });

    expect(env.GEMINI_FALLBACK_MODELS).toEqual(['gemini-3.5-flash', 'gemini-3.6-flash']);
    expect(env.CORS_ORIGINS).toEqual(['https://app.example.com', 'https://admin.example.com']);
    expect(env.AI_FALLBACK_ENABLED).toBe(false);
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('ignores empty string variables instead of failing', () => {
    const env = validateEnv({
      ...REQUIRED,
      GEMINI_INPUT_PRICE_PER_MILLION_USD: '',
      R2_ACCOUNT_ID: '',
      R2_ENDPOINT: '',
      SWAGGER_ENABLED: '',
      API_KEY: '   ',
    });

    expect(env.GEMINI_INPUT_PRICE_PER_MILLION_USD).toBeUndefined();
    expect(env.R2_ACCOUNT_ID).toBeUndefined();
    expect(env.R2_ENDPOINT).toBeUndefined();
    expect(env.SWAGGER_ENABLED).toBeUndefined();
    expect(env.API_KEY).toBeUndefined();
  });

  it('requires at least one consumer credential', () => {
    expect(() => validateEnv({ GEMINI_API_KEY: 'gemini-key' })).toThrow(/API_KEYS/);
  });

  it('requires the Gemini API key', () => {
    expect(() => validateEnv({ API_KEYS: 'consumer-key' })).toThrow(/GEMINI_API_KEY/);
  });

  it('rejects partially configured storage', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, R2_ACCOUNT_ID: 'account', R2_BUCKET: 'bucket' }),
    ).toThrow(/R2 configuration is incomplete/);
  });

  it('accepts a complete storage configuration', () => {
    const env = validateEnv({
      ...REQUIRED,
      R2_ACCOUNT_ID: 'account',
      R2_ACCESS_KEY_ID: 'access',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'bucket',
      R2_READINESS_CHECK: 'true',
    });

    expect(env.R2_BUCKET).toBe('bucket');
    expect(env.R2_READINESS_CHECK).toBe(true);
  });

  it('rejects wildcard CORS in production', () => {
    expect(() => validateEnv({ ...REQUIRED, NODE_ENV: 'production', CORS_ORIGINS: '*' })).toThrow(
      /Wildcard CORS origin is not allowed in production/,
    );
  });

  it('rejects readiness probing without storage credentials', () => {
    expect(() => validateEnv({ ...REQUIRED, R2_READINESS_CHECK: 'true' })).toThrow(
      /R2_READINESS_CHECK requires/,
    );
  });

  it('rejects timestamps and sizes outside the allowed range', () => {
    expect(() => validateEnv({ ...REQUIRED, PORT: '99999' })).toThrow();
    expect(() => validateEnv({ ...REQUIRED, MAX_DOCUMENT_SIZE_MB: '200' })).toThrow();
    expect(() => validateEnv({ ...REQUIRED, MAX_DOCUMENT_PAGES: '0' })).toThrow();
  });
});
