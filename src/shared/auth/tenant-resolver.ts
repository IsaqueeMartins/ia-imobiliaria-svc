import { AppError } from '../errors/app-error';
import { ConsumerIdentity } from './consumer';

const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveTenantId(
  headerTenantId: string | undefined,
  consumer: ConsumerIdentity,
): string | null {
  const requested = headerTenantId?.trim();

  if (requested && !TENANT_ID_PATTERN.test(requested)) {
    throw AppError.invalidRequest('The X-Tenant-Id header is malformed.', {
      header: 'X-Tenant-Id',
    });
  }

  if (requested && consumer.tenantId && requested !== consumer.tenantId) {
    throw AppError.forbidden('The consumer is not allowed to act on the requested tenant.');
  }

  return requested ?? consumer.tenantId ?? null;
}
