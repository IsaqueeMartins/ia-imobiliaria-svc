import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../shared/config/app-config.service';
import { AppError } from '../../../shared/errors/app-error';
import { isPdfBuffer } from '../../../shared/utils/pdf';
import { DOCUMENT_STORAGE, DocumentStorage } from '../domain/document-storage.port';
import { PDF_INSPECTOR, PdfInspector } from '../domain/pdf-inspector.port';
import {
  documentTooLargeError,
  storageNotConfiguredError,
  unsupportedDocumentError,
} from '../domain/document.errors';
import { assertUsableObjectKey } from '../domain/object-key';
import {
  DocumentReference,
  DocumentSourceRequest,
  ResolvedDocument,
} from '../domain/document.types';

const SUPPORTED_UPLOAD_MIME_TYPES = new Set(['application/pdf', 'application/octet-stream']);

@Injectable()
export class DocumentResolver {
  constructor(
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    @Inject(PDF_INSPECTOR) private readonly pdfInspector: PdfInspector,
    private readonly config: AppConfigService,
  ) {}

  async resolve(request: DocumentSourceRequest): Promise<ResolvedDocument> {
    const hasFile = Boolean(request.file);
    const objectKey = request.reference.objectKey ?? null;
    const hasReference = Boolean(objectKey);

    if (hasFile && hasReference) {
      throw AppError.invalidRequest(
        'Provide either a PDF file or an objectKey reference, not both.',
      );
    }

    if (!hasFile && !hasReference) {
      throw AppError.invalidRequest(
        'Provide a PDF file in the multipart field "file" or an objectKey reference in the JSON body.',
      );
    }

    if (request.file) {
      return this.resolveUploadedFile(request.file);
    }

    return this.resolveStorageObject(request.reference as DocumentReference);
  }

  private async resolveUploadedFile(
    file: NonNullable<DocumentSourceRequest['file']>,
  ): Promise<ResolvedDocument> {
    const mimeType = (file.mimetype ?? '').toLowerCase().trim();
    if (mimeType.length > 0 && !SUPPORTED_UPLOAD_MIME_TYPES.has(mimeType)) {
      throw unsupportedDocumentError('The uploaded file must be a PDF document.', { mimeType });
    }

    const data = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
    this.assertPdfPayload(data);
    this.assertSizeWithinLimit(data.byteLength);
    const pageCount = await this.inspect(data);

    return {
      id: `doc_${randomUUID()}`,
      data,
      mimeType: 'application/pdf',
      filename: file.originalname ?? null,
      pageCount,
      sizeBytes: data.byteLength,
      source: 'upload',
      reference: { tenantId: null, documentId: null, objectKey: null },
    };
  }

  private async resolveStorageObject(reference: DocumentReference): Promise<ResolvedDocument> {
    if (!this.storage.isConfigured()) {
      throw storageNotConfiguredError();
    }

    const objectKey = assertUsableObjectKey(
      reference.objectKey as string,
      this.config.storage.allowedKeyPrefixes,
    );

    const object = await this.storage.getObject(objectKey);
    const data = Buffer.isBuffer(object.data) ? object.data : Buffer.from(object.data);

    this.assertPdfPayload(data);
    this.assertSizeWithinLimit(data.byteLength);
    const pageCount = await this.inspect(data);

    return {
      id: reference.documentId ?? `doc_${randomUUID()}`,
      data,
      mimeType: 'application/pdf',
      filename: objectKey.split('/').pop() ?? null,
      pageCount,
      sizeBytes: data.byteLength,
      source: 'storage',
      reference: {
        tenantId: reference.tenantId ?? null,
        documentId: reference.documentId ?? null,
        objectKey,
      },
    };
  }

  private assertPdfPayload(data: Buffer): void {
    if (!isPdfBuffer(data)) {
      throw unsupportedDocumentError('The provided document is not a valid PDF file.');
    }
  }

  private assertSizeWithinLimit(sizeBytes: number): void {
    const limit = this.config.documents.maxDocumentSizeBytes;
    if (sizeBytes > limit) {
      throw documentTooLargeError('The document exceeds the maximum allowed size.', {
        sizeBytes,
        maxDocumentSizeBytes: limit,
      });
    }
  }

  private async inspect(data: Buffer): Promise<number> {
    const inspection = await this.pdfInspector.inspect(data);
    const maxPages = this.config.documents.maxDocumentPages;

    if (inspection.pageCount > maxPages) {
      throw documentTooLargeError('The document exceeds the maximum allowed number of pages.', {
        pageCount: inspection.pageCount,
        maxDocumentPages: maxPages,
      });
    }

    return inspection.pageCount;
  }
}
