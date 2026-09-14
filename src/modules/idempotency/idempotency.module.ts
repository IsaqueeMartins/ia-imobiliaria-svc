import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { IdempotencyService } from './application/idempotency.service';
import { IDEMPOTENCY_STORE } from './domain/idempotency-store.port';
import { InMemoryIdempotencyStore } from './infrastructure/in-memory-idempotency.store';

@Module({
  imports: [SharedModule],
  providers: [
    IdempotencyService,
    { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
  ],
  exports: [IdempotencyService, IDEMPOTENCY_STORE],
})
export class IdempotencyModule {}
