import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { RetryPolicy } from '../../../../src/shared/resilience/retry-policy';
import { createTestConfig } from '../../../fixtures/config.fixture';

describe('RetryPolicy', () => {
  const createPolicy = (maxRetries = 2) =>
    new RetryPolicy(
      createTestConfig({
        AI_MAX_RETRIES: String(maxRetries),
        AI_RETRY_BASE_DELAY_MS: '5',
        AI_RETRY_MAX_DELAY_MS: '10',
      }),
      async () => undefined,
    );

  it('retries retryable failures and returns the successful result', async () => {
    const policy = createPolicy();
    const task = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(
        new AppError({ code: ERROR_CODES.AI_PROVIDER_ERROR, status: 502, retryable: true }),
      )
      .mockResolvedValue('done');
    const onRetry = jest.fn();

    await expect(policy.execute(task, onRetry)).resolves.toBe('done');
    expect(task).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(AppError), 0, expect.any(Number));
  });

  it('stops after the configured number of attempts', async () => {
    const policy = createPolicy(1);
    const task = jest.fn(async () => {
      throw new AppError({ code: ERROR_CODES.AI_TIMEOUT, status: 504, retryable: true });
    });

    await expect(policy.execute(task)).rejects.toBeInstanceOf(AppError);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('does not retry non retryable errors', async () => {
    const policy = createPolicy();
    const task = jest.fn(async () => {
      throw new AppError({ code: ERROR_CODES.INVALID_REQUEST, status: 400 });
    });

    await expect(policy.execute(task)).rejects.toBeInstanceOf(AppError);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('does not retry unknown errors', async () => {
    const policy = createPolicy();
    const task = jest.fn(async () => {
      throw new Error('unexpected');
    });

    await expect(policy.execute(task)).rejects.toThrow('unexpected');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('caps the exponential backoff delay', () => {
    const policy = createPolicy(5);

    expect(policy.nextDelayMs(0)).toBeLessThanOrEqual(5);
    expect(policy.nextDelayMs(3)).toBeLessThanOrEqual(10);
    expect(policy.nextDelayMs(10)).toBeLessThanOrEqual(10);
  });
});
