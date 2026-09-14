import { z } from 'zod';

export const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
