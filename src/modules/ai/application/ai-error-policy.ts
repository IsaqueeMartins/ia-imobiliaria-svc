import { AppError } from '../../../shared/errors/app-error';
import { ERROR_CODES } from '../../../shared/errors/error-codes';

const FALLBACK_ELIGIBLE_CODES: readonly string[] = [
  ERROR_CODES.AI_INVALID_RESPONSE,
  ERROR_CODES.AI_RATE_LIMIT,
];

export function isFallbackEligible(error: unknown): boolean {
  if (!AppError.isAppError(error)) {
    return false;
  }
  return error.retryable || FALLBACK_ELIGIBLE_CODES.includes(error.code);
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
