import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { RequestContextService } from '../../../../src/shared/logging/request-context';
import { IdempotencyService } from '../../../../src/modules/idempotency/application/idempotency.service';
import { InMemoryIdempotencyStore } from '../../../../src/modules/idempotency/infrastructure/in-memory-idempotency.store';
import { GeneratePropertyDescriptionUseCase } from '../../../../src/modules/properties/application/generate-property-description.use-case';
import { createMockAiProvider } from '../../../fixtures/property.fixture';
import { createSilentLogger, createTestConfig } from '../../../fixtures/config.fixture';

function createHarness() {
  const provider = createMockAiProvider();
  const requestContext = new RequestContextService();
  const idempotency = new IdempotencyService(
    new InMemoryIdempotencyStore(),
    createTestConfig(),
    requestContext,
    createSilentLogger(),
  );
  const useCase = new GeneratePropertyDescriptionUseCase(provider, idempotency);

  const execute = (
    body: Parameters<GeneratePropertyDescriptionUseCase['execute']>[0],
    params: { idempotencyKey?: string | null } = {},
  ) =>
    requestContext.run(
      {
        requestId: 'req_2',
        tenantId: 'tenant-a',
        consumerId: 'key_1',
        method: 'POST',
        path: '/v1/ai/properties/description',
        idempotencyKey: params.idempotencyKey ?? null,
        replayed: false,
        startedAt: Date.now(),
      },
      () => useCase.execute(body),
    );

  return { execute, provider };
}

describe('GeneratePropertyDescriptionUseCase', () => {
  it('returns the sanitized description and forwards the normalized payload', async () => {
    const { execute, provider } = createHarness();
    provider.generatePropertyDescription.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      durationMs: 10,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      description: 'Descrição do imóvel: Apartamento com três dormitórios 🏠 #imperdível',
    });

    const outcome = await execute({
      property: {
        type: 'apartment',
        price: 750000,
        features: ['Varanda', 'www.imobiliaria.com.br'],
        location: { city: 'Santos' },
      },
      style: 'professional',
    });

    expect(outcome.response).toEqual({
      description: 'Apartamento com três dormitórios',
    });
    expect(provider.generatePropertyDescription).toHaveBeenCalledWith({
      property: {
        type: 'apartment',
        price: 750000,
        features: ['varanda'],
        city: 'Santos',
      },
      style: 'professional',
    });
  });

  it('fails when the model returns an empty description', async () => {
    const { execute, provider } = createHarness();
    provider.generatePropertyDescription.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      durationMs: 10,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      description: '   ',
    });

    await expect(
      execute({ property: { city: 'Santos' }, style: 'professional' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.AI_DESCRIPTION_FAILED, status: 422 });
  });

  it('propagates provider failures', async () => {
    const { execute, provider } = createHarness();
    provider.generatePropertyDescription.mockRejectedValue(new Error('AI_PROVIDER_ERROR'));

    await expect(execute({ property: { city: 'Santos' }, style: 'professional' })).rejects.toThrow(
      'AI_PROVIDER_ERROR',
    );
  });

  it('replays the previous description for the same idempotency key', async () => {
    const { execute, provider } = createHarness();
    const body = { property: { city: 'Santos' }, style: 'professional' as const };

    const first = await execute(body, { idempotencyKey: 'idem-9' });
    const second = await execute(body, { idempotencyKey: 'idem-9' });

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(provider.generatePropertyDescription).toHaveBeenCalledTimes(1);
  });
});
