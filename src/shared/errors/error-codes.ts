export const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  DOCUMENT_TOO_LARGE: 'DOCUMENT_TOO_LARGE',
  UNSUPPORTED_DOCUMENT: 'UNSUPPORTED_DOCUMENT',
  STORAGE_ERROR: 'STORAGE_ERROR',
  STORAGE_NOT_CONFIGURED: 'STORAGE_NOT_CONFIGURED',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_EXTRACTION_FAILED: 'AI_EXTRACTION_FAILED',
  AI_DESCRIPTION_FAILED: 'AI_DESCRIPTION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_REQUEST: 'The request payload is invalid.',
  UNAUTHORIZED: 'Missing or invalid consumer credentials.',
  FORBIDDEN: 'The consumer is not allowed to use the requested tenant context.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'The request payload failed validation.',
  DOCUMENT_NOT_FOUND: 'The referenced document was not found in the storage provider.',
  DOCUMENT_TOO_LARGE: 'The document exceeds the configured limits.',
  UNSUPPORTED_DOCUMENT: 'The uploaded document is not a supported PDF file.',
  STORAGE_ERROR: 'The document storage provider is unavailable.',
  STORAGE_NOT_CONFIGURED: 'Document storage is not configured on this deployment.',
  AI_PROVIDER_ERROR: 'The AI provider returned an unexpected error.',
  AI_TIMEOUT: 'The AI provider did not respond within the configured timeout.',
  AI_RATE_LIMIT: 'The AI provider rate limit was reached. Try again later.',
  AI_INVALID_RESPONSE: 'The AI provider returned a response that failed schema validation.',
  AI_EXTRACTION_FAILED: 'Unable to extract properties from document.',
  AI_DESCRIPTION_FAILED: 'Unable to generate a description for the provided property.',
  RATE_LIMIT_EXCEEDED: 'Too many requests for this consumer. Try again later.',
  IDEMPOTENCY_CONFLICT: 'The idempotency key was already used with a different payload.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
};

export interface ErrorWarningDetail {
  readonly code: string;
  readonly message: string;
  readonly pages?: readonly number[];
  readonly field?: string | null;
  readonly propertyIndex?: number | null;
}
