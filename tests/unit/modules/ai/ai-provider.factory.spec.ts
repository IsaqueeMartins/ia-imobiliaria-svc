import { ApiError, GoogleGenAI } from '@google/genai';
import { RetryPolicy } from '../../../../src/shared/resilience/retry-policy';
import {
  createAiProvider,
  resolveModelChain,
} from '../../../../src/modules/ai/ai-provider.factory';
import { AiUsageRecorder } from '../../../../src/modules/ai/domain/ai-usage.port';
import { PropertyDescriptionPromptBuilder } from '../../../../src/modules/ai/application/prompt/property-description.prompt';
import { PropertyExtractionPromptBuilder } from '../../../../src/modules/ai/application/prompt/property-extraction.prompt';
import { GeminiDocumentPartFactory } from '../../../../src/modules/ai/infrastructure/gemini/gemini-document-part.factory';
import { createSilentLogger, createTestConfig } from '../../../fixtures/config.fixture';
import { createExtractedProperty } from '../../../fixtures/property.fixture';

function createHarness(env: Record<string, unknown>, generateContent: jest.Mock = jest.fn()) {
  const config = createTestConfig(env);
  const logger = createSilentLogger();
  const client = {
    models: { generateContent },
    files: { upload: jest.fn(), get: jest.fn(), delete: jest.fn() },
  } as unknown as GoogleGenAI;
  const usageRecorder: AiUsageRecorder = { record: jest.fn() };

  const provider = createAiProvider({
    client,
    config,
    logger,
    retryPolicy: new RetryPolicy(config, async () => undefined),
    usageRecorder,
    extractionPrompt: new PropertyExtractionPromptBuilder(),
    descriptionPrompt: new PropertyDescriptionPromptBuilder(),
    documentParts: new GeminiDocumentPartFactory(client, config, logger),
  });

  return { provider, generateContent };
}

const extractionInput = {
  document: {
    data: Buffer.from('%PDF-1.7 content'),
    mimeType: 'application/pdf',
    filename: null,
    pageCount: 1,
  },
};

describe('resolveModelChain', () => {
  it('returns the primary model and removes duplicates', () => {
    const config = createTestConfig({
      GEMINI_MODEL: 'gemini-3.1-flash-lite',
      GEMINI_FALLBACK_MODELS: 'gemini-3.5-flash,gemini-3.1-flash-lite',
    });

    expect(resolveModelChain(config)).toEqual(['gemini-3.1-flash-lite', 'gemini-3.5-flash']);
  });

  it('ignores fallback models when the feature is disabled', () => {
    const config = createTestConfig({
      AI_FALLBACK_ENABLED: 'false',
      GEMINI_FALLBACK_MODELS: 'gemini-3.5-flash',
    });

    expect(resolveModelChain(config)).toEqual(['gemini-3.1-flash-lite']);
  });
});

describe('createAiProvider', () => {
  it('builds a single provider chain when no fallback model is configured', async () => {
    const generateContent = jest.fn(async (_request: { model: string }) => ({
      text: JSON.stringify({ properties: [createExtractedProperty()], warnings: [] }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    }));
    const { provider } = createHarness(
      { AI_FALLBACK_ENABLED: 'false', GEMINI_FALLBACK_MODELS: '' },
      generateContent,
    );

    expect(provider.model).toBe('gemini-3.1-flash-lite');

    const result = await provider.extractProperties(extractionInput);

    expect(result.model).toBe('gemini-3.1-flash-lite');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].model).toBe('gemini-3.1-flash-lite');
  });

  it('uses the cheapest model first and falls back when it fails', async () => {
    const generateContent = jest
      .fn()
      .mockRejectedValueOnce(new ApiError({ message: 'provider outage', status: 503 }))
      .mockResolvedValueOnce({
        text: JSON.stringify({ properties: [createExtractedProperty()], warnings: [] }),
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      });
    const { provider } = createHarness(
      {
        AI_FALLBACK_ENABLED: 'true',
        GEMINI_FALLBACK_MODELS: 'gemini-3.5-flash',
        AI_MAX_RETRIES: '0',
      },
      generateContent,
    );

    const result = await provider.extractProperties(extractionInput);

    expect(result.model).toBe('gemini-3.5-flash');
    expect(generateContent.mock.calls.map((call) => call[0].model)).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
    ]);
  });

  it('does not use the fallback model for non retryable failures', async () => {
    const generateContent = jest
      .fn()
      .mockRejectedValue(new ApiError({ message: 'bad request', status: 400 }));
    const { provider } = createHarness(
      {
        AI_FALLBACK_ENABLED: 'true',
        GEMINI_FALLBACK_MODELS: 'gemini-3.5-flash',
        AI_MAX_RETRIES: '0',
      },
      generateContent,
    );

    await expect(provider.extractProperties(extractionInput)).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
