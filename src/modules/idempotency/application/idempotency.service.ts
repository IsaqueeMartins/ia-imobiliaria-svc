import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../shared/config/app-config.service';
import { AppError } from '../../../shared/errors/app-error';
import { ERROR_CODES } from '../../../shared/errors/error-codes';
import { RequestContextService } from '../../../shared/logging/request-context';
import { StructuredLoggerService } from '../../../shared/logging/structured-logger.service';
import { sha256Hex } from '../../../shared/utils/fingerprint';
import {
  IDEMPOTENCY_STORE,
  IdempotencyExecutionResult,
  IdempotencyRecord,
  IdempotencyRequest,
  IdempotencyStore,
} from '../domain/idempotency-store.port';

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore,
    private readonly config: AppConfigService,
    private readonly requestContext: RequestContextService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async execute<T>(
    request: IdempotencyRequest,
    factory: () => Promise<T>,
  ): Promise<IdempotencyExecutionResult<T>> {
    const current = this.requestContext.current();
    const idempotencyKey = current?.idempotencyKey ?? null;

    if (!this.config.idempotency.enabled || !idempotencyKey) {
      return { value: await factory(), replayed: false };
    }

    const storeKey = `${request.scope}:${current?.consumerId ?? 'anonymous'}:${idempotencyKey}`;
    const existing = this.store.get<T>(storeKey);

    if (existing) {
      if (existing.fingerprint !== request.fingerprint) {
        throw new AppError({
          code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
          status: HttpStatus.CONFLICT,
          message: 'The Idempotency-Key was already used with a different payload.',
        });
      }

      const value = existing.response ?? (await existing.promise);
      this.requestContext.markReplayed();
      this.logger.log(
        {
          event: 'idempotency.replayed',
          scope: request.scope,
          keyHash: sha256Hex(idempotencyKey).slice(0, 12),
        },
        'IdempotencyService',
      );

      return { value, replayed: true };
    }

    const record: IdempotencyRecord<T> = {
      fingerprint: request.fingerprint,
      expiresAt: Date.now() + this.config.idempotency.ttlMs,
      response: null,
      promise: Promise.resolve(null as unknown as T),
    };

    record.promise = factory()
      .then((value) => {
        record.response = value;
        return value;
      })
      .catch((error: unknown) => {
        this.store.delete(storeKey);
        throw error;
      });

    this.store.set(storeKey, record);

    return { value: await record.promise, replayed: false };
  }
}
