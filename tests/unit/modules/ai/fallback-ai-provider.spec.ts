import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { FallbackAiProvider } from '../../../../src/modules/ai/application/fallback-ai-provider';
import { AiProvider } from '../../../../src/modules/ai/domain/ai-provider.port';
import { createSilentLogger } from '../../../fixtures/config.fixture';

function createProvider(model: string, error: AppError | null, result: string = model): AiProvider {
  return {
    name: 'gemini',
    model,
    extractProperties: jest.fn(async () => {
      if (error) {
        throw error;
      }
      return {
        provider: 'gemini',
        model,
        durationMs: 1,
        usage: { inputTokens: null, outputTokens: null, totalTokens: null },
        properties: [],
        warnings: [],
      };
    }),
    generatePropertyDescription: jest.fn(async () => {
      if (error) {
        throw error;
      }
      return {
        provider: 'gemini',
        model,
        durationMs: 1,
        usage: { inputTokens: null, outputTokens: null, totalTokens: null },
        description: result,
      };
    }),
  };
}

const document = {
  data: Buffer.from('pdf'),
  mimeType: 'application/pdf',
  filename: null,
  pageCount: 1,
};

describe('FallbackAiProvider', () => {
  it('requires at least one provider', () => {
    expect(() => new FallbackAiProvider([], createSilentLogger())).toThrow(/at least one provider/);
  });

  it('uses the cheapest model first and keeps it when it succeeds', async () => {
    const primary = createProvider('gemini-3.1-flash-lite', null);
    const fallback = createProvider('gemini-3.5-flash', null);
    const provider = new FallbackAiProvider([primary, fallback], createSilentLogger());

    const result = await provider.extractProperties({ document });

    expect(result.model).toBe('gemini-3.1-flash-lite');
    expect(fallback.extractProperties).not.toHaveBeenCalled();
  });

  it('falls back when the primary model fails with a retryable error', async () => {
    const primary = createProvider(
      'gemini-3.1-flash-lite',
      new AppError({ code: ERROR_CODES.AI_PROVIDER_ERROR, status: 502, retryable: true }),
    );
    const fallback = createProvider('gemini-3.5-flash', null);
    const logger = createSilentLogger();
    const provider = new FallbackAiProvider([primary, fallback], logger);

    const result = await provider.extractProperties({ document });

    expect(result.model).toBe('gemini-3.5-flash');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai.provider.fallback',
        fromModel: 'gemini-3.1-flash-lite',
        toModel: 'gemini-3.5-flash',
      }),
      'FallbackAiProvider',
    );
  });

  it('falls back when the primary model returns an invalid response', async () => {
    const primary = createProvider(
      'gemini-3.1-flash-lite',
      new AppError({ code: ERROR_CODES.AI_INVALID_RESPONSE, status: 502, retryable: true }),
    );
    const fallback = createProvider('gemini-3.5-flash', null);
    const provider = new FallbackAiProvider([primary, fallback], createSilentLogger());

    await expect(
      provider.generatePropertyDescription({
        property: { city: 'Santos' },
        style: 'professional',
      }),
    ).resolves.toMatchObject({ model: 'gemini-3.5-flash' });
  });

  it('does not fall back on non retryable failures', async () => {
    const primary = createProvider(
      'gemini-3.1-flash-lite',
      new AppError({ code: ERROR_CODES.AI_PROVIDER_ERROR, status: 502, retryable: false }),
    );
    const fallback = createProvider('gemini-3.5-flash', null);
    const provider = new FallbackAiProvider([primary, fallback], createSilentLogger());

    await expect(provider.extractProperties({ document })).rejects.toBeInstanceOf(AppError);
    expect(fallback.extractProperties).not.toHaveBeenCalled();
  });

  it('surfaces the last error when the whole chain fails', async () => {
    const primary = createProvider(
      'gemini-3.1-flash-lite',
      new AppError({ code: ERROR_CODES.AI_PROVIDER_ERROR, status: 502, retryable: true }),
    );
    const fallback = createProvider(
      'gemini-3.5-flash',
      new AppError({ code: ERROR_CODES.AI_RATE_LIMIT, status: 429, retryable: true }),
    );
    const provider = new FallbackAiProvider([primary, fallback], createSilentLogger());

    await expect(provider.extractProperties({ document })).rejects.toMatchObject({
      code: ERROR_CODES.AI_RATE_LIMIT,
    });
  });
});
