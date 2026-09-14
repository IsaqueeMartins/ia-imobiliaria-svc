import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, ERROR_MESSAGES, ErrorCode } from './error-codes';

export interface AppErrorOptions {
  readonly code: ErrorCode;
  readonly status: number;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | null;
  readonly retryable: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message ?? ERROR_MESSAGES[options.code]);
    this.name = 'AppError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details ?? null;
    this.retryable = options.retryable ?? false;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }

  static invalidRequest(message?: string, details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ERROR_CODES.INVALID_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      message,
      details,
    });
  }

  static validation(details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      status: HttpStatus.BAD_REQUEST,
      details,
    });
  }

  static unauthorized(message?: string): AppError {
    return new AppError({
      code: ERROR_CODES.UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
      message,
    });
  }

  static forbidden(message?: string): AppError {
    return new AppError({ code: ERROR_CODES.FORBIDDEN, status: HttpStatus.FORBIDDEN, message });
  }

  static internal(message?: string, cause?: unknown): AppError {
    return new AppError({
      code: ERROR_CODES.INTERNAL_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      cause,
    });
  }
}

export function isRetryableError(error: unknown): boolean {
  return AppError.isAppError(error) && error.retryable;
}

export function statusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ERROR_CODES.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ERROR_CODES.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ERROR_CODES.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ERROR_CODES.NOT_FOUND;
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return ERROR_CODES.DOCUMENT_TOO_LARGE;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ERROR_CODES.RATE_LIMIT_EXCEEDED;
    case HttpStatus.CONFLICT:
      return ERROR_CODES.IDEMPOTENCY_CONFLICT;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return ERROR_CODES.UNSUPPORTED_DOCUMENT;
    default:
      return status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? ERROR_CODES.INTERNAL_ERROR
        : ERROR_CODES.INVALID_REQUEST;
  }
}
