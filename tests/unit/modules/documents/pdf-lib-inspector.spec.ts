import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { PdfLibInspector } from '../../../../src/modules/documents/infrastructure/pdf/pdf-lib-inspector';
import { createPdfFixture, createInvalidPdfFixture } from '../../../fixtures/pdf.fixture';

describe('PdfLibInspector', () => {
  const inspector = new PdfLibInspector();

  it('counts the pages of a valid PDF', async () => {
    const pdf = await createPdfFixture({ pages: 3 });

    await expect(inspector.inspect(pdf)).resolves.toEqual({ pageCount: 3 });
  });

  it('rejects documents that are not PDFs', async () => {
    await expect(inspector.inspect(createInvalidPdfFixture())).rejects.toBeInstanceOf(AppError);

    try {
      await inspector.inspect(createInvalidPdfFixture());
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.UNSUPPORTED_DOCUMENT);
      expect((error as AppError).status).toBe(422);
    }
  });
});
