import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { RequestContextService } from '../../../../src/shared/logging/request-context';
import { DocumentResolver } from '../../../../src/modules/documents/application/document-resolver.service';
import { ResolvedDocument } from '../../../../src/modules/documents/domain/document.types';
import { IdempotencyService } from '../../../../src/modules/idempotency/application/idempotency.service';
import { InMemoryIdempotencyStore } from '../../../../src/modules/idempotency/infrastructure/in-memory-idempotency.store';
import { ExtractPropertiesUseCase } from '../../../../src/modules/properties/application/extract-properties.use-case';
import { PropertyNormalizer } from '../../../../src/modules/properties/application/property-normalizer.service';
import { createExtractedProperty, createMockAiProvider } from '../../../fixtures/property.fixture';
import { createSilentLogger, createTestConfig } from '../../../fixtures/config.fixture';

function createResolvedDocument(overrides: Partial<ResolvedDocument> = {}): ResolvedDocument {
  const data = Buffer.from('%PDF-1.7 content');

  return {
    id: 'doc_1',
    data,
    mimeType: 'application/pdf',
    filename: 'imoveis.pdf',
    pageCount: 2,
    sizeBytes: data.byteLength,
    source: 'upload',
    reference: { tenantId: null, documentId: null, objectKey: null },
    ...overrides,
  };
}

function createHarness(options: { normalizer?: PropertyNormalizer } = {}) {
  const provider = createMockAiProvider();
  const requestContext = new RequestContextService();
  const idempotency = new IdempotencyService(
    new InMemoryIdempotencyStore(),
    createTestConfig(),
    requestContext,
    createSilentLogger(),
  );
  const documentResolver = {
    resolve: jest.fn(async () => createResolvedDocument()),
  } as unknown as DocumentResolver;

  const useCase = new ExtractPropertiesUseCase(
    provider,
    documentResolver,
    options.normalizer ?? new PropertyNormalizer(),
    idempotency,
    createSilentLogger(),
  );

  const execute = (params: { idempotencyKey?: string | null; tenantId?: string | null } = {}) =>
    requestContext.run(
      {
        requestId: 'req_1',
        tenantId: params.tenantId ?? 'tenant-a',
        consumerId: 'key_1',
        method: 'POST',
        path: '/v1/ai/properties/extract',
        idempotencyKey: params.idempotencyKey ?? null,
        replayed: false,
        startedAt: Date.now(),
      },
      () =>
        useCase.execute({
          source: { file: null, reference: { objectKey: 'tenants/a/original.pdf' } },
          requestId: 'req_1',
          tenantId: params.tenantId ?? 'tenant-a',
        }),
    );

  return { execute, provider, requestContext, documentResolver };
}

describe('ExtractPropertiesUseCase', () => {
  it('returns normalized properties with document metadata and usage', async () => {
    const { execute, provider } = createHarness();

    const outcome = await execute();
    const response = outcome.response;

    expect(outcome.replayed).toBe(false);
    expect(response.requestId).toBe('req_1');
    expect(response.document).toEqual({
      id: 'doc_1',
      pages: 2,
      sizeBytes: 16,
      source: 'upload',
      filename: 'imoveis.pdf',
      tenantId: 'tenant-a',
      documentId: null,
      objectKey: null,
    });
    expect(response.properties).toHaveLength(1);
    expect(response.properties[0].location.state).toBe('SP');
    expect(response.warnings).toEqual([]);
    expect(response.errors).toEqual([]);
    expect(response.usage).toEqual({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      durationMs: 1234,
    });
    expect(provider.extractProperties).toHaveBeenCalledWith({
      document: {
        data: expect.any(Buffer),
        mimeType: 'application/pdf',
        filename: 'imoveis.pdf',
        pageCount: 2,
      },
    });
  });

  it('fails with AI_EXTRACTION_FAILED when the document has no identifiable property', async () => {
    const { execute, provider } = createHarness();
    provider.extractProperties.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      durationMs: 10,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      properties: [],
      warnings: [
        {
          code: 'NO_PROPERTIES_FOUND',
          message: 'Nenhum imóvel identificado.',
          field: null,
          pages: [],
        },
      ],
    });

    await expect(execute()).rejects.toMatchObject({
      code: ERROR_CODES.AI_EXTRACTION_FAILED,
      status: 422,
      details: expect.objectContaining({ documentId: 'doc_1', pages: 2 }),
    });
  });

  it('keeps valid properties and reports normalization failures as errors', async () => {
    const normalizer = new PropertyNormalizer();
    jest.spyOn(normalizer, 'normalize').mockImplementationOnce(() => {
      throw new Error('unexpected normalization failure');
    });

    const { execute, provider } = createHarness({ normalizer });
    provider.extractProperties.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      durationMs: 10,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      properties: [
        createExtractedProperty({ title: 'Primeiro' }),
        createExtractedProperty({ title: 'Segundo', sourcePages: [2] }),
      ],
      warnings: [],
    });

    const response = (await execute()).response;

    expect(response.properties).toHaveLength(1);
    expect(response.properties[0].title).toBe('Segundo');
    expect(response.errors).toEqual([
      expect.objectContaining({
        code: 'PROPERTY_NORMALIZATION_FAILED',
        propertyIndex: 0,
      }),
    ]);
  });

  it('replays the previous response for the same idempotency key', async () => {
    const { execute, provider } = createHarness();

    const first = await execute({ idempotencyKey: 'idem-1' });
    const second = await execute({ idempotencyKey: 'idem-1' });

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.response).toEqual(first.response);
    expect(provider.extractProperties).toHaveBeenCalledTimes(1);
  });

  it('propagates document resolution failures without calling the AI provider', async () => {
    const { execute, provider, documentResolver } = createHarness();
    (documentResolver.resolve as jest.Mock).mockRejectedValue(new Error('DOCUMENT_NOT_FOUND'));

    await expect(execute()).rejects.toThrow('DOCUMENT_NOT_FOUND');
    expect(provider.extractProperties).not.toHaveBeenCalled();
  });
});
