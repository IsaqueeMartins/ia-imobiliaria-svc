import { Injectable } from '@nestjs/common';
import { EncryptedPDFError, PDFDocument } from 'pdf-lib';
import { AppError } from '../../../../shared/errors/app-error';
import { unsupportedDocumentError } from '../../domain/document.errors';
import { PdfInspector } from '../../domain/pdf-inspector.port';
import { PdfInspection } from '../../domain/document.types';

@Injectable()
export class PdfLibInspector implements PdfInspector {
  async inspect(data: Uint8Array): Promise<PdfInspection> {
    try {
      const document = await PDFDocument.load(data, {
        updateMetadata: false,
        throwOnInvalidObject: false,
      });
      const pageCount = document.getPageCount();

      if (pageCount <= 0) {
        throw unsupportedDocumentError('The PDF document does not contain any page.');
      }

      return { pageCount };
    } catch (error) {
      if (AppError.isAppError(error)) {
        throw error;
      }
      if (error instanceof EncryptedPDFError) {
        throw unsupportedDocumentError('Encrypted PDF documents are not supported.');
      }
      throw unsupportedDocumentError('The PDF document could not be parsed.', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
