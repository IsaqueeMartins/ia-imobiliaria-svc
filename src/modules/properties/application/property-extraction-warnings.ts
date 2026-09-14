import { AiWarning } from '../../../shared/types/property-contracts';
import {
  AMBIGUOUS_CONFIDENCE,
  DEFAULT_CONFIDENCE,
  MAX_CONFIDENCE,
  MIN_CONFIDENCE,
  conflictingWarningCode,
} from '../../../shared/types/property-vocabulary';
import { normalizeWhitespace, truncate } from '../../../shared/utils/text';
import { ExtractionWarning } from '../domain/property-response.schema';

export const MAX_WARNING_MESSAGE_LENGTH = 300;
export const MAX_WARNING_FIELD_LENGTH = 60;
export const MAX_WARNING_PAGES = 20;

export function normalizePageReferences(
  pages: readonly number[],
  pageCount: number,
  index: number,
  warnings: ExtractionWarning[],
): number[] {
  const valid = new Set<number>();
  const invalid: number[] = [];

  for (const page of pages) {
    if (!Number.isInteger(page) || page < 1) {
      continue;
    }
    if (page <= pageCount) {
      valid.add(page);
    } else {
      invalid.push(page);
    }
  }

  if (invalid.length > 0) {
    const reportedPages = invalid.slice(0, MAX_WARNING_PAGES);
    warnings.push({
      code: 'OUT_OF_RANGE_PAGE',
      message: `The document has ${pageCount} page(s) but page references ${reportedPages.join(', ')} were returned.`,
      field: 'sourcePages',
      pages: reportedPages,
      propertyIndex: index,
    });
  }

  return [...valid].sort((left, right) => left - right);
}

export function mapModelWarnings(
  warnings: readonly AiWarning[],
  pageCount: number,
  index: number | null,
): ExtractionWarning[] {
  return warnings.map((warning) => ({
    code:
      warning.code === 'CONFLICTING_VALUE' && warning.field
        ? conflictingWarningCode(warning.field)
        : warning.code,
    message: truncate(normalizeWhitespace(warning.message), MAX_WARNING_MESSAGE_LENGTH),
    field: warning.field
      ? truncate(normalizeWhitespace(warning.field), MAX_WARNING_FIELD_LENGTH)
      : null,
    pages: [...new Set(warning.pages.filter((page) => page >= 1 && page <= pageCount))]
      .sort((left, right) => left - right)
      .slice(0, MAX_WARNING_PAGES),
    propertyIndex: index,
  }));
}

export function dedupeWarnings(warnings: readonly ExtractionWarning[]): ExtractionWarning[] {
  const seen = new Set<string>();
  const result: ExtractionWarning[] = [];

  for (const warning of warnings) {
    const key = `${warning.code}|${warning.field ?? ''}|${warning.pages.join(',')}|${warning.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(warning);
    }
  }

  return result;
}

export interface ConfidenceResult {
  readonly overall: number | null;
  readonly fields: Record<string, number>;
  readonly warnings: ExtractionWarning[];
}

export function buildConfidence(
  overall: number | null,
  normalized: Record<string, unknown>,
  features: readonly string[],
  warnings: readonly ExtractionWarning[],
  index: number,
): ConfidenceResult {
  const validOverall =
    typeof overall === 'number' &&
    Number.isFinite(overall) &&
    overall >= MIN_CONFIDENCE &&
    overall <= MAX_CONFIDENCE
      ? overall
      : null;
  const base = validOverall ?? DEFAULT_CONFIDENCE;
  const ambiguousFields = collectAmbiguousFields(warnings);
  const fields: Record<string, number> = {};

  const fieldValue = (field: string): number =>
    ambiguousFields.has(field.toLowerCase()) ? Math.min(base, AMBIGUOUS_CONFIDENCE) : base;

  for (const [field, value] of Object.entries(normalized)) {
    if (field !== 'description' && isPresentValue(value)) {
      fields[field] = fieldValue(field);
    }
  }

  if (features.length > 0) {
    fields.features = fieldValue('features');
  }

  const description = normalized.description;
  if (typeof description === 'string' && description.length > 0) {
    fields.description = fieldValue('description');
  }

  const confidenceWarnings: ExtractionWarning[] = [];
  if (validOverall === null && Object.keys(fields).length > 0) {
    confidenceWarnings.push({
      code: 'MISSING_FIELD_CONFIDENCE',
      message: 'The extraction did not report a confidence level for this property.',
      field: null,
      pages: [],
      propertyIndex: index,
    });
  }

  return { overall: validOverall, fields, warnings: confidenceWarnings };
}

function isPresentValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) => isPresentValue(entry));
  }
  return true;
}

function collectAmbiguousFields(warnings: readonly ExtractionWarning[]): Set<string> {
  const ambiguous = new Set<string>();

  for (const warning of warnings) {
    if (!warning.field) {
      continue;
    }
    const isAmbiguous =
      warning.code === 'AMBIGUOUS_VALUE' ||
      warning.code === 'INVALID_VALUE' ||
      warning.code.startsWith('CONFLICTING_');
    if (isAmbiguous) {
      ambiguous.add(warning.field.toLowerCase());
    }
  }

  return ambiguous;
}
