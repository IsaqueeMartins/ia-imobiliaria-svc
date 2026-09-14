import { AppError } from '../../../shared/errors/app-error';
import { StructuredLoggerService } from '../../../shared/logging/structured-logger.service';
import { RetryPolicy } from '../../../shared/resilience/retry-policy';
import {
  AiProvider,
  ExtractPropertiesInput,
  ExtractPropertiesResult,
  GeneratePropertyDescriptionInput,
  GeneratePropertyDescriptionResult,
} from '../domain/ai-provider.port';

export class RetryingAiProvider implements AiProvider {
  constructor(
    private readonly delegate: AiProvider,
    private readonly retryPolicy: RetryPolicy,
    private readonly logger: StructuredLoggerService,
  ) {}

  get name(): string {
    return this.delegate.name;
  }

  get model(): string {
    return this.delegate.model;
  }

  extractProperties(input: ExtractPropertiesInput): Promise<ExtractPropertiesResult> {
    return this.withRetry('extract_properties', () => this.delegate.extractProperties(input));
  }

  generatePropertyDescription(
    input: GeneratePropertyDescriptionInput,
  ): Promise<GeneratePropertyDescriptionResult> {
    return this.withRetry('generate_property_description', () =>
      this.delegate.generatePropertyDescription(input),
    );
  }

  private withRetry<T>(operation: string, task: () => Promise<T>): Promise<T> {
    return this.retryPolicy.execute(task, (error, attempt, delayMs) => {
      this.logger.warn(
        {
          event: 'ai.provider.retry',
          operation,
          provider: this.delegate.name,
          model: this.delegate.model,
          attempt: attempt + 1,
          delayMs,
          errorCode: AppError.isAppError(error) ? error.code : null,
        },
        'RetryingAiProvider',
      );
    });
  }
}
