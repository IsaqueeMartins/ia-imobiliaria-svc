import { ApiError } from '@google/genai';
import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import {
  geminiEmptyResponseError,
  mapGeminiError,
  mapGeminiJsonError,
  mapGeminiSchemaError,
} from '../../../../src/modules/ai/infrastructure/gemini/gemini-error.mapper';

describe('mapGeminiError', () => {
  it('keeps application errors untouched', () => {
    const error = mapGeminiJsonError('gemini-3.1-flash-lite', new SyntaxError('bad json'));

    expect(mapGeminiError(error, 'gemini-3.1-flash-lite')).toBe(error);
  });

  it('maps 429 to a retryable rate limit error', () => {
    const mapped = mapGeminiError(
      new ApiError({ message: 'rate limited', status: 429 }),
      'gemini-3.1-flash-lite',
    );

    expect(mapped.code).toBe(ERROR_CODES.AI_RATE_LIMIT);
    expect(mapped.status).toBe(429);
    expect(mapped.retryable).toBe(true);
  });

  it('maps 5xx to a retryable provider error', () => {
    const mapped = mapGeminiError(new ApiError({ message: 'boom', status: 503 }), 'model');

    expect(mapped.code).toBe(ERROR_CODES.AI_PROVIDER_ERROR);
    expect(mapped.retryable).toBe(true);
  });

  it('maps 4xx to a non retryable provider error', () => {
    const mapped = mapGeminiError(
      new ApiError({ message: 'invalid schema', status: 400 }),
      'model',
    );

    expect(mapped.code).toBe(ERROR_CODES.AI_PROVIDER_ERROR);
    expect(mapped.retryable).toBe(false);
    expect(mapped.message).toContain('invalid schema');
  });

  it('maps aborts and timeouts', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';

    expect(mapGeminiError(abort, 'model').code).toBe(ERROR_CODES.AI_TIMEOUT);
    expect(
      mapGeminiError(new ApiError({ message: 'gateway timeout', status: 504 }), 'model').code,
    ).toBe(ERROR_CODES.AI_TIMEOUT);
  });

  it('maps transport failures as retryable', () => {
    const networkError = new Error('fetch failed');
    (networkError as Error & { code?: string }).code = 'ECONNRESET';

    const mapped = mapGeminiError(networkError, 'model');

    expect(mapped.code).toBe(ERROR_CODES.AI_PROVIDER_ERROR);
    expect(mapped.retryable).toBe(true);
  });

  it('maps unexpected failures as non retryable', () => {
    const mapped = mapGeminiError(new Error('weird'), 'model');

    expect(mapped.retryable).toBe(false);
    expect(mapped).toBeInstanceOf(AppError);
  });

  it('maps invalid provider payloads to AI_INVALID_RESPONSE', () => {
    expect(mapGeminiJsonError('model', new Error('x')).code).toBe(ERROR_CODES.AI_INVALID_RESPONSE);
    expect(mapGeminiSchemaError('model', new Error('x')).code).toBe(
      ERROR_CODES.AI_INVALID_RESPONSE,
    );
    expect(geminiEmptyResponseError('model', 'finishReason:SAFETY').retryable).toBe(true);
    expect(geminiEmptyResponseError('model', null).message).toContain('empty response');
  });
});
