import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { RequestContextService } from '../../../../src/shared/logging/request-context';
import { IdempotencyService } from '../../../../src/modules/idempotency/application/idempotency.service';
import { InMemoryIdempotencyStore } from '../../../../src/modules/idempotency/infrastructure/in-memory-idempotency.store';
import { createSilentLogger, createTestConfig } from '../../../fixtures/config.fixture';

function createHarness(config: Record<string, unknown> = {}) {
  const requestContext = new RequestContextService();
  const service = new IdempotencyService(
    new InMemoryIdempotencyStore(),
    createTestConfig(config),
    requestContext,
    createSilentLogger(),
  );

  const run = <T>(
    callback: () => Promise<T>,
    options: { key?: string | null; consumerId?: string | null } = {},
  ) =>
    requestContext.run(
      {
        requestId: 'req_1',
        tenantId: 'tenant-a',
        consumerId: options.consumerId ?? 'key_1',
        method: 'POST',
        path: '/v1/ai/properties/extract',
        idempotencyKey: options.key ?? null,
        replayed: false,
        startedAt: Date.now(),
      },
      callback,
    );

  return { service, run };
}

describe('IdempotencyService', () => {
  it('always executes when no idempotency key is provided', async () => {
    const { service, run } = createHarness();
    const factory = jest.fn(async () => 'value');

    await run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory));
    await run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory));

    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('replays the stored result for the same key and payload', async () => {
    const { service, run } = createHarness();
    const factory = jest.fn(async () => ({ description: 'ok' }));

    const first = await run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory), {
      key: 'idem-1',
    });
    const second = await run(
      () => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory),
      { key: 'idem-1' },
    );

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.value).toEqual({ description: 'ok' });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('executes only once for concurrent duplicate requests', async () => {
    const { service, run } = createHarness();
    let resolveFactory: (value: string) => void = () => undefined;
    const factory = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFactory = resolve;
        }),
    );

    const first = run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory), {
      key: 'idem-2',
    });
    const second = run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory), {
      key: 'idem-2',
    });

    resolveFactory('done');

    await expect(first).resolves.toEqual({ value: 'done', replayed: false });
    await expect(second).resolves.toEqual({ value: 'done', replayed: true });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('rejects the same key used with a different payload', async () => {
    const { service, run } = createHarness();

    await run(() => service.execute({ scope: 'scope', fingerprint: 'fp-1' }, async () => 'first'), {
      key: 'idem-3',
    });

    await expect(
      run(() => service.execute({ scope: 'scope', fingerprint: 'fp-2' }, async () => 'second'), {
        key: 'idem-3',
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.IDEMPOTENCY_CONFLICT, status: 409 });
  });

  it('isolates idempotency keys per consumer', async () => {
    const { service, run } = createHarness();
    const factory = jest.fn(async () => 'value');

    await run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory), {
      key: 'shared-key',
      consumerId: 'key_a',
    });
    const other = await run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory), {
      key: 'shared-key',
      consumerId: 'key_b',
    });

    expect(other.replayed).toBe(false);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('clears the record when the operation fails so it can be retried', async () => {
    const { service, run } = createHarness();
    const failing = jest.fn(async () => {
      throw AppError.internal('first attempt failed');
    });

    await expect(
      run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, failing), { key: 'idem-4' }),
    ).rejects.toBeInstanceOf(AppError);

    const retry = jest.fn(async () => 'recovered');
    await expect(
      run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, retry), { key: 'idem-4' }),
    ).resolves.toEqual({ value: 'recovered', replayed: false });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('can be disabled by configuration', async () => {
    const { service, run } = createHarness({ IDEMPOTENCY_ENABLED: 'false' });
    const factory = jest.fn(async () => 'value');

    await run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory), {
      key: 'idem-5',
    });
    await run(() => service.execute({ scope: 'scope', fingerprint: 'fp' }, factory), {
      key: 'idem-5',
    });

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
