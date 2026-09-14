import { ApiError } from '@google/genai';
import { AppError } from '../../../../shared/errors/app-error';
import {
  aiInvalidResponseError,
  aiProviderError,
  aiRateLimitError,
  aiTimeoutError,
} from '../../domain/ai-errors';

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

const RETRYABLE_MESSAGE_PATTERN =
  /fetch failed|network|socket hang up|timeout|timed out|connection (closed|reset)|temporar/i;

function readStatus(error: unknown): number | null {
  if (error instanceof ApiError && typeof error.status === 'number') {
    return error.status;
  }
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

function readErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'unknown error';
}

function isAbortOrTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    /timeout|timed out|aborted/i.test(error.message)
  );
}

export function mapGeminiError(error: unknown, model: string): AppError {
  if (AppError.isAppError(error)) {
    return error;
  }

  const status = readStatus(error);
  if (status !== null) {
    if (status === 429) {
      return aiRateLimitError(`Gemini model ${model} rejected the request with HTTP 429.`, error);
    }
    if (status === 408 || status === 504) {
      return aiTimeoutError(`Gemini model ${model} timed out with HTTP ${status}.`, error);
    }
    if (status >= 500) {
      return aiProviderError(
        `Gemini model ${model} returned HTTP ${status}: ${readMessage(error)}`,
        true,
        error,
      );
    }
    return aiProviderError(
      `Gemini model ${model} returned HTTP ${status}: ${readMessage(error)}`,
      false,
      error,
    );
  }

  if (isAbortOrTimeout(error)) {
    return aiTimeoutError(`Gemini model ${model} did not respond in time.`, error);
  }

  const code = readErrorCode(error);
  if (
    (code !== null && RETRYABLE_NETWORK_CODES.has(code)) ||
    RETRYABLE_MESSAGE_PATTERN.test(readMessage(error))
  ) {
    return aiProviderError(
      `Transport failure while calling Gemini model ${model}: ${readMessage(error)}`,
      true,
      error,
    );
  }

  return aiProviderError(`Unexpected Gemini failure: ${readMessage(error)}`, false, error);
}

export function mapGeminiJsonError(model: string, cause: unknown): AppError {
  return aiInvalidResponseError(
    `Gemini model ${model} returned a response that is not valid JSON.`,
    cause,
  );
}

export function mapGeminiSchemaError(model: string, cause: unknown): AppError {
  return aiInvalidResponseError(
    `Gemini model ${model} returned a response that does not match the expected schema.`,
    cause,
  );
}

export function geminiEmptyResponseError(model: string, reason: string | null): AppError {
  return aiInvalidResponseError(
    `Gemini model ${model} returned an empty response${reason ? ` (${reason})` : ''}.`,
  );
}

export function geminiUploadFailedError(model: string, cause?: unknown): AppError {
  return aiProviderError(`Unable to upload the document to Gemini model ${model}.`, true, cause);
}

export function geminiUploadTimeoutError(model: string): AppError {
  return aiProviderError(
    `Gemini file processing did not complete in time for model ${model}.`,
    true,
  );
}
