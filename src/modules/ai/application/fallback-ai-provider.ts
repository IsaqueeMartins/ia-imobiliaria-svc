import { AppError } from '../../../shared/errors/app-error';
import { ERROR_CODES } from '../../../shared/errors/error-codes';
import { StructuredLoggerService } from '../../../shared/logging/structured-logger.service';
import {
  AiProvider,
  ExtractPropertiesInput,
  ExtractPropertiesResult,
  GeneratePropertyDescriptionInput,
  GeneratePropertyDescriptionResult,
} from '../domain/ai-provider.port';
import { isFallbackEligible } from './ai-error-policy';

export class FallbackAiProvider implements AiProvider {
  readonly name = 'fallback_chain';

  constructor(
    private readonly providers: readonly AiProvider[],
    private readonly logger: StructuredLoggerService,
  ) {
    if (providers.length === 0) {
      throw new Error('FallbackAiProvider requires at least one provider.');
    }
  }

  get model(): string {
    return this.providers[0].model;
  }

  extractProperties(input: ExtractPropertiesInput): Promise<ExtractPropertiesResult> {
    return this.executeChain('extract_properties', (provider) => provider.extractProperties(input));
  }

  generatePropertyDescription(
    input: GeneratePropertyDescriptionInput,
  ): Promise<GeneratePropertyDescriptionResult> {
    return this.executeChain('generate_property_description', (provider) =>
      provider.generatePropertyDescription(input),
    );
  }

  private async executeChain<T>(
    operation: string,
    task: (provider: AiProvider) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown = null;

    for (let index = 0; index < this.providers.length; index += 1) {
      const provider = this.providers[index];
      try {
        return await task(provider);
      } catch (error) {
        lastError = error;
        const hasNext = index < this.providers.length - 1;
        if (!hasNext || !isFallbackEligible(error)) {
          throw error;
        }
        this.logger.warn(
          {
            event: 'ai.provider.fallback',
            operation,
            fromModel: provider.model,
            toModel: this.providers[index + 1].model,
            errorCode: AppError.isAppError(error) ? error.code : null,
          },
          'FallbackAiProvider',
        );
      }
    }

    throw AppError.isAppError(lastError)
      ? lastError
      : new AppError({
          code: ERROR_CODES.AI_PROVIDER_ERROR,
          status: 502,
          cause: lastError,
        });
  }
}
