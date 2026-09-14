import {
  PROPERTY_TYPES,
  PropertyType,
  TRANSACTIONS,
  Transaction,
  normalizePropertyTypeLabel,
  normalizeStateCode,
  normalizeTransactionLabel,
  normalizeZipCode,
} from '../../../shared/types/property-vocabulary';
import {
  dedupePreservingOrder,
  emptyToNull,
  normalizeWhitespace,
  sanitizeFeatureLabel,
  truncate,
} from '../../../shared/utils/text';
import { ExtractionWarning } from '../domain/property-response.schema';

export const MAX_TITLE_LENGTH = 300;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_FEATURES = 60;

export interface FieldContext {
  readonly index: number;
  readonly warnings: ExtractionWarning[];
}

export function textValue(value: string | null, maxLength = MAX_TITLE_LENGTH): string | null {
  const normalized = emptyToNull(value);
  return normalized === null ? null : truncate(normalized, maxLength);
}

export function stateValue(value: string | null): string | null {
  const normalized = emptyToNull(value);
  if (normalized === null) {
    return null;
  }
  return normalizeStateCode(normalized) ?? normalized;
}

export function zipCodeValue(value: string | null): string | null {
  const normalized = emptyToNull(value);
  if (normalized === null) {
    return null;
  }
  return normalizeZipCode(normalized) ?? normalized;
}

export function featureValues(values: readonly string[]): string[] {
  const sanitized = values
    .map((value) => sanitizeFeatureLabel(value))
    .filter((value): value is string => value !== null);
  return dedupePreservingOrder(sanitized).slice(0, MAX_FEATURES);
}

export function typeValue(value: unknown, context: FieldContext): PropertyType | null {
  const raw = typeof value === 'string' ? normalizeWhitespace(value) : '';
  if (raw.length === 0) {
    return null;
  }
  if ((PROPERTY_TYPES as readonly string[]).includes(raw)) {
    return raw as PropertyType;
  }
  const mapped = normalizePropertyTypeLabel(raw);
  if (mapped) {
    return mapped;
  }
  context.warnings.push({
    code: 'UNMAPPED_VALUE',
    message: `The property type "${truncate(raw, 60)}" could not be mapped to a known type.`,
    field: 'type',
    pages: [],
    propertyIndex: context.index,
  });
  return null;
}

export function transactionValue(value: unknown, context: FieldContext): Transaction | null {
  const raw = typeof value === 'string' ? normalizeWhitespace(value) : '';
  if (raw.length === 0) {
    return null;
  }
  if ((TRANSACTIONS as readonly string[]).includes(raw)) {
    return raw as Transaction;
  }
  const mapped = normalizeTransactionLabel(raw);
  if (mapped) {
    return mapped;
  }
  context.warnings.push({
    code: 'UNMAPPED_VALUE',
    message: `The transaction "${truncate(raw, 60)}" could not be mapped to sale or rent.`,
    field: 'transaction',
    pages: [],
    propertyIndex: context.index,
  });
  return null;
}

export function nonNegativeNumberValue(
  value: number | null,
  field: string,
  context: FieldContext,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    context.warnings.push({
      code: 'INVALID_VALUE',
      message: `The value found for "${field}" is not a valid non-negative number.`,
      field,
      pages: [],
      propertyIndex: context.index,
    });
    return null;
  }
  return value;
}

export function countValue(
  value: number | null,
  field: string,
  context: FieldContext,
): number | null {
  const parsed = nonNegativeNumberValue(value, field, context);
  if (parsed === null) {
    return null;
  }
  const rounded = Math.round(parsed);
  if (Math.abs(parsed - rounded) > 0.001) {
    context.warnings.push({
      code: 'INVALID_VALUE',
      message: `The value found for "${field}" was not an integer and was rounded.`,
      field,
      pages: [],
      propertyIndex: context.index,
    });
  }
  return rounded;
}
