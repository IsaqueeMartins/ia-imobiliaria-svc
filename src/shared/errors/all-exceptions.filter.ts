import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import type { Response } from 'express';
import { RequestContextService } from '../logging/request-context';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { resolveRequestId } from '../http/request-headers';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { AppError, statusToErrorCode } from './app-error';
import { ERROR_CODES, ERROR_MESSAGES, ErrorCode } from './error-codes';

interface NormalizedError {
  readonly status: number;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details: Record<string, unknown> | null;
  readonly logMessage: string | null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly requestContext: RequestContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<AuthenticatedRequest>();
    const normalized = this.normalize(exception);
    const requestId =
      request?.requestId ?? this.requestContext.requestId ?? resolveRequestId(undefined);

    this.logger.error(
      {
        event: 'http.request.failed',
        code: normalized.code,
        status: normalized.status,
        method: request?.method ?? null,
        path: request?.originalUrl ?? request?.url ?? null,
        errorName: exception instanceof Error ? exception.name : typeof exception,
        reason: normalized.logMessage,
        stack:
          normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error
            ? exception.stack
            : null,
      },
      'ExceptionFilter',
    );

    const body: Record<string, unknown> = {
      statusCode: normalized.status,
      code: normalized.code,
      message: normalized.message,
      requestId,
    };
    if (normalized.details) {
      body.details = normalized.details;
    }

    response.status(normalized.status).json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (AppError.isAppError(exception)) {
      return {
        status: exception.status,
        code: exception.code,
        message:
          exception.status >= HttpStatus.INTERNAL_SERVER_ERROR
            ? ERROR_MESSAGES[exception.code]
            : exception.message,
        details: exception.details,
        logMessage: exception.message,
      };
    }

    if (exception instanceof MulterError) {
      const tooLarge = exception.code === 'LIMIT_FILE_SIZE';
      return {
        status: tooLarge ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST,
        code: tooLarge ? ERROR_CODES.DOCUMENT_TOO_LARGE : ERROR_CODES.INVALID_REQUEST,
        message: tooLarge
          ? ERROR_MESSAGES.DOCUMENT_TOO_LARGE
          : `Multipart request rejected: ${exception.code}.`,
        details: { multerCode: exception.code, field: exception.field ?? null },
        logMessage: exception.message,
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        details: {
          issues: exception.issues.map((issue) => ({
            path: issue.path.map((segment) => String(segment)).join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        logMessage: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = statusToErrorCode(status);
      const payload = exception.getResponse();
      const exceptionMessage =
        typeof payload === 'string'
          ? payload
          : typeof (payload as { message?: unknown }).message === 'string'
            ? (payload as { message: string }).message
            : null;

      return {
        status,
        code,
        message:
          status >= HttpStatus.INTERNAL_SERVER_ERROR || code === ERROR_CODES.RATE_LIMIT_EXCEEDED
            ? ERROR_MESSAGES[code]
            : (exceptionMessage ?? ERROR_MESSAGES[code]),
        details: null,
        logMessage: exception.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      details: null,
      logMessage: exception instanceof Error ? exception.message : String(exception),
    };
  }
}
