import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../shared/config/app-config.service';
import { AiStatusService } from '../ai/application/ai-status.service';
import { DOCUMENT_STORAGE, DocumentStorage } from '../documents/domain/document-storage.port';
import { HealthCheck, LivenessResponse, ReadinessResponse } from './health.schema';

const STORAGE_PROBE_CACHE_MS = 30000;

@Injectable()
export class HealthService {
  private lastProbeAt = 0;
  private lastProbe: HealthCheck | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly aiStatus: AiStatusService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  ) {}

  get liveness(): LivenessResponse {
    return {
      status: 'ok',
      environment: this.config.http.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessResponse> {
    const checks = [this.aiProviderCheck(), await this.documentStorageCheck()];
    return {
      status: checks.every((check) => check.status !== 'down') ? 'ready' : 'not_ready',
      checks,
    };
  }

  private aiProviderCheck(): HealthCheck {
    const status = this.aiStatus.status;
    return {
      name: 'ai_provider',
      status: status.configured ? 'up' : 'down',
      details: {
        provider: status.provider,
        primaryModel: status.primaryModel,
        fallbackModels: status.fallbackModels,
        fallbackEnabled: status.fallbackEnabled,
        timeoutMs: status.timeoutMs,
        maxRetries: status.maxRetries,
        paidCall: false,
      },
    };
  }

  private async documentStorageCheck(): Promise<HealthCheck> {
    if (!this.storage.isConfigured()) {
      return {
        name: 'document_storage',
        status: 'unconfigured',
        details: { provider: this.storage.name, uploadEndpointAvailable: true },
      };
    }

    if (!this.config.storage.readinessCheck) {
      return {
        name: 'document_storage',
        status: 'up',
        details: { provider: this.storage.name, probed: false },
      };
    }

    if (this.lastProbe && Date.now() - this.lastProbeAt < STORAGE_PROBE_CACHE_MS) {
      return this.lastProbe;
    }

    try {
      await this.storage.probe();
      this.lastProbe = {
        name: 'document_storage',
        status: 'up',
        details: { provider: this.storage.name, probed: true },
      };
    } catch (error) {
      this.lastProbe = {
        name: 'document_storage',
        status: 'down',
        details: {
          provider: this.storage.name,
          probed: true,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }

    this.lastProbeAt = Date.now();
    return this.lastProbe;
  }
}
