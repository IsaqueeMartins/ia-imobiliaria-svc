import { z } from 'zod';
import { AppError } from '../../../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { ZodValidationPipe } from '../../../../src/shared/pipes/zod-validation.pipe';

const schema = z.object({
  name: z.string().min(1),
  count: z.coerce.number().int().min(1),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value', () => {
    expect(pipe.transform({ name: 'ok', count: '3' })).toEqual({ name: 'ok', count: 3 });
  });

  it('treats a missing body as an empty object', () => {
    expect(() => pipe.transform(undefined)).toThrow(AppError);
  });

  it('throws a predictable validation error with issues', () => {
    try {
      pipe.transform({ name: '', count: 'abc' });
      throw new Error('expected the pipe to throw');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(appError.status).toBe(400);
      const issues = (appError.details as { issues: Array<{ path: string }> }).issues;
      expect(issues.map((issue) => issue.path).sort()).toEqual(['count', 'name']);
    }
  });
});
