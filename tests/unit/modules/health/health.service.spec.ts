import { AiStatusService } from '../../../../src/modules/ai/application/ai-status.service';
import { HealthService } from '../../../../src/modules/health/health.service';
import { DocumentStorage } from '../../../../src/modules/documents/domain/document-storage.port';
import { createTestConfig } from '../../../fixtures/config.fixture';

function createStorage(overrides: Partial<DocumentStorage> = {}): DocumentStorage {
  return {
    name: 'fake-storage',
    isConfigured: () => false,
    getObject: jest.fn(),
    probe: jest.fn(),
    ...overrides,
  };
}

function createHealthService(
  storage: DocumentStorage = createStorage(),
  env: Record<string, unknown> = {},
): HealthService {
  const config = createTestConfig(env);
  return new HealthService(config, new AiStatusService(config), storage);
}

const R2_ENV = {
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'access',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'bucket',
};

describe('HealthService', () => {
  it('reports liveness without calling the AI provider', () => {
    const liveness = createHealthService().liveness;

    expect(liveness.status).toBe('ok');
    expect(liveness.environment).toBe('test');
    expect(liveness.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('is ready when the AI provider is configured and storage is optional', async () => {
    const result = await createHealthService().readiness();

    expect(result.status).toBe('ready');
    expect(result.checks).toEqual([
      expect.objectContaining({
        name: 'ai_provider',
        status: 'up',
        details: expect.objectContaining({
          paidCall: false,
          primaryModel: 'gemini-3.1-flash-lite',
        }),
      }),
      expect.objectContaining({ name: 'document_storage', status: 'unconfigured' }),
    ]);
  });

  it('is not ready when the AI provider is not configured', async () => {
    const config = createTestConfig({ GEMINI_API_KEY: 'x' });
    const service = new HealthService(
      config,
      { status: { ...new AiStatusService(config).status, configured: false } } as AiStatusService,
      createStorage(),
    );

    const result = await service.readiness();

    expect(result.status).toBe('not_ready');
    expect(result.checks[0].status).toBe('down');
  });

  it('probes storage only when enabled and caches the result', async () => {
    const probe = jest.fn(async () => undefined);
    const storage = createStorage({ isConfigured: () => true, probe });
    const service = createHealthService(storage, { ...R2_ENV, R2_READINESS_CHECK: 'true' });

    const first = await service.readiness();
    const second = await service.readiness();

    expect(first.status).toBe('ready');
    expect(second.checks[1].status).toBe('up');
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('reports not ready when the storage probe fails', async () => {
    const storage = createStorage({
      isConfigured: () => true,
      probe: jest.fn(async () => {
        throw new Error('access denied');
      }),
    });
    const service = createHealthService(storage, { ...R2_ENV, R2_READINESS_CHECK: 'true' });

    const result = await service.readiness();

    expect(result.status).toBe('not_ready');
    expect(result.checks[1]).toEqual(
      expect.objectContaining({
        status: 'down',
        details: expect.objectContaining({ reason: 'access denied' }),
      }),
    );
  });

  it('does not probe storage when it is configured but probing is disabled', async () => {
    const probe = jest.fn();
    const storage = createStorage({ isConfigured: () => true, probe });

    const result = await createHealthService(storage, R2_ENV).readiness();

    expect(result.checks[1]).toEqual(
      expect.objectContaining({
        status: 'up',
        details: expect.objectContaining({ probed: false }),
      }),
    );
    expect(probe).not.toHaveBeenCalled();
  });
});
