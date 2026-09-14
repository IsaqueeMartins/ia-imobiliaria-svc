import { AiOperation } from './ai-provider.port';

export const AI_USAGE_RECORDER = Symbol('AI_USAGE_RECORDER');

export interface AiUsageEntry {
  readonly provider: string;
  readonly model: string;
  readonly operation: AiOperation;
  readonly requestId: string | null;
  readonly tenantId: string | null;
  readonly consumerId: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly durationMs: number;
  readonly status: 'success' | 'error';
  readonly errorCode: string | null;
  readonly estimatedCostUsd: number | null;
}

export interface AiUsageRecorder {
  record(entry: AiUsageEntry): void;
}
