import type { Request } from 'express';
import { ConsumerIdentity } from '../auth/consumer';

export interface UploadedDocumentFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
  readonly size: number;
}

export interface RequestMetadata {
  requestId: string;
  startedAt: number;
  consumer: ConsumerIdentity | null;
  tenantId: string | null;
}

export type AuthenticatedRequest = Request &
  Partial<RequestMetadata> & {
    file?: UploadedDocumentFile;
    files?: UploadedDocumentFile[];
  };

export function readSingleHeader(request: Request, headerName: string): string | undefined {
  const value = request.headers[headerName];
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value.trim() : undefined;
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]?.trim();
    return first && first.length > 0 ? first : undefined;
  }
  return undefined;
}
