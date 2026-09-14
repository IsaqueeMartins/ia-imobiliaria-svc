import { GoogleGenAI } from '@google/genai';
import { AppConfigService } from '../../shared/config/app-config.service';
import { StructuredLoggerService } from '../../shared/logging/structured-logger.service';
import { RetryPolicy } from '../../shared/resilience/retry-policy';
import { FallbackAiProvider } from './application/fallback-ai-provider';
import { PropertyDescriptionPromptBuilder } from './application/prompt/property-description.prompt';
import { PropertyExtractionPromptBuilder } from './application/prompt/property-extraction.prompt';
import { RetryingAiProvider } from './application/retrying-ai-provider';
import { AiProvider } from './domain/ai-provider.port';
import { AiUsageRecorder } from './domain/ai-usage.port';
import { GeminiDocumentPartFactory } from './infrastructure/gemini/gemini-document-part.factory';
import { GeminiProvider } from './infrastructure/gemini/gemini.provider';

export interface AiProviderFactoryDependencies {
  readonly client: GoogleGenAI;
  readonly config: AppConfigService;
  readonly logger: StructuredLoggerService;
  readonly retryPolicy: RetryPolicy;
  readonly usageRecorder: AiUsageRecorder;
  readonly extractionPrompt: PropertyExtractionPromptBuilder;
  readonly descriptionPrompt: PropertyDescriptionPromptBuilder;
  readonly documentParts: GeminiDocumentPartFactory;
}

export function resolveModelChain(config: AppConfigService): string[] {
  const models = [config.ai.model, ...(config.ai.fallbackEnabled ? config.ai.fallbackModels : [])]
    .map((model) => model.trim())
    .filter((model) => model.length > 0);

  return [...new Set(models)];
}

export function createAiProvider(dependencies: AiProviderFactoryDependencies): AiProvider {
  const providers = resolveModelChain(dependencies.config).map(
    (model) =>
      new RetryingAiProvider(
        new GeminiProvider({
          client: dependencies.client,
          options: {
            model,
            extractionTemperature: 0,
            descriptionTemperature: dependencies.config.ai.temperature,
          },
          extractionPrompt: dependencies.extractionPrompt,
          descriptionPrompt: dependencies.descriptionPrompt,
          documentParts: dependencies.documentParts,
          usageRecorder: dependencies.usageRecorder,
        }),
        dependencies.retryPolicy,
        dependencies.logger,
      ),
  );

  if (providers.length === 1) {
    return providers[0];
  }

  return new FallbackAiProvider(providers, dependencies.logger);
}
