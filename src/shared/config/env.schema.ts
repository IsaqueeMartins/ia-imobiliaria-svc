import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])])
  .transform(
    (value) => value === true || ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase()),
  );

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    TRUST_PROXY: booleanish.default(false),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    BODY_LIMIT: z.string().trim().min(1).default('1mb'),

    API_KEY: z.string().trim().min(1).optional(),
    API_KEYS: csv,

    GEMINI_API_KEY: z.string().trim().min(1, 'GEMINI_API_KEY is required'),
    GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.1-flash-lite'),
    GEMINI_FALLBACK_MODELS: csv,
    GEMINI_INLINE_MAX_MB: z.coerce.number().min(1).max(49).default(15),
    GEMINI_INPUT_PRICE_PER_MILLION_USD: z.coerce.number().min(0).optional(),
    GEMINI_OUTPUT_PRICE_PER_MILLION_USD: z.coerce.number().min(0).optional(),

    AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
    AI_REQUEST_TIMEOUT: z.coerce.number().int().min(1000).max(600000).default(60000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
    AI_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(0).max(60000).default(500),
    AI_RETRY_MAX_DELAY_MS: z.coerce.number().int().min(0).max(120000).default(8000),
    AI_FALLBACK_ENABLED: booleanish.default(true),

    MAX_DOCUMENT_SIZE_MB: z.coerce.number().min(1).max(50).default(50),
    MAX_DOCUMENT_PAGES: z.coerce.number().int().min(1).max(1000).default(1000),

    R2_ACCOUNT_ID: z.string().trim().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    R2_BUCKET: z.string().trim().min(1).optional(),
    R2_ENDPOINT: z.string().trim().url().optional(),
    R2_ALLOWED_KEY_PREFIXES: csv,
    R2_READINESS_CHECK: booleanish.default(false),

    CORS_ORIGINS: csv,
    SWAGGER_ENABLED: booleanish.optional(),

    RATE_LIMIT_ENABLED: booleanish.default(true),
    RATE_LIMIT_TTL: z.coerce.number().int().min(1000).default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),

    IDEMPOTENCY_ENABLED: booleanish.default(true),
    IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(1).max(86400).default(900),
  })
  .superRefine((env, ctx) => {
    if (env.API_KEYS.length === 0 && !env.API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['API_KEYS'],
        message: 'At least one consumer credential is required: set API_KEYS or API_KEY',
      });
    }

    const storageValues = [
      env.R2_ACCOUNT_ID,
      env.R2_ACCESS_KEY_ID,
      env.R2_SECRET_ACCESS_KEY,
      env.R2_BUCKET,
    ];
    const storageConfigured = storageValues.filter((value) => Boolean(value)).length;
    if (storageConfigured > 0 && storageConfigured < storageValues.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['R2_BUCKET'],
        message:
          'R2 configuration is incomplete: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET are required together',
      });
    }

    if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.includes('*')) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'Wildcard CORS origin is not allowed in production',
      });
    }

    if (env.R2_READINESS_CHECK && storageConfigured < storageValues.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['R2_READINESS_CHECK'],
        message: 'R2_READINESS_CHECK requires a complete R2 configuration',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    sanitized[key] = value;
  }

  return envSchema.parse(sanitized);
}
