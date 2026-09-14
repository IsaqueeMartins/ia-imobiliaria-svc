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

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRUST_PROXY: booleanish.default(false),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  BODY_LIMIT: z.string().trim().min(1).default('1mb'),

  API_KEY: z.string().trim().min(1).optional(),
  API_KEYS: csv,

  GEMINI_API_KEY: z
    .string({
      error:
        'GEMINI_API_KEY is required. Create a key at https://aistudio.google.com/apikey and set it in the environment',
    })
    .trim()
    .min(1, 'GEMINI_API_KEY cannot be empty'),
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
});

const STORAGE_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'on']);

function isProvided(env: Record<string, unknown>, key: string): boolean {
  const value = env[key];
  if (value === undefined || value === null) {
    return false;
  }
  return typeof value === 'string' ? value.trim().length > 0 : true;
}

export function collectCrossFieldIssues(env: Record<string, unknown>): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const providedStorageKeys = STORAGE_KEYS.filter((key) => isProvided(env, key));
  const storageComplete = providedStorageKeys.length === STORAGE_KEYS.length;

  if (!isProvided(env, 'API_KEY') && !isProvided(env, 'API_KEYS')) {
    issues.push({
      variable: 'API_KEYS',
      message:
        'At least one consumer credential is required: set API_KEYS=consumer-key or API_KEYS=consumer-key:tenant-id',
    });
  }

  if (providedStorageKeys.length > 0 && !storageComplete) {
    issues.push({
      variable: 'R2_BUCKET',
      message:
        'R2 configuration is incomplete: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET must be provided together, or all left empty to accept uploads only',
    });
  }

  if (isProvided(env, 'R2_READINESS_CHECK') && !storageComplete) {
    const value = String(env.R2_READINESS_CHECK).toLowerCase();
    if (TRUTHY_VALUES.has(value)) {
      issues.push({
        variable: 'R2_READINESS_CHECK',
        message: 'R2_READINESS_CHECK requires a complete R2 configuration',
      });
    }
  }

  if (env.NODE_ENV === 'production' && isProvided(env, 'CORS_ORIGINS')) {
    const origins = String(env.CORS_ORIGINS)
      .split(',')
      .map((origin) => origin.trim());
    if (origins.includes('*')) {
      issues.push({
        variable: 'CORS_ORIGINS',
        message:
          'CORS_ORIGINS must not contain "*" in production: list the allowed origins explicitly',
      });
    }
  }

  return issues;
}

export type AppEnv = z.infer<typeof envSchema>;

export interface EnvIssue {
  readonly variable: string;
  readonly message: string;
}

const ENV_HELP_LINES: readonly string[] = [
  '',
  'Provide the variables above through the process environment or a .env file (see .env.example) and start the service again.',
];

export function formatEnvIssues(issues: readonly EnvIssue[]): string {
  return [
    'Invalid configuration: the AI service cannot start.',
    '',
    ...issues.map((issue) => `  - ${issue.variable}: ${issue.message}`),
    ...ENV_HELP_LINES,
  ].join('\n');
}

export class EnvValidationError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    super(formatEnvIssues(issues));
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export function toEnvIssues(error: z.ZodError): EnvIssue[] {
  return error.issues.map((issue) => ({
    variable: issue.path.map((segment) => String(segment)).join('.') || 'environment',
    message: issue.message,
  }));
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    sanitized[key] = value;
  }

  const result = envSchema.safeParse(sanitized);
  const issues: EnvIssue[] = result.success ? [] : toEnvIssues(result.error);
  issues.push(...collectCrossFieldIssues(sanitized));

  if (!result.success || issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return result.data;
}
