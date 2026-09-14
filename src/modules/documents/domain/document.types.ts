import type { UploadedDocumentFile } from '../../../shared/types/authenticated-request';

export interface DocumentReference {
  readonly tenantId: string | null;
  readonly documentId: string | null;
  readonly objectKey: string | null;
}

export type DocumentSource = 'upload' | 'storage';

export interface ResolvedDocument {
  readonly id: string;
  readonly data: Buffer;
  readonly mimeType: string;
  readonly filename: string | null;
  readonly pageCount: number;
  readonly sizeBytes: number;
  readonly source: DocumentSource;
  readonly reference: DocumentReference;
}

export interface DocumentSourceRequest {
  readonly file: UploadedDocumentFile | null;
  readonly reference: Partial<DocumentReference>;
}

export interface PdfInspection {
  readonly pageCount: number;
}
