import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ERROR_CODES } from '../../src/shared/errors/error-codes';
import { createPdfFixture } from '../fixtures/pdf.fixture';
import { createMockAiProvider } from '../fixtures/property.fixture';
import { createTestApp } from '../fixtures/test-app';

const API_KEY = 'test-consumer-key';

describe('Property extraction endpoint (e2e)', () => {
  let app: INestApplication;
  let pdf: Buffer;

  beforeAll(async () => {
    app = (await createTestApp()).app;
    pdf = await createPdfFixture({ pages: 2 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('extracts properties from an uploaded PDF', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/extract')
      .set('X-API-Key', API_KEY)
      .attach('file', pdf, { filename: 'imoveis.pdf', contentType: 'application/pdf' })
      .expect(200);

    expect(response.body.requestId).toMatch(/^req_/);
    expect(response.body.document).toEqual({
      id: expect.stringMatching(/^doc_/),
      pages: 2,
      sizeBytes: pdf.byteLength,
      source: 'upload',
      filename: 'imoveis.pdf',
      tenantId: 'tenant-test',
      documentId: null,
      objectKey: null,
    });
    expect(response.body.properties).toHaveLength(1);
    expect(response.body.properties[0]).toMatchObject({
      title: 'Apartamento no Gonzaga',
      type: 'apartment',
      transaction: 'sale',
      price: 750000,
      location: { city: 'Santos', neighborhood: 'Gonzaga', state: 'SP' },
      features: ['varanda', 'piscina'],
      source: { pages: [1, 2] },
      confidence: { overall: 0.95 },
    });
    expect(response.body.usage).toEqual({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      durationMs: 1234,
    });
    expect(response.headers['idempotency-replayed']).toBe('false');
    expect(response.headers['x-request-id']).toMatch(/^req_/);
  });

  it('replays the same response for a repeated Idempotency-Key', async () => {
    const { app: idempotentApp, provider } = await createTestApp();

    const call = () =>
      request(idempotentApp.getHttpServer())
        .post('/v1/ai/properties/extract')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-idempotency-key')
        .attach('file', pdf, { filename: 'imoveis.pdf', contentType: 'application/pdf' });

    const first = await call().expect(200);
    const second = await call().expect(200);

    expect(first.headers['idempotency-replayed']).toBe('false');
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(provider.extractProperties).toHaveBeenCalledTimes(1);

    await idempotentApp.close();
  });

  it('rejects documents that are not PDFs', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/extract')
      .set('X-API-Key', API_KEY)
      .attach('file', Buffer.from('not a pdf'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
      .expect(422);

    expect(response.body.code).toBe(ERROR_CODES.UNSUPPORTED_DOCUMENT);
  });

  it('requires a document source', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/extract')
      .set('X-API-Key', API_KEY)
      .send({})
      .expect(400);

    expect(response.body.code).toBe(ERROR_CODES.INVALID_REQUEST);
    expect(response.body.message).toContain('objectKey');
  });

  it('rejects unknown body fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/extract')
      .set('X-API-Key', API_KEY)
      .send({ objectKey: 'tenants/a/x.pdf', unexpected: true })
      .expect(400);

    expect(response.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects documents above the configured size limit', async () => {
    const largePdf = Buffer.concat([Buffer.from('%PDF-1.7 '), Buffer.alloc(2 * 1024 * 1024)]);
    const { app: limitedApp } = await createTestApp({ env: { MAX_DOCUMENT_SIZE_MB: '1' } });

    const response = await request(limitedApp.getHttpServer())
      .post('/v1/ai/properties/extract')
      .set('X-API-Key', API_KEY)
      .attach('file', largePdf, { filename: 'big.pdf', contentType: 'application/pdf' })
      .expect(413);

    expect(response.body.code).toBe(ERROR_CODES.DOCUMENT_TOO_LARGE);

    await limitedApp.close();
  });

  it('explains that storage references are unavailable when R2 is not configured', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/extract')
      .set('X-API-Key', API_KEY)
      .send({ objectKey: 'tenants/tenant-test/ai-imports/doc/original.pdf' })
      .expect(503);

    expect(response.body.code).toBe(ERROR_CODES.STORAGE_NOT_CONFIGURED);
  });

  it('extracts properties from a document stored in the bucket', async () => {
    const { app: storageApp } = await createTestApp({
      storage: {
        name: 'fake-storage',
        isConfigured: () => true,
        getObject: async () => ({
          data: pdf,
          contentType: 'application/pdf',
          contentLength: pdf.byteLength,
        }),
        probe: async () => undefined,
      },
      env: { R2_ALLOWED_KEY_PREFIXES: 'tenants/' },
    });

    const response = await request(storageApp.getHttpServer())
      .post('/v1/ai/properties/extract')
      .set('X-API-Key', API_KEY)
      .send({
        tenantId: 'tenant-test',
        documentId: 'document-456',
        objectKey: 'tenants/tenant-test/ai-imports/document-456/original.pdf',
      })
      .expect(200);

    expect(response.body.document).toMatchObject({
      id: 'document-456',
      source: 'storage',
      tenantId: 'tenant-test',
      objectKey: 'tenants/tenant-test/ai-imports/document-456/original.pdf',
    });

    await storageApp.close();
  });

  it('returns AI_EXTRACTION_FAILED when the model finds no property', async () => {
    const provider = createMockAiProvider({
      extractProperties: jest.fn(async () => ({
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        durationMs: 10,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        properties: [],
        warnings: [
          {
            code: 'NO_PROPERTIES_FOUND' as const,
            message: 'Nenhum imóvel identificado.',
            field: null,
            pages: [],
          },
        ],
      })),
    });
    const { app: emptyApp } = await createTestApp({ aiProvider: provider });

    const response = await request(emptyApp.getHttpServer())
      .post('/v1/ai/properties/extract')
      .set('X-API-Key', API_KEY)
      .attach('file', pdf, { filename: 'imoveis.pdf', contentType: 'application/pdf' })
      .expect(422);

    expect(response.body.code).toBe(ERROR_CODES.AI_EXTRACTION_FAILED);
    expect(response.body.details.warnings).toHaveLength(1);

    await emptyApp.close();
  });
});
