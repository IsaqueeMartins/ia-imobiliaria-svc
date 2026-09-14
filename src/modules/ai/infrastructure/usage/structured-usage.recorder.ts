import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../shared/config/app-config.service';
import { RequestContextService } from '../../../../shared/logging/request-context';
import { StructuredLoggerService } from '../../../../shared/logging/structured-logger.service';
import { AiTokenUsage } from '../../domain/ai-provider.port';
import { AiUsageEntry, AiUsageRecorder } from '../../domain/ai-usage.port';

const COST_DECIMALS = 6;

export function estimateUsageCost(
  usage: Pick<AiTokenUsage, 'inputTokens' | 'outputTokens'>,
  inputPricePerMillionUsd: number | null,
  outputPricePerMillionUsd: number | null,
): number | null {
  if (inputPricePerMillionUsd === null && outputPricePerMillionUsd === null) {
    return null;
  }
  const inputCost =
    usage.inputTokens === null
      ? 0
      : (usage.inputTokens / 1_000_000) * (inputPricePerMillionUsd ?? 0);
  const outputCost =
    usage.outputTokens === null
      ? 0
      : (usage.outputTokens / 1_000_000) * (outputPricePerMillionUsd ?? 0);
  return Number((inputCost + outputCost).toFixed(COST_DECIMALS));
}

@Injectable()
export class StructuredUsageRecorder implements AiUsageRecorder {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly requestContext: RequestContextService,
    private readonly config: AppConfigService,
  ) {}

  record(entry: AiUsageEntry): void {
    const current = this.requestContext.current();
    const estimatedCostUsd =
      entry.estimatedCostUsd ??
      estimateUsageCost(
        { inputTokens: entry.inputTokens, outputTokens: entry.outputTokens },
        this.config.ai.inputPricePerMillionUsd,
        this.config.ai.outputPricePerMillionUsd,
      );

    this.logger.log(
      {
        event: 'ai.usage',
        provider: entry.provider,
        model: entry.model,
        operation: entry.operation,
        requestId: entry.requestId ?? current?.requestId ?? null,
        tenantId: entry.tenantId ?? current?.tenantId ?? null,
        consumerId: entry.consumerId ?? current?.consumerId ?? null,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        totalTokens: entry.totalTokens,
        durationMs: entry.durationMs,
        status: entry.status,
        errorCode: entry.errorCode,
        estimatedCostUsd,
      },
      'AiUsage',
    );
  }
}
