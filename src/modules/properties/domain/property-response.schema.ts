import { z } from 'zod';
import { PROPERTY_TYPES, TRANSACTIONS } from '../../../shared/types/property-vocabulary';

export const extractionWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string().nullable(),
  pages: z.array(z.number().int()),
  propertyIndex: z.number().int().nullable(),
});

export const propertyLocationResponseSchema = z.object({
  address: z.string().nullable(),
  number: z.string().nullable(),
  complement: z.string().nullable(),
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
});

export const propertyConfidenceSchema = z.object({
  overall: z.number().nullable(),
  fields: z.record(z.string(), z.number()),
});

export const normalizedPropertySchema = z.object({
  title: z.string().nullable(),
  type: z.enum(PROPERTY_TYPES).nullable(),
  transaction: z.enum(TRANSACTIONS).nullable(),
  price: z.number().nullable(),
  rentalPrice: z.number().nullable(),
  condominiumFee: z.number().nullable(),
  iptu: z.number().nullable(),
  area: z.number().nullable(),
  privateArea: z.number().nullable(),
  builtArea: z.number().nullable(),
  totalArea: z.number().nullable(),
  bedrooms: z.number().int().nullable(),
  suites: z.number().int().nullable(),
  bathrooms: z.number().int().nullable(),
  parkingSpaces: z.number().int().nullable(),
  location: propertyLocationResponseSchema,
  features: z.array(z.string()),
  description: z.string().nullable(),
  confidence: propertyConfidenceSchema,
  source: z.object({ pages: z.array(z.number().int()) }),
  warnings: z.array(extractionWarningSchema),
});

export const aiUsageResponseSchema = z.object({
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  totalTokens: z.number().nullable(),
  durationMs: z.number().int(),
});

export const extractedDocumentSchema = z.object({
  id: z.string(),
  pages: z.number().int(),
  sizeBytes: z.number().int(),
  source: z.enum(['upload', 'storage']),
  filename: z.string().nullable(),
  tenantId: z.string().nullable(),
  documentId: z.string().nullable(),
  objectKey: z.string().nullable(),
});

export const extractPropertiesResponseSchema = z.object({
  requestId: z.string(),
  document: extractedDocumentSchema,
  properties: z.array(normalizedPropertySchema),
  warnings: z.array(extractionWarningSchema),
  errors: z.array(extractionWarningSchema),
  usage: aiUsageResponseSchema,
});

export const propertyDescriptionResponseSchema = z.object({
  description: z.string(),
});

export type ExtractionWarning = z.infer<typeof extractionWarningSchema>;
export type NormalizedProperty = z.infer<typeof normalizedPropertySchema>;
export type ExtractPropertiesResponse = z.infer<typeof extractPropertiesResponseSchema>;
export type PropertyDescriptionResponse = z.infer<typeof propertyDescriptionResponseSchema>;
export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
