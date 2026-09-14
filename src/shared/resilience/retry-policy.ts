import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

export type SleepFunction = (milliseconds: number) => Promise<void>;

export const SLEEP_FUNCTION = Symbol('SLEEP_FUNCTION');

export const defaultSleep: SleepFunction = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

@Injectable()
export class RetryPolicy {
  constructor(
    private readonly config: AppConfigService,
    @Inject(SLEEP_FUNCTION) private readonly sleep: SleepFunction,
  ) {}

  get maxAttempts(): number {
    return this.config.ai.maxRetries + 1;
  }

  nextDelayMs(attempt: number): number {
    const exponential = this.config.ai.retryBaseDelayMs * 2 ** attempt;
    const capped = Math.min(exponential, this.config.ai.retryMaxDelayMs);
    return Math.floor(Math.random() * capped);
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.maxAttempts - 1) {
      return false;
    }
    return this.isRetryable(error);
  }

  isRetryable(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { retryable?: unknown }).retryable === true
    );
  }

  async execute<T>(
    task: (attempt: number) => Promise<T>,
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void,
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await task(attempt);
      } catch (error) {
        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }
        const delayMs = this.nextDelayMs(attempt);
        onRetry?.(error, attempt, delayMs);
        await this.sleep(delayMs);
        attempt += 1;
      }
    }
  }
}
