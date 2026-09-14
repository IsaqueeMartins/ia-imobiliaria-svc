import { HttpStatus } from '@nestjs/common';
import { AppError } from '../../../shared/errors/app-error';
import { ERROR_CODES } from '../../../shared/errors/error-codes';

export function documentTooLargeError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError({
    code: ERROR_CODES.DOCUMENT_TOO_LARGE,
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message,
    details,
  });
}

export function unsupportedDocumentError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError({
    code: ERROR_CODES.UNSUPPORTED_DOCUMENT,
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message,
    details,
  });
}

export function documentNotFoundError(objectKey: string): AppError {
  return new AppError({
    code: ERROR_CODES.DOCUMENT_NOT_FOUND,
    status: HttpStatus.NOT_FOUND,
    message: 'The referenced document was not found in the storage provider.',
    details: { objectKey },
  });
}

export function storageError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.STORAGE_ERROR,
    status: HttpStatus.BAD_GATEWAY,
    message,
    retryable: true,
    cause,
  });
}

export function storageNotConfiguredError(): AppError {
  return new AppError({
    code: ERROR_CODES.STORAGE_NOT_CONFIGURED,
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      'Document storage is not configured on this deployment. Upload the PDF file directly instead.',
  });
}
