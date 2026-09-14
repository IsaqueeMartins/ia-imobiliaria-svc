import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AppError } from '../errors/app-error';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { RequestContextService } from '../logging/request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly requestContext: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(response.statusCode ?? 200, startedAt, null);
        },
        error: (error: unknown) => {
          const status = AppError.isAppError(error) ? error.status : 500;
          const code = AppError.isAppError(error) ? error.code : 'INTERNAL_ERROR';
          this.logRequest(status, startedAt, code);
        },
      }),
    );
  }

  private logRequest(status: number, startedAt: number, errorCode: string | null): void {
    const state = this.requestContext.current();
    this.logger.log(
      {
        event: 'http.request.completed',
        method: state?.method ?? null,
        path: state?.path ?? null,
        status,
        durationMs: Date.now() - startedAt,
        errorCode,
      },
      'Http',
    );
  }
}
