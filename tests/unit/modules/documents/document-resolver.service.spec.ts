import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { DocumentResolver } from '../../../../src/modules/documents/application/document-resolver.service';
import { DocumentStorage } from '../../../../src/modules/documents/domain/document-storage.port';
import { PdfLibInspector } from '../../../../src/modules/documents/infrastructure/pdf/pdf-lib-inspector';
import { createTestConfig } from '../../../fixtures/config.fixture';
import { createInvalidPdfFixture, createPdfFixture } from '../../../fixtures/pdf.fixture';

function createStorage(overrides: Partial<DocumentStorage> = {}): DocumentStorage {
  return {
    name: 'fake-storage',
    isConfigured: () => false,
    getObject: jest.fn(),
    probe: jest.fn(),
    ...overrides,
  };
}

function createResolver(
  storage: DocumentStorage = createStorage(),
  env: Record<string, unknown> = {},
): DocumentResolver {
  return new DocumentResolver(storage, new PdfLibInspector(), createTestConfig(env));
}

async function expectAppError(promise: Promise<unknown>, code: string): Promise<AppError> {
  try {
    await promise;
    throw new Error('expected the promise to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
}

async function uploadedFile() {
  const pdf = await createPdfFixture({ pages: 2 });

  return {
    buffer: pdf,
    mimetype: 'application/pdf',
    originalname: 'imoveis.pdf',
    size: pdf.byteLength,
  };
}

describe('DocumentResolver', () => {
  it('rejects requests without any document source', async () => {
    await expectAppError(
      createResolver().resolve({ file: null, reference: {} }),
      ERROR_CODES.INVALID_REQUEST,
    );
  });

  it('rejects requests that send both a file and a reference', async () => {
    await expectAppError(
      createResolver().resolve({
        file: await uploadedFile(),
        reference: { objectKey: 'tenants/a/original.pdf' },
      }),
      ERROR_CODES.INVALID_REQUEST,
    );
  });

  it('resolves an uploaded PDF with its page count', async () => {
    const document = await createResolver().resolve({
      file: await uploadedFile(),
      reference: {},
    });

    expect(document.source).toBe('upload');
    expect(document.pageCount).toBe(2);
    expect(document.mimeType).toBe('application/pdf');
    expect(document.filename).toBe('imoveis.pdf');
    expect(document.id).toMatch(/^doc_/);
    expect(document.reference.objectKey).toBeNull();
  });

  it('rejects files that are not PDFs or have a wrong content type', async () => {
    await expectAppError(
      createResolver().resolve({
        file: {
          buffer: createInvalidPdfFixture(),
          mimetype: 'application/pdf',
          originalname: 'fake.pdf',
          size: 10,
        },
        reference: {},
      }),
      ERROR_CODES.UNSUPPORTED_DOCUMENT,
    );

    await expectAppError(
      createResolver().resolve({
        file: {
          buffer: Buffer.from('%PDF-1.7 content'),
          mimetype: 'image/png',
          originalname: 'picture.png',
          size: 16,
        },
        reference: {},
      }),
      ERROR_CODES.UNSUPPORTED_DOCUMENT,
    );
  });

  it('enforces the maximum document size', async () => {
    const oversized = Buffer.concat([Buffer.from('%PDF-1.7 '), Buffer.alloc(2 * 1024 * 1024)]);

    const error = await expectAppError(
      createResolver(createStorage(), { MAX_DOCUMENT_SIZE_MB: '1' }).resolve({
        file: {
          buffer: oversized,
          mimetype: 'application/pdf',
          originalname: 'big.pdf',
          size: oversized.byteLength,
        },
        reference: {},
      }),
      ERROR_CODES.DOCUMENT_TOO_LARGE,
    );

    expect(error.status).toBe(413);
  });

  it('enforces the maximum number of pages', async () => {
    await expectAppError(
      createResolver(createStorage(), { MAX_DOCUMENT_PAGES: '1' }).resolve({
        file: await uploadedFile(),
        reference: {},
      }),
      ERROR_CODES.DOCUMENT_TOO_LARGE,
    );
  });

  it('fails when a storage reference is used without storage configuration', async () => {
    await expectAppError(
      createResolver().resolve({ file: null, reference: { objectKey: 'tenants/a/x.pdf' } }),
      ERROR_CODES.STORAGE_NOT_CONFIGURED,
    );
  });

  it('validates the object key before reading the storage provider', async () => {
    const getObject = jest.fn();
    const resolver = createResolver(createStorage({ isConfigured: () => true, getObject }));

    await expectAppError(
      resolver.resolve({ file: null, reference: { objectKey: '/etc/passwd' } }),
      ERROR_CODES.INVALID_REQUEST,
    );
    expect(getObject).not.toHaveBeenCalled();
  });

  it('resolves a document stored in the bucket', async () => {
    const pdf = await createPdfFixture({ pages: 2 });
    const storage = createStorage({
      isConfigured: () => true,
      getObject: jest.fn(async () => ({
        data: pdf,
        contentType: 'application/pdf',
        contentLength: pdf.byteLength,
      })),
    });

    const document = await createResolver(storage, { R2_ALLOWED_KEY_PREFIXES: 'tenants/' }).resolve(
      {
        file: null,
        reference: {
          tenantId: 'tenant-123',
          documentId: 'document-456',
          objectKey: 'tenants/tenant-123/ai-imports/document-456/original.pdf',
        },
      },
    );

    expect(document.source).toBe('storage');
    expect(document.id).toBe('document-456');
    expect(document.pageCount).toBe(2);
    expect(document.filename).toBe('original.pdf');
    expect(document.reference).toEqual({
      tenantId: 'tenant-123',
      documentId: 'document-456',
      objectKey: 'tenants/tenant-123/ai-imports/document-456/original.pdf',
    });
  });

  it('rejects references outside the allowed prefixes', async () => {
    const pdf = await createPdfFixture();
    const storage = createStorage({
      isConfigured: () => true,
      getObject: jest.fn(async () => ({
        data: pdf,
        contentType: null,
        contentLength: pdf.byteLength,
      })),
    });

    const error = await expectAppError(
      createResolver(storage, { R2_ALLOWED_KEY_PREFIXES: 'tenants/tenant-a/' }).resolve({
        file: null,
        reference: { objectKey: 'tenants/tenant-b/original.pdf' },
      }),
      ERROR_CODES.FORBIDDEN,
    );

    expect(error.status).toBe(403);
  });
});
