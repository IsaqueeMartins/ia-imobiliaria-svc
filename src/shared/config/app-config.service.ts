import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiSettings {
  readonly googleApiKey: string;
  readonly model: string;
  readonly fallbackModels: readonly string[];
  readonly fallbackEnabled: boolean;
  readonly temperature: number;
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly inlineMaxBytes: number;
  readonly inputPricePerMillionUsd: number | null;
  readonly outputPricePerMillionUsd: number | null;
}

export interface DocumentSettings {
  readonly maxDocumentSizeBytes: number;
  readonly maxDocumentPages: number;
}

export interface StorageSettings {
  readonly accountId: string | null;
  readonly accessKeyId: string | null;
  readonly secretAccessKey: string | null;
  readonly bucket: string | null;
  readonly endpoint: string | null;
  readonly allowedKeyPrefixes: readonly string[];
  readonly readinessCheck: boolean;
}

export interface AuthSettings {
  readonly apiKeyEntries: readonly string[];
}

export interface RateLimitSettings {
  readonly enabled: boolean;
  readonly ttlMs: number;
  readonly max: number;
}

export interface IdempotencySettings {
  readonly enabled: boolean;
  readonly ttlMs: number;
}

export interface HttpSettings {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly trustProxy: boolean;
  readonly bodyLimit: string;
  readonly corsOrigins: readonly string[];
  readonly swaggerEnabled: boolean;
}

export interface LoggingSettings {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
}

@Injectable()
export class AppConfigService {
  readonly http: HttpSettings;
  readonly logging: LoggingSettings;
  readonly ai: AiSettings;
  readonly documents: DocumentSettings;
  readonly storage: StorageSettings;
  readonly auth: AuthSettings;
  readonly rateLimit: RateLimitSettings;
  readonly idempotency: IdempotencySettings;

  constructor(private readonly config: ConfigService) {
    const nodeEnv = this.value<'development' | 'test' | 'production'>('NODE_ENV');
    const apiKey = this.config.get<string>('API_KEY');

    this.http = {
      nodeEnv,
      port: this.value<number>('PORT'),
      trustProxy: this.value<boolean>('TRUST_PROXY'),
      bodyLimit: this.value<string>('BODY_LIMIT'),
      corsOrigins: this.value<string[]>('CORS_ORIGINS'),
      swaggerEnabled: this.config.get<boolean>('SWAGGER_ENABLED') ?? nodeEnv !== 'production',
    };

    this.logging = {
      level: this.value<'debug' | 'info' | 'warn' | 'error'>('LOG_LEVEL'),
    };

    this.ai = {
      googleApiKey: this.value<string>('GEMINI_API_KEY'),
      model: this.value<string>('GEMINI_MODEL'),
      fallbackModels: this.value<string[]>('GEMINI_FALLBACK_MODELS'),
      fallbackEnabled: this.value<boolean>('AI_FALLBACK_ENABLED'),
      temperature: this.value<number>('AI_TEMPERATURE'),
      requestTimeoutMs: this.value<number>('AI_REQUEST_TIMEOUT'),
      maxRetries: this.value<number>('AI_MAX_RETRIES'),
      retryBaseDelayMs: this.value<number>('AI_RETRY_BASE_DELAY_MS'),
      retryMaxDelayMs: this.value<number>('AI_RETRY_MAX_DELAY_MS'),
      inlineMaxBytes: Math.floor(this.value<number>('GEMINI_INLINE_MAX_MB') * 1024 * 1024),
      inputPricePerMillionUsd:
        this.config.get<number>('GEMINI_INPUT_PRICE_PER_MILLION_USD') ?? null,
      outputPricePerMillionUsd:
        this.config.get<number>('GEMINI_OUTPUT_PRICE_PER_MILLION_USD') ?? null,
    };

    this.documents = {
      maxDocumentSizeBytes: Math.floor(this.value<number>('MAX_DOCUMENT_SIZE_MB') * 1024 * 1024),
      maxDocumentPages: this.value<number>('MAX_DOCUMENT_PAGES'),
    };

    this.storage = {
      accountId: this.config.get<string>('R2_ACCOUNT_ID') ?? null,
      accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') ?? null,
      secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') ?? null,
      bucket: this.config.get<string>('R2_BUCKET') ?? null,
      endpoint: this.config.get<string>('R2_ENDPOINT') ?? null,
      allowedKeyPrefixes: this.value<string[]>('R2_ALLOWED_KEY_PREFIXES'),
      readinessCheck: this.value<boolean>('R2_READINESS_CHECK'),
    };

    this.auth = {
      apiKeyEntries: [...this.value<string[]>('API_KEYS'), ...(apiKey ? [apiKey] : [])],
    };

    this.rateLimit = {
      enabled: this.value<boolean>('RATE_LIMIT_ENABLED'),
      ttlMs: this.value<number>('RATE_LIMIT_TTL'),
      max: this.value<number>('RATE_LIMIT_MAX'),
    };

    this.idempotency = {
      enabled: this.value<boolean>('IDEMPOTENCY_ENABLED'),
      ttlMs: this.value<number>('IDEMPOTENCY_TTL_SECONDS') * 1000,
    };
  }

  private value<T>(key: string): T {
    return this.config.getOrThrow<T>(key);
  }
}
