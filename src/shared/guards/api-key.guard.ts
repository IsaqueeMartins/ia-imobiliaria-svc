import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CONSUMER_AUTHENTICATOR, ConsumerAuthenticator } from '../auth/consumer';
import { resolveTenantId } from '../auth/tenant-resolver';
import { AppError } from '../errors/app-error';
import { API_KEY_HEADER, TENANT_ID_HEADER } from '../http/request-headers';
import { AuthenticatedRequest, readSingleHeader } from '../types/authenticated-request';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(CONSUMER_AUTHENTICATOR) private readonly authenticator: ConsumerAuthenticator,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = readSingleHeader(request, API_KEY_HEADER);
    if (!apiKey) {
      throw AppError.unauthorized('Missing X-API-Key header.');
    }

    const consumer = this.authenticator.authenticate(apiKey);
    if (!consumer) {
      throw AppError.unauthorized('The provided API key is not valid.');
    }

    request.consumer = consumer;
    request.tenantId = resolveTenantId(readSingleHeader(request, TENANT_ID_HEADER), consumer);

    return true;
  }
}
