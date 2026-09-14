import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { RetryPolicy } from '../../../../src/shared/resilience/retry-policy';
import { RetryingAiProvider } from '../../../../src/modules/ai/application/retrying-ai-provider';
import { createTestConfig, createSilentLogger } from '../../../fixtures/config.fixture';
import { createDescriptionPayload } from '../../../fixtures/property.fixture';
import { AiProvider } from '../../../../src/modules/ai/domain/ai-provider.port';

function createDelegate(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    name: 'gemini',
    model: 'gemini-3.1-flash-lite',
    extractProperties: jest.fn(async () => ({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      durationMs: 10,
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      properties: [],
      warnings: [],
    })),
    generatePropertyDescription: jest.fn(async () => ({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      durationMs: 10,
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      description: 'ok',
    })),
    ...overrides,
  };
}

describe('RetryingAiProvider', () => {
  it('exposes the delegate identity', () => {
    const provider = new RetryingAiProvider(
      createDelegate(),
      new RetryPolicy(createTestConfig(), async () => undefined),
      createSilentLogger(),
    );

    expect(provider.name).toBe('gemini');
    expect(provider.model).toBe('gemini-3.1-flash-lite');
  });

  it('retries transient provider failures and logs the attempt', async () => {
    const extractProperties = jest
      .fn()
      .mockRejectedValueOnce(
        new AppError({ code: ERROR_CODES.AI_PROVIDER_ERROR, status: 502, retryable: true }),
      )
      .mockImplementation(createDelegate().extractProperties);
    const logger = createSilentLogger();
    const provider = new RetryingAiProvider(
      createDelegate({ extractProperties }),
      new RetryPolicy(createTestConfig(), async () => undefined),
      logger,
    );

    const result = await provider.extractProperties({
      document: {
        data: Buffer.from('x'),
        mimeType: 'application/pdf',
        filename: null,
        pageCount: 1,
      },
    });

    expect(result.provider).toBe('gemini');
    expect(extractProperties).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ai.provider.retry', attempt: 1 }),
      'RetryingAiProvider',
    );
  });

  it('does not retry invalid requests', async () => {
    const generatePropertyDescription = jest.fn(async () => {
      throw new AppError({ code: ERROR_CODES.AI_PROVIDER_ERROR, status: 400 });
    });
    const provider = new RetryingAiProvider(
      createDelegate({ generatePropertyDescription }),
      new RetryPolicy(createTestConfig(), async () => undefined),
      createSilentLogger(),
    );

    await expect(
      provider.generatePropertyDescription({
        property: createDescriptionPayload(),
        style: 'professional',
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(generatePropertyDescription).toHaveBeenCalledTimes(1);
  });
});
