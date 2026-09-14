import { HttpStatus } from '@nestjs/common';
import { AppError } from '../../../shared/errors/app-error';
import { ERROR_CODES } from '../../../shared/errors/error-codes';

export function aiProviderError(message: string, retryable: boolean, cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.AI_PROVIDER_ERROR,
    status: HttpStatus.BAD_GATEWAY,
    message,
    retryable,
    cause,
  });
}

export function aiTimeoutError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.AI_TIMEOUT,
    status: HttpStatus.GATEWAY_TIMEOUT,
    message,
    retryable: true,
    cause,
  });
}

export function aiRateLimitError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.AI_RATE_LIMIT,
    status: HttpStatus.TOO_MANY_REQUESTS,
    message,
    retryable: true,
    cause,
  });
}

export function aiInvalidResponseError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.AI_INVALID_RESPONSE,
    status: HttpStatus.BAD_GATEWAY,
    message,
    retryable: true,
    cause,
  });
}

export function aiExtractionFailedError(
  details?: Record<string, unknown>,
  message?: string,
): AppError {
  return new AppError({
    code: ERROR_CODES.AI_EXTRACTION_FAILED,
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message,
    details,
  });
}

export function aiDescriptionFailedError(message?: string): AppError {
  return new AppError({
    code: ERROR_CODES.AI_DESCRIPTION_FAILED,
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message,
  });
}
