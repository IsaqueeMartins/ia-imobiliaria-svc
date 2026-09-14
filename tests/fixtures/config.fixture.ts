import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../../src/shared/config/app-config.service';
import { AppEnv, validateEnv } from '../../src/shared/config/env.schema';
import { StructuredLoggerService } from '../../src/shared/logging/structured-logger.service';

export const TEST_API_KEY = 'test-consumer-key';
export const TEST_TENANT_ID = 'tenant-test';

export function buildEnv(overrides: Record<string, unknown> = {}): AppEnv {
  return validateEnv({
    NODE_ENV: 'test',
    PORT: '3000',
    API_KEYS: `${TEST_API_KEY}:${TEST_TENANT_ID}`,
    GEMINI_API_KEY: 'test-gemini-api-key',
    GEMINI_MODEL: 'gemini-3.1-flash-lite',
    GEMINI_FALLBACK_MODELS: 'gemini-3.5-flash',
    AI_FALLBACK_ENABLED: 'true',
    AI_MAX_RETRIES: '2',
    AI_RETRY_BASE_DELAY_MS: '1',
    AI_RETRY_MAX_DELAY_MS: '2',
    RATE_LIMIT_ENABLED: 'false',
    IDEMPOTENCY_ENABLED: 'true',
    LOG_LEVEL: 'error',
    ...overrides,
  });
}

export function createTestConfig(overrides: Record<string, unknown> = {}): AppConfigService {
  return new AppConfigService(new ConfigService(buildEnv(overrides)));
}

export function createSilentLogger(): StructuredLoggerService {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
    setLogLevels: jest.fn(),
  } as unknown as StructuredLoggerService;
}
