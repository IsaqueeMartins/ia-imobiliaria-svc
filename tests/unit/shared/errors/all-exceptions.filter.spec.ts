import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { AllExceptionsFilter } from '../../../../src/shared/errors/all-exceptions.filter';
import { RequestContextService } from '../../../../src/shared/logging/request-context';
import { MulterError } from 'multer';
import { createSilentLogger } from '../../../fixtures/config.fixture';

interface CapturedResponse {
  statusCode: number | null;
  body: Record<string, unknown> | null;
}

function createHost(
  request: Record<string, unknown> = { method: 'POST', url: '/v1/ai/properties/extract' },
) {
  const captured: CapturedResponse = { statusCode: null, body: null };
  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };

  return { host, captured };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter(createSilentLogger(), new RequestContextService());

  it('maps AppError to the documented error contract', () => {
    const { host, captured } = createHost({ requestId: 'req_test' });

    filter.catch(
      new AppError({
        code: ERROR_CODES.AI_EXTRACTION_FAILED,
        status: 422,
        details: { pages: 3 },
      }),
      host as never,
    );

    expect(captured.statusCode).toBe(422);
    expect(captured.body).toEqual({
      statusCode: 422,
      code: 'AI_EXTRACTION_FAILED',
      message: 'Unable to extract properties from document.',
      requestId: 'req_test',
      details: { pages: 3 },
    });
  });

  it('never exposes internal messages of 5xx errors', () => {
    const { host, captured } = createHost({});

    filter.catch(
      new AppError({
        code: ERROR_CODES.AI_PROVIDER_ERROR,
        status: 502,
        message: 'Gemini model returned HTTP 500: internal quota project abc',
      }),
      host as never,
    );

    expect(captured.body?.message).toBe('The AI provider returned an unexpected error.');
    expect(JSON.stringify(captured.body)).not.toContain('quota project');
  });

  it('maps multer file size errors to DOCUMENT_TOO_LARGE', () => {
    const { host, captured } = createHost({});

    filter.catch(new MulterError('LIMIT_FILE_SIZE', 'file'), host as never);

    expect(captured.statusCode).toBe(413);
    expect(captured.body?.code).toBe('DOCUMENT_TOO_LARGE');
  });

  it('maps unknown errors to a generic internal error without stack traces', () => {
    const { host, captured } = createHost({});

    filter.catch(new Error('database credentials leaked'), host as never);

    expect(captured.statusCode).toBe(500);
    expect(captured.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: expect.any(String),
    });
  });

  it('generates a request id when the request has none', () => {
    const { host, captured } = createHost({});

    filter.catch(AppError.unauthorized(), host as never);

    expect(captured.statusCode).toBe(401);
    expect(String(captured.body?.requestId)).toMatch(/^req_/);
  });
});
