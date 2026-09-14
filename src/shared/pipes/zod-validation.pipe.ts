import { PipeTransform } from '@nestjs/common';
import { ZodError, ZodType } from 'zod';
import { AppError } from '../errors/app-error';

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export function formatZodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw AppError.validation({ issues: formatZodIssues(result.error) });
    }
    return result.data;
  }
}
