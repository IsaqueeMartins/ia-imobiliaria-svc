import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { readIdempotencyKeyHeader, resolveRequestId } from '../http/request-headers';
import { RequestContextService, RequestContextState } from '../logging/request-context';
import { AuthenticatedRequest, readSingleHeader } from '../types/authenticated-request';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const state: RequestContextState = {
      requestId: request.requestId ?? resolveRequestId(undefined),
      tenantId: request.tenantId ?? null,
      consumerId: request.consumer?.id ?? null,
      method: request.method,
      path: request.originalUrl ?? request.url ?? '',
      idempotencyKey: readIdempotencyKeyHeader(readSingleHeader(request, 'idempotency-key')),
      replayed: false,
      startedAt: Date.now(),
    };

    request.requestId = state.requestId;
    request.tenantId = state.tenantId;

    return this.requestContext.run(state, () => next.handle());
  }
}
