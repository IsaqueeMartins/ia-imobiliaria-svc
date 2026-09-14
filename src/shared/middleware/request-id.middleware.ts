import type { NextFunction, Request, Response } from 'express';
import { readSingleHeader } from '../types/authenticated-request';
import { REQUEST_ID_HEADER, resolveRequestId } from '../http/request-headers';

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(readSingleHeader(request, REQUEST_ID_HEADER));
  (request as Request & { requestId?: string }).requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}
