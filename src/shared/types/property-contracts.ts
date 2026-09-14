import { z } from 'zod';
import { parseDecimalNumber, parseInteger } from '../utils/number-parser';
import {
  AI_WARNING_CODES,
  DESCRIPTION_STYLES,
  PROPERTY_TYPES,
  TRANSACTIONS,
} from './property-vocabulary';

export const propertyTypeSchema = z.enum(PROPERTY_TYPES);
export const transactionSchema = z.enum(TRANSACTIONS);
export const descriptionStyleSchema = z.enum(DESCRIPTION_STYLES);

export const numericInputSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = parseDecimalNumber(value);
  if (parsed === null || parsed < 0) {
    ctx.addIssue({ code: 'custom', message: 'Expected a non-negative numeric value.' });
    return z.NEVER;
  }
  return parsed;
});

export const integerInputSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 0) {
    ctx.addIssue({ code: 'custom', message: 'Expected a non-negative integer value.' });
    return z.NEVER;
  }
  return parsed;
});

const pageNumberSchema = z.number().int().min(1).max(1000);

export const aiWarningSchema = z.object({
  code: z.enum(AI_WARNING_CODES),
  message: z.string().min(1).max(300),
  field: z.string().max(60).nullable(),
  pages: z.array(pageNumberSchema).max(50),
});

export const aiPropertyLocationSchema = z.object({
  address: z.string().max(300).nullable(),
  number: z.string().max(30).nullable(),
  complement: z.string().max(120).nullable(),
  neighborhood: z.string().max(120).nullable(),
  city: z.string().max(120).nullable(),
  state: z.string().max(60).nullable(),
  zipCode: z.string().max(20).nullable(),
});

export const aiExtractedPropertySchema = z.object({
  title: z.string().max(300).nullable(),
  type: propertyTypeSchema.nullable(),
  transaction: transactionSchema.nullable(),
  price: z.number().min(0).nullable(),
  rentalPrice: z.number().min(0).nullable(),
  condominiumFee: z.number().min(0).nullable(),
  iptu: z.number().min(0).nullable(),
  area: z.number().min(0).nullable(),
  privateArea: z.number().min(0).nullable(),
  builtArea: z.number().min(0).nullable(),
  totalArea: z.number().min(0).nullable(),
  bedrooms: z.number().int().min(0).max(50).nullable(),
  suites: z.number().int().min(0).max(50).nullable(),
  bathrooms: z.number().int().min(0).max(50).nullable(),
  parkingSpaces: z.number().int().min(0).max(100).nullable(),
  location: aiPropertyLocationSchema.nullable(),
  features: z.array(z.string().max(120)).max(60),
  description: z.string().max(4000).nullable(),
  sourcePages: z.array(pageNumberSchema).max(200),
  confidence: z.number().min(0).max(1).nullable(),
  warnings: z.array(aiWarningSchema).max(20),
});

export const aiExtractionResponseSchema = z.object({
  properties: z.array(aiExtractedPropertySchema),
  warnings: z.array(aiWarningSchema).max(20),
});

export const aiDescriptionResponseSchema = z.object({
  description: z.string().min(1).max(6000),
});

const nullableText = (maxLength: number) => z.string().trim().max(maxLength).nullable().optional();

export const propertyDescriptionPayloadSchema = z
  .object({
    title: nullableText(300),
    type: propertyTypeSchema.nullable().optional(),
    transaction: transactionSchema.nullable().optional(),
    price: numericInputSchema.nullable().optional(),
    rentalPrice: numericInputSchema.nullable().optional(),
    condominiumFee: numericInputSchema.nullable().optional(),
    iptu: numericInputSchema.nullable().optional(),
    area: numericInputSchema.nullable().optional(),
    privateArea: numericInputSchema.nullable().optional(),
    builtArea: numericInputSchema.nullable().optional(),
    totalArea: numericInputSchema.nullable().optional(),
    bedrooms: integerInputSchema.nullable().optional(),
    suites: integerInputSchema.nullable().optional(),
    bathrooms: integerInputSchema.nullable().optional(),
    parkingSpaces: integerInputSchema.nullable().optional(),
    address: nullableText(300),
    number: nullableText(30),
    complement: nullableText(120),
    neighborhood: nullableText(120),
    city: nullableText(120),
    state: nullableText(120),
    zipCode: nullableText(20),
    location: aiPropertyLocationSchema.partial().strict().nullable().optional(),
    features: z.array(z.string().trim().min(1).max(120)).max(60).optional(),
    description: nullableText(4000),
  })
  .strict()
  .refine((payload) => hasMeaningfulPropertyData(payload), {
    message: 'The property payload must contain at least one non-empty field.',
  });

export const propertyDescriptionRequestSchema = z
  .object({
    property: propertyDescriptionPayloadSchema,
    style: descriptionStyleSchema.default('professional'),
  })
  .strict();

export type AiWarning = z.infer<typeof aiWarningSchema>;
export type AiExtractedProperty = z.infer<typeof aiExtractedPropertySchema>;
export type AiPropertyLocation = z.infer<typeof aiPropertyLocationSchema>;
export type AiExtractionResponse = z.infer<typeof aiExtractionResponseSchema>;
export type AiDescriptionResponse = z.infer<typeof aiDescriptionResponseSchema>;
export type PropertyDescriptionPayload = z.infer<typeof propertyDescriptionPayloadSchema>;
export type PropertyDescriptionRequest = z.infer<typeof propertyDescriptionRequestSchema>;

function isMeaningfulValue(value: unknown): boolean {
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
    return Object.values(value as Record<string, unknown>).some((entry) =>
      isMeaningfulValue(entry),
    );
  }
  return true;
}

export function hasMeaningfulPropertyData(payload: Record<string, unknown>): boolean {
  return Object.values(payload).some((value) => isMeaningfulValue(value));
}
