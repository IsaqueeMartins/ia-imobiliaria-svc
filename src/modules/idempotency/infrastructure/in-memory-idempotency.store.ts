import { Injectable } from '@nestjs/common';
import { IdempotencyRecord, IdempotencyStore } from '../domain/idempotency-store.port';

const CLEANUP_INTERVAL_MS = 60000;

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord<unknown>>();
  private lastCleanupAt = Date.now();

  get<T>(key: string): IdempotencyRecord<T> | null {
    this.cleanupExpired();
    const record = this.records.get(key);
    if (!record) {
      return null;
    }
    if (record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return null;
    }
    return record as IdempotencyRecord<T>;
  }

  set<T>(key: string, record: IdempotencyRecord<T>): void {
    this.records.set(key, record as IdempotencyRecord<unknown>);
  }

  delete(key: string): void {
    this.records.delete(key);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }
    this.lastCleanupAt = now;
    for (const [key, record] of this.records.entries()) {
      if (record.expiresAt <= now) {
        this.records.delete(key);
      }
    }
  }
}
