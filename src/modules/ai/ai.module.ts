import { Module } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { SharedModule } from '../../shared/shared.module';
import { createAiProvider } from './ai-provider.factory';
import { AiStatusService } from './application/ai-status.service';
import { PropertyDescriptionPromptBuilder } from './application/prompt/property-description.prompt';
import { PropertyExtractionPromptBuilder } from './application/prompt/property-extraction.prompt';
import { AI_PROVIDER } from './domain/ai-provider.port';
import { AI_USAGE_RECORDER } from './domain/ai-usage.port';
import { GEMINI_CLIENT, createGeminiClient } from './infrastructure/gemini/gemini-client.factory';
import { GeminiDocumentPartFactory } from './infrastructure/gemini/gemini-document-part.factory';
import { StructuredUsageRecorder } from './infrastructure/usage/structured-usage.recorder';
import { AppConfigService } from '../../shared/config/app-config.service';
import { StructuredLoggerService } from '../../shared/logging/structured-logger.service';
import { RetryPolicy } from '../../shared/resilience/retry-policy';
import { AiUsageRecorder } from './domain/ai-usage.port';

@Module({
  imports: [SharedModule],
  providers: [
    AiStatusService,
    PropertyExtractionPromptBuilder,
    PropertyDescriptionPromptBuilder,
    GeminiDocumentPartFactory,
    { provide: GEMINI_CLIENT, useFactory: createGeminiClientFactory, inject: [AppConfigService] },
    { provide: AI_USAGE_RECORDER, useClass: StructuredUsageRecorder },
    {
      provide: AI_PROVIDER,
      useFactory: (
        client: GoogleGenAI,
        config: AppConfigService,
        logger: StructuredLoggerService,
        retryPolicy: RetryPolicy,
        usageRecorder: AiUsageRecorder,
        extractionPrompt: PropertyExtractionPromptBuilder,
        descriptionPrompt: PropertyDescriptionPromptBuilder,
        documentParts: GeminiDocumentPartFactory,
      ) =>
        createAiProvider({
          client,
          config,
          logger,
          retryPolicy,
          usageRecorder,
          extractionPrompt,
          descriptionPrompt,
          documentParts,
        }),
      inject: [
        GEMINI_CLIENT,
        AppConfigService,
        StructuredLoggerService,
        RetryPolicy,
        AI_USAGE_RECORDER,
        PropertyExtractionPromptBuilder,
        PropertyDescriptionPromptBuilder,
        GeminiDocumentPartFactory,
      ],
    },
  ],
  exports: [AI_PROVIDER, AI_USAGE_RECORDER, AiStatusService],
})
export class AiModule {}

function createGeminiClientFactory(config: AppConfigService): GoogleGenAI {
  return createGeminiClient(config.ai);
}
