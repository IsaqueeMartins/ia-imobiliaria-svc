import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { DocumentResolver } from './application/document-resolver.service';
import { DOCUMENT_STORAGE } from './domain/document-storage.port';
import { PDF_INSPECTOR } from './domain/pdf-inspector.port';
import { R2DocumentStorageAdapter } from './infrastructure/r2/r2-document-storage.adapter';
import { PdfLibInspector } from './infrastructure/pdf/pdf-lib-inspector';

@Module({
  imports: [SharedModule],
  providers: [
    DocumentResolver,
    { provide: DOCUMENT_STORAGE, useClass: R2DocumentStorageAdapter },
    { provide: PDF_INSPECTOR, useClass: PdfLibInspector },
  ],
  exports: [DocumentResolver, DOCUMENT_STORAGE, PDF_INSPECTOR],
})
export class DocumentsModule {}
