import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../shared/config/app-config.service';

export interface AiStatus {
  readonly configured: boolean;
  readonly provider: string;
  readonly primaryModel: string;
  readonly fallbackModels: readonly string[];
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly fallbackEnabled: boolean;
}

@Injectable()
export class AiStatusService {
  constructor(private readonly config: AppConfigService) {}

  get status(): AiStatus {
    return {
      configured: this.config.ai.googleApiKey.trim().length > 0,
      provider: 'gemini',
      primaryModel: this.config.ai.model,
      fallbackModels: this.config.ai.fallbackEnabled ? this.config.ai.fallbackModels : [],
      timeoutMs: this.config.ai.requestTimeoutMs,
      maxRetries: this.config.ai.maxRetries,
      fallbackEnabled: this.config.ai.fallbackEnabled,
    };
  }
}
