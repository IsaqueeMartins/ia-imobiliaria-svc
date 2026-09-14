export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

export interface IdempotencyRecord<T> {
  readonly fingerprint: string;
  readonly expiresAt: number;
  promise: Promise<T>;
  response: T | null;
}

export interface IdempotencyStore {
  get<T>(key: string): IdempotencyRecord<T> | null;
  set<T>(key: string, record: IdempotencyRecord<T>): void;
  delete(key: string): void;
}

export interface IdempotencyExecutionResult<T> {
  readonly value: T;
  readonly replayed: boolean;
}

export interface IdempotencyRequest {
  readonly scope: string;
  readonly fingerprint: string;
}
