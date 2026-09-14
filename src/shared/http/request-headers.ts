import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error';

export const REQUEST_ID_HEADER = 'x-request-id';
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const API_KEY_HEADER = 'x-api-key';
export const TENANT_ID_HEADER = 'x-tenant-id';
export const IDEMPOTENCY_REPLAYED_HEADER = 'idempotency-replayed';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

export function resolveRequestId(headerValue: string | undefined): string {
  const candidate = headerValue?.trim();
  if (candidate && REQUEST_ID_PATTERN.test(candidate)) {
    return candidate;
  }
  return createRequestId();
}

export function readIdempotencyKeyHeader(headerValue: string | undefined): string | null {
  const key = headerValue?.trim();
  if (!key) {
    return null;
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw AppError.invalidRequest('The Idempotency-Key header is malformed.', {
      header: 'Idempotency-Key',
    });
  }
  return key;
}
