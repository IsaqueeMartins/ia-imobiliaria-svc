import { z } from 'zod';

export const extractPropertiesRequestSchema = z
  .object({
    tenantId: z.string().trim().min(1).max(128).optional(),
    documentId: z.string().trim().min(1).max(128).optional(),
    objectKey: z.string().trim().min(1).max(1024).optional(),
  })
  .strict();

export type ExtractPropertiesRequest = z.infer<typeof extractPropertiesRequestSchema>;
